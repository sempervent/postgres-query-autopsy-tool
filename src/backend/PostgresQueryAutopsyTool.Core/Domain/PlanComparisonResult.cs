using System.Collections.Generic;

namespace PostgresQueryAutopsyTool.Core.Domain;

public sealed record PlanComparisonFindingDelta(
    string FindingId,
    FindingSeverity SeverityA,
    FindingSeverity SeverityB,
    string Category,
    string Title,
    string Summary);

public sealed record PlanComparisonResult(
    string ComparisonId,
    string NarrativeSummary,
    IReadOnlyList<string> NodesAdded,
    IReadOnlyList<string> NodesRemoved,
    IReadOnlyList<PlanComparisonFindingDelta> FindingDeltas);

