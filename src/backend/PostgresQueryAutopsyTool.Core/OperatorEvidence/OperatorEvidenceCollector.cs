using PostgresQueryAutopsyTool.Core.Analysis;

namespace PostgresQueryAutopsyTool.Core.OperatorEvidence;

public static class OperatorEvidenceCollector
{
    public sealed record Options(
        int MaxSubtreeNodesToInspect = 60,
        int MaxDescendantDepth = 3);

    public static OperatorContextEvidence Collect(AnalyzedPlanNode node, IReadOnlyDictionary<string, AnalyzedPlanNode> byId, Options? options = null)
    {
        var opt = options ?? new Options();

        var type = node.Node.NodeType ?? "Unknown";

        HashJoinContextEvidence? hashJoin = null;
        SortContextEvidence? sort = null;
        NestedLoopContextEvidence? nestedLoop = null;
        ScanWasteContextEvidence? scanWaste = null;
        MaterializeContextEvidence? materialize = null;
        MemoizeContextEvidence? memoize = null;

        if (type.Contains("Hash Join", StringComparison.OrdinalIgnoreCase))
            hashJoin = CollectHashJoin(node, byId, opt);

        if (type.Contains("Sort", StringComparison.OrdinalIgnoreCase))
            sort = CollectSort(node, byId, opt);

        if (string.Equals(type, "Nested Loop", StringComparison.OrdinalIgnoreCase))
            nestedLoop = CollectNestedLoop(node, byId, opt);

        if (type.Contains("Scan", StringComparison.OrdinalIgnoreCase))
            scanWaste = CollectScanWaste(node, byId, opt, includeSubtree: false);
        else
        {
            // Propagate scan waste to parents when it is meaningful.
            var sub = CollectScanWaste(node, byId, opt, includeSubtree: true);
            if (sub is not null && (sub.RowsRemovedByFilter ?? 0) > 0)
                scanWaste = sub;
        }

        if (string.Equals(type, "Materialize", StringComparison.OrdinalIgnoreCase))
            materialize = new MaterializeContextEvidence(
                Loops: node.Node.ActualLoops,
                SubtreeTimeShareOfPlan: node.Metrics.SubtreeTimeShare,
                SubtreeSharedReadShareOfPlan: node.Metrics.SubtreeBufferShare);

        if (string.Equals(type, "Memoize", StringComparison.OrdinalIgnoreCase))
            memoize = CollectMemoize(node);

        return new OperatorContextEvidence(hashJoin, sort, nestedLoop, scanWaste, materialize, memoize);
    }

    private static HashJoinContextEvidence CollectHashJoin(AnalyzedPlanNode join, IReadOnlyDictionary<string, AnalyzedPlanNode> byId, Options opt)
    {
        var childHash = FindFirstDescendant(join, byId, n => string.Equals(n.Node.NodeType, "Hash", StringComparison.OrdinalIgnoreCase), opt);
        HashChildEvidence? hash = null;
        if (childHash is not null)
        {
            hash = new HashChildEvidence(
                HashNodeId: childHash.NodeId,
                HashBuckets: childHash.Node.HashBuckets,
                OriginalHashBuckets: childHash.Node.OriginalHashBuckets,
                HashBatches: childHash.Node.HashBatches,
                OriginalHashBatches: childHash.Node.OriginalHashBatches,
                PeakMemoryUsageKb: childHash.Node.PeakMemoryUsageKb,
                DiskUsageKb: childHash.Node.DiskUsageKb);
        }

        // Best-effort build/probe row magnitudes: use direct children as the two sides (common shape).
        double? side0 = null;
        double? side1 = null;
        if (join.ChildNodeIds.Count > 0 && byId.TryGetValue(join.ChildNodeIds[0], out var c0))
            side0 = c0.Metrics.ActualRowsTotal;
        if (join.ChildNodeIds.Count > 1 && byId.TryGetValue(join.ChildNodeIds[1], out var c1))
            side1 = c1.Metrics.ActualRowsTotal;

        return new HashJoinContextEvidence(
            ChildHash: hash,
            HashCond: join.Node.HashCond,
            BuildSideActualRowsTotal: side1,
            ProbeSideActualRowsTotal: side0);
    }

    private static SortContextEvidence CollectSort(AnalyzedPlanNode sort, IReadOnlyDictionary<string, AnalyzedPlanNode> byId, Options opt)
    {
        // Input row volume: prefer first child actual rows total.
        double? inputRows = null;
        if (sort.ChildNodeIds.Count > 0 && byId.TryGetValue(sort.ChildNodeIds[0], out var c0))
            inputRows = c0.Metrics.ActualRowsTotal;

        return new SortContextEvidence(
            SortMethod: sort.Node.SortMethod,
            SortSpaceUsedKb: sort.Node.SortSpaceUsedKb,
            SortSpaceType: sort.Node.SortSpaceType,
            PeakMemoryUsageKb: sort.Node.PeakMemoryUsageKb,
            DiskUsageKb: sort.Node.DiskUsageKb,
            InputActualRowsTotal: inputRows);
    }

