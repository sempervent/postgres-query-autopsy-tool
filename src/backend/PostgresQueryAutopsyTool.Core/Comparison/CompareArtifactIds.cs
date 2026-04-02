using System.Security.Cryptography;
using System.Text;
using PostgresQueryAutopsyTool.Core.Analysis;

namespace PostgresQueryAutopsyTool.Core.Comparison;

/// <summary>
/// Deterministic, comparison-scoped artifact ids for shareable references (UI, reports, deep links).
/// </summary>
public static class CompareArtifactIds
{
    private const int HashChars = 12;

    /// <summary>Stable id for a finding diff row (order-independent identity within a comparison).</summary>
    public static string FindingDiff(string comparisonId, FindingDiffItem f)
    {
        var raw =
            $"{comparisonId}\u001e{f.RuleId}\u001e{f.ChangeType}\u001e{f.NodeIdA ?? ""}\u001e{f.NodeIdB ?? ""}\u001e{f.Title}\u001e{f.Summary}";
        return "fd_" + ShortHex(raw);
    }

    /// <summary>Stable id for an index insight diff row.</summary>
    public static string IndexInsightDiff(string comparisonId, IndexInsightDiffItem d)
    {
        var sigA = InsightFingerprint(d.InsightA);
        var sigB = InsightFingerprint(d.InsightB);
        var raw =
            $"{comparisonId}\u001e{d.Kind}\u001e{d.NodeIdA ?? ""}\u001e{d.NodeIdB ?? ""}\u001e{d.Summary}\u001e{d.AccessPathFamilyA ?? ""}\u001e{d.AccessPathFamilyB ?? ""}\u001e{sigA}\u001e{sigB}";
        return "ii_" + ShortHex(raw);
    }

    /// <summary>Stable id for a mapped node pair in a comparison.</summary>
    public static string PairId(string comparisonId, string nodeIdA, string nodeIdB)
    {
        var raw = $"{comparisonId}\u001e{nodeIdA}\u001e{nodeIdB}";
        return "pair_" + ShortHex(raw);
    }

    public static FindingsDiff AssignFindingDiffIds(string comparisonId, FindingsDiff diff) =>
        new(diff.Items.Select(f => f with { DiffId = FindingDiff(comparisonId, f) }).ToArray());

    public static IndexComparisonSummary AssignInsightDiffIds(string comparisonId, IndexComparisonSummary index) =>
        index with
        {
            InsightDiffs = index.InsightDiffs.Select(d => d with { InsightDiffId = IndexInsightDiff(comparisonId, d) }).ToArray()
        };

    private static string InsightFingerprint(PlanIndexInsight? i)
    {
        if (i is null) return "";
        var sk = string.Join(",", i.SignalKinds.OrderBy(s => s, StringComparer.Ordinal));
        return $"{i.NodeId}\u001f{i.AccessPathFamily}\u001f{i.RelationName ?? ""}\u001f{i.IndexName ?? ""}\u001f{sk}";
    }

    private static string ShortHex(string raw)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(hash.AsSpan(0, 6)).ToLowerInvariant();
    }
}
