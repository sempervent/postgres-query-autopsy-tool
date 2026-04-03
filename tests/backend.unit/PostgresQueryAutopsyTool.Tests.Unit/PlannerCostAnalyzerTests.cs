using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Domain;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class PlannerCostAnalyzerTests
{
    [Fact]
    public void Empty_nodes_yields_unknown()
    {
        Assert.Equal(PlannerCostPresence.Unknown, PlannerCostAnalyzer.Detect(Array.Empty<AnalyzedPlanNode>()));
    }

    [Fact]
    public void Node_with_planner_costs_yields_present()
    {
        var root = new NormalizedPlanNode
        {
            NodeId = "r",
            NodeType = "Result",
            StartupCost = 0,
            TotalCost = 0.01m,
            Children = Array.Empty<NormalizedPlanNode>(),
        };
        var analyzed = new DerivedMetricsEngine().Compute(root);
        Assert.Equal(PlannerCostPresence.Present, PlannerCostAnalyzer.Detect(analyzed));
    }

    [Fact]
    public void Nodes_without_planner_cost_fields_yields_not_detected()
    {
        var root = new NormalizedPlanNode
        {
            NodeId = "r",
            NodeType = "Result",
            Children = Array.Empty<NormalizedPlanNode>(),
        };
        var analyzed = new DerivedMetricsEngine().Compute(root);
        Assert.Equal(PlannerCostPresence.NotDetected, PlannerCostAnalyzer.Detect(analyzed));
    }
}
