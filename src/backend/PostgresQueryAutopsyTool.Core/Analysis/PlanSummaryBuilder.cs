namespace PostgresQueryAutopsyTool.Core.Analysis;

public static class PlanSummaryBuilder
{
    public static PlanSummary Build(
        string rootNodeId,
        IReadOnlyList<AnalyzedPlanNode> nodes,
        IReadOnlyList<Domain.AnalysisFinding> findings,
        int hotspotCount = 5)
    {
        var byId = nodes.ToDictionary(n => n.NodeId, StringComparer.Ordinal);
        var root = byId[rootNodeId];

        var totalNodeCount = nodes.Count;
        var maxDepth = nodes.Count == 0 ? 0 : nodes.Max(n => n.Metrics.Depth);

        var hasActualTiming = nodes.Any(n => n.Metrics.InclusiveActualTimeMs is not null);
        var hasBuffers = nodes.Any(n => n.Node.SharedReadBlocks is not null || n.Node.SharedHitBlocks is not null);

        var warnings = new List<string>();
        if (!hasActualTiming)
            warnings.Add("No actual timing fields observed (did you run EXPLAIN ANALYZE?). Findings will be partial.");
        if (!hasBuffers)
            warnings.Add("No buffer fields observed (did you run EXPLAIN (ANALYZE, BUFFERS)?). Buffer hotspot findings will be partial.");

        var rootInclusive = root.Metrics.InclusiveActualTimeMs;

        var topExclusive = nodes
            .Where(n => n.Metrics.ExclusiveActualTimeMsApprox is not null)
            .OrderByDescending(n => n.Metrics.ExclusiveActualTimeMsApprox)
            .Take(hotspotCount)
            .Select(n => n.NodeId)
            .ToArray();

        var topInclusive = nodes
            .Where(n => n.Metrics.SubtreeInclusiveTimeMs is not null)
            .OrderByDescending(n => n.Metrics.SubtreeInclusiveTimeMs)
            .Take(hotspotCount)
            .Select(n => n.NodeId)
            .ToArray();

        var topSharedRead = nodes
            .Where(n => n.Node.SharedReadBlocks is not null)
            .OrderByDescending(n => n.Node.SharedReadBlocks)
            .Take(hotspotCount)
            .Select(n => n.NodeId)
            .ToArray();

        var severeFindings = findings.Count(f => f.Severity == Domain.FindingSeverity.High);

        return new PlanSummary(
            TotalNodeCount: totalNodeCount,
            MaxDepth: maxDepth,
            RootInclusiveActualTimeMs: rootInclusive,
            HasActualTiming: hasActualTiming,
            HasBuffers: hasBuffers,
            TopExclusiveTimeHotspotNodeIds: topExclusive,
            TopInclusiveTimeHotspotNodeIds: topInclusive,
            TopSharedReadHotspotNodeIds: topSharedRead,
            SevereFindingsCount: severeFindings,
            Warnings: warnings
        );
    }
}

