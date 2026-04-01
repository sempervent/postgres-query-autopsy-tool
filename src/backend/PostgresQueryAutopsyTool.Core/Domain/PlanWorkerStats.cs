namespace PostgresQueryAutopsyTool.Core.Domain;

/// <summary>
/// Per-entry stats from PostgreSQL <c>EXPLAIN</c> JSON <c>Workers</c> array (parallel query breakdown).
/// Parent/leader node fields on <see cref="NormalizedPlanNode"/> remain the plan-level aggregate when present;
/// these rows are the explicit worker slice (not double-counted into summaries beyond existing fallback fill-in).
/// </summary>
public sealed record PlanWorkerStats(
    int? WorkerNumber,
    double? ActualStartupTimeMs,
    double? ActualTotalTimeMs,
    double? ActualRows,
    long? ActualLoops,
    long? SharedHitBlocks,
    long? SharedReadBlocks,
    long? SharedDirtiedBlocks,
    long? SharedWrittenBlocks,
    long? LocalHitBlocks,
    long? LocalReadBlocks,
    long? LocalDirtiedBlocks,
    long? LocalWrittenBlocks,
    long? TempReadBlocks,
    long? TempWrittenBlocks,
    string? SortMethod,
    long? SortSpaceUsedKb,
    string? SortSpaceType);
