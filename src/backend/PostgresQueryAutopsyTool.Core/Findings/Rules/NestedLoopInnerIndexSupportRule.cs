using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings.Rules;

/// <summary>
/// Nested loop inner side repeats with sequential (or coarse bitmap) access — index support investigation.
/// Complements amplification rule (lower loop threshold, index-focused framing).
/// </summary>
public sealed class NestedLoopInnerIndexSupportRule : IFindingRule
{
    public string RuleId => "Q.nl-inner-index-support";
    public string Title => "Nested loop inner access may need better index alignment";
    public FindingCategory Category => FindingCategory.PotentialIndexingOpportunity;

    public IEnumerable<AnalysisFinding> Evaluate(FindingEvaluationContext context)
    {
        foreach (var n in context.Nodes)
        {
            if (!string.Equals(n.Node.NodeType, "Nested Loop", StringComparison.OrdinalIgnoreCase))
                continue;
            if (n.ChildNodeIds.Count < 2)
                continue;

            var inner = context.ById[n.ChildNodeIds[1]];
            var loops = inner.Node.ActualLoops ?? n.Node.ActualLoops ?? 1;
            if (loops < 15 || loops >= 1000)
                continue;

            var family = IndexSignalAnalyzer.AccessPathFamily(inner.Node.NodeType);
            if (family != IndexAccessPathTokens.SeqScan && family != IndexAccessPathTokens.BitmapHeapScan)
                continue;

            var innerTimeShare = context.SubtreeTimeShareOfPlan(inner) ?? 0;
            var innerReadShare = context.SubtreeSharedReadShareOfPlan(inner) ?? 0;
            if (innerTimeShare < 0.08 && innerReadShare < 0.10)
                continue;

            yield return new AnalysisFinding(
                FindingId: $"{RuleId}:{n.NodeId}",
                RuleId: RuleId,
                Severity: loops >= 80 ? FindingSeverity.Medium : FindingSeverity.Low,
                Confidence: FindingConfidence.Medium,
                Category: Category,
                Title: Title,
                Summary:
                $"Nested Loop `{n.NodeId}` runs inner `{inner.Node.NodeType}` ~{loops}×; consider whether an index can better support the inner predicate.",
                Explanation:
                "Repeated inner probes with sequential or bitmap heap access can be acceptable, but when inner work is non-trivial this is a common place to investigate join-key/index alignment.",
                NodeIds: new[] { n.NodeId, inner.NodeId },
                Evidence: new Dictionary<string, object?>
                {
                    ["nestedLoopNodeId"] = n.NodeId,
                    ["innerNodeId"] = inner.NodeId,
                    ["innerNodeType"] = inner.Node.NodeType,
                    ["innerAccessPathFamily"] = family,
                    ["innerLoops"] = loops,
                    ["innerRelationName"] = inner.Node.RelationName,
                    ["innerFilter"] = inner.Node.Filter,
                    ["innerIndexCond"] = inner.Node.IndexCond,
                    ["innerSubtreeTimeShare"] = innerTimeShare,
                    ["innerSubtreeReadShare"] = innerReadShare,
                },
                Suggestion:
                "Check join predicates on the inner side for btree/GiST/etc. support, verify outer cardinality estimates, and compare to hash/merge join alternatives in a safe test environment.",
                RankScore: null
            );
        }
    }
}
