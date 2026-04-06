using System.Linq;
using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Comparison;
using PostgresQueryAutopsyTool.Core.Findings;
using PostgresQueryAutopsyTool.Core.Findings.Rules;
using PostgresQueryAutopsyTool.Core.Parsing;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class ComparisonEngineTests
{
    [Fact]
    public void Maps_root_nodes_and_produces_summary_deltas()
    {
        var a = AnalyzeFixture("compare_before_seq_scan.json");
        var b = AnalyzeFixture("compare_after_index_scan.json");

        var cmp = new ComparisonEngine().Compare(a, b);

        Assert.NotEmpty(cmp.Matches);
        Assert.Contains(cmp.Matches, m => m.NodeIdA == "root" && m.NodeIdB == "root");

        // Even if runtime timing is present, should compute delta.
        Assert.NotNull(cmp.Summary.RuntimeDeltaMs);
        Assert.NotNull(cmp.Summary.RuntimeDeltaPct);

        // Should produce node deltas for matched nodes.
        Assert.NotEmpty(cmp.NodeDeltas);
    }

    [Fact]
    public void Detects_improvements_when_runtime_drops()
    {
        var a = AnalyzeFixture("compare_before_seq_scan.json");
        var b = AnalyzeFixture("compare_after_index_scan.json");

        var cmp = new ComparisonEngine().Compare(a, b);

        // Root inclusive time should be lower in "after" fixture.
        Assert.True(cmp.Summary.RuntimeDeltaMs is < 0);
        Assert.NotEmpty(cmp.TopImprovedNodes);
    }

    [Fact]
    public void Findings_diff_reports_new_or_resolved_items()
    {
        var a = AnalyzeFixture("compare_before_seq_scan.json");
        var b = AnalyzeFixture("compare_after_index_scan.json");

        var cmp = new ComparisonEngine().Compare(a, b);

        Assert.NotEmpty(cmp.FindingsDiff.Items);
        Assert.Contains(cmp.FindingsDiff.Items, i => i.ChangeType is FindingChangeType.New or FindingChangeType.Resolved or FindingChangeType.Improved or FindingChangeType.Worsened);
    }

    [Fact]
    public void Compare_includes_bottleneck_posture_brief_when_both_plans_have_bottlenecks()
    {
        var a = AnalyzeFixture("compare_before_seq_scan.json");
        var b = AnalyzeFixture("compare_after_index_scan.json");

        var cmp = new ComparisonEngine().Compare(a, b);

        Assert.NotNull(cmp.BottleneckBrief);
        Assert.NotEmpty(cmp.BottleneckBrief.Lines);
        Assert.Contains(
            cmp.BottleneckBrief.Lines,
            line => line.Contains("bottleneck", StringComparison.OrdinalIgnoreCase));
        Assert.NotNull(cmp.ComparisonStory);
        Assert.False(string.IsNullOrWhiteSpace(cmp.ComparisonStory!.Overview));
    }

    [Fact]
    public void Rewrite_nl_to_hash_join_maps_join_roots_with_region_continuity_hint()
    {
        var a = AnalyzeFixture("rewrite_nl_orders_lineitems.json");
        var b = AnalyzeFixture("rewrite_hash_orders_lineitems.json");
        var cmp = new ComparisonEngine().Compare(a, b);

        var joinPair = cmp.PairDetails.FirstOrDefault(p =>
            (p.Identity.NodeTypeA ?? "").Contains("Nested Loop", StringComparison.OrdinalIgnoreCase) &&
            (p.Identity.NodeTypeB ?? "").Contains("Hash Join", StringComparison.OrdinalIgnoreCase));
        Assert.NotNull(joinPair);
        Assert.False(string.IsNullOrWhiteSpace(joinPair!.RegionContinuityHint));
        Assert.Contains("nested-loop", joinPair.RegionContinuityHint, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("hash", joinPair.RegionContinuityHint, StringComparison.OrdinalIgnoreCase);

        Assert.NotNull(cmp.ComparisonStory);
        var beats = string.Join(' ', cmp.ComparisonStory!.ChangeBeats.Select(b => b.Text));
        var storyText = cmp.ComparisonStory.Overview + " " + beats;
        Assert.Contains("orders", storyText, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Rewrite_nl_to_hash_emits_operator_shape_compare_suggestion_when_continuity_present()
    {
        var a = AnalyzeFixture("rewrite_nl_orders_lineitems.json");
        var b = AnalyzeFixture("rewrite_hash_orders_lineitems.json");
        var cmp = new ComparisonEngine().Compare(a, b);
        var sugs = CompareOptimizationSuggestionEngine.Build(cmp);
        Assert.Contains(
            sugs,
            s => s.Title.Contains("Rewrite changed operator shape", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Rewrite_access_seq_to_index_shipments_emits_scan_continuity_hint_on_mapped_pair()
    {
        var a = AnalyzeFixture("rewrite_access_seq_shipments.json");
        var b = AnalyzeFixture("rewrite_access_idx_shipments.json");
        var cmp = new ComparisonEngine().Compare(a, b);

        var scanPair = cmp.PairDetails.FirstOrDefault(p =>
            (p.Identity.NodeTypeA ?? "").Contains("Seq Scan", StringComparison.OrdinalIgnoreCase) &&
            (p.Identity.NodeTypeB ?? "").Contains("Index Scan", StringComparison.OrdinalIgnoreCase));
        Assert.NotNull(scanPair);
        Assert.False(string.IsNullOrWhiteSpace(scanPair!.RegionContinuityHint));
        Assert.Contains("shipments", scanPair.RegionContinuityHint, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("sequential scan", scanPair.RegionContinuityHint, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("index-backed", scanPair.RegionContinuityHint, StringComparison.OrdinalIgnoreCase);
        Assert.False(string.IsNullOrWhiteSpace(scanPair.RegionContinuitySummaryCue));
        Assert.Contains("narrower access", scanPair.RegionContinuitySummaryCue, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("access.narrower", scanPair.ContinuityKindKey);

        var sugs = CompareOptimizationSuggestionEngine.Build(cmp);
        Assert.Contains(
            sugs,
            s => s.Summary.Contains("Narrower access often shifts pressure", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Rewrite_sort_seq_to_ordered_index_shipments_emits_ordering_continuity_hint()
    {
        var a = AnalyzeFixture("rewrite_sort_seq_shipments.json");
        var b = AnalyzeFixture("rewrite_index_ordered_shipments.json");
        var cmp = new ComparisonEngine().Compare(a, b);

        var scanPair = cmp.PairDetails.FirstOrDefault(p =>
            (p.Identity.NodeTypeA ?? "").Contains("Seq Scan", StringComparison.OrdinalIgnoreCase) &&
            (p.Identity.NodeTypeB ?? "").Contains("Index Scan", StringComparison.OrdinalIgnoreCase));
        Assert.NotNull(scanPair);
        Assert.False(string.IsNullOrWhiteSpace(scanPair!.RegionContinuityHint));
        Assert.Contains("explicit sort", scanPair.RegionContinuityHint, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("shipments", scanPair.RegionContinuityHint, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Strong ordering evidence", scanPair.RegionContinuityHint, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Partial win", scanPair.RegionContinuityHint, StringComparison.OrdinalIgnoreCase);
        Assert.False(string.IsNullOrWhiteSpace(scanPair.RegionContinuitySummaryCue));
        Assert.Contains("narrower access", scanPair.RegionContinuitySummaryCue, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("access.narrower.orderStrong", scanPair.ContinuityKindKey);

        Assert.NotNull(cmp.ComparisonStory);
        var beats = string.Join(' ', cmp.ComparisonStory!.ChangeBeats.Select(x => x.Text));
        Assert.Contains("explicit sort", beats, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Rewrite_access_seq_to_bitmap_shipments_emits_bitmap_continuity_hint_and_summary_cue()
    {
        var a = AnalyzeFixture("rewrite_access_seq_shipments.json");
        var b = AnalyzeFixture("rewrite_access_bitmap_shipments.json");
        var cmp = new ComparisonEngine().Compare(a, b);

        var pair = cmp.PairDetails.FirstOrDefault(p =>
            (p.Identity.NodeTypeA ?? "").Contains("Seq Scan", StringComparison.OrdinalIgnoreCase) &&
            (p.Identity.NodeTypeB ?? "").Contains("Bitmap Heap", StringComparison.OrdinalIgnoreCase));
        Assert.NotNull(pair);
        Assert.False(string.IsNullOrWhiteSpace(pair!.RegionContinuityHint));
        Assert.Contains("bitmap heap", pair.RegionContinuityHint, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("Same relation · seq to bitmap", pair.RegionContinuitySummaryCue);
        Assert.Equal("access.seqToBitmap", pair.ContinuityKindKey);
    }

    [Fact]
    public void Rewrite_access_bitmap_to_index_shipments_emits_index_transition_hint()
    {
        var a = AnalyzeFixture("rewrite_access_bitmap_shipments.json");
        var b = AnalyzeFixture("rewrite_access_idx_shipments.json");
        var cmp = new ComparisonEngine().Compare(a, b);

        var pair = cmp.PairDetails.FirstOrDefault(p =>
            (p.Identity.NodeTypeA ?? "").Contains("Bitmap Heap", StringComparison.OrdinalIgnoreCase) &&
            (p.Identity.NodeTypeB ?? "").Equals("Index Scan", StringComparison.OrdinalIgnoreCase));
        Assert.NotNull(pair);
        Assert.False(string.IsNullOrWhiteSpace(pair!.RegionContinuityHint));
        Assert.Contains("direct index-backed scan", pair.RegionContinuityHint, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("Same relation · bitmap to index", pair.RegionContinuitySummaryCue);
        Assert.Equal("access.bitmapToIndex", pair.ContinuityKindKey);
    }

    [Fact]
    public void Rewrite_access_index_to_index_only_shipments_emits_index_only_continuity()
    {
        var a = AnalyzeFixture("rewrite_access_idx_shipments.json");
        var b = AnalyzeFixture("rewrite_access_idxonly_shipments.json");
        var cmp = new ComparisonEngine().Compare(a, b);

        var pair = cmp.PairDetails.FirstOrDefault(p =>
            (p.Identity.NodeTypeA ?? "").Equals("Index Scan", StringComparison.OrdinalIgnoreCase) &&
            (p.Identity.NodeTypeB ?? "").Contains("Index Only", StringComparison.OrdinalIgnoreCase));
        Assert.NotNull(pair);
        Assert.False(string.IsNullOrWhiteSpace(pair!.RegionContinuityHint));
        Assert.Contains("index-only path", pair.RegionContinuityHint, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("Same relation · index-only path", pair.RegionContinuitySummaryCue);
        Assert.Equal("access.indexToIndexOnly", pair.ContinuityKindKey);
    }

    [Fact]
    public void Rewrite_access_index_to_bitmap_shipments_emits_regression_cue()
    {
        var a = AnalyzeFixture("rewrite_access_idx_shipments.json");
        var b = AnalyzeFixture("rewrite_access_bitmap_shipments.json");
        var cmp = new ComparisonEngine().Compare(a, b);

        var pair = cmp.PairDetails.FirstOrDefault(p =>
            (p.Identity.NodeTypeA ?? "").Equals("Index Scan", StringComparison.OrdinalIgnoreCase) &&
            (p.Identity.NodeTypeB ?? "").Contains("Bitmap Heap", StringComparison.OrdinalIgnoreCase));
        Assert.NotNull(pair);
        Assert.Equal("access.indexToBitmap.regression", pair!.ContinuityKindKey);
        Assert.Contains("regression", pair.RegionContinuitySummaryCue, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Nl_inner_seq_heavy_bottleneck_line_stresses_repeated_inner_seq_scan()
    {
        var a = AnalyzeFixture("nl_inner_seq_heavy.json");
        var byId = a.Nodes.ToDictionary(n => n.NodeId, StringComparer.Ordinal);
        var root = byId[a.RootNodeId];
        var line = OperatorNarrativeHelper.BottleneckDetailLine(root, byId);
        Assert.Contains("Nested loop re-runs", line, StringComparison.Ordinal);
        Assert.Contains("sequential scan", line, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("8000", line.Replace(",", "", StringComparison.Ordinal), StringComparison.Ordinal);

        Assert.True(root.ChildNodeIds.Count >= 2);
        var inner = byId[root.ChildNodeIds[1]];
        var innerNote = OperatorNarrativeHelper.SymptomNoteIfNestedLoopInner(inner, byId);
        Assert.NotNull(innerNote);
        Assert.Contains("nested loop", innerNote, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("8000", innerNote!.Replace(",", "", StringComparison.Ordinal), StringComparison.Ordinal);
    }

    private static PlanAnalysisResult WithQueryText(PlanAnalysisResult p, string? queryText) =>
        p with { QueryText = queryText };

    [Fact]
    public void Query_assisted_ordering_uses_order_by_when_index_json_omits_sort_columns()
    {
        const string sql =
            "SELECT * FROM shipments WHERE warehouse_id = 3 ORDER BY priority DESC LIMIT 500";
        var a = WithQueryText(AnalyzeFixture("rewrite_queryassist_sort_priority_shipments.json"), sql);
        var b = WithQueryText(AnalyzeFixture("rewrite_access_idx_shipments.json"), sql);
        var cmp = new ComparisonEngine().Compare(a, b);

        var scanPair = cmp.PairDetails.FirstOrDefault(p =>
            (p.Identity.NodeTypeA ?? "").Contains("Seq Scan", StringComparison.OrdinalIgnoreCase) &&
            (p.Identity.NodeTypeB ?? "").Contains("Index Scan", StringComparison.OrdinalIgnoreCase));
        Assert.NotNull(scanPair);
        Assert.Equal("access.narrower.orderQueryText", scanPair!.ContinuityKindKey);
        Assert.Contains("ORDER BY", scanPair.RegionContinuityHint, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("JSON", scanPair.RegionContinuityHint, StringComparison.OrdinalIgnoreCase);
        Assert.False(string.IsNullOrWhiteSpace(scanPair.RegionContinuitySummaryCue));
    }

    [Fact]
    public void Gather_merge_vs_single_aggregate_emits_grouped_output_continuity()
    {
        var a = AnalyzeFixture("rewrite_aggregate_gather_merge_customer_shipments.json");
        var b = AnalyzeFixture("rewrite_aggregate_hash_customer_shipments.json");
        var cmp = new ComparisonEngine().Compare(a, b);

        var pair = cmp.PairDetails.FirstOrDefault(p =>
            (p.Identity.NodeTypeA ?? "").Contains("Gather Merge", StringComparison.OrdinalIgnoreCase) &&
            (p.Identity.NodeTypeB ?? "").Contains("Aggregate", StringComparison.OrdinalIgnoreCase) &&
            !(p.Identity.NodeTypeB ?? "").Contains("Partial", StringComparison.OrdinalIgnoreCase));
        Assert.NotNull(pair);
        Assert.Equal("aggregate.gatherVsSingle", pair!.ContinuityKindKey);
        Assert.Contains("grouped-output", pair.RegionContinuityHint, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("gather-merge", pair.RegionContinuityHint, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Partial_aggregate_vs_hash_aggregate_emits_partial_final_continuity()
    {
        var a = AnalyzeFixture("rewrite_aggregate_hash_customer_shipments.json");
        var b = AnalyzeFixture("rewrite_aggregate_partial_customer_shipments.json");
        var cmp = new ComparisonEngine().Compare(a, b);

        var pair = cmp.PairDetails.FirstOrDefault(p =>
            (p.Identity.NodeTypeA ?? "").Contains("Aggregate", StringComparison.OrdinalIgnoreCase) &&
            !(p.Identity.NodeTypeA ?? "").Contains("Partial", StringComparison.OrdinalIgnoreCase) &&
            (p.Identity.NodeTypeB ?? "").Contains("Partial Aggregate", StringComparison.OrdinalIgnoreCase));
        Assert.NotNull(pair);
        Assert.Equal("aggregate.partialFinal", pair!.ContinuityKindKey);
        Assert.Contains("partial vs finalize", pair.RegionContinuityHint, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Group_by_query_text_bridges_differing_planner_group_key_strings()
    {
        const string q = "SELECT count(*) FROM shipments GROUP BY shipments.customer_id";
        var a = WithQueryText(AnalyzeFixture("rewrite_aggregate_hash_customer_shipments.json"), q);
        var b = WithQueryText(AnalyzeFixture("rewrite_aggregate_hash_qualified_customer_shipments.json"), q);
        var cmp = new ComparisonEngine().Compare(a, b);

        var pair = cmp.PairDetails.FirstOrDefault(p =>
            (p.Identity.NodeTypeA ?? "").Contains("Aggregate", StringComparison.OrdinalIgnoreCase) &&
            (p.Identity.NodeTypeB ?? "").Contains("Aggregate", StringComparison.OrdinalIgnoreCase));
        Assert.NotNull(pair);
        Assert.Equal("aggregate.queryTextGroupKeyBridge", pair!.ContinuityKindKey);
        Assert.Contains("GROUP BY", pair.RegionContinuityHint, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Time_bucket_in_query_adds_hedged_bucket_context_to_partial_final_continuity()
    {
        const string q =
            "SELECT time_bucket('1 hour', created_at) AS bucket, count(*) FROM shipments GROUP BY bucket";
        var a = WithQueryText(AnalyzeFixture("rewrite_aggregate_hash_bucket_shipments.json"), q);
        var b = WithQueryText(AnalyzeFixture("rewrite_aggregate_partial_bucket_shipments.json"), q);
        var cmp = new ComparisonEngine().Compare(a, b);

        var pair = cmp.PairDetails.FirstOrDefault(p =>
            (p.Identity.NodeTypeA ?? "").Contains("Aggregate", StringComparison.OrdinalIgnoreCase) &&
            (p.Identity.NodeTypeB ?? "").Contains("Partial Aggregate", StringComparison.OrdinalIgnoreCase));
        Assert.NotNull(pair);
        Assert.Equal("aggregate.partialFinal", pair!.ContinuityKindKey);
        Assert.Contains("time_bucket", pair.RegionContinuityHint, StringComparison.OrdinalIgnoreCase);
    }

    private static PlanAnalysisResult AnalyzeFixture(string fileName)
    {
        var json = ReadFixture(fileName);
        using var doc = JsonDocument.Parse(json);

        var parser = new PostgresJsonExplainParser();
        var root = parser.ParsePostgresExplain(doc.RootElement);

        var metrics = new DerivedMetricsEngine().Compute(root);
        var findings = new FindingsEngine(new IFindingRule[]
        {
            new RowMisestimationRule(),
            new ExclusiveCpuHotspotRule(),
            new SubtreeRuntimeHotspotRule(),
            new BufferReadHotspotRule(),
            new NestedLoopAmplificationRule(),
            new NestedLoopInnerIndexSupportRule(),
            new SequentialScanConcernRule(),
            new PotentialStatisticsIssueRule(),
            new PotentialIndexingOpportunityRule(),
            new PlanComplexityConcernRule(),
            new RepeatedExpensiveSubtreeRule(),
            new SortCostConcernRule(),
            new HashJoinPressureRule(),
            new MaterializeLoopsConcernRule(),
            new HighFanOutJoinWarningRule(),
            new QueryShapeBoundaryConcernRule(),
        }).EvaluateAndRank(root.NodeId, metrics);

        var summary = PlanSummaryBuilder.Build(root.NodeId, metrics, findings);
        var narrative = NarrativeGenerator.From(summary, metrics, findings);
        var findingCtx = new FindingEvaluationContext(root.NodeId, metrics);
        var indexOverview = IndexSignalAnalyzer.BuildOverview(metrics, findingCtx);
        var indexInsights = IndexSignalAnalyzer.BuildInsights(metrics, findingCtx, indexOverview);

        return new PlanAnalysisResult(
            AnalysisId: "test",
            RootNodeId: root.NodeId,
            QueryText: null,
            ExplainMetadata: null,
            Nodes: metrics,
            Findings: findings,
            Narrative: narrative,
            Summary: summary,
            IndexOverview: indexOverview,
            IndexInsights: indexInsights,
            OptimizationSuggestions: Array.Empty<OptimizationSuggestion>()
        );
    }

    private static string ReadFixture(string fileName)
    {
        var fixturePath = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "../../../fixtures/postgres-json", fileName)
        );
        return File.ReadAllText(fixturePath);
    }
}

