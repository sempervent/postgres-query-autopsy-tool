namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>Phase 64: copies <see cref="AnalyzedPlanNode.OperatorBriefingLine"/> onto bottleneck rows after interpretation augment.</summary>
public static class PlanBottleneckBriefingOverlay
{
    public static IReadOnlyList<PlanBottleneckInsight> AttachOperatorBriefings(
        IReadOnlyList<PlanBottleneckInsight> insights,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        return insights
            .Select(insight =>
            {
                var nid = insight.NodeIds.FirstOrDefault();
                if (nid is null || !byId.TryGetValue(nid, out var n))
                    return insight;
                var line = n.OperatorBriefingLine;
                return string.IsNullOrWhiteSpace(line) ? insight : insight with { OperatorBriefingLine = line };
            })
            .ToArray();
    }
}
