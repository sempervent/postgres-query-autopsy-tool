using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings.Rules;

/// <summary>Index or bitmap path is used but the node still concentrates reads, heap fetches, or recheck work.</summary>
public sealed class IndexAccessStillHeavyRule : IFindingRule
{
    public string RuleId => "R.index-access-still-heavy";
    public string Title => "Index path still looks I/O or heap heavy";
    public FindingCategory Category => FindingCategory.AccessPathConcern;

    public IEnumerable<AnalysisFinding> Evaluate(FindingEvaluationContext context)
    {
        var append = context.Nodes.Any(n =>
            string.Equals(n.Node.NodeType, "Append", StringComparison.OrdinalIgnoreCase));
        var bitmapHeaps = context.Nodes.Count(n =>
            string.Equals(n.Node.NodeType, "Bitmap Heap Scan", StringComparison.OrdinalIgnoreCase));
        var suppressBitmapDetails = append && bitmapHeaps >= 6;

        foreach (var n in context.Nodes)
        {
            var nt = n.Node.NodeType ?? "";
            if (nt.Equals("Index Scan", StringComparison.OrdinalIgnoreCase) ||
                nt.Equals("Index Only Scan", StringComparison.OrdinalIgnoreCase))
            {
                if (!LooksHeavy(n, context, out var detail))
                    continue;

                yield return MakeFinding(this, n, context, detail, isBitmap: false);
            }
            else if (nt.Equals("Bitmap Heap Scan", StringComparison.OrdinalIgnoreCase))
            {
                if (suppressBitmapDetails)
                    continue;
                if (!LooksHeavy(n, context, out var detail))
                    continue;

                yield return MakeFinding(this, n, context, detail, isBitmap: true);
            }
        }
    }

    private static bool LooksHeavy(AnalyzedPlanNode n, FindingEvaluationContext context, out string detail)
    {
        detail = "";
        var readShare = context.SharedReadShareOfPlan(n) ?? 0;
        var heap = n.Node.HeapFetches ?? 0;
        var recheck = n.Node.RowsRemovedByIndexRecheck ?? 0;
        var reads = n.Node.SharedReadBlocks ?? 0;
        var timeShare = context.SubtreeTimeShareOfPlan(n) ?? 0;
        var rows = n.Metrics.ActualRowsTotal ?? 0;

        if (readShare >= 0.12 && reads >= 500)
        {
            detail = $"shared read share ~{readShare:P0} with {reads} read blocks on this node";
            return true;
        }

        if (heap >= 5_000)
        {
            detail = $"heap fetches reported ({heap}) remain high despite index/bitmap path";
            return true;
        }

        if (recheck >= 200)
        {
            detail = $"rows removed by index recheck ({recheck}) suggest lossy or coarse bitmap/index filtering";
            return true;
        }

        if (rows >= 50_000 && timeShare >= 0.12 && reads >= 300)
        {
            detail = "large row volume through this indexed path with meaningful time share";
            return true;
        }

        return false;
    }

    private static AnalysisFinding MakeFinding(IndexAccessStillHeavyRule rule, AnalyzedPlanNode n, FindingEvaluationContext context, string detail, bool isBitmap)
    {
        var rel = n.Node.RelationName ?? "unknown";
        var idx = n.Node.IndexName;
        var summary = idx is not null
            ? $"{n.Node.NodeType} on `{rel}` via `{idx}` still shows heavy access signals ({detail})."
            : $"{n.Node.NodeType} on `{rel}` still shows heavy access signals ({detail}).";

        return new AnalysisFinding(
            FindingId: $"{rule.RuleId}:{n.NodeId}",
            RuleId: rule.RuleId,
            Severity: FindingSeverity.Medium,
            Confidence: FindingConfidence.Medium,
            Category: rule.Category,
            Title: rule.Title,
            Summary: summary,
            Explanation:
            "An index (or bitmap) being used does not guarantee cheap execution. Large heap work, rechecks, or concentrated reads can mean weak selectivity, correlation, wide projections, or a bitmap that is lossy for the predicate.",
            NodeIds: new[] { n.NodeId },
            Evidence: new Dictionary<string, object?>
            {
                ["nodeId"] = n.NodeId,
                ["nodeType"] = n.Node.NodeType,
                ["accessPathFamily"] = IndexSignalAnalyzer.AccessPathFamily(n.Node.NodeType),
                ["relationName"] = n.Node.RelationName,
                ["indexName"] = n.Node.IndexName,
                ["indexCond"] = n.Node.IndexCond,
                ["recheckCond"] = n.Node.RecheckCond,
                ["heapFetches"] = n.Node.HeapFetches,
                ["rowsRemovedByIndexRecheck"] = n.Node.RowsRemovedByIndexRecheck,
                ["sharedReadBlocks"] = n.Node.SharedReadBlocks,
                ["sharedReadShareOfPlan"] = context.SharedReadShareOfPlan(n),
                ["subtreeTimeShareOfPlan"] = context.SubtreeTimeShareOfPlan(n),
                ["detail"] = detail,
                ["isBitmapHeap"] = isBitmap,
            },
            Suggestion:
            "Validate predicate selectivity and correlation, whether a covering index reduces heap hits, and whether bitmap vs index-only paths behave better for this query. Use narrower selects and compare EXPLAIN in a safe environment.",
            RankScore: null
        );
    }
}
