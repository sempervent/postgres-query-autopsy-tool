using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Parsing;
using PostgresQueryAutopsyTool.Core.Services;
using PostgresQueryAutopsyTool.Tests.Unit.Support;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

/// <summary>Phase 86: HTML/Markdown export parity signals (inspect path, suggestions depth, headings).</summary>
public sealed class AnalyzeReportExportTests
{
    [Fact]
    public async Task RenderHtmlReport_uses_headline_findings_heading_and_includes_suggestion_depth()
    {
        var dir = AnalyzeFixtureCorpus.ResolvePostgresJsonDirectory();
        var path = Path.Combine(dir, "simple_seq_scan.json");
        Assert.True(File.Exists(path));

        var json = await File.ReadAllTextAsync(path);
        using var doc = JsonDocument.Parse(json);

        var svc = new PlanAnalysisService(new PostgresJsonExplainParser());
        var analysis = await svc.AnalyzeAsync(doc.RootElement, CancellationToken.None);

        var html = svc.RenderHtmlReport(analysis);
        Assert.Contains("Headline Findings", html, StringComparison.Ordinal);
        Assert.DoesNotContain("Headine Findings", html, StringComparison.Ordinal);

        if (analysis.OptimizationSuggestions.Count > 0)
        {
            Assert.Contains("Why:", html, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("Validate:", html, StringComparison.OrdinalIgnoreCase);
        }

        if (analysis.PlanStory?.InspectFirstSteps is { Count: > 0 })
            Assert.Contains("Start here", html, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RenderMarkdownReport_includes_structured_start_here_when_steps_exist()
    {
        var dir = AnalyzeFixtureCorpus.ResolvePostgresJsonDirectory();
        var path = Path.Combine(dir, "simple_seq_scan.json");
        Assert.True(File.Exists(path));

        var json = await File.ReadAllTextAsync(path);
        using var doc = JsonDocument.Parse(json);

        var svc = new PlanAnalysisService(new PostgresJsonExplainParser());
        var analysis = await svc.AnalyzeAsync(doc.RootElement, CancellationToken.None);

        var md = svc.RenderMarkdownReport(analysis);
        if (analysis.PlanStory?.InspectFirstSteps is { Count: > 0 })
            Assert.Contains("Start here (steps)", md, StringComparison.Ordinal);
    }
}
