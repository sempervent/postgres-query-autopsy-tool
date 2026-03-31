using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.OperatorEvidence;

public sealed record HashChildEvidence(
    string? HashNodeId,
    long? HashBuckets,
    long? OriginalHashBuckets,
    long? HashBatches,
    long? OriginalHashBatches,
    long? PeakMemoryUsageKb,
    long? DiskUsageKb);

public sealed record HashJoinContextEvidence(
    HashChildEvidence? ChildHash,
    string? HashCond,
    double? BuildSideActualRowsTotal,
    double? ProbeSideActualRowsTotal);

public sealed record SortContextEvidence(
    string? SortMethod,
    long? SortSpaceUsedKb,
    string? SortSpaceType,
    long? PeakMemoryUsageKb,
    long? DiskUsageKb,
    double? InputActualRowsTotal);

public sealed record ScanWasteContextEvidence(
    string? PrimaryScanNodeId,
    string? PrimaryScanNodeType,
    string? RelationName,
    long? RowsRemovedByFilter,
    long? RowsRemovedByJoinFilter,
    long? RowsRemovedByIndexRecheck,
    long? HeapFetches,
    double? RemovedRowsShareApprox);

public sealed record NestedLoopContextEvidence(
    string? InnerNodeId,
    long? InnerLoopsApprox,
    double? InnerSubtreeTimeShareOfPlan,
    ScanWasteContextEvidence? InnerSideScanWaste);

public sealed record MaterializeContextEvidence(
    long? Loops,
    double? SubtreeTimeShareOfPlan,
    double? SubtreeSharedReadShareOfPlan);

public sealed record MemoizeContextEvidence(
    string? CacheKey,
    long? CacheHits,
    long? CacheMisses,
    long? CacheEvictions,
    long? CacheOverflows,
    double? HitRate);

/// <summary>
/// Curated operator-context evidence for a node. This is intentionally compact.
/// It may include evidence from nearby descendants (e.g. child Hash under Hash Join).
/// </summary>
public sealed record OperatorContextEvidence(
    HashJoinContextEvidence? HashJoin = null,
    SortContextEvidence? Sort = null,
    NestedLoopContextEvidence? NestedLoop = null,
    ScanWasteContextEvidence? ScanWaste = null,
    MaterializeContextEvidence? Materialize = null,
    MemoizeContextEvidence? Memoize = null);

