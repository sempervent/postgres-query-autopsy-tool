namespace PostgresQueryAutopsyTool.Core.Analysis;

public sealed record DerivedNodeMetrics(
    int Depth,
    bool IsRoot,
    bool IsLeaf,
    int ChildCount,
    long SubtreeNodeCount,

    // Actual timing (ms) derived from Postgres ANALYZE semantics (best-effort)
    double? InclusiveActualTimeMs,
    double? ExclusiveActualTimeMsApprox,
    double? SubtreeInclusiveTimeMs,
    double? SubtreeTimeShare,

    // Row/cost signals
    double? ActualRowsTotal,
    double? RowEstimateRatio,
    double? RowEstimateFactor,
    double? RowEstimateLog10Error,
    decimal? CostPerEstimatedRow,
    double? ActualTimePerOutputRowMs,
    long? LoopsAmplification,

    // Buffers
    long? BufferTotalBlocks,
    double? BufferShareOfPlan,
    long? SubtreeSharedReadBlocks,
    long? SubtreeSharedHitBlocks,
    double? SubtreeBufferShare);

