using System.Linq;
using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Domain;
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
    public void Flat_pg_buffer_json_sets_hasBuffers_and_buffer_hotspot()
    {
        var analysis = AnalyzeFixture("pg_flat_buffers_seq_scan.json");

        Assert.True(analysis.Summary.HasBuffers);
        Assert.Contains(analysis.Summary.TopSharedReadHotspotNodeIds, id => id == "root");
        Assert.Contains(analysis.Findings, f => f.RuleId == "D.buffer-read-hotspot");
    }

    [Fact]
    public void Worker_merged_buffers_enable_hotspot_on_gather_root()
    {
        var analysis = AnalyzeFixture("pg_workers_flat_buffers.json");

        Assert.True(analysis.Summary.HasBuffers);
        Assert.Contains(analysis.Findings, f => f.RuleId == "D.buffer-read-hotspot");
    }

    [Fact]
    public void Typed_workers_preserved_on_node_and_narrative_mentions_parallelism()
    {
        var analysis = AnalyzeFixture("pg_workers_flat_buffers.json");

        var gather = analysis.Nodes.First(n => n.NodeId == "root");
        Assert.Equal(2, gather.Node.Workers.Count);
        Assert.Equal(0, gather.Node.Workers[0].WorkerNumber);
        Assert.Equal(400000, gather.Node.Workers[0].SharedReadBlocks);
        Assert.Equal(580.5, gather.Node.Workers[0].ActualTotalTimeMs);
        Assert.Equal(600000, gather.Node.Workers[1].SharedReadBlocks);

        Assert.Contains("per-worker stats", analysis.Narrative.WhatHappened, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Worker shared-read counts vary", analysis.Narrative.WhatHappened, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Complex_timescaledb_query_keeps_buffer_hotspots_temp_detection_and_worker_narrative()
    {
        var analysis = AnalyzeFixture("complex_timescaledb_query.json");

        Assert.True(analysis.Summary.HasBuffers);
        Assert.NotEmpty(analysis.Summary.TopSharedReadHotspotNodeIds);
        Assert.Contains(analysis.Findings, f => f.RuleId == "D.buffer-read-hotspot");
        Assert.DoesNotContain(
            "No buffer counters were detected",
            analysis.Narrative.WhatLikelyMatters,
            StringComparison.OrdinalIgnoreCase);

        var workerNodes = analysis.Nodes.Where(n => PlanWorkerStatsHelper.HasWorkers(n.Node)).ToArray();
        Assert.True(workerNodes.Length >= 4, "expected multiple parallel operators with Workers[] in fixture");
        var partialAgg = workerNodes.Select(n => n.Node).First(n =>
            n.NodeType == "Aggregate" && string.Equals(n.PartialMode, "Partial", StringComparison.Ordinal));
        var readRange = PlanWorkerStatsHelper.SharedReadRange(partialAgg.Workers);
        Assert.NotNull(readRange);
        Assert.Equal(39860, readRange.Value.Min);
        Assert.Equal(40225, readRange.Value.Max);
        Assert.True(PlanWorkerStatsHelper.AnyWorkerHasTempIo(partialAgg.Workers));

        Assert.Contains("per-worker stats", analysis.Narrative.WhatHappened, StringComparison.OrdinalIgnoreCase);
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
            Nodes: metrics,
            Findings: findings,
            Narrative: narrative,
            Summary: summary,
            IndexOverview: indexOverview,
            IndexInsights: indexInsights
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

