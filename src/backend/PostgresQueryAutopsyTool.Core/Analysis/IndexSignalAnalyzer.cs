using PostgresQueryAutopsyTool.Core.Domain;
using PostgresQueryAutopsyTool.Core.Findings;

namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>
/// Centralized, conservative index/access-path signals for findings, summaries, and UI.
/// Does not prescribe concrete DDL—only investigation angles grounded in plan fields.
/// </summary>
public static class IndexSignalAnalyzer
{
    public const string SignalMissingIndexInvestigation = "missingIndexInvestigation";
    public const string SignalIndexPathStillCostly = "indexPathStillCostly";
    public const string SignalBitmapRecheckOrHeapHeavy = "bitmapRecheckOrHeapHeavy";
    public const string SignalSortOrderSupportOpportunity = "sortOrderSupportOpportunity";
    public const string SignalJoinInnerIndexSupport = "joinInnerIndexSupport";

    public static string AccessPathFamily(string? nodeType)
    {
        var nt = nodeType ?? "";
        if (nt.Equals("Seq Scan", StringComparison.OrdinalIgnoreCase)) return IndexAccessPathTokens.SeqScan;
        if (nt.Equals("Index Scan", StringComparison.OrdinalIgnoreCase)) return IndexAccessPathTokens.IndexScan;
        if (nt.Equals("Index Only Scan", StringComparison.OrdinalIgnoreCase)) return IndexAccessPathTokens.IndexOnlyScan;
        if (nt.Equals("Bitmap Heap Scan", StringComparison.OrdinalIgnoreCase)) return IndexAccessPathTokens.BitmapHeapScan;
        if (nt.Equals("Bitmap Index Scan", StringComparison.OrdinalIgnoreCase)) return IndexAccessPathTokens.BitmapIndexScan;
        return IndexAccessPathTokens.Other;
    }

    public static PlanIndexOverview BuildOverview(IReadOnlyList<AnalyzedPlanNode> nodes, FindingEvaluationContext ctx)
    {
        var seq = 0;
        var ix = 0;
        var ixOnly = 0;
        var bh = 0;
        var bi = 0;
        var append = false;
        foreach (var n in nodes)
        {
            var t = n.Node.NodeType ?? "";
            if (t.Equals("Seq Scan", StringComparison.OrdinalIgnoreCase)) seq++;
            else if (t.Equals("Index Scan", StringComparison.OrdinalIgnoreCase)) ix++;
            else if (t.Equals("Index Only Scan", StringComparison.OrdinalIgnoreCase)) ixOnly++;
            else if (t.Equals("Bitmap Heap Scan", StringComparison.OrdinalIgnoreCase)) bh++;
            else if (t.Equals("Bitmap Index Scan", StringComparison.OrdinalIgnoreCase)) bi++;
            else if (t.Equals("Append", StringComparison.OrdinalIgnoreCase)) append = true;
        }

        var suggests = append && bh >= 6;
        var note = suggests
            ? "Append with many per-chunk bitmap heap scans: indexes appear in use, but aggregated reads/temp work can still dominate. Investigate time windows, chunk pruning, ordering/sort alignment, and predicate selectivity—not only “add an index.”"
            : null;

        return new PlanIndexOverview(
            SeqScanCount: seq,
            IndexScanCount: ix,
            IndexOnlyScanCount: ixOnly,
            BitmapHeapScanCount: bh,
            BitmapIndexScanCount: bi,
            HasAppendOperator: append,
            SuggestsChunkedBitmapWorkload: suggests,
            ChunkedWorkloadNote: note);
    }

    public static IReadOnlyList<PlanIndexInsight> BuildInsights(
        IReadOnlyList<AnalyzedPlanNode> nodes,
        FindingEvaluationContext ctx,
        PlanIndexOverview overview,
        int maxInsights = 28)
    {
        var list = new List<PlanIndexInsight>();
        var suppressBitmapDetails = overview.SuggestsChunkedBitmapWorkload;

        foreach (var n in nodes)
        {
            var nt = n.Node.NodeType ?? "";
            var family = AccessPathFamily(nt);

            if (family == IndexAccessPathTokens.SeqScan)
            {
                var sig = TrySeqScanMissingIndexSignals(n, ctx);
                if (sig is not null) list.Add(sig);
                continue;
            }

            if (family is IndexAccessPathTokens.IndexScan or IndexAccessPathTokens.IndexOnlyScan)
            {
                var sig = TryIndexPathCostly(n, ctx, family);
                if (sig is not null) list.Add(sig);
                continue;
            }

            if (family == IndexAccessPathTokens.BitmapHeapScan)
            {
                if (suppressBitmapDetails)
                    continue;
                var sig = TryBitmapHeapSignals(n, ctx);
                if (sig is not null) list.Add(sig);
                continue;
            }

            if (nt.Contains("Sort", StringComparison.OrdinalIgnoreCase))
            {
                var sig = TrySortOrderSignal(n, ctx);
                if (sig is not null) list.Add(sig);
            }
        }

        foreach (var n in nodes)
        {
            if (!string.Equals(n.Node.NodeType, "Nested Loop", StringComparison.OrdinalIgnoreCase))
                continue;
            var sig = TryNestedLoopInnerIndex(n, ctx);
            if (sig is not null) list.Add(sig);
        }

        return list
            .OrderByDescending(i => InsightPriority(i))
            .Take(maxInsights)
            .ToArray();
    }

