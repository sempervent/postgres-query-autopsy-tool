using System.Collections.Generic;

namespace PostgresQueryAutopsyTool.Core.Domain;

public enum FindingSeverity
{
    Info = 0,
    Low = 1,
    Medium = 2,
    High = 3,
    Critical = 4
}

public enum FindingConfidence
{
    Low = 0,
    Medium = 1,
    High = 2
}

public enum FindingCategory
{
    Misestimation = 0,
    AccessPathConcern = 1,
    JoinStrategyConcern = 2,
    LoopAmplification = 3,
    BufferHotspot = 4,
    CpuHotspot = 5,
    WasteDeadWorkSuspicion = 6,
    PlanComplexityConcern = 7,
    PotentialIndexingOpportunity = 8,
    PotentialStatisticsIssue = 9
}

public sealed record AnalysisFinding(
    string FindingId,
    string RuleId,
    FindingSeverity Severity,
    FindingConfidence Confidence,
    FindingCategory Category,
    string Title,
    string Summary,
    string Explanation,
    IReadOnlyList<string>? NodeIds,
    IReadOnlyDictionary<string, object?> Evidence,
    string Suggestion,
    double? RankScore = null);

