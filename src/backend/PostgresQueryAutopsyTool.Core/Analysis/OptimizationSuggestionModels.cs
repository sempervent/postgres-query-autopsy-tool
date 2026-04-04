using System.Text.Json.Serialization;
using PostgresQueryAutopsyTool.Core.Serialization;

namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>High-level bucket for UI grouping and reporting.</summary>
[JsonConverter(typeof(OptimizationSuggestionCategoryJsonConverter))]
public enum OptimizationSuggestionCategory
{
    IndexExperiment,
    QueryRewrite,
    SchemaChange,
    StatisticsMaintenance,
    PartitioningChunking,
    SortOrdering,
    JoinStrategy,
    Parallelism,
    TimescaledbWorkload,
    ObserveBeforeChange
}

/// <summary>What kind of concrete experiment or review is implied (not DDL).</summary>
[JsonConverter(typeof(SuggestedActionTypeJsonConverter))]
public enum SuggestedActionType
{
    CreateIndexCandidate,
    ReviewExistingIndex,
    RewritePredicate,
    ReduceSelectedColumns,
    ChangeGroupingOrOrderingStrategy,
    RefreshStatistics,
    RevisitChunkingOrRetention,
    MeasureWorkerSkew,
    ValidateWithExplainAnalyze,
    ReduceSortOrHashVolume,
    ReviewJoinShape,
    ReviewMaterializeOrMemoize
}

[JsonConverter(typeof(SuggestionConfidenceLevelJsonConverter))]
public enum SuggestionConfidenceLevel
{
    Low,
    Medium,
    High
}

[JsonConverter(typeof(SuggestionPriorityLevelJsonConverter))]
public enum SuggestionPriorityLevel
{
    Low,
    Medium,
    High,
    Critical
}

/// <summary>UI grouping: human-facing families, independent of <see cref="OptimizationSuggestionCategory"/>.</summary>
[JsonConverter(typeof(OptimizationSuggestionFamilyJsonConverter))]
public enum OptimizationSuggestionFamily
{
    IndexExperiments,
    QueryShapeOrdering,
    StatisticsPlannerAccuracy,
    SchemaWorkloadShape,
    OperationalTuningValidation
}

/// <summary>
/// Evidence-backed, investigation-oriented next step. Not a prescription.
/// </summary>
public sealed record OptimizationSuggestion(
    string SuggestionId,
    OptimizationSuggestionCategory Category,
    SuggestedActionType SuggestedActionType,
    string Title,
    string Summary,
    string Details,
    string Rationale,
    SuggestionConfidenceLevel Confidence,
    SuggestionPriorityLevel Priority,
    IReadOnlyList<string> TargetNodeIds,
    IReadOnlyList<string> RelatedFindingIds,
    IReadOnlyList<string> RelatedIndexInsightNodeIds,
    IReadOnlyList<string> Cautions,
    IReadOnlyList<string> ValidationSteps,
    OptimizationSuggestionFamily SuggestionFamily,
    /// <summary>Imperative next experiment or review step (short).</summary>
    string RecommendedNextAction,
    /// <summary>Plain-language impact: why an operator should care.</summary>
    string WhyItMatters,
    /// <summary>Optional human-readable target (operators, relations)—not raw node ids in primary copy.</summary>
    string? TargetDisplayLabel = null,
    /// <summary>True when this card merged multiple overlapping signals.</summary>
    bool IsGroupedCluster = false,
    /// <summary>Compare-only: stable finding diff row ids (<c>fd_*</c>).</summary>
    IReadOnlyList<string>? RelatedFindingDiffIds = null,
    /// <summary>Compare-only: stable index insight diff row ids (<c>ii_*</c>).</summary>
    IReadOnlyList<string>? RelatedIndexInsightDiffIds = null,
    /// <summary>Phase 59: stable bottleneck insight ids (<c>bn_*</c>) this suggestion responds to.</summary>
    IReadOnlyList<string>? RelatedBottleneckInsightIds = null,
    /// <summary>Phase 49: alternate ids for the same suggestion (e.g. pre–Phase-48 carried compare ids) for deep-link compatibility.</summary>
    IReadOnlyList<string>? AlsoKnownAs = null);
