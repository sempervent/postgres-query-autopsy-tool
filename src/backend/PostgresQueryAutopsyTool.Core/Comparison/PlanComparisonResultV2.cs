using PostgresQueryAutopsyTool.Core.Analysis;

namespace PostgresQueryAutopsyTool.Core.Comparison;

public sealed record PlanComparisonResultV2(
    string ComparisonId,
    PlanAnalysisResult PlanA,
    PlanAnalysisResult PlanB,
    ComparisonSummary Summary,
    IReadOnlyList<NodeMatch> Matches,
    IReadOnlyList<string> UnmatchedNodeIdsA,
    IReadOnlyList<string> UnmatchedNodeIdsB,
    IReadOnlyList<NodeDelta> NodeDeltas,
    IReadOnlyList<NodeDelta> TopImprovedNodes,
    IReadOnlyList<NodeDelta> TopWorsenedNodes,
    IReadOnlyList<NodePairDetail> PairDetails,
    FindingsDiff FindingsDiff,
    IndexComparisonSummary IndexComparison,
    string Narrative,
    IReadOnlyList<OptimizationSuggestion> CompareOptimizationSuggestions,
    ComparisonDiagnostics? Diagnostics = null,
    /// <summary>Phase 49: persisted JSON schema generation.</summary>
    int ArtifactSchemaVersion = 0,
    /// <summary>Phase 49: filled from SQLite <c>created_utc</c> on read when absent in JSON.</summary>
    DateTimeOffset? ArtifactPersistedUtc = null,
    /// <summary>Optional ownership/sharing metadata (Phase 37); merged from SQLite on read.</summary>
    StoredArtifactAccess? ArtifactAccess = null);

