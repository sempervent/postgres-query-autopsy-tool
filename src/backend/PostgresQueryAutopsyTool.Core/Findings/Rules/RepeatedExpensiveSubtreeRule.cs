using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings.Rules;

public sealed class RepeatedExpensiveSubtreeRule : IFindingRule
{
    public string RuleId => "I.repeated-expensive-subtree";
    public string Title => "Repeated expensive subtree";
    public FindingCategory Category => FindingCategory.LoopAmplification;

    public IEnumerable<AnalysisFinding> Evaluate(FindingEvaluationContext context)
    {
        if (!context.HasActualTiming)
            yield break;

        foreach (var n in context.Nodes)
        {
            var loops = n.Node.ActualLoops ?? 1;
            if (loops < 20) continue;

            var subtreeTime = n.Metrics.SubtreeInclusiveTimeMs;
            if (subtreeTime is null) continue;

            // Trigger if a repeated subtree is non-trivial.
            if (subtreeTime.Value < 5.0) continue;

            var severity =
                loops >= 500 ? FindingSeverity.High :
                FindingSeverity.Medium;

            yield return new AnalysisFinding(
                FindingId: $"{RuleId}:{n.NodeId}",
                RuleId: RuleId,
                Severity: severity,
                Confidence: FindingConfidence.High,
                Category: Category,
                Title: "Loops amplify subtree cost",
                Summary: $"Node `{n.NodeId}` executes {loops} loops; subtree inclusive time ≈ {subtreeTime.Value:F2}ms.",
                Explanation:
                "A subtree that looks modest per-loop can become dominant when executed many times. This finding highlights loops-driven amplification.",
                NodeIds: new[] { n.NodeId },
                Evidence: new Dictionary<string, object?>
                {
                    ["nodeId"] = n.NodeId,
                    ["nodeType"] = n.Node.NodeType,
                    ["loops"] = loops,
                    ["subtreeInclusiveTimeMs"] = subtreeTime,
                    ["subtreeTimeShareOfPlan"] = context.SubtreeTimeShareOfPlan(n),
                },
                Suggestion:
                "Inspect why this subtree is re-entered so many times. If it sits under a nested loop, verify cardinalities and consider alternative join strategies or stronger indexing on the inner side.",
                RankScore: null
            );
        }
    }
}

