using PostgresQueryAutopsyTool.Core.Domain;
using PostgresQueryAutopsyTool.Core.Findings;

namespace PostgresQueryAutopsyTool.Core.Analysis;

internal static class BottleneckClassifier
{
    public static BottleneckClass ClassForExclusiveOrSubtreeNode(AnalyzedPlanNode n, FindingEvaluationContext ctx)
    {
        var t = n.Node.NodeType ?? "";
        if (t.Contains("Sort", StringComparison.OrdinalIgnoreCase))
        {
            if (SortLooksSpillHeavy(n))
                return BottleneckClass.SortOrSpillPressure;
            return BottleneckClass.SortOrSpillPressure;
        }

        if (t.Contains("Nested Loop", StringComparison.OrdinalIgnoreCase) ||
            t.Contains("Hash Join", StringComparison.OrdinalIgnoreCase) ||
            t.Contains("Merge Join", StringComparison.OrdinalIgnoreCase))
            return BottleneckClass.JoinAmplification;

        if (t.Contains("Aggregate", StringComparison.OrdinalIgnoreCase) ||
            t.Contains("Group", StringComparison.OrdinalIgnoreCase))
            return BottleneckClass.AggregationPressure;

        if (t.Equals("CTE Scan", StringComparison.OrdinalIgnoreCase) ||
            t.Equals("Subquery Scan", StringComparison.OrdinalIgnoreCase))
            return BottleneckClass.QueryShapeBoundary;

        if (t.Equals("Materialize", StringComparison.OrdinalIgnoreCase) ||
            t.Equals("Memoize", StringComparison.OrdinalIgnoreCase))
            return BottleneckClass.JoinAmplification;

        if (!string.IsNullOrWhiteSpace(n.Node.RelationName) &&
            (t.Contains("Scan", StringComparison.OrdinalIgnoreCase) || t.Contains("Bitmap", StringComparison.OrdinalIgnoreCase)))
        {
            var reads = n.Node.SharedReadBlocks ?? 0;
            var readShare = ctx.SharedReadShareOfPlan(n) ?? 0;
            if (reads >= 500 || readShare >= 0.08)
                return BottleneckClass.IoHotspot;
            if ((n.Metrics.RowEstimateFactor ?? 0) >= 25)
                return BottleneckClass.ScanFanout;
            return BottleneckClass.CpuHotspot;
        }

        return BottleneckClass.GeneralTime;
    }

    public static BottleneckClass ClassForIoReadNode(AnalyzedPlanNode n, FindingEvaluationContext ctx)
    {
        var t = n.Node.NodeType ?? "";
        if (!string.IsNullOrWhiteSpace(n.Node.IndexName) &&
            (t.Contains("Index", StringComparison.OrdinalIgnoreCase) || t.Contains("Bitmap", StringComparison.OrdinalIgnoreCase)))
            return BottleneckClass.AccessPathMismatch;
        return BottleneckClass.IoHotspot;
    }

    public static BottleneckClass ClassForFinding(AnalysisFinding f)
    {
        var id = f.RuleId;
        if (id.Contains("row-misestimation", StringComparison.OrdinalIgnoreCase))
            return BottleneckClass.PlannerMisestimation;
        if (id.Contains("nested-loop", StringComparison.OrdinalIgnoreCase) ||
            id.Contains("nl-inner", StringComparison.OrdinalIgnoreCase))
            return BottleneckClass.JoinAmplification;
        if (id.Contains("sort-cost", StringComparison.OrdinalIgnoreCase))
            return BottleneckClass.SortOrSpillPressure;
        if (id.Contains("buffer-read", StringComparison.OrdinalIgnoreCase) ||
            id.Contains("seq-scan", StringComparison.OrdinalIgnoreCase) ||
            id.Contains("indexing-opportunity", StringComparison.OrdinalIgnoreCase) ||
            id.Contains("index-access-still", StringComparison.OrdinalIgnoreCase))
            return BottleneckClass.IoHotspot;
        if (id.Contains("query-shape-boundary", StringComparison.OrdinalIgnoreCase))
            return BottleneckClass.QueryShapeBoundary;
        if (id.Contains("hash-join", StringComparison.OrdinalIgnoreCase))
            return BottleneckClass.JoinAmplification;
        if (id.Contains("materialize", StringComparison.OrdinalIgnoreCase))
            return BottleneckClass.JoinAmplification;
        return BottleneckClass.GeneralTime;
    }

    public static BottleneckCauseHint CauseHintFor(
        string kind,
        AnalyzedPlanNode? anchor,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId,
        int rank)
    {
        if (anchor is null)
            return BottleneckCauseHint.Ambiguous;

        if (!string.IsNullOrWhiteSpace(OperatorNarrativeHelper.SymptomNoteIfNestedLoopInner(anchor, byId)))
            return BottleneckCauseHint.DownstreamSymptom;

        if (kind.Equals("time_subtree", StringComparison.OrdinalIgnoreCase) && rank > 1)
            return BottleneckCauseHint.Ambiguous;

        if (kind.Equals("finding", StringComparison.OrdinalIgnoreCase) &&
            anchor.Node.NodeType?.Contains("Sort", StringComparison.OrdinalIgnoreCase) == true &&
            ParentLooksJoinHeavy(anchor, byId))
            return BottleneckCauseHint.DownstreamSymptom;

        if (rank == 1 && kind is "time_exclusive" or "io_read" or "finding" or "query_shape")
            return BottleneckCauseHint.PrimaryFocus;

        return BottleneckCauseHint.Ambiguous;
    }

    private static bool ParentLooksJoinHeavy(AnalyzedPlanNode n, IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        if (string.IsNullOrEmpty(n.ParentNodeId) || !byId.TryGetValue(n.ParentNodeId, out var p))
            return false;
        var pt = p.Node.NodeType ?? "";
        return pt.Contains("Join", StringComparison.OrdinalIgnoreCase) ||
               pt.Contains("Nested Loop", StringComparison.OrdinalIgnoreCase);
    }

    private static bool SortLooksSpillHeavy(AnalyzedPlanNode n)
    {
        var m = n.Node.SortMethod ?? "";
        var st = n.Node.SortSpaceType ?? "";
        return m.Contains("external", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(st, "Disk", StringComparison.OrdinalIgnoreCase) ||
               (n.Node.DiskUsageKb ?? 0) > 0;
    }
}
