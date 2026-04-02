using System.Text.Json.Serialization;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Serialization;

namespace PostgresQueryAutopsyTool.Core.Comparison;

[JsonConverter(typeof(IndexInsightDiffKindJsonConverter))]
public enum IndexInsightDiffKind
{
    New = 0,
    Resolved = 1,
    Improved = 2,
    Worsened = 3,
    Changed = 4,
    Unchanged = 5
}

/// <summary>One classified change between bounded index insights on Plan A vs Plan B.</summary>
public sealed record IndexInsightDiffItem(
    IndexInsightDiffKind Kind,
    string Summary,
    PlanIndexInsight? InsightA,
    PlanIndexInsight? InsightB,
    string? NodeIdA,
    string? NodeIdB,
    string? AccessPathFamilyA,
    string? AccessPathFamilyB,
    /// <summary>Legacy indices into ranked <c>FindingsDiff.Items</c>; prefer <see cref="RelatedFindingDiffIds"/>.</summary>
    IReadOnlyList<int> RelatedFindingDiffIndexes,
    /// <summary>Stable comparison-scoped id (e.g. <c>ii_*</c>).</summary>
    string InsightDiffId = "",
    /// <summary>Stable ids of related finding diff rows (Phase 33).</summary>
    IReadOnlyList<string>? RelatedFindingDiffIds = null);

/// <summary>Plan-level index posture delta plus ranked insight-level diff for Compare.</summary>
public sealed record IndexComparisonSummary(
    IReadOnlyList<string> OverviewLines,
    IReadOnlyList<IndexInsightDiffItem> InsightDiffs,
    /// <summary>Short bullets for narrative (subset of overview + top insight summaries).</summary>
    IReadOnlyList<string> NarrativeBullets,
    /// <summary>True when either plan matched the chunked Append+bitmap-heuristic (Timescale-style nuance).</summary>
    bool EitherPlanSuggestsChunkedBitmapWorkload);
