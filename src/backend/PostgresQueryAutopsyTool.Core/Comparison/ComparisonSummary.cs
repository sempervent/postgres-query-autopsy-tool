namespace PostgresQueryAutopsyTool.Core.Comparison;

public sealed record ComparisonSummary(
    double? RuntimeMsA,
    double? RuntimeMsB,
    double? RuntimeDeltaMs,
    double? RuntimeDeltaPct,
    long SharedReadBlocksA,
    long SharedReadBlocksB,
    long SharedReadDeltaBlocks,
    double? SharedReadDeltaPct,
    long NodeCountA,
    long NodeCountB,
    long NodeCountDelta,
    int MaxDepthA,
    int MaxDepthB,
    int MaxDepthDelta,
    int SevereFindingsCountA,
    int SevereFindingsCountB,
    int SevereFindingsDelta);

