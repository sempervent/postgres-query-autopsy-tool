using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Analysis;

public static class PlannerCostAnalyzer
{
    /// <summary>Detects presence of planner cost/estimate fields on normalized plan nodes.</summary>
    public static PlannerCostPresence Detect(IReadOnlyList<AnalyzedPlanNode> nodes)
    {
        if (nodes.Count == 0)
            return PlannerCostPresence.Unknown;

        var any = false;
        var none = false;
        foreach (var n in nodes)
        {
            var has = NodeHasPlannerCostLikeFields(n.Node);
            if (has) any = true;
            else none = true;
        }

        if (any && none)
            return PlannerCostPresence.Mixed;
        if (any)
            return PlannerCostPresence.Present;
        return PlannerCostPresence.NotDetected;
    }

    private static bool NodeHasPlannerCostLikeFields(NormalizedPlanNode node)
        => node.StartupCost is not null
           || node.TotalCost is not null
           || node.PlanRows is not null
           || node.PlanWidth is not null;
}
