using System.Reflection;
using PostgresQueryAutopsyTool.Core.Comparison;
using PostgresQueryAutopsyTool.Core.Domain;
using PostgresQueryAutopsyTool.Core.OperatorEvidence;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class ComparisonNarrativeSideHintsTests
{
    [Fact]
    public void FormatPairEvidence_includes_build_side_when_hash_build_summary_present()
    {
        var d = new NodeDelta(
            NodeIdA: "a",
            NodeIdB: "b",
            MatchScore: 0.9,
            MatchConfidence: MatchConfidence.High,
            NodeTypeA: "Hash Join",
            NodeTypeB: "Hash Join",
            RelationName: null,
            IndexName: null,
            InclusiveTimeMs: new NumericDelta(null, null, null, null),
            ExclusiveTimeMsApprox: new NumericDelta(null, null, null, null),
            SubtreeTimeShare: new NumericDelta(null, null, null, null),
            SharedReadBlocks: new NumericDelta(null, null, null, null),
            SharedReadShare: new NumericDelta(null, null, null, null),
            RowEstimateFactor: new NumericDelta(null, null, null, null),
            ActualRowsTotal: new NumericDelta(null, null, null, null),
            Loops: new NumericDelta(null, null, null, null));

        var pair = new NodePairDetail(
            Identity: new NodePairIdentity(
                NodeIdA: "a",
                NodeIdB: "b",
                NodeTypeA: "Hash Join",
                NodeTypeB: "Hash Join",
                RelationNameA: null,
                RelationNameB: null,
                IndexNameA: null,
                IndexNameB: null,
                JoinTypeA: null,
                JoinTypeB: null,
                DepthA: 0,
                DepthB: 0,
                MatchConfidence: MatchConfidence.High,
                MatchScore: 0.9,
                ScoreBreakdown: new Dictionary<string, double>()),
            RawFields: new NodePairRawFields(
                FilterA: null,
                FilterB: null,
                IndexCondA: null,
                IndexCondB: null,
                JoinFilterA: null,
                JoinFilterB: null,
                HashCondA: null,
                HashCondB: null,
                MergeCondA: null,
                MergeCondB: null,
                SortKeyA: null,
                SortKeyB: null,
                GroupKeyA: null,
                GroupKeyB: null,
                StrategyA: null,
                StrategyB: null,
                ParallelAwareA: null,
                ParallelAwareB: null,
                WorkersPlannedA: null,
                WorkersPlannedB: null,
                WorkersLaunchedA: null,
                WorkersLaunchedB: null,
                RowsRemovedByFilterA: null,
                RowsRemovedByFilterB: null,
                RowsRemovedByJoinFilterA: null,
                RowsRemovedByJoinFilterB: null,
                RowsRemovedByIndexRecheckA: null,
                RowsRemovedByIndexRecheckB: null,
                HeapFetchesA: null,
                HeapFetchesB: null,
                SortMethodA: null,
                SortMethodB: null,
                SortSpaceUsedKbA: null,
                SortSpaceUsedKbB: null,
                SortSpaceTypeA: null,
                SortSpaceTypeB: null,
                PresortedKeyA: null,
                PresortedKeyB: null,
                FullSortGroupsA: null,
                FullSortGroupsB: null,
                HashBucketsA: null,
                HashBucketsB: null,
                OriginalHashBucketsA: null,
                OriginalHashBucketsB: null,
                HashBatchesA: null,
                HashBatchesB: null,
                OriginalHashBatchesA: null,
                OriginalHashBatchesB: null,
                PeakMemoryUsageKbA: null,
                PeakMemoryUsageKbB: null,
                DiskUsageKbA: null,
                DiskUsageKbB: null,
                InnerUniqueA: null,
                InnerUniqueB: null,
                PartialModeA: null,
                PartialModeB: null,
                CacheKeyA: null,
                CacheKeyB: null,
                CacheHitsA: null,
                CacheHitsB: null,
                CacheMissesA: null,
                CacheMissesB: null,
                CacheEvictionsA: null,
                CacheEvictionsB: null,
                CacheOverflowsA: null,
                CacheOverflowsB: null),
            ContextEvidenceA: null,
            ContextEvidenceB: null,
            ContextDiff: new OperatorContextEvidenceDiff(
                HashBuild: new HashBuildContextDiff(
                    HashBatches: new ScalarDeltaLong(1, 8, 7, null, EvidenceChangeDirection.Worsened),
                    DiskUsageKb: new ScalarDeltaLong(0, 65536, 65536, null, EvidenceChangeDirection.Worsened),
                    PeakMemoryUsageKb: new ScalarDeltaLong(null, null, null, null, EvidenceChangeDirection.NotApplicable),
                    PressureDirection: EvidenceChangeDirection.Worsened,
                    Summary: "hash build: batches 1→8; disk 0→65536kB"),
                ScanWaste: null,
                Sort: null,
                Memoize: null,
                NestedLoop: null,
                Highlights: new[] { "hash build: batches 1→8; disk 0→65536kB" },
                OverallDirection: EvidenceChangeDirection.Worsened),
            Metrics: Array.Empty<MetricDeltaDetail>(),
            Findings: new PairFindingsView(
                FindingsA: Array.Empty<AnalysisFinding>(),
                FindingsB: Array.Empty<AnalysisFinding>(),
                RelatedDiffItems: Array.Empty<FindingDiffItem>()));

        var m = typeof(ComparisonEngine).GetMethod("FormatPairEvidence", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(m);

        var line = (string)m!.Invoke(null, new object?[] { pair, d })!;
        Assert.Contains("Build side", line, StringComparison.OrdinalIgnoreCase);
    }
}

