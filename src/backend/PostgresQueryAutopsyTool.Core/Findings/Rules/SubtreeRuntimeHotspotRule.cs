using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings.Rules;

public sealed class SubtreeRuntimeHotspotRule : IFindingRule
{
    public string RuleId => "C.subtree-runtime-hotspot";
    public string Title => "Subtree runtime hotspot";
    public FindingCategory Category => FindingCategory.CpuHotspot;

    public IEnumerable<AnalysisFinding> Evaluate(FindingEvaluationContext context)
    {
        if (!context.HasActualTiming)
            yield break;

        foreach (var n in context.Nodes)
        {
            var share = context.SubtreeTimeShareOfPlan(n);
            if (share is null) continue;
            if (share.Value < 0.35) continue;

            var severity =
                share.Value >= 0.80 ? FindingSeverity.Critical :
                share.Value >= 0.60 ? FindingSeverity.High :
                FindingSeverity.Medium;

            yield return new AnalysisFinding(
                FindingId: $"{RuleId}:{n.NodeId}",
                RuleId: RuleId,
                Severity: severity,
                Confidence: FindingConfidence.High,
                Category: Category,
                Title: "Subtree dominates runtime",
                Summary: $"Subtree at `{n.NodeId}` ({n.Node.NodeType}) accounts for ~{share.Value:P0} of runtime.",
                Explanation:
                "This subtree is a major contributor to total runtime. Prioritize investigation here before smaller leaf-level concerns.",
                NodeIds: new[] { n.NodeId },
                Evidence: new Dictionary<string, object?>
                {
                    ["nodeId"] = n.NodeId,
                    ["nodeType"] = n.Node.NodeType,
                    ["subtreeInclusiveTimeMs"] = n.Metrics.SubtreeInclusiveTimeMs,
                    ["subtreeTimeShareOfPlan"] = share,
                },
                Suggestion:
                "Investigate this branch first: open the subtree and locate its hottest operators (exclusive time) and buffer hotspots. " +
                "If this is a join, validate join order/strategy; if a scan, validate access path and predicate selectivity.",
                RankScore: null
            );
        }
    }
}

