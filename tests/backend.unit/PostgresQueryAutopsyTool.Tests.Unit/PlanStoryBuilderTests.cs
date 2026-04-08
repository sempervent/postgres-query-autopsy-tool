using PostgresQueryAutopsyTool.Core.Analysis;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class PlanStoryBuilderTests
{
    [Fact]
    public void Build_populates_overview_inspect_path_and_propagation_from_fixture()
    {
        var analysis = AnalysisFixtureBuilder.Build("simple_seq_scan.json");
        Assert.NotNull(analysis.PlanStory);
        var s = analysis.PlanStory!;
        Assert.False(string.IsNullOrWhiteSpace(s.PlanOverview));
        Assert.False(string.IsNullOrWhiteSpace(s.WorkConcentration));
        Assert.False(string.IsNullOrWhiteSpace(s.InspectFirstPath));
        Assert.Contains("1)", s.InspectFirstPath, StringComparison.Ordinal);
        Assert.NotNull(s.InspectFirstSteps);
        Assert.True(s.InspectFirstSteps!.Count >= 2);
        Assert.Equal(1, s.InspectFirstSteps[0].StepNumber);
        Assert.False(string.IsNullOrWhiteSpace(s.InspectFirstSteps[0].Title));
        Assert.Contains(
            s.InspectFirstSteps,
            st => st.Title.Contains("Cross-check", StringComparison.OrdinalIgnoreCase));
        Assert.NotEmpty(analysis.Summary.Bottlenecks);
        Assert.False(string.IsNullOrWhiteSpace(s.ExecutionShape));
        Assert.All(s.PropagationBeats, b => Assert.False(string.IsNullOrWhiteSpace(b.Text)));
        if (analysis.OptimizationSuggestions.Count > 0)
            Assert.Contains("Optimization suggestions", s.InspectFirstPath, StringComparison.OrdinalIgnoreCase);
    }
}
