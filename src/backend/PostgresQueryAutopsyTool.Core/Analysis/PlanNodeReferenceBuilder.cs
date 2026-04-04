using System.Text.RegularExpressions;
using PostgresQueryAutopsyTool.Core.Findings;

namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>Phase 61: derives human-readable anchors from plan evidence (bounded inference, hedged query hints).</summary>
public static class PlanNodeReferenceBuilder
{
    private static readonly Regex OrderByRx = new(@"\border\s+by\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex GroupByRx = new(@"\bgroup\s+by\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex TimeBucketRx = new(@"\btime_bucket\s*\(", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    public static PlanNodeHumanReference Build(AnalyzedPlanNode n, FindingEvaluationContext ctx) =>
        Build(n, ctx.ById, ctx.RootNodeId, queryText: null);

    public static PlanNodeHumanReference Build(
        AnalyzedPlanNode n,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId,
        string rootNodeId,
        string? queryText = null)
    {
        var type = n.Node.NodeType ?? "Unknown";
        var role = InferJoinChildRole(n, byId);
        var boundary = NearestBoundaryUnder(n, byId, rootNodeId);
        var queryHint = QueryHintForNode(n, type, queryText);
        var primary = PrimaryLabelCore(n, byId);
        return new PlanNodeHumanReference(n.NodeId, primary, role, boundary, queryHint);
    }

    /// <summary>Primary label only (no boundary/query); safe for parent snippets without recursive boundary walks.</summary>
    public static string PrimaryLabelCore(AnalyzedPlanNode n, IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        var type = n.Node.NodeType ?? "Unknown";
        var rel = n.Node.RelationName;
        var idx = n.Node.IndexName;
        var depth = n.Metrics.Depth;

        if (!string.IsNullOrWhiteSpace(rel) &&
            (type.Contains("Scan", StringComparison.OrdinalIgnoreCase) || type.Contains("Bitmap", StringComparison.OrdinalIgnoreCase)))
        {
            if (!string.IsNullOrWhiteSpace(idx) && type.Contains("Index", StringComparison.OrdinalIgnoreCase))
                return $"{type} on {rel} using {idx}";
            return $"{type} on {rel}";
        }

        if (type.Contains("Sort", StringComparison.OrdinalIgnoreCase))
        {
            var key = string.IsNullOrWhiteSpace(n.Node.SortKey) ? "plan sort keys" : TrimKey(n.Node.SortKey!, 56);
            var feed = n.ChildNodeIds.Count > 0 ? FirstDescendantRelation(n.ChildNodeIds[0], byId) : null;
            return feed is not null ? $"Sort on {feed} by {key}" : $"Sort by {key}";
        }

        if (type.Contains("Aggregate", StringComparison.OrdinalIgnoreCase) ||
            type.Contains("Group", StringComparison.OrdinalIgnoreCase))
        {
            var gk = string.IsNullOrWhiteSpace(n.Node.GroupKey) ? null : TrimKey(n.Node.GroupKey!, 48);
            var partial = n.Node.PartialMode;
            var prefix = partial is not null && partial.Contains("Partial", StringComparison.OrdinalIgnoreCase)
                ? "Partial aggregate"
                : partial is not null && partial.Contains("Final", StringComparison.OrdinalIgnoreCase)
                    ? "Final aggregate"
                    : "Aggregate";
            var primary = gk is not null ? $"{prefix} grouping on {gk}" : $"{prefix} ({type})";
            var childRel = n.ChildNodeIds.Count > 0 ? FirstDescendantRelation(n.ChildNodeIds[0], byId) : null;
            if (childRel is not null && !primary.Contains(childRel, StringComparison.OrdinalIgnoreCase))
                primary += $" over {childRel}";
            return primary;
        }

        if (type.Contains("Join", StringComparison.OrdinalIgnoreCase) || type.Equals("Nested Loop", StringComparison.OrdinalIgnoreCase))
        {
            var (leftRel, rightRel) = JoinSideRelations(n, byId);
            if (!string.IsNullOrWhiteSpace(leftRel) && !string.IsNullOrWhiteSpace(rightRel))
                return $"{type} ({leftRel} × {rightRel})";
            if (!string.IsNullOrWhiteSpace(n.Node.JoinType))
                return $"{type} ({n.Node.JoinType})";
            return type;
        }

        if (type.Equals("CTE Scan", StringComparison.OrdinalIgnoreCase) ||
            type.Equals("Subquery Scan", StringComparison.OrdinalIgnoreCase))
        {
            var alias = string.IsNullOrWhiteSpace(n.Node.Alias) ? null : n.Node.Alias;
            return alias is not null ? $"{type} ({alias})" : $"{type} (subplan boundary)";
        }

        if (type.Equals("Append", StringComparison.OrdinalIgnoreCase))
            return "Append (chunk/union-style fan-out)";

        if (type.Contains("Gather", StringComparison.OrdinalIgnoreCase))
        {
            var under = n.ChildNodeIds.Count > 0 ? FirstMeaningfulChildType(n.ChildNodeIds[0], byId) : null;
            var aggHint = under is not null && under.Contains("Aggregate", StringComparison.OrdinalIgnoreCase)
                ? " above partial aggregate branch"
                : "";
            return type.Contains("Merge", StringComparison.OrdinalIgnoreCase)
                ? $"Gather Merge{aggHint}"
                : $"Gather{aggHint}";
        }

        if (type.Equals("Materialize", StringComparison.OrdinalIgnoreCase) || type.Equals("Memoize", StringComparison.OrdinalIgnoreCase))
            return $"{type} (intermediate cache)";

        if (!string.IsNullOrWhiteSpace(rel))
            return $"{type} on {rel}";

        return $"{type} (depth {depth})";
    }

    public static string DisplayLine(PlanNodeHumanReference r)
    {
        var parts = new List<string> { r.PrimaryLabel };
        if (!string.IsNullOrWhiteSpace(r.RoleInPlan))
            parts.Add(r.RoleInPlan);
        if (!string.IsNullOrWhiteSpace(r.BoundaryUnder))
            parts.Add(r.BoundaryUnder);
        var core = string.Join(" — ", parts);
        if (!string.IsNullOrWhiteSpace(r.QueryCorrespondenceHint))
            return $"{core}. {r.QueryCorrespondenceHint}";
        return core;
    }

    /// <summary>Safe label when only an id is known; avoids exposing <c>root.*</c> paths as primary copy.</summary>
    public static string SafePrimary(string? nodeId, FindingEvaluationContext ctx)
    {
        if (string.IsNullOrEmpty(nodeId))
            return "this plan";
        if (!ctx.ById.TryGetValue(nodeId, out var n))
            return LooksLikePlannerPath(nodeId) ? "an operator in this plan" : nodeId;
        return Build(n, ctx).PrimaryLabel;
    }

    public static string SafePrimary(string? nodeId, IReadOnlyDictionary<string, AnalyzedPlanNode> byId, string rootNodeId)
    {
        if (string.IsNullOrEmpty(nodeId))
            return "this plan";
        if (!byId.TryGetValue(nodeId, out var n))
            return LooksLikePlannerPath(nodeId) ? "an operator in this plan" : nodeId;
        return Build(n, byId, rootNodeId).PrimaryLabel;
    }

    public static string PairHumanLabel(
        AnalyzedPlanNode a,
        AnalyzedPlanNode b,
        FindingEvaluationContext ctxA,
        FindingEvaluationContext ctxB)
    {
        var la = DisplayLine(Build(a, ctxA));
        var lb = DisplayLine(Build(b, ctxB));
        return $"{la} → {lb}";
    }

    internal static bool LooksLikePlannerPath(string nodeId) =>
        nodeId.StartsWith("root", StringComparison.Ordinal) && nodeId.Contains('.', StringComparison.Ordinal);

    private static string? QueryHintForNode(AnalyzedPlanNode n, string type, string? queryText)
    {
        if (string.IsNullOrWhiteSpace(queryText))
            return null;

        if (type.Contains("Sort", StringComparison.OrdinalIgnoreCase) && OrderByRx.IsMatch(queryText))
            return "Likely corresponds to ORDER BY shape in the source query (heuristic).";

        if ((type.Contains("Aggregate", StringComparison.OrdinalIgnoreCase) ||
             type.Contains("Group", StringComparison.OrdinalIgnoreCase)) && GroupByRx.IsMatch(queryText))
            return "Likely aligns with a GROUP BY boundary in the source query (heuristic).";

        if (!string.IsNullOrWhiteSpace(n.Node.RelationName) &&
            n.Node.RelationName.Contains("_hyper_", StringComparison.OrdinalIgnoreCase) &&
            TimeBucketRx.IsMatch(queryText))
            return "Chunk-style relation with time_bucket in the query often implies chunk fan-out in the plan (heuristic).";

        return null;
    }

    private static string? InferJoinChildRole(AnalyzedPlanNode n, IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        if (string.IsNullOrEmpty(n.ParentNodeId) || !byId.TryGetValue(n.ParentNodeId, out var parent))
            return null;

        var pt = parent.Node.NodeType ?? "";
        var kids = parent.ChildNodeIds;
        if (kids is null || kids.Count < 2)
            return null;

        var isNl = pt.Contains("Nested Loop", StringComparison.OrdinalIgnoreCase);
        var isHj = pt.Contains("Hash Join", StringComparison.OrdinalIgnoreCase);
        var isMj = pt.Contains("Merge Join", StringComparison.OrdinalIgnoreCase);
        if (!isNl && !isHj && !isMj)
            return null;

        var (lRel, rRel) = JoinSideRelations(parent, byId);
        var left = kids[0];
        var right = kids[1];
        var isFirst = string.Equals(left, n.NodeId, StringComparison.Ordinal);

        if (isNl || isMj)
        {
            if (isFirst && lRel is not null && rRel is not null)
                return $"outer side of {pt} joining {lRel} × {rRel}";
            if (!isFirst && lRel is not null && rRel is not null)
                return $"inner side of {pt} joining {lRel} × {rRel}";
        }

        if (isHj)
        {
            // Convention aligned with frontend: left probes, right builds (often via Hash node).
            if (isFirst && lRel is not null && rRel is not null)
                return $"probe side of {pt} ({lRel} × {rRel})";
            if (!isFirst && lRel is not null && rRel is not null)
                return $"build side of {pt} ({lRel} × {rRel})";
        }

        return null;
    }

    private static string? NearestBoundaryUnder(AnalyzedPlanNode n, IReadOnlyDictionary<string, AnalyzedPlanNode> byId, string rootNodeId)
    {
        var cur = n;
        for (var i = 0; i < 24 && !string.IsNullOrEmpty(cur.ParentNodeId); i++)
        {
            if (!byId.TryGetValue(cur.ParentNodeId, out var p))
                break;
            var t = p.Node.NodeType ?? "";
            var isJoin = t.Contains("Join", StringComparison.OrdinalIgnoreCase) || t.Equals("Nested Loop", StringComparison.OrdinalIgnoreCase);
            var isAgg = t.Contains("Aggregate", StringComparison.OrdinalIgnoreCase);
            var isSort = t.Contains("Sort", StringComparison.OrdinalIgnoreCase);
            var isGather = t.Contains("Gather", StringComparison.OrdinalIgnoreCase);
            if (isJoin || isAgg || isSort || isGather)
                return $"under {PrimaryLabelCore(p, byId)}";
            if (string.Equals(p.NodeId, rootNodeId, StringComparison.Ordinal))
                break;
            cur = p;
        }

        return null;
    }

    private static (string? Left, string? Right) JoinSideRelations(AnalyzedPlanNode join, IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        var kids = join.ChildNodeIds ?? Array.Empty<string>();
        if (kids.Count < 2)
            return (null, null);

        var leftRel = FirstDescendantRelation(kids[0], byId);
        var rightRel = FirstDescendantRelation(kids[1], byId);

        var isHashJoin = (join.Node.NodeType ?? "").Contains("Hash Join", StringComparison.OrdinalIgnoreCase);
        if (isHashJoin && byId.TryGetValue(kids[1], out var rightNode))
        {
            var rt = rightNode.Node.NodeType ?? "";
            if (rt.Equals("Hash", StringComparison.OrdinalIgnoreCase) && rightNode.ChildNodeIds.Count > 0)
                rightRel = FirstDescendantRelation(rightNode.ChildNodeIds[0], byId) ?? rightRel;
        }

        return (leftRel, rightRel);
    }

    private static string? FirstMeaningfulChildType(string nodeId, IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        if (!byId.TryGetValue(nodeId, out var n))
            return null;
        return n.Node.NodeType;
    }

    public static string? FirstDescendantRelation(string nodeId, IReadOnlyDictionary<string, AnalyzedPlanNode> byId, int maxNodes = 28)
    {
        var queue = new Queue<string>();
        var seen = new HashSet<string>(StringComparer.Ordinal) { nodeId };
        queue.Enqueue(nodeId);
        var steps = 0;

        while (queue.Count > 0 && steps < maxNodes)
        {
            var id = queue.Dequeue();
            if (!byId.TryGetValue(id, out var n))
                continue;

            if (!string.IsNullOrWhiteSpace(n.Node.RelationName))
                return n.Node.RelationName;

            foreach (var c in n.ChildNodeIds ?? Array.Empty<string>())
            {
                if (seen.Add(c))
                    queue.Enqueue(c);
            }

            steps++;
        }

        return null;
    }

    private static string TrimKey(string s, int maxLen)
    {
        var t = string.Join(" ", s.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (t.Length <= maxLen)
            return t;
        return t[..(maxLen - 1)] + "…";
    }
}
