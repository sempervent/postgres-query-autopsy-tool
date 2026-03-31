using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings.Rules;

public sealed class MaterializeLoopsConcernRule : IFindingRule
{
    public string RuleId => "M.materialize-loops-concern";
    public string Title => "Materialize + loops concern";
    public FindingCategory Category => FindingCategory.LoopAmplification;

    public IEnumerable<AnalysisFinding> Evaluate(FindingEvaluationContext context)
    {
        if (!context.HasActualTiming && !context.HasBuffers)
            yield break;

        foreach (var n in context.Nodes)
        {
            if (!string.Equals(n.Node.NodeType, "Materialize", StringComparison.OrdinalIgnoreCase))
                continue;

            var loops = n.Node.ActualLoops ?? 1;
            if (loops < 20)
                continue;

            var subtreeShare = context.SubtreeTimeShareOfPlan(n);
            var readShare = context.SubtreeSharedReadShareOfPlan(n);

            // Materialize is often beneficial; this only flags when it's in a heavily repeated zone and shows meaningful cost signals.
            if ((subtreeShare ?? 0) < 0.10 && (readShare ?? 0) < 0.20)
                continue;

            var severity =
                loops >= 1000 ? FindingSeverity.High :
                loops >= 200 ? FindingSeverity.Medium :
                FindingSeverity.Low;

            var confidence =
                context.HasActualTiming && subtreeShare is not null ? FindingConfidence.High :
                FindingConfidence.Medium;

            yield return new AnalysisFinding(
                FindingId: $"{RuleId}:{n.NodeId}",
                RuleId: RuleId,
                Severity: severity,
                Confidence: confidence,
                Category: Category,
                Title: "Materialize appears in a high-loop region",
                Summary: $"Materialize `{n.NodeId}` is executed ~{loops} times; repeated reuse or rescans may be driving cost.",
                Explanation:
                "Materialize can reduce repeated work, but a materialized subtree under high loops can still be costly (e.g., large materialization, rescans, or I/O). " +
                "This finding flags materialization nodes that sit inside heavily repeated execution.",
                NodeIds: new[] { n.NodeId },
                Evidence: new Dictionary<string, object?>
                {
                    ["nodeId"] = n.NodeId,
                    ["nodeType"] = n.Node.NodeType,
                    ["loops"] = loops,
                    ["subtreeTimeShareOfPlan"] = subtreeShare,
                    ["subtreeSharedReadShareOfPlan"] = readShare,
                    ["subtreeSharedReadBlocks"] = n.Metrics.SubtreeSharedReadBlocks,
                },
                Suggestion:
                "Inspect what is being materialized and whether it is large. Validate join order and whether the repeated side can be reduced (filters pushed down) " +
                "or whether a different join strategy would avoid high-loop rescans.",
                RankScore: null
            );
        }
    }
}

