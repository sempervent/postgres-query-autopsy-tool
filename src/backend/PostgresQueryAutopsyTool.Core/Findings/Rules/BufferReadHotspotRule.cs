using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings.Rules;

public sealed class BufferReadHotspotRule : IFindingRule
{
    public string RuleId => "D.buffer-read-hotspot";
    public string Title => "Buffer read hotspot";
    public FindingCategory Category => FindingCategory.BufferHotspot;

    public IEnumerable<AnalysisFinding> Evaluate(FindingEvaluationContext context)
    {
        if (!context.HasBuffers)
            yield break;

        foreach (var n in context.Nodes)
        {
            var nodeShare = context.SharedReadShareOfPlan(n);
            var subtreeShare = context.SubtreeSharedReadShareOfPlan(n);

            // Trigger either on node-level concentration or subtree-level concentration.
            var bestShare = (nodeShare ?? 0) >= (subtreeShare ?? 0) ? nodeShare : subtreeShare;
            if (bestShare is null || bestShare.Value < 0.35) continue;

            var severity =
                bestShare.Value >= 0.80 ? FindingSeverity.Critical :
                bestShare.Value >= 0.60 ? FindingSeverity.High :
                FindingSeverity.Medium;

            var confidence = FindingConfidence.Medium;
            if (n.Node.RelationName is not null || n.Node.IndexName is not null)
                confidence = FindingConfidence.High;

            yield return new AnalysisFinding(
                FindingId: $"{RuleId}:{n.NodeId}",
                RuleId: RuleId,
                Severity: severity,
                Confidence: confidence,
                Category: Category,
                Title: "Shared reads concentrated in node/subtree",
                Summary: $"Shared reads are concentrated at `{n.NodeId}` ({n.Node.NodeType}) (~{bestShare.Value:P0} of shared reads).",
                Explanation:
                "A high shared read concentration is a strong signal for I/O-driven slowness (cold cache, large relation/index, inefficient access path) " +
                "or repeated access due to loops.",
                NodeIds: new[] { n.NodeId },
                Evidence: new Dictionary<string, object?>
                {
                    ["nodeId"] = n.NodeId,
                    ["nodeType"] = n.Node.NodeType,
                    ["relationName"] = n.Node.RelationName,
                    ["indexName"] = n.Node.IndexName,
                    ["sharedReadBlocks"] = n.Node.SharedReadBlocks,
                    ["subtreeSharedReadBlocks"] = n.Metrics.SubtreeSharedReadBlocks,
                    ["sharedReadShareOfPlan"] = nodeShare,
                    ["subtreeSharedReadShareOfPlan"] = subtreeShare,
                },
                Suggestion:
                "Investigate access path and I/O behavior: confirm whether this is expected (large scan) or avoidable (missing index support, poor join order). " +
                "If the relation is large and predicates are selective, validate indexability and statistics.",
                RankScore: null
            );
        }
    }
}

