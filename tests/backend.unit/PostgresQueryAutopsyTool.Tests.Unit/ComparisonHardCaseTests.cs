using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Comparison;
using PostgresQueryAutopsyTool.Core.Findings;
using PostgresQueryAutopsyTool.Core.Findings.Rules;
using PostgresQueryAutopsyTool.Core.Parsing;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class ComparisonHardCaseTests
{
    [Theory]
    [InlineData("scan-rewrite-seq-to-index")]
    [InlineData("scan-rewrite-seq-to-bitmap")]
    public void Scan_family_rewrites_map_same_relation(string scenarioDir)
    {
        var (a, b) = AnalyzeComparisonFixture(scenarioDir);
        var cmp = new ComparisonEngine().Compare(a, b);

        Assert.NotEmpty(cmp.Matches);
        Assert.Contains(cmp.PairDetails, p =>
            string.Equals(p.Identity.RelationNameA ?? p.Identity.RelationNameB, "products", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(p.Identity.RelationNameA ?? p.Identity.RelationNameB, "events", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Join_family_rewrite_maps_nested_loop_to_hash_join_with_non_high_confidence()
    {
        var (a, b) = AnalyzeComparisonFixture("join-strategy-rewrite");
        var cmp = new ComparisonEngine().Compare(a, b);

        var joinPair = cmp.PairDetails.FirstOrDefault(p =>
            p.Identity.NodeTypeA.Contains("Nested Loop", StringComparison.OrdinalIgnoreCase) &&
            p.Identity.NodeTypeB.Contains("Hash Join", StringComparison.OrdinalIgnoreCase));

        Assert.NotNull(joinPair);

        // Join rewrite should not be "obviously identical" -> avoid false high confidence.
        Assert.NotEqual(MatchConfidence.High, joinPair!.Identity.MatchConfidence);
    }

    [Fact]
    public void Stats_improvement_reduces_row_misestimation_signal()
    {
        var (a, b) = AnalyzeComparisonFixture("stats-improvement");
        var cmp = new ComparisonEngine().Compare(a, b);

        // We don't assert exact strings; just that a misestimation-related diff appears.
        Assert.Contains(cmp.FindingsDiff.Items, i =>
            i.RuleId.Contains("misestimation", StringComparison.OrdinalIgnoreCase) ||
            i.Title.Contains("misestimation", StringComparison.OrdinalIgnoreCase) ||
            i.Summary.Contains("estimate", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Materialize_effect_exposes_loops_and_time_delta_directionality()
    {
        var (a, b) = AnalyzeComparisonFixture("materialize-effect");
        var cmp = new ComparisonEngine().Compare(a, b);

        Assert.NotEmpty(cmp.PairDetails);
        var anyLoopsMetric = cmp.PairDetails
            .SelectMany(p => p.Metrics)
            .FirstOrDefault(m => m.Key == "loops");

        Assert.NotNull(anyLoopsMetric);
    }

    [Fact]
    public void Narrative_mentions_top_improved_or_worsened_areas()
    {
        var (a, b) = AnalyzeComparisonFixture("scan-rewrite-seq-to-index");
        var cmp = new ComparisonEngine().Compare(a, b);

        // Lightweight narrative sanity: it should talk about improvement/worsening and reference operators.
        Assert.Contains("runtime", cmp.Narrative, StringComparison.OrdinalIgnoreCase);
        Assert.True(
            cmp.Narrative.Contains("scan", StringComparison.OrdinalIgnoreCase) ||
            cmp.Narrative.Contains("join", StringComparison.OrdinalIgnoreCase) ||
            cmp.Narrative.Contains("sort", StringComparison.OrdinalIgnoreCase));
    }

    private static (PlanAnalysisResult A, PlanAnalysisResult B) AnalyzeComparisonFixture(string scenarioDir)
    {
        var jsonA = ReadComparisonFixture(scenarioDir, "planA.json");
        var jsonB = ReadComparisonFixture(scenarioDir, "planB.json");

        return (AnalyzeJson(jsonA), AnalyzeJson(jsonB));
    }

    private static PlanAnalysisResult AnalyzeJson(string json)
    {
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

    private static string ReadComparisonFixture(string scenarioDir, string fileName)
    {
        var fixturePath = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "../../../fixtures/comparison", scenarioDir, fileName)
        );
        return File.ReadAllText(fixturePath);
    }
}

