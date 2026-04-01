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
    /// <summary>Indices into <see cref="IndexComparisonSummary.InsightDiffs"/> are not needed; these index <c>FindingsDiff.Items</c> after ranking.</summary>
    IReadOnlyList<int> RelatedFindingDiffIndexes);

/// <summary>Plan-level index posture delta plus ranked insight-level diff for Compare.</summary>
public sealed record IndexComparisonSummary(
    IReadOnlyList<string> OverviewLines,
    IReadOnlyList<IndexInsightDiffItem> InsightDiffs,
    /// <summary>Short bullets for narrative (subset of overview + top insight summaries).</summary>
    IReadOnlyList<string> NarrativeBullets,
    /// <summary>True when either plan matched the chunked Append+bitmap-heuristic (Timescale-style nuance).</summary>
    bool EitherPlanSuggestsChunkedBitmapWorkload);
