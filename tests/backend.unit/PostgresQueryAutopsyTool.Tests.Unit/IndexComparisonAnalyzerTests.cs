using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Comparison;
using PostgresQueryAutopsyTool.Core.Findings;
using PostgresQueryAutopsyTool.Core.Findings.Rules;
using PostgresQueryAutopsyTool.Core.Parsing;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class IndexComparisonAnalyzerTests
{
    [Fact]
    public void Seq_scan_to_index_scan_compare_produces_overview_and_insight_diff()
    {
        var a = AnalyzePostgresJson("compare_before_seq_scan.json");
        var b = AnalyzePostgresJson("compare_after_index_scan.json");
        var cmp = new ComparisonEngine().Compare(a, b);

        Assert.NotNull(cmp.IndexComparison);
        Assert.NotEmpty(cmp.IndexComparison.OverviewLines);
        Assert.Contains(cmp.IndexComparison.InsightDiffs, d => d.Kind != IndexInsightDiffKind.Unchanged);

        var scanPair = cmp.PairDetails.FirstOrDefault(p =>
            p.Identity.AccessPathFamilyA == IndexAccessPathTokens.SeqScan &&
            p.Identity.AccessPathFamilyB == IndexAccessPathTokens.IndexScan);
        Assert.NotNull(scanPair);
        Assert.NotEmpty(scanPair!.IndexDeltaCues);
        Assert.Contains(scanPair.IndexDeltaCues, c => c.Contains("Access path family", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Complex_timescaledb_vs_simple_plan_flags_chunked_posture_change()
    {
        var heavy = AnalyzePostgresJson("complex_timescaledb_query.json");
        var light = AnalyzePostgresJson("simple_seq_scan.json");
        Assert.True(heavy.IndexOverview.SuggestsChunkedBitmapWorkload);
        Assert.False(light.IndexOverview.SuggestsChunkedBitmapWorkload);

        var cmp = new ComparisonEngine().Compare(heavy, light);
        Assert.True(cmp.IndexComparison.EitherPlanSuggestsChunkedBitmapWorkload);
        Assert.Contains(cmp.IndexComparison.OverviewLines, l =>
            l.Contains("Chunked bitmap", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Compare_narrative_includes_index_aware_phrasing_when_insights_differ()
    {
        var a = AnalyzePostgresJson("compare_before_seq_scan.json");
        var b = AnalyzePostgresJson("compare_after_index_scan.json");
        var cmp = new ComparisonEngine().Compare(a, b);

        Assert.Contains("access-path", cmp.Narrative, StringComparison.OrdinalIgnoreCase);
        Assert.True(
            cmp.Narrative.Contains("Resolved", StringComparison.OrdinalIgnoreCase) ||
            cmp.Narrative.Contains("New", StringComparison.OrdinalIgnoreCase) ||
            cmp.Narrative.Contains("Changed", StringComparison.OrdinalIgnoreCase) ||
            cmp.Narrative.Contains("Improved", StringComparison.OrdinalIgnoreCase));
    }

    public static PlanAnalysisResult AnalyzePostgresJson(string fileName)
    {
        var json = File.ReadAllText(Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "../../../fixtures/postgres-json", fileName)));
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
            OptimizationSuggestions: Array.Empty<OptimizationSuggestion>());
    }
}
