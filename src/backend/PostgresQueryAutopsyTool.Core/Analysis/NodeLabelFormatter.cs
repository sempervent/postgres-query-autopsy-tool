namespace PostgresQueryAutopsyTool.Core.Analysis;

internal static class NodeLabelFormatter
{
    public static string ShortLabel(AnalyzedPlanNode n, IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        var type = n.Node.NodeType ?? "Unknown";
        var rel = n.Node.RelationName;
        var idx = n.Node.IndexName;

        if (!string.IsNullOrWhiteSpace(rel))
        {
            if (!string.IsNullOrWhiteSpace(idx) && type.Contains("Index", StringComparison.OrdinalIgnoreCase))
                return $"{type} on {rel} using {idx}";
            return $"{type} on {rel}";
        }

        if (type.Contains("Join", StringComparison.OrdinalIgnoreCase) || type.Equals("Nested Loop", StringComparison.OrdinalIgnoreCase))
        {
            var kids = n.ChildNodeIds ?? Array.Empty<string>();
            if (kids.Count >= 2)
            {
                var left = FirstDescendantRelation(kids[0], byId);
                var right = FirstDescendantRelation(kids[1], byId);
                if (!string.IsNullOrWhiteSpace(left) && !string.IsNullOrWhiteSpace(right))
                    return $"{type} ({left} × {right})";
            }
        }

        if (type.Contains("Sort", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(n.Node.SortKey))
            return $"{type} ({Trim(n.Node.SortKey!, 48)})";

        if (!string.IsNullOrWhiteSpace(n.Node.JoinType) && (type.Contains("Join", StringComparison.OrdinalIgnoreCase) || type.Equals("Nested Loop", StringComparison.OrdinalIgnoreCase)))
            return $"{type} ({n.Node.JoinType})";

        return type;
    }

    private static string? FirstDescendantRelation(string nodeId, IReadOnlyDictionary<string, AnalyzedPlanNode> byId, int maxNodes = 25)
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

            foreach (var c in (n.ChildNodeIds ?? Array.Empty<string>()))
            {
                if (seen.Add(c))
                    queue.Enqueue(c);
            }

            steps++;
        }

        return null;
    }

    private static string Trim(string s, int maxLen)
    {
        var t = string.Join(" ", s.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (t.Length <= maxLen) return t;
        return t[..(maxLen - 1)] + "…";
    }
}

