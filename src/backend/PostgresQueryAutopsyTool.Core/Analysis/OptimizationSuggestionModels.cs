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
    /// <summary>Compare-only: stable finding diff row ids (<c>fd_*</c>).</summary>
    IReadOnlyList<string>? RelatedFindingDiffIds = null,
    /// <summary>Compare-only: stable index insight diff row ids (<c>ii_*</c>).</summary>
    IReadOnlyList<string>? RelatedIndexInsightDiffIds = null);
