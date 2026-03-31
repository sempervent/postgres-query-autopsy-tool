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
    IReadOnlyDictionary<string, object?> EvidenceB);

public sealed record FindingsDiff(
    IReadOnlyList<FindingDiffItem> Items);

