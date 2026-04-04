namespace PostgresQueryAutopsyTool.Core.Analysis;

public sealed record PlanSummary(
    long TotalNodeCount,
    int MaxDepth,
    double? RootInclusiveActualTimeMs,
    bool HasActualTiming,
    bool HasBuffers,
    /// <summary>Detected from parsed plan nodes (not from declared EXPLAIN metadata).</summary>
    PlannerCostPresence PlannerCosts,
    IReadOnlyList<string> TopExclusiveTimeHotspotNodeIds,
    IReadOnlyList<string> TopInclusiveTimeHotspotNodeIds,
    IReadOnlyList<string> TopSharedReadHotspotNodeIds,
    int SevereFindingsCount,
    IReadOnlyList<string> Warnings,
    /// <summary>Phase 58: prioritized bottleneck lines (evidence-backed; not duplicate findings).</summary>
    IReadOnlyList<PlanBottleneckInsight> Bottlenecks);

