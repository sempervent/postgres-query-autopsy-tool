using System.Text.Json;
using System.Text.Json.Serialization;
using PostgresQueryAutopsyTool.Core.Analysis;

namespace PostgresQueryAutopsyTool.Core.Serialization;

public sealed class OptimizationSuggestionCategoryJsonConverter : JsonConverter<OptimizationSuggestionCategory>
{
    public override OptimizationSuggestionCategory Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number && reader.TryGetInt32(out var n))
            return (OptimizationSuggestionCategory)n;
        var s = reader.GetString();
        return s switch
        {
            "index_experiment" => OptimizationSuggestionCategory.IndexExperiment,
            "query_rewrite" => OptimizationSuggestionCategory.QueryRewrite,
            "schema_change" => OptimizationSuggestionCategory.SchemaChange,
            "statistics_maintenance" => OptimizationSuggestionCategory.StatisticsMaintenance,
            "partitioning_chunking" => OptimizationSuggestionCategory.PartitioningChunking,
            "sort_ordering" => OptimizationSuggestionCategory.SortOrdering,
            "join_strategy" => OptimizationSuggestionCategory.JoinStrategy,
            "parallelism" => OptimizationSuggestionCategory.Parallelism,
            "timescaledb_workload" => OptimizationSuggestionCategory.TimescaledbWorkload,
            "observe_before_change" => OptimizationSuggestionCategory.ObserveBeforeChange,
            _ => Enum.TryParse<OptimizationSuggestionCategory>(s, true, out var e) ? e : OptimizationSuggestionCategory.ObserveBeforeChange
        };
    }

    public override void Write(Utf8JsonWriter writer, OptimizationSuggestionCategory value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value switch
        {
            OptimizationSuggestionCategory.IndexExperiment => "index_experiment",
            OptimizationSuggestionCategory.QueryRewrite => "query_rewrite",
            OptimizationSuggestionCategory.SchemaChange => "schema_change",
            OptimizationSuggestionCategory.StatisticsMaintenance => "statistics_maintenance",
            OptimizationSuggestionCategory.PartitioningChunking => "partitioning_chunking",
            OptimizationSuggestionCategory.SortOrdering => "sort_ordering",
            OptimizationSuggestionCategory.JoinStrategy => "join_strategy",
            OptimizationSuggestionCategory.Parallelism => "parallelism",
            OptimizationSuggestionCategory.TimescaledbWorkload => "timescaledb_workload",
            OptimizationSuggestionCategory.ObserveBeforeChange => "observe_before_change",
            _ => "observe_before_change"
        });
    }
}

public sealed class SuggestedActionTypeJsonConverter : JsonConverter<SuggestedActionType>
{
    public override SuggestedActionType Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number && reader.TryGetInt32(out var n))
            return (SuggestedActionType)n;
        var s = reader.GetString();
        return s switch
        {
            "create_index_candidate" => SuggestedActionType.CreateIndexCandidate,
            "review_existing_index" => SuggestedActionType.ReviewExistingIndex,
            "rewrite_predicate" => SuggestedActionType.RewritePredicate,
            "reduce_selected_columns" => SuggestedActionType.ReduceSelectedColumns,
            "change_grouping_or_ordering_strategy" => SuggestedActionType.ChangeGroupingOrOrderingStrategy,
            "refresh_statistics" => SuggestedActionType.RefreshStatistics,
            "revisit_chunking_or_retention" => SuggestedActionType.RevisitChunkingOrRetention,
            "measure_worker_skew" => SuggestedActionType.MeasureWorkerSkew,
            "validate_with_explain_analyze" => SuggestedActionType.ValidateWithExplainAnalyze,
            "reduce_sort_or_hash_volume" => SuggestedActionType.ReduceSortOrHashVolume,
            "review_join_shape" => SuggestedActionType.ReviewJoinShape,
            "review_materialize_or_memoize" => SuggestedActionType.ReviewMaterializeOrMemoize,
            _ => Enum.TryParse<SuggestedActionType>(s, true, out var e) ? e : SuggestedActionType.ValidateWithExplainAnalyze
        };
    }

    public override void Write(Utf8JsonWriter writer, SuggestedActionType value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value switch
        {
            SuggestedActionType.CreateIndexCandidate => "create_index_candidate",
            SuggestedActionType.ReviewExistingIndex => "review_existing_index",
            SuggestedActionType.RewritePredicate => "rewrite_predicate",
            SuggestedActionType.ReduceSelectedColumns => "reduce_selected_columns",
            SuggestedActionType.ChangeGroupingOrOrderingStrategy => "change_grouping_or_ordering_strategy",
            SuggestedActionType.RefreshStatistics => "refresh_statistics",
            SuggestedActionType.RevisitChunkingOrRetention => "revisit_chunking_or_retention",
            SuggestedActionType.MeasureWorkerSkew => "measure_worker_skew",
            SuggestedActionType.ValidateWithExplainAnalyze => "validate_with_explain_analyze",
            SuggestedActionType.ReduceSortOrHashVolume => "reduce_sort_or_hash_volume",
            SuggestedActionType.ReviewJoinShape => "review_join_shape",
            SuggestedActionType.ReviewMaterializeOrMemoize => "review_materialize_or_memoize",
            _ => "validate_with_explain_analyze"
        });
    }
}

