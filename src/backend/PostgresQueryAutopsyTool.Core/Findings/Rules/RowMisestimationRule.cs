using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings.Rules;

public sealed class RowMisestimationRule : IFindingRule
{
    public string RuleId => "A.row-misestimation";
    public string Title => "Severe row misestimation";
    public FindingCategory Category => FindingCategory.Misestimation;

    public IEnumerable<AnalysisFinding> Evaluate(FindingEvaluationContext context)
    {
        foreach (var n in context.Nodes)
        {
            var factor = n.Metrics.RowEstimateFactor;
            if (factor is null) continue;
            if (factor.Value < 10) continue;

            var log10 = n.Metrics.RowEstimateLog10Error ?? 0;
            var timeShare = context.SubtreeTimeShareOfPlan(n);

            var severity =
                factor.Value >= 1000 ? FindingSeverity.Critical :
                factor.Value >= 100 ? FindingSeverity.High :
                FindingSeverity.Medium;

            // Escalate if it's also a clear runtime hotspot.
            if (severity != FindingSeverity.Critical && timeShare is >= 0.4)
                severity = FindingSeverity.High;

            var confidence = context.HasActualTiming ? FindingConfidence.High : FindingConfidence.Medium;

            var est = n.Node.PlanRows;
            var loops = n.Node.ActualLoops ?? 1;
            double? estTotal = est is null ? null : est.Value * loops;
            var actualTotal = n.Metrics.ActualRowsTotal;

            yield return new AnalysisFinding(
                FindingId: $"{RuleId}:{n.NodeId}",
                RuleId: RuleId,
                Severity: severity,
                Confidence: confidence,
                Category: Category,
                Title: "Row estimate diverged materially from actual rows",
                Summary: $"Estimated vs actual rows differ by ~{factor.Value:F1}x on node `{n.NodeId}` ({n.Node.NodeType}).",
                Explanation:
                "PostgreSQL's planner estimated a very different cardinality than what occurred at runtime. " +
                "This can cause bad join strategy choices, wrong memory expectations, and generally pushes the plan into the wrong shape.",
                NodeIds: new[] { n.NodeId },
                Evidence: new Dictionary<string, object?>
                {
                    ["nodeId"] = n.NodeId,
                    ["nodeType"] = n.Node.NodeType,
                    ["relationName"] = n.Node.RelationName,
                    ["indexName"] = n.Node.IndexName,
                    ["estimatedRowsPerLoop"] = est,
                    ["estimatedRowsTotalApprox"] = estTotal,
                    ["actualRowsPerLoop"] = n.Node.ActualRows,
                    ["actualRowsTotalApprox"] = actualTotal,
                    ["loops"] = loops,
                    ["rowEstimateRatio"] = n.Metrics.RowEstimateRatio,
                    ["rowEstimateFactor"] = factor.Value,
                    ["rowEstimateLog10Error"] = log10,
                    ["subtreeTimeShareOfPlan"] = timeShare,
                },
                Suggestion:
                "Investigate selectivity assumptions: verify predicate selectivity, join conditions, and whether statistics are fresh. " +
                "If predicates are correlated, consider extended statistics; if estimates compound across joins, isolate which relation/predicate is misestimated first.",
                RankScore: null
            );
        }
    }
}