    private static double InsightPriority(PlanIndexInsight i)
    {
        var p = 0.0;
        foreach (var s in i.SignalKinds)
        {
            p += s switch
            {
                SignalMissingIndexInvestigation => 4,
                SignalJoinInnerIndexSupport => 3.5,
                SignalIndexPathStillCostly => 3,
                SignalBitmapRecheckOrHeapHeavy => 2.5,
                SignalSortOrderSupportOpportunity => 2,
                _ => 0
            };
        }
        if (i.Facts.TryGetValue("subtreeTimeShareOfPlan", out var ts) && ts is double d) p += d;
        if (i.Facts.TryGetValue("sharedReadShareOfPlan", out var rs) && rs is double d2) p += d2 * 2;
        return p;
    }

    private static PlanIndexInsight? TrySeqScanMissingIndexSignals(AnalyzedPlanNode n, FindingEvaluationContext ctx)
    {
        var hasFilter = !string.IsNullOrWhiteSpace(n.Node.Filter);
        var timeShare = ctx.SubtreeTimeShareOfPlan(n) ?? 0;
        var readShare = ctx.SharedReadShareOfPlan(n) ?? 0;
        if (!hasFilter && timeShare < 0.22 && readShare < 0.22)
            return null;

        var rowsRemoved = n.Node.RowsRemovedByFilter ?? 0;
        var wasteShare = n.ContextEvidence?.ScanWaste?.RemovedRowsShareApprox;

        if (!hasFilter && rowsRemoved < 50 && wasteShare is null or < 0.15 && timeShare < 0.35 && readShare < 0.35)
            return null;

        var headline = $"Seq Scan on `{n.Node.RelationName ?? "unknown"}` — filter/index investigation may be warranted";
        return new PlanIndexInsight(
            n.NodeId,
            IndexAccessPathTokens.SeqScan,
            n.Node.NodeType,
            n.Node.RelationName,
            null,
            new[] { SignalMissingIndexInvestigation },
            headline,
            Facts(n, ctx,
                ("filter", n.Node.Filter),
                ("rowsRemovedByFilter", n.Node.RowsRemovedByFilter),
                ("removedRowsShareApprox", wasteShare)));
    }

    private static Dictionary<string, object?> BaseFacts(AnalyzedPlanNode n, FindingEvaluationContext ctx) => new()
    {
        ["subtreeTimeShareOfPlan"] = ctx.SubtreeTimeShareOfPlan(n),
        ["sharedReadShareOfPlan"] = ctx.SharedReadShareOfPlan(n),
        ["sharedReadBlocks"] = n.Node.SharedReadBlocks,
        ["actualRowsTotalApprox"] = n.Metrics.ActualRowsTotal,
        ["exclusiveTimeShareOfPlan"] = ctx.ExclusiveTimeShareOfPlan(n),
    };

    private static IReadOnlyDictionary<string, object?> Facts(AnalyzedPlanNode n, FindingEvaluationContext ctx,
        params (string Key, object? Value)[] extra)
    {
        var d = BaseFacts(n, ctx);
        foreach (var (k, v) in extra)
            d[k] = v;
        return d;
    }

    private static PlanIndexInsight? TryIndexPathCostly(AnalyzedPlanNode n, FindingEvaluationContext ctx, string family)
    {
        var readShare = ctx.SharedReadShareOfPlan(n) ?? 0;
        var heap = n.Node.HeapFetches ?? 0;
        var recheckRemoved = n.Node.RowsRemovedByIndexRecheck ?? 0;
        var timeShare = ctx.SubtreeTimeShareOfPlan(n) ?? 0;
        var rowsOut = n.Metrics.ActualRowsTotal ?? 0;

        var costlyReads = readShare >= 0.12 && (n.Node.SharedReadBlocks ?? 0) >= 500;
        var costlyHeap = heap >= 5_000;
        var costlyRecheck = recheckRemoved >= 100;
        var heavyVolume = rowsOut >= 50_000 && timeShare >= 0.12;

        if (!costlyReads && !costlyHeap && !costlyRecheck && !heavyVolume)
            return null;

        var headline = family == IndexAccessPathTokens.IndexOnlyScan
            ? $"Index Only Scan still shows large volume or heap/recheck work — verify selectivity and covering columns"
            : $"Index Scan path still concentrates reads/heap work — index may be weak, non-selective, or fighting correlation";

        var kinds = new List<string> { SignalIndexPathStillCostly };
        if (recheckRemoved > 0 || !string.IsNullOrWhiteSpace(n.Node.RecheckCond))
            kinds.Add(SignalBitmapRecheckOrHeapHeavy);

        return new PlanIndexInsight(
            n.NodeId,
            family,
            n.Node.NodeType,
            n.Node.RelationName,
            n.Node.IndexName,
            kinds,
            headline,
            Facts(n, ctx,
                ("indexCond", n.Node.IndexCond),
                ("recheckCond", n.Node.RecheckCond),
                ("heapFetches", n.Node.HeapFetches),
                ("rowsRemovedByIndexRecheck", n.Node.RowsRemovedByIndexRecheck)));
    }

