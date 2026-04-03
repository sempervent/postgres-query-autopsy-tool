using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace PostgresQueryAutopsyTool.Core.Parsing;

/// <summary>
/// Normalizes pasted PostgreSQL client output (e.g. psql) into JSON text for <see cref="PostgresJsonExplainParser"/>.
/// Conservative: does not attempt full terminal emulation; targets <c>QUERY PLAN</c> tables and <c>+</c> line wraps.
/// </summary>
public static class PlanInputNormalizer
{
    private static readonly Regex RowsFooter = new(
        @"^\s*\(\d+\s+rows?\)\s*$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    /// <summary>Try to produce JSON text suitable for <see cref="JsonDocument.Parse(string)"/>.</summary>
    public static PlanInputNormalizeResult TryNormalizeToJson(string rawInput)
    {
        if (string.IsNullOrWhiteSpace(rawInput))
            return PlanInputNormalizeResult.Fail("Plan input is empty.", "Paste EXPLAIN JSON or psql QUERY PLAN output.");

        var trimmed = rawInput.Trim();

        // A. Already JSON
        if (trimmed.Length > 0 && (trimmed[0] == '{' || trimmed[0] == '['))
        {
            try
            {
                using var _ = JsonDocument.Parse(trimmed);
                return PlanInputNormalizeResult.Ok(trimmed, new PlanInputNormalizationInfo("rawJson", "Parsed raw JSON directly."));
            }
            catch (JsonException ex)
            {
                return PlanInputNormalizeResult.Fail(
                    $"Invalid JSON: {ex.Message}",
                    "Fix JSON syntax, paste only the plan array/object, or paste full psql QUERY PLAN output.");
            }
        }

        // B. psql-style QUERY PLAN table
        var lines = rawInput.Replace("\r\n", "\n", StringComparison.Ordinal).Split('\n');
        var headerIdx = -1;
        for (var i = 0; i < lines.Length; i++)
        {
            var t = lines[i].Trim();
            var isHeader = t.Equals("QUERY PLAN", StringComparison.OrdinalIgnoreCase) ||
                           (t.StartsWith("QUERY PLAN", StringComparison.OrdinalIgnoreCase) &&
                            (t.Length == 10 || (t.Length > 10 && char.IsWhiteSpace(t[10]))));
            if (isHeader)
            {
                headerIdx = i;
                break;
            }
        }

        if (headerIdx < 0)
        {
            return PlanInputNormalizeResult.Fail(
                "Input is not valid JSON and does not start with a QUERY PLAN header.",
                "Paste raw EXPLAIN (FORMAT JSON) output, or copy the full psql table including the QUERY PLAN header.");
        }

        var bodyLines = new List<string>();
        var i0 = headerIdx + 1;
        for (; i0 < lines.Length; i0++)
        {
            var line = lines[i0];
            if (string.IsNullOrWhiteSpace(line))
                continue;
            if (IsTableSeparatorLine(line))
                continue;
            if (RowsFooter.IsMatch(line.Trim()))
                break;
            bodyLines.Add(line);
        }

        if (bodyLines.Count == 0)
        {
            return PlanInputNormalizeResult.Fail(
                "Found QUERY PLAN header but no plan body rows before the table footer.",
                "Ensure the JSON cell content was copied; try \\x off or widen terminal, then copy again.");
        }

        var reconstructed = ReconstructFromWrappedLines(bodyLines);
        var jsonish = reconstructed.Trim();
        if (jsonish.Length == 0)
            return PlanInputNormalizeResult.Fail(
                "After removing the QUERY PLAN wrapper, the reconstructed text was empty.",
                "Try copying the JSON portion only, or use the suggested EXPLAIN command to capture cleaner output.");

        try
        {
            using var _ = JsonDocument.Parse(jsonish);
            return PlanInputNormalizeResult.Ok(
                jsonish,
                new PlanInputNormalizationInfo(
                    "queryPlanTable",
                    "Normalized pasted QUERY PLAN output (header, separators, and + line wraps removed)."));
        }
        catch (JsonException ex)
        {
            return PlanInputNormalizeResult.Fail(
                $"The pasted text looked like PostgreSQL tabular output, but the JSON body could not be reconstructed. {ex.Message}",
                "Try copying the JSON cell contents directly or use the suggested EXPLAIN command.");
        }
    }

    private static bool IsTableSeparatorLine(string line)
    {
        var s = line.Trim();
        if (s.Length < 2)
            return false;
        // dashed rules, box-drawing, mostly punctuation
        var allSep = true;
        foreach (var c in s)
        {
            if (c is not ('-' or '+' or '|' or ' ' or ':' or '.'))
            {
                allSep = false;
                break;
            }
        }

        return allSep;
    }

    /// <summary>Strip optional leading/trailing <c>|</c> used by psql aligned output.</summary>
    private static string StripCellBorders(string line)
    {
        var s = line.Trim();
        if (s.Length == 0)
            return s;
        if (s[0] == '|')
            s = s[1..].TrimStart();
        if (s.Length > 0 && s[^1] == '|')
            s = s[..^1].TrimEnd();
        return s.Trim();
    }

    /// <summary>
    /// Join lines where a physical line ends with <c>+</c> as psql wrap continuation (artifact), not part of JSON.
    /// Plus signs inside JSON strings that end a physical line are ambiguous; we only strip trailing <c>+</c> after trim.
    /// </summary>
    private static string ReconstructFromWrappedLines(IReadOnlyList<string> bodyLines)
    {
        var sb = new StringBuilder();
        foreach (var raw in bodyLines)
        {
            var cell = StripCellBorders(raw);
            if (cell.Length == 0)
                continue;
            var t = cell.TrimEnd();
            if (t.Length == 0)
                continue;
            if (t.EndsWith("+", StringComparison.Ordinal))
            {
                var withoutPlus = t[..^1].TrimEnd();
                sb.Append(withoutPlus);
            }
            else
                sb.Append(cell.Trim());
        }

        return sb.ToString();
    }
}
