using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Domain;
using PostgresQueryAutopsyTool.Core.Findings;
using PostgresQueryAutopsyTool.Core.Findings.Rules;
using PostgresQueryAutopsyTool.Core.Parsing;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class OptimizationSuggestionEngineTests
{
    private static readonly IPlanParser Parser = new PostgresJsonExplainParser();

    [Fact]
    public void Seq_scan_fixture_produces_index_experiment_suggestion()
    {
        var analysis = AnalyzeFixture("simple_seq_scan.json");
        var s = analysis.OptimizationSuggestions;
        Assert.Contains(s, x =>
            x.Category == OptimizationSuggestionCategory.IndexExperiment &&
            x.SuggestedActionType == SuggestedActionType.CreateIndexCandidate &&
            x.Title.Contains("Seq Scan", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Hash_join_fixture_can_produce_join_strategy_suggestion()
    {
        var analysis = AnalyzeFixture("hash_join.json");
        var s = analysis.OptimizationSuggestions;
        Assert.Contains(s, x =>
            x.Category == OptimizationSuggestionCategory.JoinStrategy &&
            x.SuggestedActionType == SuggestedActionType.ReduceSortOrHashVolume);
    }

    [Fact]
    public void External_sort_fixture_produces_sort_or_spill_suggestion()
    {
        var analysis = AnalyzeFixture("operator_sort_external.json");
        var s = analysis.OptimizationSuggestions;
        Assert.Contains(s, x =>
            x.Category == OptimizationSuggestionCategory.SortOrdering &&
            (x.Title.Contains("Sort", StringComparison.OrdinalIgnoreCase) ||
             x.Title.Contains("spill", StringComparison.OrdinalIgnoreCase) ||
             x.SuggestedActionType == SuggestedActionType.ReduceSortOrHashVolume));
    }

    [Fact]
    public void Index_scan_heap_heavy_fixture_suggests_review_existing_index()
    {
        var analysis = AnalyzeFixture("index_scan_heap_heavy.json");
        Assert.Contains(analysis.OptimizationSuggestions, x =>
            x.SuggestedActionType == SuggestedActionType.ReviewExistingIndex &&
            (x.Title.Contains("index", StringComparison.OrdinalIgnoreCase) ||
             x.Summary.Contains("heap", StringComparison.OrdinalIgnoreCase) ||
             x.Summary.Contains("read-heavy", StringComparison.OrdinalIgnoreCase)));
    }

    [Fact]
    public void Nested_loop_inner_seq_fixture_suggests_inner_side_index_support()
    {
        var analysis = AnalyzeFixture("nl_inner_seq_index_support.json");
        Assert.Contains(analysis.OptimizationSuggestions, x =>
            x.Category == OptimizationSuggestionCategory.JoinStrategy &&
            (x.Title.Contains("inner", StringComparison.OrdinalIgnoreCase) ||
             x.Summary.Contains("inner", StringComparison.OrdinalIgnoreCase)));
    }

    [Fact]
    public void Misestimation_fixture_produces_statistics_suggestion()
    {
        var analysis = AnalyzeFixture("nested_loop_misestimation.json");
        var s = analysis.OptimizationSuggestions;
        Assert.Contains(s, x =>
            x.Category == OptimizationSuggestionCategory.StatisticsMaintenance &&
            x.SuggestedActionType == SuggestedActionType.RefreshStatistics);
    }

    [Fact]
    public void Misestimation_fixture_consolidates_overlapping_statistics_findings_into_one_cluster()
    {
        var analysis = AnalyzeFixture("nested_loop_misestimation.json");
        var stats = analysis.OptimizationSuggestions
            .Where(x => x.Category == OptimizationSuggestionCategory.StatisticsMaintenance)
            .ToArray();
        Assert.Single(stats);
        Assert.True(stats[0].IsGroupedCluster);
        Assert.False(string.IsNullOrWhiteSpace(stats[0].RecommendedNextAction));
        Assert.False(string.IsNullOrWhiteSpace(stats[0].WhyItMatters));
        Assert.Equal(OptimizationSuggestionFamily.StatisticsPlannerAccuracy, stats[0].SuggestionFamily);
    }

    [Fact]
    public void Seq_scan_suggestion_includes_human_readable_fields_not_machine_concat()
    {
        var analysis = AnalyzeFixture("simple_seq_scan.json");
        var s = analysis.OptimizationSuggestions.First(x => x.Category == OptimizationSuggestionCategory.IndexExperiment);
        Assert.False(string.IsNullOrWhiteSpace(s.RecommendedNextAction));
        Assert.False(string.IsNullOrWhiteSpace(s.WhyItMatters));
        Assert.False(s.RecommendedNextAction.Contains("Confidence:", StringComparison.Ordinal));
        Assert.False(s.Summary.Contains("Confidence:", StringComparison.Ordinal));
    }

    [Fact]
    public void External_sort_suggestion_avoids_raw_node_path_in_summary()
    {
        var analysis = AnalyzeFixture("operator_sort_external.json");
        var sortish = analysis.OptimizationSuggestions.Where(x =>
            x.Category == OptimizationSuggestionCategory.SortOrdering ||
            x.Title.Contains("sort", StringComparison.OrdinalIgnoreCase)).ToArray();
        Assert.NotEmpty(sortish);
        Assert.All(sortish, x => Assert.DoesNotContain("root.", x.Summary, StringComparison.Ordinal));
    }

    [Fact]
    public void Query_shape_boundary_fixture_produces_rewrite_suggestion_and_bottleneck_linked_rationale()
    {
        var analysis = AnalyzeFixture("query_shape_cte_under_nested_loop.json");
        Assert.Contains(analysis.Findings, f => f.RuleId == "S.query-shape-boundary");

        var boundary = analysis.OptimizationSuggestions.FirstOrDefault(s =>
            s.Title.Contains("CTE/subquery", StringComparison.OrdinalIgnoreCase));
        Assert.NotNull(boundary);
        Assert.Equal(OptimizationSuggestionCategory.QueryRewrite, boundary.Category);
        Assert.Equal(SuggestedActionType.ReviewJoinShape, boundary.SuggestedActionType);

        var withBottleneckHint = analysis.OptimizationSuggestions.Where(s =>
            s.Rationale.Contains("Primary bottleneck", StringComparison.OrdinalIgnoreCase)).ToArray();
        Assert.NotEmpty(withBottleneckHint);
    }

    [Fact]
    public void Complex_timescaledb_query_is_not_naive_index_only_story()
    {
        var analysis = AnalyzeFixture("complex_timescaledb_query.json");
        var s = analysis.OptimizationSuggestions;

        Assert.Contains(s, x => x.Category == OptimizationSuggestionCategory.TimescaledbWorkload);
        Assert.Contains(s, x =>
            x.Summary.Contains("chunk", StringComparison.OrdinalIgnoreCase) ||
            x.Summary.Contains("window", StringComparison.OrdinalIgnoreCase) ||
            x.Summary.Contains("prun", StringComparison.OrdinalIgnoreCase) ||
            x.Details.Contains("bitmap", StringComparison.OrdinalIgnoreCase));

        var naiveOnly = s.Where(x =>
                x.Category == OptimizationSuggestionCategory.IndexExperiment &&
                x.SuggestedActionType == SuggestedActionType.CreateIndexCandidate &&
                !x.Cautions.Any(c => c.Contains("chunk", StringComparison.OrdinalIgnoreCase) ||
                                     c.Contains("naive", StringComparison.OrdinalIgnoreCase)))
            .ToArray();

        Assert.Empty(naiveOnly);
    }

    private static PlanAnalysisResult AnalyzeFixture(string fileName)
    {
        var json = ReadFixture(fileName);
        var root = Parser.ParsePostgresExplain(JsonDocument.Parse(json).RootElement);
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
            new IndexAccessStillHeavyRule(),
            new BitmapRecheckAttentionRule(),
            new AppendChunkedBitmapWorkloadRule(),
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
        var ctx = new FindingEvaluationContext(root.NodeId, metrics);
        var overview = IndexSignalAnalyzer.BuildOverview(metrics, ctx);
        var insights = IndexSignalAnalyzer.BuildInsights(metrics, ctx, overview);
        var core = new PlanAnalysisResult(
            "test", root.NodeId, null, null, metrics, findings, narrative, summary, overview, insights,
            Array.Empty<OptimizationSuggestion>());
        return core with { OptimizationSuggestions = OptimizationSuggestionEngine.Build(core) };
    }

    private static string ReadFixture(string fileName)
    {
        var fixturePath = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "../../../fixtures/postgres-json", fileName)
        );
        return File.ReadAllText(fixturePath);
    }
}
