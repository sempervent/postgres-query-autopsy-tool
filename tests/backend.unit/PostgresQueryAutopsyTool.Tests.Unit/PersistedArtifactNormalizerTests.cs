using PostgresQueryAutopsyTool.Core.Comparison;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class PersistedArtifactNormalizerTests
{
    [Fact]
    public void NormalizeLoadedAnalysis_reapplies_operator_briefing_on_bottlenecks_when_nodes_carry_lines()
    {
        var a = AnalysisFixtureBuilder.Build("operator_sort_external.json");
        var first = a.Summary.Bottlenecks[0];
        Assert.False(string.IsNullOrWhiteSpace(first.OperatorBriefingLine), "fixture pipeline should attach briefing");

        var stripped = a.Summary.Bottlenecks.Select(b => b with { OperatorBriefingLine = (string?)null }).ToArray();
        var raw = a with { Summary = a.Summary with { Bottlenecks = stripped } };

        var norm = PersistedArtifactNormalizer.NormalizeLoadedAnalysis(raw, null);
        var back = norm.Summary.Bottlenecks.First(b => b.InsightId == first.InsightId);
        Assert.False(string.IsNullOrWhiteSpace(back.OperatorBriefingLine));
    }
}
