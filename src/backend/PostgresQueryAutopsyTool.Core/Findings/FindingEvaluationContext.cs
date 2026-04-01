using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings;

public sealed class FindingEvaluationContext
{
    public string RootNodeId { get; }
    public IReadOnlyList<AnalyzedPlanNode> Nodes { get; }
    public IReadOnlyDictionary<string, AnalyzedPlanNode> ById { get; }

    public double? RootInclusiveActualTimeMs { get; }
    public long RootSharedReadBlocks { get; }

    public bool HasActualTiming { get; }
    public bool HasBuffers { get; }

    public IReadOnlyDictionary<string, int> NodeTypeCounts { get; }

    public FindingEvaluationContext(string rootNodeId, IReadOnlyList<AnalyzedPlanNode> nodes)
    {
        RootNodeId = rootNodeId;
        Nodes = nodes;
        ById = nodes.ToDictionary(n => n.NodeId, StringComparer.Ordinal);

        var root = ById[rootNodeId];
        RootInclusiveActualTimeMs = root.Metrics.InclusiveActualTimeMs;

        RootSharedReadBlocks = root.Metrics.SubtreeSharedReadBlocks ?? 0;

        HasActualTiming = nodes.Any(n => n.Metrics.InclusiveActualTimeMs is not null);
        HasBuffers = nodes.Any(n => PlanBufferStats.NodeHasAnyBufferCounter(n.Node));

        NodeTypeCounts = nodes
            .GroupBy(n => n.Node.NodeType ?? "Unknown", StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.Count(), StringComparer.Ordinal);
    }

    public double? ExclusiveTimeShareOfPlan(AnalyzedPlanNode node)
    {
        if (RootInclusiveActualTimeMs is null || RootInclusiveActualTimeMs.Value <= 0) return null;
        if (node.Metrics.ExclusiveActualTimeMsApprox is null) return null;
        return node.Metrics.ExclusiveActualTimeMsApprox.Value / RootInclusiveActualTimeMs.Value;
    }

    public double? SubtreeTimeShareOfPlan(AnalyzedPlanNode node)
    {
        return node.Metrics.SubtreeTimeShare;
    }

    public double? SharedReadShareOfPlan(AnalyzedPlanNode node)
    {
        if (RootSharedReadBlocks <= 0) return null;
        if (node.Node.SharedReadBlocks is null) return null;
        return (double)node.Node.SharedReadBlocks.Value / RootSharedReadBlocks;
    }

    public double? SubtreeSharedReadShareOfPlan(AnalyzedPlanNode node)
    {
        return node.Metrics.SubtreeBufferShare;
    }
}

