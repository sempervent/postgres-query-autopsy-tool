using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings.Rules;

public sealed class ExclusiveCpuHotspotRule : IFindingRule
{
    public string RuleId => "B.exclusive-cpu-hotspot";
    public string Title => "Exclusive CPU hotspot";
    public FindingCategory Category => FindingCategory.CpuHotspot;

    public IEnumerable<AnalysisFinding> Evaluate(FindingEvaluationContext context)
    {
        if (!context.HasActualTiming)
            yield break;

        foreach (var n in context.Nodes)
        {
            var share = context.ExclusiveTimeShareOfPlan(n);
            if (share is null) continue;

            var severity =
                share.Value >= 0.50 ? FindingSeverity.Critical :
                share.Value >= 0.30 ? FindingSeverity.High :
                share.Value >= 0.15 ? FindingSeverity.Medium :
                share.Value >= 0.08 ? FindingSeverity.Low :
                FindingSeverity.Info;

            if (severity == FindingSeverity.Info)
                continue;

            var confidence = FindingConfidence.Medium;
            if (n.Metrics.ExclusiveActualTimeMsApprox is not null && n.Metrics.ExclusiveActualTimeMsApprox.Value > 0)
                confidence = FindingConfidence.High;

            yield return new AnalysisFinding(
                FindingId: $"{RuleId}:{n.NodeId}",
                RuleId: RuleId,
                Severity: severity,
                Confidence: confidence,
                Category: Category,
                Title: "Node consumes large exclusive runtime",
                Summary: $"Node `{n.NodeId}` ({n.Node.NodeType}) accounts for ~{share.Value:P0} of exclusive time (approx).",
                Explanation:
                "Exclusive time is approximated as node inclusive time minus the sum of child inclusive times, clamped at zero. " +
                "A high exclusive share usually means the operator’s local work dominates (CPU, expression evaluation, tuple processing, hash/sort work, etc.).",
                NodeIds: new[] { n.NodeId },
                Evidence: new Dictionary<string, object?>
                {
                    ["nodeId"] = n.NodeId,
                    ["nodeType"] = n.Node.NodeType,
                    ["relationName"] = n.Node.RelationName,
                    ["exclusiveTimeMsApprox"] = n.Metrics.ExclusiveActualTimeMsApprox,
                    ["inclusiveTimeMs"] = n.Metrics.InclusiveActualTimeMs,
                    ["exclusiveTimeShareOfPlan"] = share,
                },
                Suggestion:
                "Inspect this operator’s local work: expressions (filters), sort/hash operations, and join strategy details. " +
                "If this is a sort/hash node, check memory settings and row counts; if it’s a scan, check predicate selectivity and access path.",
                RankScore: null
            );
        }
    }
}

