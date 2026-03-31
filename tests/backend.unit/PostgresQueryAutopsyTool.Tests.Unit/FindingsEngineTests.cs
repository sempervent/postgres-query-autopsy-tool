using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Findings;
using PostgresQueryAutopsyTool.Core.Findings.Rules;
using PostgresQueryAutopsyTool.Core.Parsing;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class FindingsEngineTests
{
    [Fact]
    public void Row_misestimation_rule_fires_on_simple_seq_scan_fixture()
    {
        var analysis = AnalyzeFixture("simple_seq_scan.json");

        Assert.Contains(analysis.Findings, f => f.RuleId == "A.row-misestimation");
    }

    [Fact]
    public void Buffer_hotspot_rule_fires_on_buffer_heavy_fixture()
    {
        var analysis = AnalyzeFixture("buffer_heavy.json");

        Assert.Contains(analysis.Findings, f => f.RuleId == "D.buffer-read-hotspot");
    }

    [Fact]
    public void Nested_loop_amplification_rule_fires_on_nested_loop_fixture()
    {
        var analysis = AnalyzeFixture("nested_loop_amplification.json");

        Assert.Contains(analysis.Findings, f => f.RuleId == "E.nested-loop-amplification");
    }

    [Fact]
    public void Plan_complexity_rule_does_not_fire_on_tiny_plans()
    {
        var analysis = AnalyzeFixture("simple_index_scan.json");

        Assert.DoesNotContain(analysis.Findings, f => f.RuleId == "H.plan-complexity");
    }

    [Fact]
    public void Ranking_puts_highest_severity_near_top_when_present()
    {
        var analysis = AnalyzeFixture("nested_loop_amplification.json");

        // Ensure we have some ranked findings.
        Assert.NotEmpty(analysis.Findings);

        var top = analysis.Findings.Take(3).ToArray();
        Assert.Contains(top, f => (int)f.Severity >= 2); // Medium+ should appear near top for this fixture set
        Assert.All(top, f => Assert.NotNull(f.RankScore));
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
        }).EvaluateAndRank(root.NodeId, metrics);

        var summary = PlanSummaryBuilder.Build(root.NodeId, metrics, findings);
        var narrative = NarrativeGenerator.From(summary, metrics, findings);

        return new PlanAnalysisResult(
            AnalysisId: "test",
            RootNodeId: root.NodeId,
            QueryText: null,
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

