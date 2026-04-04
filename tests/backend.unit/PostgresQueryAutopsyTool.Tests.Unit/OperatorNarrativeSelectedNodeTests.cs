using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Domain;
using PostgresQueryAutopsyTool.Core.Findings;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class OperatorNarrativeSelectedNodeTests
{
    [Fact]
    public void BuildSelectedNodeInterpretation_includes_hotspot_and_bottleneck_cues_when_flagged()
    {
        static DerivedNodeMetrics M(int depth, double? inclusive, double? exclusive, double? subtree, double? share)
            => new(
                Depth: depth,
                IsRoot: depth == 0,
                IsLeaf: depth != 0,
                ChildCount: depth == 0 ? 1 : 0,
                SubtreeNodeCount: depth == 0 ? 2 : 1,
                InclusiveActualTimeMs: inclusive,
                ExclusiveActualTimeMsApprox: exclusive,
                SubtreeInclusiveTimeMs: subtree,
                SubtreeTimeShare: share,
                ActualRowsTotal: null,
                RowEstimateRatio: null,
                RowEstimateFactor: null,
                RowEstimateLog10Error: null,
                CostPerEstimatedRow: null,
                ActualTimePerOutputRowMs: null,
                LoopsAmplification: null,
                BufferTotalBlocks: null,
                BufferShareOfPlan: null,
                SubtreeSharedReadBlocks: null,
                SubtreeSharedHitBlocks: null,
                SubtreeBufferShare: null);

        var nodes = new[]
        {
            new AnalyzedPlanNode(
                NodeId: "root",
                ParentNodeId: null,
                ChildNodeIds: new[] { "leaf" },
                Node: new NormalizedPlanNode { NodeId = "root", NodeType = "Limit", Children = Array.Empty<NormalizedPlanNode>() },
                Metrics: M(0, 100, 1, 100, 1),
                ContextEvidence: null),
            new AnalyzedPlanNode(
                NodeId: "leaf",
                ParentNodeId: "root",
                ChildNodeIds: Array.Empty<string>(),
                Node: new NormalizedPlanNode { NodeId = "leaf", NodeType = "Sort", Children = Array.Empty<NormalizedPlanNode>() },
                Metrics: M(1, 99, 40, 99, 0.99),
                ContextEvidence: null),
        };

        var ctx = new FindingEvaluationContext("root", nodes);
        var text = OperatorNarrativeHelper.BuildSelectedNodeInterpretation(nodes[1], ctx, isRankedBottleneck: true, isTopExclusiveHotspot: true);

        Assert.Contains("Main bottlenecks", text, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("exclusive-time", text, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Sort", text, StringComparison.OrdinalIgnoreCase);
    }
}
