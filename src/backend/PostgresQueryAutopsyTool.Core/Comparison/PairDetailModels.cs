using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Comparison;

public enum DeltaDirection
{
    Improved = 0,
    Worsened = 1,
    Neutral = 2,
    NotApplicable = 3,
    Ambiguous = 4
}

public sealed record MetricDeltaDetail(
    string Key,
    double? A,
    double? B,
    double? Delta,
    double? DeltaPct,
    DeltaDirection Direction);

public sealed record NodePairIdentity(
    string NodeIdA,
    string NodeIdB,
    string NodeTypeA,
    string NodeTypeB,
    string? RelationNameA,
    string? RelationNameB,
    string? IndexNameA,
    string? IndexNameB,
    string? JoinTypeA,
    string? JoinTypeB,
    int DepthA,
    int DepthB,
    MatchConfidence MatchConfidence,
    double MatchScore,
    IReadOnlyDictionary<string, double> ScoreBreakdown);

public sealed record NodePairRawFields(
    string? FilterA,
    string? FilterB,
    string? IndexCondA,
    string? IndexCondB,
    string? JoinFilterA,
    string? JoinFilterB,
    string? HashCondA,
    string? HashCondB,
    string? MergeCondA,
    string? MergeCondB,
    string? SortKeyA,
    string? SortKeyB,
    string? GroupKeyA,
    string? GroupKeyB,
    string? StrategyA,
    string? StrategyB,
    bool? ParallelAwareA,
    bool? ParallelAwareB,
    int? WorkersPlannedA,
    int? WorkersPlannedB,
    int? WorkersLaunchedA,
    int? WorkersLaunchedB,
    long? RowsRemovedByFilterA,
    long? RowsRemovedByFilterB,
    long? RowsRemovedByJoinFilterA,
    long? RowsRemovedByJoinFilterB,
    long? RowsRemovedByIndexRecheckA,
    long? RowsRemovedByIndexRecheckB,
    long? HeapFetchesA,
    long? HeapFetchesB,
    string? SortMethodA,
    string? SortMethodB,
    long? SortSpaceUsedKbA,
    long? SortSpaceUsedKbB,
    string? SortSpaceTypeA,
    string? SortSpaceTypeB,
    string? PresortedKeyA,
    string? PresortedKeyB,
    long? FullSortGroupsA,
    long? FullSortGroupsB,
    long? HashBucketsA,
    long? HashBucketsB,
    long? OriginalHashBucketsA,
    long? OriginalHashBucketsB,
    long? HashBatchesA,
    long? HashBatchesB,
    long? OriginalHashBatchesA,
    long? OriginalHashBatchesB,
    long? PeakMemoryUsageKbA,
    long? PeakMemoryUsageKbB,
    long? DiskUsageKbA,
    long? DiskUsageKbB,
    bool? InnerUniqueA,
    bool? InnerUniqueB,
    string? PartialModeA,
    string? PartialModeB,
    string? CacheKeyA,
    string? CacheKeyB,
    long? CacheHitsA,
    long? CacheHitsB,
    long? CacheMissesA,
    long? CacheMissesB,
    long? CacheEvictionsA,
    long? CacheEvictionsB,
    long? CacheOverflowsA,
    long? CacheOverflowsB);

public sealed record PairFindingsView(
    IReadOnlyList<AnalysisFinding> FindingsA,
    IReadOnlyList<AnalysisFinding> FindingsB,
    IReadOnlyList<FindingDiffItem> RelatedDiffItems);

public sealed record NodePairDetail(
    NodePairIdentity Identity,
    NodePairRawFields RawFields,
    PostgresQueryAutopsyTool.Core.OperatorEvidence.OperatorContextEvidence? ContextEvidenceA,
    PostgresQueryAutopsyTool.Core.OperatorEvidence.OperatorContextEvidence? ContextEvidenceB,
    PostgresQueryAutopsyTool.Core.OperatorEvidence.OperatorContextEvidenceDiff? ContextDiff,
    IReadOnlyList<MetricDeltaDetail> Metrics,
    PairFindingsView Findings);

