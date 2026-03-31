using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings.Rules;

public sealed class NestedLoopAmplificationRule : IFindingRule
{
    public string RuleId => "E.nested-loop-amplification";
    public string Title => "Nested loop amplification concern";
    public FindingCategory Category => FindingCategory.LoopAmplification;

    public IEnumerable<AnalysisFinding> Evaluate(FindingEvaluationContext context)
    {
        if (!context.HasActualTiming && !context.HasBuffers)
            yield break;

        foreach (var n in context.Nodes)
        {
            if (!string.Equals(n.Node.NodeType, "Nested Loop", StringComparison.OrdinalIgnoreCase))
                continue;

            var childIds = n.ChildNodeIds;
            if (childIds.Count < 2)
                continue;

            var outer = context.ById[childIds[0]];
            var inner = context.ById[childIds[1]];

            var loops = inner.Node.ActualLoops ?? n.Node.ActualLoops ?? 1;
            if (loops < 10)
                continue;

            var innerTime = inner.Metrics.InclusiveActualTimeMs;
            var innerSubtreeTime = inner.Metrics.SubtreeInclusiveTimeMs;
            var innerReadShare = context.SubtreeSharedReadShareOfPlan(inner);
            var waste = inner.ContextEvidence?.ScanWaste;

            var severity = FindingSeverity.Medium;
            if (loops >= 100 && (innerSubtreeTime is > 10 || innerReadShare is > 0.35))
                severity = FindingSeverity.High;
            if (loops >= 1000)
                severity = FindingSeverity.Critical;

            var confidence = FindingConfidence.Medium;
            if (context.HasActualTiming && innerSubtreeTime is not null)
                confidence = FindingConfidence.High;

            yield return new AnalysisFinding(
                FindingId: $"{RuleId}:{n.NodeId}",
                RuleId: RuleId,
                Severity: severity,
                Confidence: confidence,
                Category: FindingCategory.JoinStrategyConcern,
                Title: "Nested loop may be amplifying inner work",
                Summary: $"Nested Loop `{n.NodeId}` executes inner subtree ~{loops} times; inner work may dominate runtime/I/O.",
                Explanation:
                "Nested loops can be excellent for small outer cardinalities, but become problematic when the inner side is expensive and repeated many times. " +
                "This finding flags a high loop count combined with meaningful inner subtree work.",
                NodeIds: new[] { n.NodeId, inner.NodeId, outer.NodeId },
                Evidence: new Dictionary<string, object?>
                {
                    ["nodeId"] = n.NodeId,
                    ["nodeType"] = n.Node.NodeType,
                    ["outerNodeId"] = outer.NodeId,
                    ["innerNodeId"] = inner.NodeId,
                    ["innerLoops"] = loops,
                    ["innerInclusiveTimeMs"] = innerTime,
                    ["innerSubtreeInclusiveTimeMs"] = innerSubtreeTime,
                    ["innerSubtreeSharedReadShareOfPlan"] = innerReadShare,
                    ["subtreeTimeShareOfPlan"] = context.SubtreeTimeShareOfPlan(n),
                    ["innerScanWaste_primaryScanNodeId"] = waste?.PrimaryScanNodeId,
                    ["innerScanWaste_relationName"] = waste?.RelationName,
                    ["innerScanWaste_rowsRemovedByFilter"] = waste?.RowsRemovedByFilter,
                    ["innerScanWaste_removedRowsShareApprox"] = waste?.RemovedRowsShareApprox,
                },
                Suggestion:
                "Inspect join predicates and cardinality. Consider whether a hash/merge join is viable, or whether the inner side needs stronger index support. " +
                "Validate row estimates on the outer side—misestimation often causes nested loops to be chosen incorrectly.",
                RankScore: null
            );
        }
    }
}

