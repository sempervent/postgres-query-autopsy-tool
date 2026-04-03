namespace PostgresQueryAutopsyTool.Core.Parsing;

/// <summary>Describes how raw plan input was interpreted before JSON parsing (Phase 35).</summary>
public sealed record PlanInputNormalizationInfo(
    /// <summary>
    /// <c>rawJson</c>: parsed as JSON directly.
    /// <c>queryPlanTable</c>: stripped psql <c>QUERY PLAN</c> table wrapper and continuation lines.
    /// </summary>
    string Kind,
    string? Detail = null);
