using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings.Rules;

public sealed class PotentialIndexingOpportunityRule : IFindingRule
{
    public string RuleId => "J.potential-indexing-opportunity";
    public string Title => "Potential indexing opportunity";
    public FindingCategory Category => FindingCategory.PotentialIndexingOpportunity;

    public IEnumerable<AnalysisFinding> Evaluate(FindingEvaluationContext context)
    {
        // Conservative: only emit when we have a relation, a predicate, and evidence of impact (time/buffers).
        foreach (var n in context.Nodes)
        {
            var isSeqScan = string.Equals(n.Node.NodeType, "Seq Scan", StringComparison.OrdinalIgnoreCase);
            if (!isSeqScan) continue;

            if (string.IsNullOrWhiteSpace(n.Node.RelationName)) continue;
            if (string.IsNullOrWhiteSpace(n.Node.Filter)) continue;

            var timeShare = context.SubtreeTimeShareOfPlan(n) ?? 0;
            var readShare = context.SharedReadShareOfPlan(n) ?? 0;

            // Require meaningful impact.
            if (timeShare < 0.20 && readShare < 0.20)
                continue;

            var severity =
                (timeShare >= 0.50 || readShare >= 0.50) ? FindingSeverity.High :
                FindingSeverity.Medium;

            var confidence = FindingConfidence.Medium;
            if (context.HasBuffers || context.HasActualTiming)
                confidence = FindingConfidence.High;

            yield return new AnalysisFinding(
                FindingId: $"{RuleId}:{n.NodeId}",
                RuleId: RuleId,
                Severity: severity,
                Confidence: confidence,
                Category: Category,
                Title: "Predicate suggests indexing investigation",
                Summary: $"Seq Scan on `{n.Node.RelationName}` with filter appears impactful; investigate whether an index could reduce scanned work.",
                Explanation:
                "This is not a claim that an index is definitely required. It’s a prompt to investigate indexability and selectivity of the predicate and compare plan outcomes.",
                NodeIds: new[] { n.NodeId },
                Evidence: new Dictionary<string, object?>
                {
                    ["nodeId"] = n.NodeId,
                    ["relationName"] = n.Node.RelationName,
                    ["filter"] = n.Node.Filter,
                    ["subtreeTimeShareOfPlan"] = context.SubtreeTimeShareOfPlan(n),
                    ["sharedReadShareOfPlan"] = context.SharedReadShareOfPlan(n),
                    ["actualRowsTotalApprox"] = n.Metrics.ActualRowsTotal,
                    ["rowsRemovedByFilter"] = n.Node.RowsRemovedByFilter,
                    ["removedRowsShareApprox"] = n.ContextEvidence?.ScanWaste?.RemovedRowsShareApprox,
                },
                Suggestion:
                "Investigate candidate indexes (including composite/covering) matching the predicate. Validate with EXPLAIN ANALYZE before/after in a safe environment; watch for selectivity changes and correlation effects.",
                RankScore: null
            );
        }
    }
}

