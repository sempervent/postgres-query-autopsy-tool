using PostgresQueryAutopsyTool.Core.Domain;
using PostgresQueryAutopsyTool.Core.OperatorEvidence;

namespace PostgresQueryAutopsyTool.Core.Analysis;

public sealed class DerivedMetricsEngine
{
    public sealed record Options(
        int HotspotCount = 5,
        double Epsilon = 1e-9);

    private readonly Options _options;

    public DerivedMetricsEngine(Options? options = null)
    {
        _options = options ?? new Options();
    }

    public IReadOnlyList<AnalyzedPlanNode> Compute(NormalizedPlanNode root)
    {
        var index = PlanNodeIndex.Build(root);
        var preorder = PlanTraversal.Preorder(root);

        // Precompute depth.
        var depthById = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var node in preorder)
        {
            if (index.ParentById[node.NodeId] is null)
            {
                depthById[node.NodeId] = 0;
                continue;
            }

            var parentId = index.ParentById[node.NodeId]!;
            depthById[node.NodeId] = depthById[parentId] + 1;
        }

        // Postorder aggregates (subtree node count, subtree time, subtree buffers, etc.).
        var postorder = PlanTraversal.Postorder(root);
        var subtreeNodeCountById = new Dictionary<string, long>(StringComparer.Ordinal);
        var subtreeInclusiveTimeById = new Dictionary<string, double?>(StringComparer.Ordinal);
        var inclusiveTimeById = new Dictionary<string, double?>(StringComparer.Ordinal);
        var exclusiveTimeById = new Dictionary<string, double?>(StringComparer.Ordinal);

        var subtreeSharedReadById = new Dictionary<string, long?>(StringComparer.Ordinal);
        var subtreeSharedHitById = new Dictionary<string, long?>(StringComparer.Ordinal);

        // Plan totals (used for shares).
        long totalSharedRead = 0;

        foreach (var node in postorder)
        {
            var childIds = index.ChildrenById[node.NodeId];
            var childInclusiveSum = childIds
                .Select(id => inclusiveTimeById.TryGetValue(id, out var t) ? t : null)
                .Where(t => t is not null)
                .Sum(t => t!.Value);

            var inclusive = ComputeInclusiveActualTimeMs(node);
            inclusiveTimeById[node.NodeId] = inclusive;

            // Exclusive approximation: parent inclusive - sum(child inclusive) clamped to >=0.
            double? exclusive = null;
            if (inclusive is not null)
            {
                exclusive = inclusive.Value - childInclusiveSum;
                if (exclusive.Value < 0) exclusive = 0;
            }
            exclusiveTimeById[node.NodeId] = exclusive;

            long subtreeCount = 1;

            // Subtree-inclusive time is defined as the inclusive time at the subtree root.
            // Rationale: PostgreSQL "Actual Total Time" at a node is already inclusive of its children.
            // Summing inclusive times across a subtree double-counts and can exceed total plan runtime.
            double? subtreeTime = inclusive;
            foreach (var childId in childIds)
            {
                subtreeCount += subtreeNodeCountById[childId];
            }

            subtreeNodeCountById[node.NodeId] = subtreeCount;
            subtreeInclusiveTimeById[node.NodeId] = subtreeTime;

            // Subtree buffers: we use shared hit/read as the primary "buffer hotspot" signal.
            var sharedRead = node.SharedReadBlocks;
            var sharedHit = node.SharedHitBlocks;

            long? subtreeSharedRead = sharedRead;
            long? subtreeSharedHit = sharedHit;
            foreach (var childId in childIds)
            {
                subtreeSharedRead = AddNullableLong(subtreeSharedRead, subtreeSharedReadById[childId]);
                subtreeSharedHit = AddNullableLong(subtreeSharedHit, subtreeSharedHitById[childId]);
            }

            subtreeSharedReadById[node.NodeId] = subtreeSharedRead;
            subtreeSharedHitById[node.NodeId] = subtreeSharedHit;
        }

        // Plan totals for shares.
        var rootInclusive = inclusiveTimeById[root.NodeId];
        totalSharedRead = subtreeSharedReadById[root.NodeId] ?? 0;

