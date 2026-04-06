using PostgresQueryAutopsyTool.Core.Comparison;
using PostgresQueryAutopsyTool.Core.Findings;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class ComparisonStoryBuilderTests
{
    [Fact]
    public void Severe_findings_delta_adds_structural_beat()
    {
        var a = AnalysisFixtureBuilder.Build("simple_seq_scan.json");
        var b = AnalysisFixtureBuilder.Build("simple_seq_scan.json");
        var summary = new ComparisonSummary(
            RuntimeMsA: 1, RuntimeMsB: 1, RuntimeDeltaMs: 0, RuntimeDeltaPct: 0,
            SharedReadBlocksA: 0, SharedReadBlocksB: 0, SharedReadDeltaBlocks: 0, SharedReadDeltaPct: 0,
            NodeCountA: 1, NodeCountB: 1, NodeCountDelta: 0,
            MaxDepthA: 0, MaxDepthB: 0, MaxDepthDelta: 0,
            SevereFindingsCountA: 0, SevereFindingsCountB: 2, SevereFindingsDelta: 2);
        var story = ComparisonStoryBuilder.Build(a, b, summary, Array.Empty<NodeDelta>(), Array.Empty<NodeDelta>(), new FindingsDiff(Array.Empty<FindingDiffItem>()));
        Assert.Contains(story.ChangeBeats, b => b.Text.Contains("High-severity", StringComparison.Ordinal));
    }
}
