using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings.Rules;

public sealed class HighFanOutJoinWarningRule : IFindingRule
{
    public string RuleId => "N.high-fanout-join-warning";
    public string Title => "High fan-out join warning";
    public FindingCategory Category => FindingCategory.Misestimation;

    public IEnumerable<AnalysisFinding> Evaluate(FindingEvaluationContext context)
    {
        foreach (var n in context.Nodes)
        {
            var type = n.Node.NodeType ?? "Unknown";
            var isJoin =
                type.Contains("Join", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(type, "Nested Loop", StringComparison.OrdinalIgnoreCase);

            if (!isJoin)
                continue;

            // Primary signal: estimate factor indicates big divergence (or explosive expansion).
            var factor = n.Metrics.RowEstimateFactor;
            var actual = n.Metrics.ActualRowsTotal;
            var est = n.Node.PlanRows;

            if (factor is null || factor.Value < 10)
                continue;

            // Avoid noisy triggers when rows are tiny.
            if (actual is not null && actual.Value < 500)
                continue;

            var severity =
                factor.Value >= 100 ? FindingSeverity.High :
                factor.Value >= 30 ? FindingSeverity.Medium :
                FindingSeverity.Low;

            var confidence = (actual is not null && est is not null) ? FindingConfidence.High : FindingConfidence.Medium;

            yield return new AnalysisFinding(
                FindingId: $"{RuleId}:{n.NodeId}",
                RuleId: RuleId,
                Severity: severity,
                Confidence: confidence,
                Category: Category,
                Title: "Join output is much larger than expected",
                Summary: $"Join `{n.NodeId}` ({type}) has a large estimate divergence (factor ~{factor.Value:F1}).",
                Explanation:
                "Large fan-out (row explosion) can indicate missing join predicates, incorrect join keys, correlation issues, or statistics problems. " +
                "This finding flags joins where actual rows diverge heavily from estimated rows.",
                NodeIds: new[] { n.NodeId },
                Evidence: new Dictionary<string, object?>
                {
                    ["nodeId"] = n.NodeId,
                    ["nodeType"] = type,
                    ["relationName"] = n.Node.RelationName,
                    ["joinType"] = n.Node.JoinType,
                    ["actualRowsTotal"] = actual,
                    ["estimatedRowsPerLoop"] = est,
                    ["rowEstimateFactor"] = factor,
                    ["hashCond"] = n.Node.HashCond,
                    ["mergeCond"] = n.Node.MergeCond,
                    ["joinFilter"] = n.Node.JoinFilter,
                },
                Suggestion:
                "Confirm join predicates and cardinality expectations. If predicates are correct, improve statistics on join columns (ANALYZE) and consider extended statistics for correlated columns. " +
                "If the row explosion is real, consider reducing the join input sets or applying filters earlier.",
                RankScore: null
            );
        }
    }
}

