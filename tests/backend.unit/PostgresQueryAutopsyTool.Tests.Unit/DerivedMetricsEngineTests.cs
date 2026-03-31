using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Parsing;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class DerivedMetricsEngineTests
{
    [Fact]
    public void Computes_inclusive_and_exclusive_time_with_loops()
    {
        var json = ReadFixture("nested_loop_misestimation.json");
        using var doc = JsonDocument.Parse(json);

        var parser = new PostgresJsonExplainParser();
        var root = parser.ParsePostgresExplain(doc.RootElement);

        var engine = new DerivedMetricsEngine();
        var analyzed = engine.Compute(root);
        var byId = analyzed.ToDictionary(n => n.NodeId, StringComparer.Ordinal);

        // Root inclusive = ActualTotalTime * loops (loops=1 here)
        Assert.Equal(200.0, byId["root"].Metrics.InclusiveActualTimeMs);

        // Child 1 (index scan) inclusive = 0.200 * loops(3) = 0.6
        Assert.Equal(0.6, byId["root.1"].Metrics.InclusiveActualTimeMs!.Value, 9);

        // Exclusive should be clamped >= 0
        Assert.True(byId["root"].Metrics.ExclusiveActualTimeMsApprox is >= 0);
    }

    [Fact]
    public void Computes_row_estimate_ratio_and_log10_error()
    {
        var json = ReadFixture("simple_seq_scan.json");
        using var doc = JsonDocument.Parse(json);

        var parser = new PostgresJsonExplainParser();
        var root = parser.ParsePostgresExplain(doc.RootElement);

        var engine = new DerivedMetricsEngine();
        var analyzed = engine.Compute(root);
        var seq = analyzed.Single(n => n.NodeId == "root");

        // actualRowsTotal=5, estTotal=planRows(100)*loops(1)=100 => ratio=0.05
        Assert.NotNull(seq.Metrics.RowEstimateRatio);
        Assert.Equal(0.05, seq.Metrics.RowEstimateRatio!.Value, 6);
        Assert.Equal(20.0, seq.Metrics.RowEstimateFactor!.Value, 6); // symmetric factor
        Assert.True(seq.Metrics.RowEstimateLog10Error is > 1.0);
    }

    [Fact]
    public void Computes_buffer_shares_based_on_total_shared_reads()
    {
        var json = ReadFixture("buffer_heavy.json");
        using var doc = JsonDocument.Parse(json);

        var parser = new PostgresJsonExplainParser();
        var root = parser.ParsePostgresExplain(doc.RootElement);

        var engine = new DerivedMetricsEngine();
        var analyzed = engine.Compute(root);
        var byId = analyzed.ToDictionary(n => n.NodeId, StringComparer.Ordinal);

        // Root shared reads are 8000; child shared reads are 7000; total shared reads = 15000
        Assert.Equal(8000, byId["root"].Node.SharedReadBlocks);
        Assert.Equal(7000, byId["root.0"].Node.SharedReadBlocks);

        Assert.NotNull(byId["root"].Metrics.BufferShareOfPlan);
        Assert.Equal(8000d / 15000d, byId["root"].Metrics.BufferShareOfPlan!.Value, 8);

        Assert.NotNull(byId["root.0"].Metrics.BufferShareOfPlan);
        Assert.Equal(7000d / 15000d, byId["root.0"].Metrics.BufferShareOfPlan!.Value, 8);
    }

    private static string ReadFixture(string fileName)
    {
        var fixturePath = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "../../../fixtures/postgres-json", fileName)
        );
        return File.ReadAllText(fixturePath);
    }
}

