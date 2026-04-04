using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Analysis;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class BottleneckEnumsJsonTests
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    [Fact]
    public void PlanBottleneckInsight_serializes_bottleneck_enums_as_camel_case_strings()
    {
        var bn = new PlanBottleneckInsight(
            "bn_test",
            1,
            "time_exclusive",
            BottleneckClass.SortOrSpillPressure,
            BottleneckCauseHint.DownstreamSymptom,
            "Sort dominates",
            "Detail",
            Array.Empty<string>(),
            Array.Empty<string>(),
            null,
            "Because → likely: test propagation note.",
            HumanAnchorLabel: "Sort on orders by id");

        var json = JsonSerializer.Serialize(bn, Options);
        Assert.Contains("\"bottleneckClass\":\"sortOrSpillPressure\"", json, StringComparison.Ordinal);
        Assert.Contains("\"causeHint\":\"downstreamSymptom\"", json, StringComparison.Ordinal);
    }

    [Fact]
    public void PlanBottleneckInsight_round_trips_from_camel_case_json()
    {
        const string json = """
            {"insightId":"x","rank":1,"kind":"time_exclusive","bottleneckClass":"joinAmplification","causeHint":"primaryFocus","headline":"h","detail":"d","nodeIds":[],"relatedFindingIds":[]}
            """;
        var bn = JsonSerializer.Deserialize<PlanBottleneckInsight>(json, Options);
        Assert.NotNull(bn);
        Assert.Equal(BottleneckClass.JoinAmplification, bn.BottleneckClass);
        Assert.Equal(BottleneckCauseHint.PrimaryFocus, bn.CauseHint);
    }
}
