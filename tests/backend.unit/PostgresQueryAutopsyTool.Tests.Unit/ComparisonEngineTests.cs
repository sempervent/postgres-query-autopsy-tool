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

