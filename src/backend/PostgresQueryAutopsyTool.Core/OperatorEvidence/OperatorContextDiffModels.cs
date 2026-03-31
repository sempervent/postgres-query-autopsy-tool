namespace PostgresQueryAutopsyTool.Core.OperatorEvidence;

public enum EvidenceChangeDirection
{
    Improved = 0,
    Worsened = 1,
    Mixed = 2,
    Changed = 3,
    Neutral = 4,
    NotApplicable = 5,
    Unknown = 6
}

public sealed record ScalarDeltaLong(long? A, long? B, long? Delta, double? DeltaPct, EvidenceChangeDirection Direction);
public sealed record ScalarDeltaDouble(double? A, double? B, double? Delta, double? DeltaPct, EvidenceChangeDirection Direction);
public sealed record ScalarDeltaString(string? A, string? B, EvidenceChangeDirection Direction);

public sealed record HashBuildContextDiff(
    ScalarDeltaLong HashBatches,
    ScalarDeltaLong DiskUsageKb,
    ScalarDeltaLong PeakMemoryUsageKb,
    EvidenceChangeDirection PressureDirection,
    string? Summary);

public sealed record ScanWasteContextDiff(
    ScalarDeltaLong RowsRemovedByFilter,
    ScalarDeltaDouble RemovedRowsShareApprox,
    ScalarDeltaLong RowsRemovedByIndexRecheck,
    ScalarDeltaLong HeapFetches,
    EvidenceChangeDirection WasteDirection,
    string? Summary);

public sealed record SortContextDiff(
    ScalarDeltaString SortMethod,
    ScalarDeltaLong DiskUsageKb,
    ScalarDeltaLong SortSpaceUsedKb,
    EvidenceChangeDirection SortSpillDirection,
    string? Summary);

public sealed record MemoizeContextDiff(
    ScalarDeltaLong CacheHits,
    ScalarDeltaLong CacheMisses,
    ScalarDeltaDouble HitRate,
    EvidenceChangeDirection EffectivenessDirection,
    string? Summary);

public sealed record NestedLoopContextDiff(
    ScalarDeltaLong InnerLoopsApprox,
    ScalarDeltaDouble InnerSubtreeTimeShareOfPlan,
    ScanWasteContextDiff? InnerSideWaste,
    EvidenceChangeDirection AmplificationDirection,
    string? Summary);

public sealed record OperatorContextEvidenceDiff(
    HashBuildContextDiff? HashBuild,
    ScanWasteContextDiff? ScanWaste,
    SortContextDiff? Sort,
    MemoizeContextDiff? Memoize,
    NestedLoopContextDiff? NestedLoop,
    IReadOnlyList<string> Highlights,
    EvidenceChangeDirection OverallDirection);

