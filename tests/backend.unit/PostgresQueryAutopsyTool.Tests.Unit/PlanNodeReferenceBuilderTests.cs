using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Comparison;
using PostgresQueryAutopsyTool.Core.Findings;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class PlanNodeReferenceBuilderTests
{
    [Fact]
    public void PrimaryLabelCore_scan_on_relation_avoids_raw_path()
    {
        var analysis = AnalysisFixtureBuilder.Build("simple_seq_scan.json");
        var scan = analysis.Nodes.First(n => !string.IsNullOrWhiteSpace(n.Node.RelationName));
        var byId = analysis.Nodes.ToDictionary(n => n.NodeId, StringComparer.Ordinal);
        var label = PlanNodeReferenceBuilder.PrimaryLabelCore(scan, byId);
        Assert.Contains("Seq Scan", label, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("root.", label, StringComparison.Ordinal);
    }

    [Fact]
    public void SafePrimary_never_returns_root_path_when_node_missing()
    {
        var analysis = AnalysisFixtureBuilder.Build("simple_seq_scan.json");
        var ctx = new FindingEvaluationContext(analysis.RootNodeId, analysis.Nodes);
        var s = PlanNodeReferenceBuilder.SafePrimary("root.0.0.0.0.0.99", ctx);
        Assert.Equal("an operator in this plan", s);
    }

    [Fact]
    public void Plan_story_propagation_beats_when_present_use_human_anchors_not_raw_paths()
    {
        var analysis = AnalysisFixtureBuilder.Build("simple_seq_scan.json");
        Assert.NotNull(analysis.PlanStory);
        var beats = analysis.PlanStory!.PropagationBeats;
        if (beats.Count == 0)
            return;
        foreach (var b in beats)
        {
            Assert.False(string.IsNullOrWhiteSpace(b.Text));
            if (b.FocusNodeId is not null)
                Assert.DoesNotContain("root.", b.AnchorLabel, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void Comparison_story_first_beat_may_anchor_pair_ids()
    {
        var a = AnalysisFixtureBuilder.Build("compare_before_seq_scan.json");
        var b = AnalysisFixtureBuilder.Build("compare_after_index_scan.json");
        var cmp = new ComparisonEngine().Compare(a, b);
        Assert.NotNull(cmp.ComparisonStory);
        var anchored = cmp.ComparisonStory!.ChangeBeats.FirstOrDefault(x => x.FocusNodeIdA is not null && x.FocusNodeIdB is not null);
        Assert.NotNull(anchored);
        Assert.False(string.IsNullOrWhiteSpace(anchored!.PairAnchorLabel));
    }
}
