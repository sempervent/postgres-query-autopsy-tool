using PostgresQueryAutopsyTool.Core.Findings;

namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>Operator context for bottleneck, narrative, and selected-node copy (plan-evidence only).</summary>
public static class OperatorNarrativeHelper
{
    public static string BottleneckDetailLine(AnalyzedPlanNode n, IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        var type = n.Node.NodeType ?? "operator";
        var rel = n.Node.RelationName;
        var loops = n.Node.ActualLoops ?? 1;
        var rows = n.Metrics.ActualRowsTotal ?? n.Node.ActualRows;

        if (type.Contains("Sort", StringComparison.OrdinalIgnoreCase))
        {
            var key = string.IsNullOrWhiteSpace(n.Node.SortKey) ? "keys" : $"[{TrimKey(n.Node.SortKey!, 40)}]";
            return
                $"This {type} orders rows on {key} before later operators consume them. Large sorts often mean too many rows or wide rows are reaching the sort; check what feeds it and whether ordering can be satisfied earlier.";
        }

        if (type.Contains("Hash Join", StringComparison.OrdinalIgnoreCase) || type.Equals("Hash Join", StringComparison.OrdinalIgnoreCase))
            return "Hash join builds a hash table on one child and probes with the other—high cost often tracks build size, probe volume, or memory spills.";

        if (type.Contains("Nested Loop", StringComparison.OrdinalIgnoreCase))
            return "Nested loop re-runs its inner side per outer row; dominant cost is often repeated inner work or high outer cardinality.";

        if (type.Contains("Merge Join", StringComparison.OrdinalIgnoreCase))
            return "Merge join requires ordered inputs; expense often tracks how much sorting or index-ordering was needed to produce those inputs.";

        if (type.Contains("Aggregate", StringComparison.OrdinalIgnoreCase) || type.Contains("Group", StringComparison.OrdinalIgnoreCase))
            return "Aggregation collapses rows; high cost here often means a large grouped rowset or heavy per-group work before this node.";

        if (!string.IsNullOrWhiteSpace(rel) && (type.Contains("Scan", StringComparison.OrdinalIgnoreCase) || type.Contains("Bitmap", StringComparison.OrdinalIgnoreCase)))
        {
            var ix = n.Node.IndexName;
            var ixPart = string.IsNullOrWhiteSpace(ix) ? "" : $" using index `{ix}`";
            return $"Access path `{type}` on `{rel}`{ixPart} is where shared reads or runtime concentrate in this branch. Heavy reads here can feed later joins or sorts—check both this operator and what sits above it.";
        }

        if (type.Equals("Materialize", StringComparison.OrdinalIgnoreCase) || type.Equals("Memoize", StringComparison.OrdinalIgnoreCase))
        {
            return loops > 1
                ? $"{type} stores an intermediate result; under high loops ({loops}×) the stored rowset may be rebuilt or re-read often—inspect size and what forces re-execution."
                : $"{type} stores an intermediate result for reuse; cost tracks stored row width/volume and how often downstream operators revisit it.";
        }

        if (type.Equals("CTE Scan", StringComparison.OrdinalIgnoreCase) || type.Equals("Subquery Scan", StringComparison.OrdinalIgnoreCase))
        {
            var rowHint = rows is > 0 ? $" ~{rows:0} rows reported here." : "";
            return $"This `{type}` reads a named subplan boundary (CTE/subquery).{rowHint} Shape and row volume at this boundary often influence later joins and sorts.";
        }

        if (type.Equals("Append", StringComparison.OrdinalIgnoreCase))
            return "Append chooses among child subtrees (common for chunk-parallel or UNION ALL-style plans); total work sums across active children—heavy cost may be many chunk scans rather than one missing index.";

        if (type.Contains("Gather", StringComparison.OrdinalIgnoreCase))
            return "Gather merges parallel worker output; skew across workers or expensive partial branches can show up here or immediately underneath.";

        if (type.Contains("Bitmap Index Scan", StringComparison.OrdinalIgnoreCase) &&
            !type.Contains("Heap", StringComparison.OrdinalIgnoreCase))
            return "Bitmap index scans build row sets for heap access; lossy bitmaps or wide matching sets increase recheck and heap work downstream.";

        return $"Operator `{NodeLabelFormatter.ShortLabel(n, byId)}` concentrates measurable work in this plan snapshot.";
    }

    public static string? SymptomNoteIfNestedLoopInner(AnalyzedPlanNode n, IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        if (string.IsNullOrEmpty(n.ParentNodeId) || !byId.TryGetValue(n.ParentNodeId, out var parent))
            return null;

        var pt = parent.Node.NodeType ?? "";
        if (!pt.Contains("Nested Loop", StringComparison.OrdinalIgnoreCase))
            return null;

        var kids = parent.ChildNodeIds;
        if (kids is null || kids.Count < 2)
            return null;

        if (!string.Equals(kids[1], n.NodeId, StringComparison.Ordinal))
            return null;

        return "Sits on the inner side of a nested loop—cost may be a symptom of outer row count, join condition, or inner-side filtering/index support.";
    }