    private static PlanIndexInsight? TryBitmapHeapSignals(AnalyzedPlanNode n, FindingEvaluationContext ctx)
    {
        var readShare = ctx.SharedReadShareOfPlan(n) ?? 0;
        var heap = n.Node.HeapFetches ?? 0;
        var recheckRemoved = n.Node.RowsRemovedByIndexRecheck ?? 0;
        var hasRecheckExpr = !string.IsNullOrWhiteSpace(n.Node.RecheckCond);

        var flag = readShare >= 0.10 && (n.Node.SharedReadBlocks ?? 0) >= 800
                   || heap >= 8_000
                   || recheckRemoved >= 200
                   || (hasRecheckExpr && heap >= 1_000);

        if (!flag) return null;

        var headline = hasRecheckExpr || recheckRemoved > 0
            ? "Bitmap Heap Scan with recheck/heap volume — bitmap path may be lossy or selective enough; investigate predicate + index definition"
            : "Bitmap Heap Scan still drives notable reads/heap fetches — index exists but access may be coarse or rows wide";

        return new PlanIndexInsight(
            n.NodeId,
            IndexAccessPathTokens.BitmapHeapScan,
            n.Node.NodeType,
            n.Node.RelationName,
            n.Node.IndexName,
            new[] { SignalBitmapRecheckOrHeapHeavy, SignalIndexPathStillCostly },
            headline,
            Facts(n, ctx,
                ("recheckCond", n.Node.RecheckCond),
                ("heapFetches", n.Node.HeapFetches),
                ("rowsRemovedByIndexRecheck", n.Node.RowsRemovedByIndexRecheck)));
    }

    private static PlanIndexInsight? TrySortOrderSignal(AnalyzedPlanNode n, FindingEvaluationContext ctx)
    {
        var method = n.Node.SortMethod ?? "";
        var spaceType = n.Node.SortSpaceType ?? "";
        var diskKb = n.Node.DiskUsageKb ?? 0;
        var external = method.Contains("external", StringComparison.OrdinalIgnoreCase)
                       || string.Equals(spaceType, "Disk", StringComparison.OrdinalIgnoreCase)
                       || diskKb > 0;
        var share = ctx.ExclusiveTimeShareOfPlan(n) ?? 0;
        if (!external && share < 0.18)
            return null;
        if (string.IsNullOrWhiteSpace(n.Node.SortKey))
            return null;

        return new PlanIndexInsight(
            n.NodeId,
            IndexAccessPathTokens.Other,
            n.Node.NodeType,
            null,
            null,
            new[] { SignalSortOrderSupportOpportunity },
            "Expensive sort with explicit keys — investigate whether an index can provide order earlier (or reduce rows pre-sort)",
            Facts(n, ctx,
                ("sortKey", n.Node.SortKey),
                ("sortMethod", n.Node.SortMethod),
                ("sortSpaceType", n.Node.SortSpaceType),
                ("sortSpaceUsedKb", n.Node.SortSpaceUsedKb)));
    }

    private static PlanIndexInsight? TryNestedLoopInnerIndex(AnalyzedPlanNode n, FindingEvaluationContext ctx)
    {
        if (n.ChildNodeIds.Count < 2) return null;
        var innerId = n.ChildNodeIds[1];
        if (!ctx.ById.TryGetValue(innerId, out var inner)) return null;

        var loops = inner.Node.ActualLoops ?? n.Node.ActualLoops ?? 1;
        if (loops < 25) return null;

        var innerFamily = AccessPathFamily(inner.Node.NodeType);
        if (innerFamily != IndexAccessPathTokens.SeqScan && innerFamily != IndexAccessPathTokens.BitmapHeapScan)
            return null;

        var innerShare = ctx.SubtreeTimeShareOfPlan(inner) ?? 0;
        var innerRead = ctx.SubtreeSharedReadShareOfPlan(inner) ?? 0;
        if (innerShare < 0.12 && innerRead < 0.12)
            return null;

        return new PlanIndexInsight(
            inner.NodeId,
            innerFamily,
            inner.Node.NodeType,
            inner.Node.RelationName,
            inner.Node.IndexName,
            new[] { SignalJoinInnerIndexSupport },
            "Nested loop inner side repeats often with seq/bitmap access — stronger or better-aligned index on the inner predicate may help",
            Facts(inner, ctx,
                ("nestedLoopNodeId", n.NodeId),
                ("innerLoops", loops),
                ("innerFilter", inner.Node.Filter),
                ("innerIndexCond", inner.Node.IndexCond)));
    }
}
