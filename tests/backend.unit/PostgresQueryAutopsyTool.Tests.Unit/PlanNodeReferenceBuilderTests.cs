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

    [Fact]
    public void Hash_join_probe_and_build_roles_use_between_phrase_not_raw_paths()
    {
        var analysis = AnalysisFixtureBuilder.Build("hash_join.json");
        var byId = analysis.Nodes.ToDictionary(n => n.NodeId, StringComparer.Ordinal);
        var eventsScan = analysis.Nodes.First(n => string.Equals(n.Node.RelationName, "events", StringComparison.Ordinal));
        var usersScan = analysis.Nodes.First(n => string.Equals(n.Node.RelationName, "users", StringComparison.Ordinal));
        var probeRef = PlanNodeReferenceBuilder.Build(eventsScan, byId, analysis.RootNodeId);
        var buildRef = PlanNodeReferenceBuilder.Build(usersScan, byId, analysis.RootNodeId);
        Assert.Contains("probe side", probeRef.RoleInPlan ?? "", StringComparison.OrdinalIgnoreCase);
        Assert.Contains("between", probeRef.RoleInPlan ?? "", StringComparison.OrdinalIgnoreCase);
        Assert.Contains("build side", buildRef.RoleInPlan ?? "", StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("root.", probeRef.RoleInPlan ?? "", StringComparison.Ordinal);
        Assert.DoesNotContain("root.", PlanNodeReferenceBuilder.DisplayLine(probeRef), StringComparison.Ordinal);
    }

    [Fact]
    public void Hash_join_with_Hash_on_left_infers_probe_build_via_Hash_child()
    {
        var analysis = AnalysisFixtureBuilder.Build("hash_join_build_left.json");
        var byId = analysis.Nodes.ToDictionary(n => n.NodeId, StringComparer.Ordinal);
        var eventsScan = analysis.Nodes.First(n => string.Equals(n.Node.RelationName, "events", StringComparison.Ordinal));
        var usersScan = analysis.Nodes.First(n => string.Equals(n.Node.RelationName, "users", StringComparison.Ordinal));
        var probeRef = PlanNodeReferenceBuilder.Build(eventsScan, byId, analysis.RootNodeId);
        var buildRef = PlanNodeReferenceBuilder.Build(usersScan, byId, analysis.RootNodeId);
        Assert.Contains("probe side", probeRef.RoleInPlan ?? "", StringComparison.OrdinalIgnoreCase);
        Assert.Contains("build side", buildRef.RoleInPlan ?? "", StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void PrimaryLabelCore_Hash_under_HashJoin_mentions_build_table()
    {
        var analysis = AnalysisFixtureBuilder.Build("hash_join.json");
        var byId = analysis.Nodes.ToDictionary(n => n.NodeId, StringComparer.Ordinal);
        var hashNode = analysis.Nodes.First(n => string.Equals(n.Node.NodeType, "Hash", StringComparison.Ordinal));
        var label = PlanNodeReferenceBuilder.PrimaryLabelCore(hashNode, byId);
        Assert.Contains("Hash build table", label, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("events", label, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("users", label, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Hash_semi_join_roles_mention_existence_test()
    {
        var analysis = AnalysisFixtureBuilder.Build("hash_semi_join.json");
        var byId = analysis.Nodes.ToDictionary(n => n.NodeId, StringComparer.Ordinal);
        var eventsScan = analysis.Nodes.First(n => string.Equals(n.Node.RelationName, "events", StringComparison.Ordinal));
        var usersScan = analysis.Nodes.First(n => string.Equals(n.Node.RelationName, "users", StringComparison.Ordinal));
        var probeRef = PlanNodeReferenceBuilder.Build(eventsScan, byId, analysis.RootNodeId);
        var innerRef = PlanNodeReferenceBuilder.Build(usersScan, byId, analysis.RootNodeId);
        Assert.Contains("existence", probeRef.RoleInPlan ?? "", StringComparison.OrdinalIgnoreCase);
        Assert.Contains("probe", probeRef.RoleInPlan ?? "", StringComparison.OrdinalIgnoreCase);
        Assert.Contains("existence", innerRef.RoleInPlan ?? "", StringComparison.OrdinalIgnoreCase);
        Assert.Contains("build", innerRef.RoleInPlan ?? "", StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Operator_briefing_line_combines_label_role_without_raw_path()
    {
        var analysis = AnalysisFixtureBuilder.Build("simple_seq_scan.json");
        var n = analysis.Nodes.First(x => !string.IsNullOrWhiteSpace(x.Node.RelationName));
        var ctx = new FindingEvaluationContext(analysis.RootNodeId, analysis.Nodes);
        var line = OperatorNarrativeHelper.BuildOperatorBriefingLine(n, ctx);
        Assert.False(string.IsNullOrWhiteSpace(line));
        Assert.DoesNotContain("root.", line, StringComparison.Ordinal);
    }

    [Fact]
    public void Hash_join_nested_shallow_Hash_infers_probe_build_without_ambiguous_phrase_when_evidence_good()
    {
        var analysis = AnalysisFixtureBuilder.Build("hash_join_nested_build_hash.json");
        var byId = analysis.Nodes.ToDictionary(n => n.NodeId, StringComparer.Ordinal);
        var ordersScan = analysis.Nodes.First(n => string.Equals(n.Node.RelationName, "orders", StringComparison.Ordinal));
        var lineitemsScan = analysis.Nodes.First(n => string.Equals(n.Node.RelationName, "lineitems", StringComparison.Ordinal));
        var probeRef = PlanNodeReferenceBuilder.Build(ordersScan, byId, analysis.RootNodeId);
        var buildRef = PlanNodeReferenceBuilder.Build(lineitemsScan, byId, analysis.RootNodeId);
        Assert.Contains("probe side", probeRef.RoleInPlan ?? "", StringComparison.OrdinalIgnoreCase);
        Assert.Contains("build side", buildRef.RoleInPlan ?? "", StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("defaulting to child order", probeRef.RoleInPlan ?? "", StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Gather_merge_fixture_primary_label_signals_partial_aggregate_context()
    {
        var analysis = AnalysisFixtureBuilder.Build("gather_merge_partial_agg.json");
        var gm = analysis.Nodes.First(n => (n.Node.NodeType ?? "").Contains("Gather Merge", StringComparison.OrdinalIgnoreCase));
        var byId = analysis.Nodes.ToDictionary(n => n.NodeId, StringComparer.Ordinal);
        var label = PlanNodeReferenceBuilder.PrimaryLabelCore(gm, byId);
        Assert.Contains("Gather Merge", label, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("partial aggregate", label, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Sort_external_fixture_bottleneck_narrative_mentions_disk_or_external_sort()
    {
        var analysis = AnalysisFixtureBuilder.Build("operator_sort_external.json");
        var sort = analysis.Nodes.First(n => (n.Node.NodeType ?? "").Contains("Sort", StringComparison.OrdinalIgnoreCase));
        var byId = analysis.Nodes.ToDictionary(n => n.NodeId, StringComparer.Ordinal);
        var line = OperatorNarrativeHelper.BottleneckDetailLine(sort, byId);
        Assert.True(
            line.Contains("external", StringComparison.OrdinalIgnoreCase) ||
            line.Contains("disk", StringComparison.OrdinalIgnoreCase) ||
            line.Contains("work_mem", StringComparison.OrdinalIgnoreCase),
            $"Expected spill/work_mem cue in: {line}");
    }

    [Fact]
    public void Plan_inspect_first_path_mentions_bottleneck_anchor()
    {
        var analysis = AnalysisFixtureBuilder.Build("hash_join.json");
        Assert.NotNull(analysis.PlanStory);
        var p = analysis.PlanStory!.InspectFirstPath;
        Assert.Contains("bottleneck", p, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Cross-check findings", p, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Bottleneck_insights_carry_operator_briefing_when_augmented()
    {
        var analysis = AnalysisFixtureBuilder.Build("operator_sort_external.json");
        var withBrief = analysis.Summary.Bottlenecks.FirstOrDefault(b => !string.IsNullOrWhiteSpace(b.OperatorBriefingLine));
        Assert.NotNull(withBrief);
        Assert.DoesNotContain("root.", withBrief!.OperatorBriefingLine!, StringComparison.Ordinal);
    }
}
