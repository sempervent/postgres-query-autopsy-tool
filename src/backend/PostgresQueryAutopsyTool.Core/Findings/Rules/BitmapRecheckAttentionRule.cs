using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings.Rules;

/// <summary>Bitmap heap (or index-assisted) path with explicit recheck / lossy signals worth reviewing.</summary>
public sealed class BitmapRecheckAttentionRule : IFindingRule
{
    public string RuleId => "S.bitmap-recheck-attention";
    public string Title => "Bitmap / recheck path needs review";
    public FindingCategory Category => FindingCategory.AccessPathConcern;

    public IEnumerable<AnalysisFinding> Evaluate(FindingEvaluationContext context)
    {
        var append = context.Nodes.Any(n =>
            string.Equals(n.Node.NodeType, "Append", StringComparison.OrdinalIgnoreCase));
        var bitmapHeaps = context.Nodes.Count(n =>
            string.Equals(n.Node.NodeType, "Bitmap Heap Scan", StringComparison.OrdinalIgnoreCase));
        var suppress = append && bitmapHeaps >= 6;

        foreach (var n in context.Nodes)
        {
            if (!string.Equals(n.Node.NodeType, "Bitmap Heap Scan", StringComparison.OrdinalIgnoreCase))
                continue;
            if (suppress)
                continue;

            var hasRecheckExpr = !string.IsNullOrWhiteSpace(n.Node.RecheckCond);
            var recheckRows = n.Node.RowsRemovedByIndexRecheck ?? 0;
            if (!hasRecheckExpr && recheckRows < 50)
                continue;

            var heap = n.Node.HeapFetches ?? 0;
            var readShare = context.SharedReadShareOfPlan(n) ?? 0;
            if (recheckRows < 50 && heap < 2_000 && readShare < 0.08)
                continue;

            yield return new AnalysisFinding(
                FindingId: $"{RuleId}:{n.NodeId}",
                RuleId: RuleId,
                Severity: recheckRows >= 500 || heap >= 20_000 ? FindingSeverity.Medium : FindingSeverity.Low,
                Confidence: hasRecheckExpr ? FindingConfidence.High : FindingConfidence.Medium,
                Category: Category,
                Title: Title,
                Summary:
                $"Bitmap Heap Scan on `{n.Node.RelationName ?? "unknown"}` shows recheck-related evidence; verify bitmap selectivity and predicate alignment.",
                Explanation:
                "Recheck conditions and rows removed by index recheck indicate the bitmap may be lossy relative to filters, or that heap verification work remains significant. This is an investigation lead, not proof the index is wrong.",
                NodeIds: new[] { n.NodeId },
                Evidence: new Dictionary<string, object?>
                {
                    ["nodeId"] = n.NodeId,
                    ["accessPathFamily"] = IndexSignalAnalyzer.AccessPathFamily(n.Node.NodeType),
                    ["relationName"] = n.Node.RelationName,
                    ["recheckCond"] = n.Node.RecheckCond,
                    ["rowsRemovedByIndexRecheck"] = n.Node.RowsRemovedByIndexRecheck,
                    ["heapFetches"] = n.Node.HeapFetches,
                    ["sharedReadBlocks"] = n.Node.SharedReadBlocks,
                    ["sharedReadShareOfPlan"] = context.SharedReadShareOfPlan(n),
                },
                Suggestion:
                "Compare selectivity of indexed vs residual predicates, consider more selective partial indexes, and check whether index-only or plain index scans behave better for this predicate mix.",
                RankScore: null
            );
        }
    }
}
