using PostgresQueryAutopsyTool.Core.Domain;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class PlanWorkerStatsHelperTests
{
    [Fact]
    public void SharedReadsClearlyUneven_true_when_spread_and_ratio_large()
    {
        var w = new[]
        {
            new PlanWorkerStats(0, null, null, null, null, null, 400000, null, null, null, null, null, null, null, null, null, null, null),
            new PlanWorkerStats(1, null, null, null, null, null, 600000, null, null, null, null, null, null, null, null, null, null, null),
        };
        Assert.True(PlanWorkerStatsHelper.SharedReadsClearlyUneven(w));
    }

    [Fact]
    public void SharedReadRange_returns_min_max()
    {
        var w = new[]
        {
            new PlanWorkerStats(0, null, null, null, null, 10, 100, null, null, null, null, null, null, null, null, null, null, null),
            new PlanWorkerStats(1, null, null, null, null, 20, 200, null, null, null, null, null, null, null, null, null, null, null),
        };
        var r = PlanWorkerStatsHelper.SharedReadRange(w);
        Assert.NotNull(r);
        Assert.Equal(100, r.Value.Min);
        Assert.Equal(200, r.Value.Max);
    }
}
