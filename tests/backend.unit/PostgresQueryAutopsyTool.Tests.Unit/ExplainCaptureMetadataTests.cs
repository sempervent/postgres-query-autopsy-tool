using System.Text.Json;
using System.Text.Json.Nodes;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Parsing;
using PostgresQueryAutopsyTool.Core.Services;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class ExplainCaptureMetadataTests
{
    [Fact]
    public async Task Analyze_preserves_explain_metadata_when_provided()
    {
        var path = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "../../../fixtures/postgres-json", "simple_seq_scan.json"));
        using var doc = JsonDocument.Parse(await File.ReadAllTextAsync(path));
        var meta = new ExplainCaptureMetadata(
            new ExplainOptions(Format: "json", Analyze: true, Verbose: true, Buffers: true, Costs: true),
            SourceExplainCommand: "EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON) SELECT 1;");
        var service = new PlanAnalysisService(new PostgresJsonExplainParser());
        var analysis = await service.AnalyzeAsync(doc.RootElement, CancellationToken.None, explainMetadata: meta);

        Assert.NotNull(analysis.ExplainMetadata);
        Assert.Equal("json", analysis.ExplainMetadata!.Options!.Format);
        Assert.True(analysis.ExplainMetadata.Options!.Analyze);
        Assert.True(analysis.ExplainMetadata.Options!.Costs);
        Assert.Contains("SELECT 1", analysis.ExplainMetadata.SourceExplainCommand ?? "");
    }

    [Fact]
    public async Task Fixture_with_costs_has_planner_costs_present()
    {
        var path = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "../../../fixtures/postgres-json", "simple_seq_scan.json"));
        using var doc = JsonDocument.Parse(await File.ReadAllTextAsync(path));
        var service = new PlanAnalysisService(new PostgresJsonExplainParser());
        var analysis = await service.AnalyzeAsync(doc.RootElement, CancellationToken.None);
        Assert.Equal(PlannerCostPresence.Present, analysis.Summary.PlannerCosts);
    }

    [Fact]
    public async Task Plan_without_cost_fields_yields_not_detected()
    {
        var path = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "../../../fixtures/postgres-json", "simple_seq_scan.json"));
        var root = JsonNode.Parse(await File.ReadAllTextAsync(path))!;
        StripPlannerCostProperties(root);
        using var doc = JsonDocument.Parse(root.ToJsonString());
        var service = new PlanAnalysisService(new PostgresJsonExplainParser());
        var analysis = await service.AnalyzeAsync(doc.RootElement, CancellationToken.None);
        Assert.Equal(PlannerCostPresence.NotDetected, analysis.Summary.PlannerCosts);
    }

    [Fact]
    public async Task Markdown_report_includes_capture_section_when_metadata_present()
    {
        var path = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "../../../fixtures/postgres-json", "simple_seq_scan.json"));
        using var doc = JsonDocument.Parse(await File.ReadAllTextAsync(path));
        var service = new PlanAnalysisService(new PostgresJsonExplainParser());
        var analysis = await service.AnalyzeAsync(
            doc.RootElement,
            CancellationToken.None,
            explainMetadata: new ExplainCaptureMetadata(
                new ExplainOptions(Costs: false),
                "EXPLAIN (FORMAT JSON, COSTS false) SELECT 1;"));
        var md = service.RenderMarkdownReport(analysis);
        Assert.Contains("Plan capture & EXPLAIN context", md);
        Assert.Contains("Declared options (client)", md, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("COSTS off", md);
        Assert.Contains("Planner costs (detected from JSON)", md);
    }

    private static void StripPlannerCostProperties(JsonNode? node)
    {
        switch (node)
        {
            case JsonObject o:
                o.Remove("Startup Cost");
                o.Remove("Total Cost");
                o.Remove("Plan Rows");
                o.Remove("Plan Width");
                foreach (var p in o)
                    StripPlannerCostProperties(p.Value);
                break;
            case JsonArray a:
                foreach (var item in a)
                    StripPlannerCostProperties(item);
                break;
        }
    }
}
