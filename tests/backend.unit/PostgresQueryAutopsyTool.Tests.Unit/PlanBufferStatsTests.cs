using PostgresQueryAutopsyTool.Core.Domain;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class PlanBufferStatsTests
{
    [Fact]
    public void NodeHasAnyBufferCounter_true_for_temp_only()
    {
        var n = new NormalizedPlanNode
        {
            NodeId = "root",
            NodeType = "Sort",
            TempReadBlocks = 0,
            TempWrittenBlocks = 100,
        };

        Assert.True(PlanBufferStats.NodeHasAnyBufferCounter(n));
    }

    [Fact]
    public void NodeHasAnyBufferCounter_false_when_all_buffer_fields_null()
    {
        var n = new NormalizedPlanNode { NodeId = "root", NodeType = "Seq Scan" };
        Assert.False(PlanBufferStats.NodeHasAnyBufferCounter(n));
    }
}
