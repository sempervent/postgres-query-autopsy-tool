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
            var nt = n.Node.NodeType ?? "";
            var isMaterialize = nt.Equals("Materialize", StringComparison.OrdinalIgnoreCase);
            var isMemoize = nt.Equals("Memoize", StringComparison.OrdinalIgnoreCase);
            if (!isMaterialize && !isMemoize)
                continue;

            var loops = n.Node.ActualLoops ?? 1;
            var subtreeShare = context.SubtreeTimeShareOfPlan(n);
            var readShare = context.SubtreeSharedReadShareOfPlan(n);

            if (isMaterialize)
            {
                if (loops < 20)
                    continue;
                // Materialize is often beneficial; only flag heavy repetition + meaningful cost signals.
                if ((subtreeShare ?? 0) < 0.10 && (readShare ?? 0) < 0.20)
                    continue;
            }
            else
            {
                // Memoize: fewer loops typical; rely on share thresholds.
                if (loops < 8 && (subtreeShare ?? 0) < 0.12 && (readShare ?? 0) < 0.18)
                    continue;
                if ((subtreeShare ?? 0) < 0.08 && (readShare ?? 0) < 0.15)
                    continue;
            }

            var severity =
                loops >= 1000 ? FindingSeverity.High :
                loops >= 200 ? FindingSeverity.Medium :
                isMemoize && (subtreeShare ?? 0) >= 0.22 ? FindingSeverity.Medium :
                FindingSeverity.Low;

            var confidence =
                context.HasActualTiming && subtreeShare is not null ? FindingConfidence.High :
                FindingConfidence.Medium;

            var title = isMaterialize
                ? "Materialize appears in a high-loop region"
                : "Memoize shows meaningful repeated subtree cost";

            var summary = isMaterialize
                ? $"Materialize `{n.NodeId}` is executed ~{loops} times; repeated reuse or rescans may be driving cost."
                : $"Memoize `{n.NodeId}` (~{loops} loops) retains subtree work; time/read share suggests the cached subtree is still expensive in context.";

            var explanation = isMaterialize
                ? "Materialize can reduce repeated work, but a materialized subtree under high loops can still be costly (e.g., large materialization, rescans, or I/O). " +
                  "This finding flags materialization nodes that sit inside heavily repeated execution."
                : "Memoize caches subtree results for reuse. When timing or I/O share stays high, the cached subtree may be large or re-evaluated often enough to matter—" +
                  "treat this as a query-shape / intermediate-rowset investigation, not automatically an index issue.";

            yield return new AnalysisFinding(
                FindingId: $"{RuleId}:{n.NodeId}",
                RuleId: RuleId,
                Severity: severity,
                Confidence: confidence,
                Category: Category,
                Title: title,
                Summary: summary,
                Explanation: explanation,
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
                "Inspect what is being materialized or memoized and whether it is large. Validate join order and whether the repeated side can be reduced (filters pushed down) " +
                "or whether a different join strategy would avoid high-loop rescans.",
                RankScore: null
            );
        }
    }
}

