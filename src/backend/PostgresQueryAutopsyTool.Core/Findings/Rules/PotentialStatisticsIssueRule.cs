using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings.Rules;

public sealed class PotentialStatisticsIssueRule : IFindingRule
{
    public string RuleId => "G.potential-statistics-issue";
    public string Title => "Potential statistics issue";
    public FindingCategory Category => FindingCategory.PotentialStatisticsIssue;

    public IEnumerable<AnalysisFinding> Evaluate(FindingEvaluationContext context)
    {
        // Look for multiple severe misestimations across the plan.
        var severeMis = context.Nodes
            .Where(n => n.Metrics.RowEstimateFactor is >= 100)
            .OrderByDescending(n => n.Metrics.RowEstimateFactor)
            .Take(5)
            .ToArray();

        if (severeMis.Length < 2)
            yield break;

        var confidence = context.HasActualTiming ? FindingConfidence.Medium : FindingConfidence.Low;
        if (context.HasActualTiming && severeMis.All(n => n.Metrics.RowEstimateLog10Error is not null))
            confidence = FindingConfidence.High;

        var severity = FindingSeverity.Medium;
        if (severeMis.Any(n => n.Metrics.RowEstimateFactor is >= 1000))
            severity = FindingSeverity.High;

        yield return new AnalysisFinding(
            FindingId: $"{RuleId}:{context.RootNodeId}",
            RuleId: RuleId,
            Severity: severity,
            Confidence: confidence,
            Category: Category,
            Title: "Multiple severe misestimations suggest statistics issues",
            Summary: $"Observed {severeMis.Length} nodes with ≥100x row estimate error; this pattern often correlates with stale/insufficient stats or correlated predicates.",
            Explanation:
            "A single misestimate can happen for many reasons. Multiple severe misestimates in the same plan increase the likelihood that statistics are stale, missing, or unable to model predicate correlation.",
            NodeIds: severeMis.Select(n => n.NodeId).ToArray(),
            Evidence: new Dictionary<string, object?>
            {
                ["nodeIds"] = severeMis.Select(n => n.NodeId).ToArray(),
                ["nodes"] = severeMis.Select(n => new Dictionary<string, object?>
                {
                    ["nodeId"] = n.NodeId,
                    ["nodeType"] = n.Node.NodeType,
                    ["relationName"] = n.Node.RelationName,
                    ["rowEstimateFactor"] = n.Metrics.RowEstimateFactor,
                    ["rowEstimateLog10Error"] = n.Metrics.RowEstimateLog10Error,
                    ["subtreeTimeShareOfPlan"] = context.SubtreeTimeShareOfPlan(n),
                }).ToArray()
            },
            Suggestion:
            "Check ANALYZE freshness and autovacuum behavior. For correlated predicates, consider extended statistics. For skewed distributions, verify column statistics targets. Re-run EXPLAIN ANALYZE after stats changes to validate impact.",
            RankScore: null
        );
    }
}

