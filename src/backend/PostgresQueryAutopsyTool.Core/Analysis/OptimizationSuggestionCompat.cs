namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>
/// Backfills Phase 47+ presentation fields for older persisted snapshots (Phase 49 server-side).
/// </summary>
public static class OptimizationSuggestionCompat
{
    public static OptimizationSuggestionFamily FamilyFromCategory(OptimizationSuggestionCategory category) =>
        category switch
        {
            OptimizationSuggestionCategory.IndexExperiment => OptimizationSuggestionFamily.IndexExperiments,
            OptimizationSuggestionCategory.StatisticsMaintenance => OptimizationSuggestionFamily.StatisticsPlannerAccuracy,
            OptimizationSuggestionCategory.TimescaledbWorkload or OptimizationSuggestionCategory.PartitioningChunking =>
                OptimizationSuggestionFamily.SchemaWorkloadShape,
            OptimizationSuggestionCategory.ObserveBeforeChange => OptimizationSuggestionFamily.OperationalTuningValidation,
            _ => OptimizationSuggestionFamily.QueryShapeOrdering
        };

    /// <summary>
    /// Ensures human-facing fields are populated without inventing engine evidence.
    /// </summary>
    public static OptimizationSuggestion NormalizeFields(OptimizationSuggestion s)
    {
        var family = FamilyFromCategory(s.Category);
        var v0 = s.ValidationSteps.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))?.Trim();
        var recommended = string.IsNullOrWhiteSpace(s.RecommendedNextAction)
            ? (v0 ?? (string.IsNullOrWhiteSpace(s.Summary)
                ? "Review the summary and validation steps for this snapshot."
                : s.Summary.Trim()))
            : s.RecommendedNextAction.Trim();
        var why = string.IsNullOrWhiteSpace(s.WhyItMatters)
            ? (string.IsNullOrWhiteSpace(s.Rationale)
                ? "This snapshot uses an older suggestion shape; rely on summary, rationale, and validation steps for evidence."
                : s.Rationale.Trim())
            : s.WhyItMatters.Trim();
        var firstTarget = s.TargetNodeIds.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))?.Trim();
        var label = string.IsNullOrWhiteSpace(s.TargetDisplayLabel) ? firstTarget : s.TargetDisplayLabel.Trim();
        return s with
        {
            SuggestionFamily = family,
            RecommendedNextAction = recommended,
            WhyItMatters = why,
            TargetDisplayLabel = label
        };
    }
}