    /// <summary>Phase 59: compact interpretive copy for the selected-node panel (no raw field dump).</summary>
    public static string BuildSelectedNodeInterpretation(
        AnalyzedPlanNode n,
        FindingEvaluationContext ctx,
        bool isRankedBottleneck,
        bool isTopExclusiveHotspot,
        string? queryText = null)
    {
        var byId = ctx.ById;
        var parts = new List<string> { BottleneckDetailLine(n, byId) };

        var qh = PlanNodeReferenceBuilder.Build(n, byId, ctx.RootNodeId, queryText).QueryCorrespondenceHint;
        if (!string.IsNullOrWhiteSpace(qh))
            parts.Add(qh);

        var importance = new List<string>();
        if (isRankedBottleneck)
            importance.Add("appears in the ranked Main bottlenecks list for this snapshot");
        if (isTopExclusiveHotspot)
            importance.Add("is among the top exclusive-time hotspots");
        if (importance.Count > 0)
            parts.Add("This operator " + string.Join(" and ", importance) + ".");

        var exShare = ctx.ExclusiveTimeShareOfPlan(n) ?? 0;
        var readShare = ctx.SharedReadShareOfPlan(n) ?? 0;
        if (exShare >= 0.12 || readShare >= 0.12)
            parts.Add(
                $"Rough share of root work here: exclusive time ~{exShare:P0} of root inclusive; shared reads ~{readShare:P0} of root reads (when measurable).");

        var childHint = ChildSubtreeConcentrationHint(n, ctx);
        if (childHint is not null)
            parts.Add(childHint);

        return string.Join(" ", parts);
    }

    private static string? ChildSubtreeConcentrationHint(AnalyzedPlanNode n, FindingEvaluationContext ctx)
    {
        if (n.ChildNodeIds.Count == 0) return null;
        foreach (var cid in n.ChildNodeIds)
        {
            if (!ctx.ById.TryGetValue(cid, out var c)) continue;
            var share = ctx.SubtreeTimeShareOfPlan(c) ?? 0;
            if (share < 0.42) continue;
            var label = NodeLabelFormatter.ShortLabel(c, ctx.ById);
            return $"Much of the time under this branch sits under “{label}” (~{share:P0} subtree share)—open that child if this node’s own exclusive time looks modest.";
        }

        return null;
    }

    public static string ExecutionShapeSummary(FindingEvaluationContext ctx)
    {
        var counts = ctx.NodeTypeCounts;
        var total = Math.Max(1, ctx.Nodes.Count);
        var joins = counts.Keys.Count(k => k.Contains("Join", StringComparison.OrdinalIgnoreCase));
        var scans = counts.Where(kv => kv.Key.Contains("Scan", StringComparison.OrdinalIgnoreCase)).Sum(kv => kv.Value);
        var sorts = counts.Keys.Count(k => k.Contains("Sort", StringComparison.OrdinalIgnoreCase));
        var nl = counts.TryGetValue("Nested Loop", out var nlc) ? nlc : 0;
        var hj = (counts.TryGetValue("Hash Join", out var hjc) ? hjc : 0) + (counts.TryGetValue("Parallel Hash Join", out var phj) ? phj : 0);
        var cte = counts.Keys.Count(k => k.Equals("CTE Scan", StringComparison.OrdinalIgnoreCase) || k.Equals("Subquery Scan", StringComparison.OrdinalIgnoreCase));

        var parts = new List<string>();
        if (joins > 0)
            parts.Add(
                nl > hj
                    ? $"join-heavy plan leaning on nested loops ({nl} nested loop join(s), {hj} hash join(s))"
                    : $"join-heavy plan with mixed strategies ({hj} hash join(s), {nl} nested loop join(s))");

        if (scans > total * 0.35 && scans > 6)
            parts.Add("many scan operators—check which scans are selective vs wide");

        if (sorts > 0)
            parts.Add($"{sorts} sort operator type(s)—watch for large rowsets entering sorts");

        if (cte > 0)
            parts.Add("CTE/subquery scan boundaries present—row counts crossing those boundaries can dominate downstream work");

        if (parts.Count == 0)
            return $"Plan has {total} operators to max depth {ctx.Nodes.Max(x => x.Metrics.Depth)}.";

        return string.Join("; ", parts) + ".";
    }

    private static string TrimKey(string s, int max)
    {
        var t = string.Join(" ", s.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (t.Length <= max) return t;
        return t[..(max - 1)] + "…";
    }
}
