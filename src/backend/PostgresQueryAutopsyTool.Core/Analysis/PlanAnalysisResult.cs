using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Analysis;

public sealed record PlanAnalysisResult(
    string AnalysisId,
    string RootNodeId,
    string? QueryText,
    IReadOnlyList<AnalyzedPlanNode> Nodes,
    IReadOnlyList<AnalysisFinding> Findings,
    AnalysisNarrative Narrative,
    PlanSummary Summary,
    PlanIndexOverview IndexOverview,
    IReadOnlyList<PlanIndexInsight> IndexInsights,
    IReadOnlyList<OptimizationSuggestion> OptimizationSuggestions);

