using System.Collections.Generic;
using System.Net;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Reporting;

/// <summary>Shared markdown fragments for EXPLAIN / planner-cost capture (Analyze + Compare).</summary>
public static class PlanCaptureMarkdownFormatter
{
    public static string PlannerCostsShortLabel(PlannerCostPresence p) => p switch
    {
        PlannerCostPresence.Present => "present",
        PlannerCostPresence.NotDetected => "not detected (often COSTS OFF or stripped JSON)",
        PlannerCostPresence.Mixed => "mixed across nodes",
        _ => "unknown"
    };

    public static string FormatCaptureSectionMarkdown(PlanAnalysisResult analysis)
    {
        var lines = new List<string>
        {
            $"- **Planner costs (detected from JSON):** {PlannerCostsShortLabel(analysis.Summary.PlannerCosts)}"
        };

        if (analysis.ExplainMetadata is null)
            return string.Join("\n", lines);

        var em = analysis.ExplainMetadata;
        if (!string.IsNullOrWhiteSpace(em.SourceExplainCommand))
        {
            var safeCmd = em.SourceExplainCommand.Trim().Replace("```", "'''");
            lines.Add($"- **Declared EXPLAIN command:**\n\n```text\n{safeCmd}\n```");
        }

        if (em.Options is not null)
        {
            var declared = FormatDeclaredExplainOptionsLine(em.Options);
            if (declared.Length > 0)
                lines.Add($"- **Declared options (client):** {declared}");
        }

        return string.Join("\n", lines);
    }

    public static string FormatDeclaredExplainOptionsLine(ExplainOptions o)
    {
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(o.Format))
            parts.Add($"FORMAT {o.Format.Trim()}");
        if (o.Analyze == true) parts.Add("ANALYZE");
        if (o.Verbose == true) parts.Add("VERBOSE");
        if (o.Buffers == true) parts.Add("BUFFERS");
        if (o.Costs == true) parts.Add("COSTS on");
        if (o.Costs == false) parts.Add("COSTS off");
        if (o.Settings == true) parts.Add("SETTINGS");
        if (o.Wal == true) parts.Add("WAL");
        if (o.Timing == true) parts.Add("TIMING");
        if (o.Summary == true) parts.Add("SUMMARY");
        if (o.Jit == true) parts.Add("JIT");
        return string.Join(", ", parts);
    }

    public static string FormatCaptureSectionHtml(PlanAnalysisResult analysis)
    {
        if (analysis.ExplainMetadata is null)
            return "";

        var blocks = new List<string>();
        if (!string.IsNullOrWhiteSpace(analysis.ExplainMetadata.SourceExplainCommand))
        {
            blocks.Add(
                $"<p><b>Declared EXPLAIN command</b></p><pre style=\"white-space:pre-wrap\">{System.Net.WebUtility.HtmlEncode(analysis.ExplainMetadata.SourceExplainCommand.Trim())}</pre>");
        }

        if (analysis.ExplainMetadata.Options is not null)
        {
            var line = FormatDeclaredExplainOptionsLine(analysis.ExplainMetadata.Options);
            if (line.Length > 0)
                blocks.Add($"<p><b>Declared options</b> {System.Net.WebUtility.HtmlEncode(line)}</p>");
        }

        return blocks.Count == 0 ? "" : "<h2>EXPLAIN capture (declared)</h2>" + string.Join("", blocks);
    }

    public static string FormatSideHeaderMarkdown(string sideLabel, PlanAnalysisResult plan)
    {
        var norm = plan.PlanInputNormalization;
        var normLine = norm is null
            ? "- **Input normalization:** (legacy JSON body or not recorded)"
            : $"- **Input normalization:** `{norm.Kind}`{(string.IsNullOrWhiteSpace(norm.Detail) ? "" : $" — {norm.Detail}")}";
        var queryLine = string.IsNullOrWhiteSpace(plan.QueryText)
            ? "- **Source query:** not provided"
            : "- **Source query:** provided (see compare narrative / plan detail exports as needed)";
        return $@"### {sideLabel}
{queryLine}
{normLine}

{FormatCaptureSectionMarkdown(plan)}";
    }

    /// <summary>Phase 88: per-side plan capture block for compare HTML export (parity with markdown headers).</summary>
    public static string FormatSideHeaderHtml(string sideLabel, PlanAnalysisResult plan)
    {
        var norm = plan.PlanInputNormalization;
        var normText = norm is null
            ? "(legacy JSON body or not recorded)"
            : $"{WebUtility.HtmlEncode(norm.Kind.ToString())}{(string.IsNullOrWhiteSpace(norm.Detail) ? "" : $" — {WebUtility.HtmlEncode(norm.Detail)}")}";
        var qt = string.IsNullOrWhiteSpace(plan.QueryText) ? "not provided" : "provided";
        var parts = new List<string>
        {
            $"<li><b>Source query:</b> {qt}</li>",
            $"<li><b>Input normalization:</b> {normText}</li>",
            $"<li><b>Planner costs (detected from JSON):</b> {WebUtility.HtmlEncode(PlannerCostsShortLabel(plan.Summary.PlannerCosts))}</li>"
        };

        var em = plan.ExplainMetadata;
        if (em is not null)
        {
            if (!string.IsNullOrWhiteSpace(em.SourceExplainCommand))
            {
                parts.Add(
                    "<li><b>Recorded EXPLAIN command</b><pre style=\"white-space:pre-wrap;margin:0.35rem 0 0\">" +
                    WebUtility.HtmlEncode(em.SourceExplainCommand.Trim()) + "</pre></li>");
            }

            if (em.Options is not null)
            {
                var dl = FormatDeclaredExplainOptionsLine(em.Options);
                if (dl.Length > 0)
                    parts.Add($"<li><b>Declared options (client):</b> {WebUtility.HtmlEncode(dl)}</li>");
            }
        }

        return $"<div style=\"margin-bottom:1.25rem\"><h3>{WebUtility.HtmlEncode(sideLabel)}</h3><ul style=\"margin:0.25rem 0 0 1rem;padding-left:0.5rem\">{string.Join("", parts)}</ul></div>";
    }
}
