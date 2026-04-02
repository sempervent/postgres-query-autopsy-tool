using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Comparison;

public enum FindingChangeType
{
    New = 0,
    Resolved = 1,
    Worsened = 2,
    Improved = 3,
    Unchanged = 4,
    Unmapped = 5
}

public sealed record FindingDiffItem(
    string RuleId,
    FindingChangeType ChangeType,
    string? NodeIdA,
    string? NodeIdB,
    FindingSeverity? SeverityA,
    FindingSeverity? SeverityB,
    FindingConfidence? ConfidenceA,
    FindingConfidence? ConfidenceB,
    string Title,
    string Summary,
    IReadOnlyDictionary<string, object?> EvidenceA,
    IReadOnlyDictionary<string, object?> EvidenceB,
    /// <summary>Legacy positional links into <see cref="IndexComparisonSummary.InsightDiffs"/>; prefer <see cref="RelatedIndexDiffIds"/>.</summary>
    IReadOnlyList<int> RelatedIndexDiffIndexes,
    /// <summary>Stable comparison-scoped id (e.g. <c>fd_*</c>) for reports and deep links.</summary>
    string DiffId = "",
    /// <summary>Stable ids of related index insight diffs (Phase 33).</summary>
    IReadOnlyList<string>? RelatedIndexDiffIds = null);

public sealed record FindingsDiff(
    IReadOnlyList<FindingDiffItem> Items);