    private static NestedLoopContextEvidence CollectNestedLoop(AnalyzedPlanNode nl, IReadOnlyDictionary<string, AnalyzedPlanNode> byId, Options opt)
    {
        string? innerId = nl.ChildNodeIds.Count > 1 ? nl.ChildNodeIds[1] : (nl.ChildNodeIds.Count > 0 ? nl.ChildNodeIds[0] : null);
        AnalyzedPlanNode? inner = null;
        if (innerId is not null) byId.TryGetValue(innerId, out inner);

        var loops = inner?.Node.ActualLoops ?? nl.Node.ActualLoops;
        var innerShare = inner?.Metrics.SubtreeTimeShare;
        var innerWaste = inner is not null ? CollectScanWaste(inner, byId, opt, includeSubtree: true) : null;

        return new NestedLoopContextEvidence(
            InnerNodeId: inner?.NodeId,
            InnerLoopsApprox: loops,
            InnerSubtreeTimeShareOfPlan: innerShare,
            InnerSideScanWaste: innerWaste);
    }

    private static MemoizeContextEvidence? CollectMemoize(AnalyzedPlanNode node)
    {
        var hits = node.Node.CacheHits;
        var misses = node.Node.CacheMisses;
        double? hitRate = null;
        if (hits is not null && misses is not null && (hits.Value + misses.Value) > 0)
            hitRate = (double)hits.Value / (hits.Value + misses.Value);

        if (node.Node.CacheKey is null &&
            hits is null && misses is null &&
            node.Node.CacheEvictions is null && node.Node.CacheOverflows is null)
            return null;

        return new MemoizeContextEvidence(
            CacheKey: node.Node.CacheKey,
            CacheHits: hits,
            CacheMisses: misses,
            CacheEvictions: node.Node.CacheEvictions,
            CacheOverflows: node.Node.CacheOverflows,
            HitRate: hitRate);
    }

    private static ScanWasteContextEvidence? CollectScanWaste(AnalyzedPlanNode node, IReadOnlyDictionary<string, AnalyzedPlanNode> byId, Options opt, bool includeSubtree)
    {
        // Candidate scans: either this node (local) or first scan found in subtree.
        var targets = includeSubtree
            ? EnumerateSubtree(node, byId, opt).Where(n => (n.Node.NodeType ?? "").Contains("Scan", StringComparison.OrdinalIgnoreCase)).ToArray()
            : new[] { node };

        if (targets.Length == 0)
            return null;

        // Pick primary scan with largest removed-by-filter as a useful explanatory anchor.
        var primary = targets
            .OrderByDescending(n => n.Node.RowsRemovedByFilter ?? 0)
            .ThenByDescending(n => n.Node.SharedReadBlocks ?? 0)
            .First();

        var removedFilter = primary.Node.RowsRemovedByFilter;
        var removedJoin = primary.Node.RowsRemovedByJoinFilter;
        var removedRecheck = primary.Node.RowsRemovedByIndexRecheck;
        var heapFetches = primary.Node.HeapFetches;

        // Approx removed share: removed / (removed + output) when we have both.
        double? removedShare = null;
        if (removedFilter is not null && primary.Metrics.ActualRowsTotal is not null)
        {
            var denom = removedFilter.Value + primary.Metrics.ActualRowsTotal.Value;
            if (denom > 0) removedShare = removedFilter.Value / denom;
        }

        // Only surface propagated scan waste when we have an actual “waste-ish” signal.
        var anyWaste =
            (removedFilter ?? 0) > 0 ||
            (removedJoin ?? 0) > 0 ||
            (removedRecheck ?? 0) > 0 ||
            (heapFetches ?? 0) > 0;

        if (!anyWaste)
            return null;

        return new ScanWasteContextEvidence(
            PrimaryScanNodeId: primary.NodeId,
            PrimaryScanNodeType: primary.Node.NodeType,
            RelationName: primary.Node.RelationName,
            RowsRemovedByFilter: removedFilter,
            RowsRemovedByJoinFilter: removedJoin,
            RowsRemovedByIndexRecheck: removedRecheck,
            HeapFetches: heapFetches,
            RemovedRowsShareApprox: removedShare);
    }

    private static IEnumerable<AnalyzedPlanNode> EnumerateSubtree(AnalyzedPlanNode root, IReadOnlyDictionary<string, AnalyzedPlanNode> byId, Options opt)
    {
        var queue = new Queue<(string nodeId, int depth)>();
        var seen = new HashSet<string>(StringComparer.Ordinal);

        queue.Enqueue((root.NodeId, 0));
        seen.Add(root.NodeId);

        var yielded = 0;
        while (queue.Count > 0 && yielded < opt.MaxSubtreeNodesToInspect)
        {
            var (id, depth) = queue.Dequeue();
            if (!byId.TryGetValue(id, out var node)) continue;

            yield return node;
            yielded++;

            if (depth >= opt.MaxDescendantDepth) continue;

            foreach (var childId in node.ChildNodeIds)
            {
                if (seen.Add(childId))
                    queue.Enqueue((childId, depth + 1));
            }
        }
    }

    private static AnalyzedPlanNode? FindFirstDescendant(AnalyzedPlanNode root, IReadOnlyDictionary<string, AnalyzedPlanNode> byId, Func<AnalyzedPlanNode, bool> predicate, Options opt)
    {
        foreach (var n in EnumerateSubtree(root, byId, opt))
        {
            if (n.NodeId == root.NodeId) continue;
            if (predicate(n)) return n;
        }
        return null;
    }
}