        // Build final analyzed nodes (preorder for stable UI ordering).
        var analyzed = new List<AnalyzedPlanNode>(preorder.Count);
        foreach (var node in preorder)
        {
            var nodeId = node.NodeId;
            var parentId = index.ParentById[nodeId];
            var childIds = index.ChildrenById[nodeId];

            var depth = depthById[nodeId];
            var isRoot = parentId is null;
            var isLeaf = childIds.Count == 0;

            var loops = node.ActualLoops;
            var inclusive = inclusiveTimeById[nodeId];
            var exclusive = exclusiveTimeById[nodeId];
            var subtreeTime = subtreeInclusiveTimeById[nodeId];

            var actualRowsTotal = ComputeActualRowsTotal(node);
            var rowRatio = ComputeRowEstimateRatio(node);
            double? rowFactor = rowRatio is null
                ? null
                : Math.Max(rowRatio.Value, 1.0 / Math.Max(rowRatio.Value, _options.Epsilon));
            double? rowLog10 = rowFactor is null
                ? null
                : Math.Log10(Math.Max(rowFactor.Value, 1.0));

            var costPerEstRow = ComputeCostPerEstimatedRow(node);
            double? timePerOutputRow = (inclusive is not null && actualRowsTotal is > 0)
                ? inclusive.Value / actualRowsTotal.Value
                : null;

            var bufferTotal = ComputeBufferTotalBlocks(node);
            double? bufferShareOfPlan = (node.SharedReadBlocks is not null && totalSharedRead > 0)
                ? (double)node.SharedReadBlocks.Value / totalSharedRead
                : null;

            var subtreeSharedRead = subtreeSharedReadById[nodeId];
            var subtreeSharedHit = subtreeSharedHitById[nodeId];
            double? subtreeBufferShare = (subtreeSharedRead is not null && totalSharedRead > 0)
                ? (double)subtreeSharedRead.Value / totalSharedRead
                : null;

            double? subtreeTimeShare = (subtreeTime is not null && rootInclusive is not null && rootInclusive.Value > 0)
                ? subtreeTime.Value / rootInclusive.Value
                : null;

            var metrics = new DerivedNodeMetrics(
                Depth: depth,
                IsRoot: isRoot,
                IsLeaf: isLeaf,
                ChildCount: childIds.Count,
                SubtreeNodeCount: subtreeNodeCountById[nodeId],

                InclusiveActualTimeMs: inclusive,
                ExclusiveActualTimeMsApprox: exclusive,
                SubtreeInclusiveTimeMs: subtreeTime,
                SubtreeTimeShare: subtreeTimeShare,

                ActualRowsTotal: actualRowsTotal,
                RowEstimateRatio: rowRatio,
                RowEstimateFactor: rowFactor,
                RowEstimateLog10Error: rowLog10,
                CostPerEstimatedRow: costPerEstRow,
                ActualTimePerOutputRowMs: timePerOutputRow,
                LoopsAmplification: loops,

                BufferTotalBlocks: bufferTotal,
                BufferShareOfPlan: bufferShareOfPlan,
                SubtreeSharedReadBlocks: subtreeSharedRead,
                SubtreeSharedHitBlocks: subtreeSharedHit,
                SubtreeBufferShare: subtreeBufferShare
            );

            analyzed.Add(new AnalyzedPlanNode(
                NodeId: nodeId,
                ParentNodeId: parentId,
                ChildNodeIds: childIds,
                Node: node,
                Metrics: metrics,
                ContextEvidence: null
            ));
        }

        // Second pass: compute compact operator-context evidence (may look into descendants).
        var byId = analyzed.ToDictionary(n => n.NodeId, StringComparer.Ordinal);
        for (var i = 0; i < analyzed.Count; i++)
        {
            var n = analyzed[i];
            var ctx = OperatorEvidenceCollector.Collect(n, byId);
            analyzed[i] = n with { ContextEvidence = ctx };
        }

        return analyzed;
    }

    // --- Approximation rules (documented) ---
    // Postgres JSON "Actual Total Time" is reported per-loop; we multiply by loops to get total inclusive.
    private static double? ComputeInclusiveActualTimeMs(NormalizedPlanNode node)
    {
        if (node.ActualTotalTimeMs is null) return null;
        var loops = node.ActualLoops ?? 1;
        return node.ActualTotalTimeMs.Value * loops;
    }

    private static double? ComputeActualRowsTotal(NormalizedPlanNode node)
    {
        if (node.ActualRows is null) return null;
        var loops = node.ActualLoops ?? 1;
        return node.ActualRows.Value * loops;
    }

    private static double? ComputeRowEstimateRatio(NormalizedPlanNode node)
    {
        if (node.PlanRows is null) return null;
        var est = node.PlanRows.Value;
        if (est <= 0) return null;

        var actualTotal = ComputeActualRowsTotal(node);
        if (actualTotal is null) return null;

        // Plan Rows are also per-loop in Postgres; normalize totals by multiplying estimate by loops.
        var loops = node.ActualLoops ?? 1;
        var estTotal = est * loops;
        if (estTotal <= 0) return null;

        return actualTotal.Value / estTotal;
    }

    private static decimal? ComputeCostPerEstimatedRow(NormalizedPlanNode node)
    {
        if (node.TotalCost is null || node.PlanRows is null) return null;
        if (node.PlanRows.Value <= 0) return null;
        return node.TotalCost.Value / (decimal)node.PlanRows.Value;
    }

    private static long? ComputeBufferTotalBlocks(NormalizedPlanNode node)
    {
        // Total across all known buffer counters (shared/local/temp; hit/read/dirtied/written).
        long total = 0;
        bool any = false;
        foreach (var v in new long?[]
                 {
                     node.SharedHitBlocks, node.SharedReadBlocks, node.SharedDirtiedBlocks, node.SharedWrittenBlocks,
                     node.LocalHitBlocks, node.LocalReadBlocks, node.LocalDirtiedBlocks, node.LocalWrittenBlocks,
                     node.TempReadBlocks, node.TempWrittenBlocks
                 })
        {
            if (v is null) continue;
            any = true;
            total += v.Value;
        }

        return any ? total : null;
    }

    private static long? AddNullableLong(long? a, long? b)
    {
        if (a is null && b is null) return null;
        return (a ?? 0) + (b ?? 0);
    }
}

