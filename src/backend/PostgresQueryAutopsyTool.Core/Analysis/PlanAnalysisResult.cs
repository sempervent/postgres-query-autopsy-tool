using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Analysis;

public sealed record PlanAnalysisResult(
    string AnalysisId,
    string RootNodeId,
    IReadOnlyList<AnalyzedPlanNode> Nodes,
    IReadOnlyList<AnalysisFinding> Findings,
    AnalysisNarrative Narrative,
    PlanSummary Summary);

