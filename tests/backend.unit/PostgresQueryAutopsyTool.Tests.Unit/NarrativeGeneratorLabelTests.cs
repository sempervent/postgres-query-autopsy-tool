using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Domain;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class NarrativeGeneratorLabelTests
{
    [Fact]
    public void Narrative_hotspots_use_labels_not_node_ids()
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
                ChildNodeIds: new[] { "root.0" },
                Node: new NormalizedPlanNode { NodeId = "root", NodeType = "Hash Join", Children = Array.Empty<NormalizedPlanNode>() },
                Metrics: M(depth: 0, inclusive: 10, exclusive: 5, subtree: 10, share: 1),
                ContextEvidence: null),
            new AnalyzedPlanNode(
                NodeId: "root.0",
                ParentNodeId: "root",
                ChildNodeIds: Array.Empty<string>(),
                Node: new NormalizedPlanNode { NodeId = "root.0", NodeType = "Seq Scan", RelationName = "users", Children = Array.Empty<NormalizedPlanNode>() },
                Metrics: M(depth: 1, inclusive: 8, exclusive: 8, subtree: 8, share: 0.8),
                ContextEvidence: null)
        };

        var summary = new PlanSummary(
            TotalNodeCount: 2,
            MaxDepth: 1,
            RootInclusiveActualTimeMs: 10,
            HasActualTiming: true,
            HasBuffers: false,
            PlannerCosts: PlannerCostPresence.Present,
            TopExclusiveTimeHotspotNodeIds: new[] { "root.0" },
            TopInclusiveTimeHotspotNodeIds: Array.Empty<string>(),
            TopSharedReadHotspotNodeIds: Array.Empty<string>(),
            SevereFindingsCount: 0,
            Warnings: Array.Empty<string>());

        var narrative = NarrativeGenerator.From(summary, nodes, Array.Empty<AnalysisFinding>());
        Assert.Contains("Seq Scan on users", narrative.WhereTimeWent);
        Assert.DoesNotContain("root.0", narrative.WhereTimeWent, StringComparison.OrdinalIgnoreCase);
    }
}

