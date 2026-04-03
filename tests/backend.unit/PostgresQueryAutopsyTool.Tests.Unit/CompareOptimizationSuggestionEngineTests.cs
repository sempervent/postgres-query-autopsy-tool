using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Comparison;
using PostgresQueryAutopsyTool.Core.Domain;
using PostgresQueryAutopsyTool.Core.Findings;
using PostgresQueryAutopsyTool.Core.Findings.Rules;
using PostgresQueryAutopsyTool.Core.Parsing;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class CompareOptimizationSuggestionEngineTests
{
    [Fact]
    public void Identical_plans_still_return_compare_suggestion_list_without_throw()
    {
        var analysis = AnalyzeFixture("simple_seq_scan.json");
        var cmp = new ComparisonEngine().Compare(analysis, analysis);
        Assert.NotNull(cmp.CompareOptimizationSuggestions);
    }

    private static PlanAnalysisResult AnalyzeFixture(string fileName)
    {
        var json = File.ReadAllText(Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "../../../fixtures/postgres-json", fileName)));
        var root = new PostgresJsonExplainParser().ParsePostgresExplain(JsonDocument.Parse(json).RootElement);
        var metrics = new DerivedMetricsEngine().Compute(root);
        var findings = new FindingsEngine(new IFindingRule[]
        {
            new RowMisestimationRule(),
            new SequentialScanConcernRule(),
            new PotentialIndexingOpportunityRule(),
        }).EvaluateAndRank(root.NodeId, metrics);
        var summary = PlanSummaryBuilder.Build(root.NodeId, metrics, findings);
        var narrative = NarrativeGenerator.From(summary, metrics, findings);
        var ctx = new FindingEvaluationContext(root.NodeId, metrics);
        var overview = IndexSignalAnalyzer.BuildOverview(metrics, ctx);
        var insights = IndexSignalAnalyzer.BuildInsights(metrics, ctx, overview);
        var core = new PlanAnalysisResult(
            "t", root.NodeId, null, null, metrics, findings, narrative, summary, overview, insights,
            Array.Empty<OptimizationSuggestion>());
        return core with { OptimizationSuggestions = OptimizationSuggestionEngine.Build(core) };
    }
}
