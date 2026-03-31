using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Findings;
using PostgresQueryAutopsyTool.Core.Findings.Rules;
using PostgresQueryAutopsyTool.Core.OperatorEvidence;
using PostgresQueryAutopsyTool.Core.Parsing;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class OperatorEvidenceCollectorTests
{
    [Fact]
    public void Hash_join_context_surfaces_child_hash_batches_and_disk()
    {
        var analysis = AnalyzeFixture("operator_hash_batches_disk.json");
        var join = analysis.Nodes.First(n => string.Equals(n.Node.NodeType, "Hash Join", StringComparison.OrdinalIgnoreCase));

        Assert.NotNull(join.ContextEvidence);
        var ctx = join.ContextEvidence!;
        Assert.NotNull(ctx.HashJoin);
        Assert.NotNull(ctx.HashJoin!.ChildHash);
        Assert.True((ctx.HashJoin.ChildHash!.HashBatches ?? 0) > 1);
        Assert.True((ctx.HashJoin.ChildHash.DiskUsageKb ?? 0) > 0);
    }

    [Fact]
    public void Memoize_context_surfaces_cache_hit_rate()
    {
        var analysis = AnalyzeFixture("operator_memoize_cache.json");
        var memo = analysis.Nodes.First(n => string.Equals(n.Node.NodeType, "Memoize", StringComparison.OrdinalIgnoreCase));

        Assert.NotNull(memo.ContextEvidence?.Memoize);
        Assert.True(memo.ContextEvidence!.Memoize!.HitRate is > 0.5);
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
            new SequentialScanConcernRule(),
            new PotentialStatisticsIssueRule(),
            new PotentialIndexingOpportunityRule(),
            new PlanComplexityConcernRule(),
            new RepeatedExpensiveSubtreeRule(),
            new SortCostConcernRule(),
            new HashJoinPressureRule(),
            new MaterializeLoopsConcernRule(),
            new HighFanOutJoinWarningRule(),
        }).EvaluateAndRank(root.NodeId, metrics);

        var summary = PlanSummaryBuilder.Build(root.NodeId, metrics, findings);
        var narrative = NarrativeGenerator.From(summary, findings);

        return new PlanAnalysisResult(
            AnalysisId: "test",
            RootNodeId: root.NodeId,
            Nodes: metrics,
            Findings: findings,
            Narrative: narrative,
            Summary: summary
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

