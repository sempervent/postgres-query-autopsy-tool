using PostgresQueryAutopsyTool.Core.Findings;

namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>Phase 59: attaches <see cref="AnalyzedPlanNode.OperatorInterpretation"/> after summary/bottlenecks exist.</summary>
public static class PlanNodeInterpretationAugmentor
{
    public static IReadOnlyList<AnalyzedPlanNode> Augment(
        IReadOnlyList<AnalyzedPlanNode> nodes,
        string rootNodeId,
        PlanSummary summary,
        string? queryText = null)
    {
        if (nodes.Count == 0) return nodes;

        var ctx = new FindingEvaluationContext(rootNodeId, nodes);
        var bottleneckNodes = new HashSet<string>(summary.Bottlenecks.SelectMany(b => b.NodeIds), StringComparer.Ordinal);
        var topExclusive = new HashSet<string>(
            summary.TopExclusiveTimeHotspotNodeIds.Take(4),
            StringComparer.Ordinal);

        return nodes
            .Select(n =>
            {
                var text = OperatorNarrativeHelper.BuildSelectedNodeInterpretation(
                    n,
                    ctx,
                    bottleneckNodes.Contains(n.NodeId),
                    topExclusive.Contains(n.NodeId),
                    queryText);
                return n with { OperatorInterpretation = text };
            })
            .ToArray();
    }
}