public sealed class SuggestionConfidenceLevelJsonConverter : JsonConverter<SuggestionConfidenceLevel>
{
    public override SuggestionConfidenceLevel Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number && reader.TryGetInt32(out var n))
            return (SuggestionConfidenceLevel)n;
        var s = reader.GetString();
        return s?.ToLowerInvariant() switch
        {
            "low" => SuggestionConfidenceLevel.Low,
            "medium" => SuggestionConfidenceLevel.Medium,
            "high" => SuggestionConfidenceLevel.High,
            _ => SuggestionConfidenceLevel.Medium
        };
    }

    public override void Write(Utf8JsonWriter writer, SuggestionConfidenceLevel value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value switch
        {
            SuggestionConfidenceLevel.Low => "low",
            SuggestionConfidenceLevel.Medium => "medium",
            SuggestionConfidenceLevel.High => "high",
            _ => "medium"
        });
    }
}

public sealed class OptimizationSuggestionFamilyJsonConverter : JsonConverter<OptimizationSuggestionFamily>
{
    public override OptimizationSuggestionFamily Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number && reader.TryGetInt32(out var n))
            return (OptimizationSuggestionFamily)n;
        var s = reader.GetString();
        return s switch
        {
            "index_experiments" => OptimizationSuggestionFamily.IndexExperiments,
            "query_shape_ordering" => OptimizationSuggestionFamily.QueryShapeOrdering,
            "statistics_planner_accuracy" => OptimizationSuggestionFamily.StatisticsPlannerAccuracy,
            "schema_workload_shape" => OptimizationSuggestionFamily.SchemaWorkloadShape,
            "operational_tuning_validation" => OptimizationSuggestionFamily.OperationalTuningValidation,
            _ => Enum.TryParse<OptimizationSuggestionFamily>(s, true, out var e) ? e : OptimizationSuggestionFamily.QueryShapeOrdering
        };
    }

    public override void Write(Utf8JsonWriter writer, OptimizationSuggestionFamily value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value switch
        {
            OptimizationSuggestionFamily.IndexExperiments => "index_experiments",
            OptimizationSuggestionFamily.QueryShapeOrdering => "query_shape_ordering",
            OptimizationSuggestionFamily.StatisticsPlannerAccuracy => "statistics_planner_accuracy",
            OptimizationSuggestionFamily.SchemaWorkloadShape => "schema_workload_shape",
            OptimizationSuggestionFamily.OperationalTuningValidation => "operational_tuning_validation",
            _ => "query_shape_ordering"
        });
    }
}

public sealed class SuggestionPriorityLevelJsonConverter : JsonConverter<SuggestionPriorityLevel>
{
    public override SuggestionPriorityLevel Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number && reader.TryGetInt32(out var n))
            return (SuggestionPriorityLevel)n;
        var s = reader.GetString();
        return s?.ToLowerInvariant() switch
        {
            "low" => SuggestionPriorityLevel.Low,
            "medium" => SuggestionPriorityLevel.Medium,
            "high" => SuggestionPriorityLevel.High,
            "critical" => SuggestionPriorityLevel.Critical,
            _ => SuggestionPriorityLevel.Medium
        };
    }

    public override void Write(Utf8JsonWriter writer, SuggestionPriorityLevel value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value switch
        {
            SuggestionPriorityLevel.Low => "low",
            SuggestionPriorityLevel.Medium => "medium",
            SuggestionPriorityLevel.High => "high",
            SuggestionPriorityLevel.Critical => "critical",
            _ => "medium"
        });
    }
}
