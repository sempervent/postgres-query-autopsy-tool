using PostgresQueryAutopsyTool.Core.Domain;
using PostgresQueryAutopsyTool.Core.Parsing;

namespace PostgresQueryAutopsyTool.Core.Analysis;

public sealed record PlanAnalysisResult(
    string AnalysisId,
    string RootNodeId,
    string? QueryText,
    ExplainCaptureMetadata? ExplainMetadata,
    IReadOnlyList<AnalyzedPlanNode> Nodes,
    IReadOnlyList<AnalysisFinding> Findings,
    AnalysisNarrative Narrative,
    PlanSummary Summary,
    PlanIndexOverview IndexOverview,
    IReadOnlyList<PlanIndexInsight> IndexInsights,
    IReadOnlyList<OptimizationSuggestion> OptimizationSuggestions,
    /// <summary>Set when the API normalized pasted text (e.g. psql QUERY PLAN); null for legacy <c>plan</c> JSON body.</summary>
    PlanInputNormalizationInfo? PlanInputNormalization = null,
    /// <summary>Optional ownership/sharing metadata (Phase 37); omitted from stored JSON payload, merged from SQLite on read.</summary>
    StoredArtifactAccess? ArtifactAccess = null);

