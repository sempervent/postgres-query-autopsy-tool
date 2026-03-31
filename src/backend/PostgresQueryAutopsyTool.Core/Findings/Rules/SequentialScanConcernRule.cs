using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings.Rules;

public sealed class SequentialScanConcernRule : IFindingRule
{
    public string RuleId => "F.seq-scan-concern";
    public string Title => "Sequential scan concern";
    public FindingCategory Category => FindingCategory.AccessPathConcern;

    public IEnumerable<AnalysisFinding> Evaluate(FindingEvaluationContext context)
    {
        foreach (var n in context.Nodes)
        {
            if (!string.Equals(n.Node.NodeType, "Seq Scan", StringComparison.OrdinalIgnoreCase))
                continue;

            // Conservative: require at least a filter expression or strong hotspot evidence.
            var hasFilter = !string.IsNullOrWhiteSpace(n.Node.Filter);
            var timeShare = context.SubtreeTimeShareOfPlan(n) ?? 0;
            var readShare = context.SharedReadShareOfPlan(n) ?? 0;

            if (!hasFilter && timeShare < 0.25 && readShare < 0.25)
                continue;

            // Heuristic severity based on impact.
            var severity =
                (timeShare >= 0.50 || readShare >= 0.50) ? FindingSeverity.High :
                (timeShare >= 0.25 || readShare >= 0.25) ? FindingSeverity.Medium :
                FindingSeverity.Low;

            // Confidence is higher if relation and filter are known.
            var confidence =
                (n.Node.RelationName is not null && hasFilter) ? FindingConfidence.High :
                (hasFilter ? FindingConfidence.Medium : FindingConfidence.Low);

            yield return new AnalysisFinding(
                FindingId: $"{RuleId}:{n.NodeId}",
                RuleId: RuleId,
                Severity: severity,
                Confidence: confidence,
                Category: Category,
                Title: "Sequential scan may be doing avoidable work",
                Summary: $"Seq Scan `{n.NodeId}` on `{n.Node.RelationName ?? "unknown_relation"}` is a meaningful runtime/I/O contributor.",
                Explanation:
                "Sequential scans can be correct (small table, low selectivity, or cheaper than random I/O), but when paired with a selective filter and hotspot behavior " +
                "they can indicate an access-path issue worth investigating.",
                NodeIds: new[] { n.NodeId },
                Evidence: new Dictionary<string, object?>
                {
                    ["nodeId"] = n.NodeId,
                    ["nodeType"] = n.Node.NodeType,
                    ["relationName"] = n.Node.RelationName,
                    ["filter"] = n.Node.Filter,
                    ["inclusiveTimeMs"] = n.Metrics.InclusiveActualTimeMs,
                    ["subtreeTimeShareOfPlan"] = context.SubtreeTimeShareOfPlan(n),
                    ["sharedReadBlocks"] = n.Node.SharedReadBlocks,
                    ["sharedReadShareOfPlan"] = context.SharedReadShareOfPlan(n),
                    ["actualRowsTotalApprox"] = n.Metrics.ActualRowsTotal,
                    ["rowsRemovedByFilter"] = n.Node.RowsRemovedByFilter,
                    ["removedRowsShareApprox"] = n.ContextEvidence?.ScanWaste?.RemovedRowsShareApprox,
                },
                Suggestion:
                "Investigate whether the filter predicate is indexable and selective. Validate table size and selectivity; compare before/after with an index in a safe environment. " +
                "If the scan is justified, focus on reducing rows early (predicate pushdown, query rewrite) or improving cache locality.",
                RankScore: null
            );
        }
    }
}

