using PostgresQueryAutopsyTool.Core.Comparison;
using PostgresQueryAutopsyTool.Core.Domain;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class PairRewriteVerdictBuilderTests
{
    [Fact]
    public void Build_improved_inclusive_time_high_confidence()
    {
        var m = new List<MetricDeltaDetail>
        {
            new("inclusiveActualTimeMs", 200, 100, -100, -0.5, DeltaDirection.Improved),
        };
        var v = PairRewriteVerdictBuilder.Build(m, null, null, MatchConfidence.High);
        Assert.Contains("improved", v, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Build_low_confidence_prefixes_weak_mapping_when_metrics_present()
    {
        var m = new List<MetricDeltaDetail>
        {
            new("inclusiveActualTimeMs", 200, 100, -100, -0.5, DeltaDirection.Improved),
        };
        var v = PairRewriteVerdictBuilder.Build(m, null, null, MatchConfidence.Low);
        Assert.NotNull(v);
        Assert.StartsWith("Weak mapping", v, StringComparison.Ordinal);
        Assert.Contains("improved", v, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Build_only_low_mapping_returns_dedicated_sentence_without_double_prefix()
    {
        var v = PairRewriteVerdictBuilder.Build(Array.Empty<MetricDeltaDetail>(), null, null, MatchConfidence.Low);
        Assert.Equal(
            "Low mapping confidence—treat this pair as a weak signal until confidence rises.",
            v);
    }
}
