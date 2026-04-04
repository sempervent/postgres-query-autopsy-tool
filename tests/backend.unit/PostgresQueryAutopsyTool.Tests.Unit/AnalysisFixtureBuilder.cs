using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Findings;
using PostgresQueryAutopsyTool.Core.Findings.Rules;
using PostgresQueryAutopsyTool.Core.Parsing;

namespace PostgresQueryAutopsyTool.Tests.Unit;

internal static class AnalysisFixtureBuilder
{
    internal static PlanAnalysisResult Build(string fileName)
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
            Array.Empty<OptimizationSuggestion>(),
            PlanStory: null);
        var withSug = core with { OptimizationSuggestions = OptimizationSuggestionEngine.Build(core) };
        var story = PlanStoryBuilder.Build(
            root.NodeId, summary, metrics, findings, narrative, overview, insights, withSug.OptimizationSuggestions);
        return withSug with { PlanStory = story };
    }
}
