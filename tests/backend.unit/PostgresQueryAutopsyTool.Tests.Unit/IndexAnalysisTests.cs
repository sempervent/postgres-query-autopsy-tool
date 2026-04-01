using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Services;
using PostgresQueryAutopsyTool.Core.Parsing;
using System.Text.Json;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class IndexAnalysisTests
{
    [Fact]
    public void Index_scan_heap_heavy_emits_index_access_still_heavy_finding()
    {
        var analysis = AnalyzeViaService("index_scan_heap_heavy.json");
        Assert.Contains(analysis.Findings, f => f.RuleId == "R.index-access-still-heavy");
        Assert.Contains(analysis.IndexInsights, i => i.SignalKinds.Contains(IndexSignalAnalyzer.SignalIndexPathStillCostly));
    }

    [Fact]
    public void Bitmap_recheck_fixture_emits_bitmap_recheck_attention()
    {
        var analysis = AnalyzeViaService("bitmap_recheck_waste.json");
        Assert.Contains(analysis.Findings, f => f.RuleId == "S.bitmap-recheck-attention");
    }

    [Fact]
    public void Nested_loop_inner_seq_emits_inner_index_support_finding()
    {
        var analysis = AnalyzeViaService("nl_inner_seq_index_support.json");
        Assert.Contains(analysis.Findings, f => f.RuleId == "Q.nl-inner-index-support");
    }

    [Fact]
    public void Complex_timescaledb_chunked_workload_does_not_naively_flag_per_chunk_bitmap_rechecks()
    {
        var analysis = AnalyzeViaService("complex_timescaledb_query.json");

        Assert.True(analysis.IndexOverview.SuggestsChunkedBitmapWorkload);
        Assert.True(analysis.IndexOverview.BitmapHeapScanCount >= 8);
        Assert.Contains(analysis.Findings, f => f.RuleId == "P.append-chunk-bitmap-workload");

        Assert.DoesNotContain(analysis.Findings, f => f.RuleId == "S.bitmap-recheck-attention");

        var bitmapHeavy = analysis.Findings.Where(f =>
            f.RuleId == "R.index-access-still-heavy" &&
            f.Evidence.TryGetValue("isBitmapHeap", out var bh) && bh is true).ToArray();
        Assert.Empty(bitmapHeavy);

        Assert.All(
            analysis.IndexInsights.Where(i => i.AccessPathFamily == IndexAccessPathTokens.BitmapHeapScan),
            _ => Assert.Fail("Expected no per-node bitmap heap index insights when chunk pattern suppresses them"));
    }

    [Fact]
    public void Complex_timescaledb_sort_insights_include_order_support_signal()
    {
        var analysis = AnalyzeViaService("complex_timescaledb_query.json");
        Assert.Contains(
            analysis.IndexInsights,
            i => i.SignalKinds.Contains(IndexSignalAnalyzer.SignalSortOrderSupportOpportunity));
    }

    private static PlanAnalysisResult AnalyzeViaService(string fileName)
    {
        var path = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../fixtures/postgres-json", fileName));
        var json = File.ReadAllText(path);
        using var doc = JsonDocument.Parse(json);
        var service = new PlanAnalysisService(new PostgresJsonExplainParser());
        return service.AnalyzeAsync(doc.RootElement, CancellationToken.None).GetAwaiter().GetResult();
    }
}
