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
        var augmented = PlanNodeInterpretationAugmentor.Augment(metrics, root.NodeId, summary, queryText: null);
        var byId = augmented.ToDictionary(n => n.NodeId, StringComparer.Ordinal);
        var summaryWithBriefings = summary with
        {
            Bottlenecks = PlanBottleneckBriefingOverlay.AttachOperatorBriefings(summary.Bottlenecks, byId)
        };
        var narrative = NarrativeGenerator.From(summaryWithBriefings, augmented, findings);
        var ctx = new FindingEvaluationContext(root.NodeId, augmented);
        var overview = IndexSignalAnalyzer.BuildOverview(augmented, ctx);
        var insights = IndexSignalAnalyzer.BuildInsights(augmented, ctx, overview);
        var core = new PlanAnalysisResult(
            "t", root.NodeId, null, null, augmented, findings, narrative, summaryWithBriefings, overview, insights,
            Array.Empty<OptimizationSuggestion>(),
            PlanStory: null);
        var withSug = core with { OptimizationSuggestions = OptimizationSuggestionEngine.Build(core) };
        var story = PlanStoryBuilder.Build(
            root.NodeId,
            summaryWithBriefings,
            augmented,
            findings,
            narrative,
            overview,
            insights,
            withSug.OptimizationSuggestions,
            queryText: null);
        return withSug with { PlanStory = story };
    }
}
