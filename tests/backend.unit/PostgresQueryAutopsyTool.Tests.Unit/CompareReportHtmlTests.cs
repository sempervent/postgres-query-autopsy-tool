using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Comparison;
using PostgresQueryAutopsyTool.Core.Parsing;
using PostgresQueryAutopsyTool.Core.Services;
using PostgresQueryAutopsyTool.Tests.Unit.Support;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class CompareReportHtmlTests
{
    private static bool TopPairHasVerdict(PlanComparisonResultV2 c, NodeDelta? d)
    {
        if (d is null) return false;
        var pair = c.PairDetails.FirstOrDefault(p =>
            p.Identity.NodeIdA == d.NodeIdA && p.Identity.NodeIdB == d.NodeIdB);
        return pair is { RewriteVerdictOneLiner: { Length: > 0 } };
    }

    [Fact]
    public async Task RenderCompareHtmlReport_includes_sections_and_comparison_id()
    {
        var dir = AnalyzeFixtureCorpus.ResolvePostgresJsonDirectory();
        var pathA = Path.Combine(dir, "compare_before_seq_scan.json");
        var pathB = Path.Combine(dir, "compare_after_index_scan.json");
        Assert.True(File.Exists(pathA) && File.Exists(pathB));

        var jsonA = await File.ReadAllTextAsync(pathA);
        var jsonB = await File.ReadAllTextAsync(pathB);
        using var docA = JsonDocument.Parse(jsonA);
        using var docB = JsonDocument.Parse(jsonB);

        var svc = new PlanAnalysisService(new PostgresJsonExplainParser());
        var cmp = await svc.CompareAsync(docA.RootElement, docB.RootElement, CancellationToken.None);

        var html = svc.RenderCompareHtmlReport(cmp);
        Assert.Contains("Postgres Query Autopsy — Compare", html, StringComparison.Ordinal);
        Assert.Contains("Plan capture &amp; EXPLAIN context (per side)", html, StringComparison.Ordinal);
        Assert.Contains("Plan A (baseline)", html, StringComparison.Ordinal);
        Assert.Contains("Top worsened pair", html, StringComparison.Ordinal);
        Assert.Contains("Top improved pair", html, StringComparison.Ordinal);
        Assert.Contains("Change briefing", html, StringComparison.Ordinal);
        Assert.Contains("Bottleneck posture (A vs B)", html, StringComparison.Ordinal);
        Assert.Contains("<h2>Narrative</h2>", html, StringComparison.Ordinal);
        Assert.Contains(cmp.ComparisonId, html, StringComparison.Ordinal);
    }

    [Fact]
    public async Task RenderCompareHtmlReport_includes_rewrite_outcome_on_top_pairs_when_verdict_present()
    {
        var dir = AnalyzeFixtureCorpus.ResolvePostgresJsonDirectory();
        var pathA = Path.Combine(dir, "compare_before_seq_scan.json");
        var pathB = Path.Combine(dir, "compare_after_index_scan.json");
        Assert.True(File.Exists(pathA) && File.Exists(pathB));

        var jsonA = await File.ReadAllTextAsync(pathA);
        var jsonB = await File.ReadAllTextAsync(pathB);
        using var docA = JsonDocument.Parse(jsonA);
        using var docB = JsonDocument.Parse(jsonB);

        var svc = new PlanAnalysisService(new PostgresJsonExplainParser());
        var cmp = await svc.CompareAsync(docA.RootElement, docB.RootElement, CancellationToken.None);

        var worst = cmp.TopWorsenedNodes.FirstOrDefault();
        var best = cmp.TopImprovedNodes.FirstOrDefault();
        var expectInHtml = TopPairHasVerdict(cmp, worst) || TopPairHasVerdict(cmp, best);
        Assert.True(
            expectInHtml,
            "compare_before_seq_scan vs compare_after_index_scan should place a rewrite verdict on at least one top worsened/improved pair (HTML export parity).");

        var html = svc.RenderCompareHtmlReport(cmp);
        Assert.Contains("Rewrite outcome", html, StringComparison.Ordinal);
    }

    [Fact]
    public async Task RenderCompareMarkdownReport_includes_rewrite_outcome_on_top_pairs_when_verdict_present()
    {
        var dir = AnalyzeFixtureCorpus.ResolvePostgresJsonDirectory();
        var pathA = Path.Combine(dir, "compare_before_seq_scan.json");
        var pathB = Path.Combine(dir, "compare_after_index_scan.json");
        Assert.True(File.Exists(pathA) && File.Exists(pathB));

        var jsonA = await File.ReadAllTextAsync(pathA);
        var jsonB = await File.ReadAllTextAsync(pathB);
        using var docA = JsonDocument.Parse(jsonA);
        using var docB = JsonDocument.Parse(jsonB);

        var svc = new PlanAnalysisService(new PostgresJsonExplainParser());
        var cmp = await svc.CompareAsync(docA.RootElement, docB.RootElement, CancellationToken.None);

        var worst = cmp.TopWorsenedNodes.FirstOrDefault();
        var best = cmp.TopImprovedNodes.FirstOrDefault();
        var expectInExport = TopPairHasVerdict(cmp, worst) || TopPairHasVerdict(cmp, best);
        Assert.True(
            expectInExport,
            "compare_before_seq_scan vs compare_after_index_scan should place a rewrite verdict on at least one top worsened/improved pair (markdown export parity).");

        var md = svc.RenderCompareMarkdownReport(cmp);
        Assert.Contains("Rewrite outcome", md, StringComparison.Ordinal);
        Assert.DoesNotContain("Rewrite readout", md, StringComparison.Ordinal);
    }

    [Fact]
    public async Task RenderCompareHtmlReport_includes_story_beats_when_comparison_story_has_beats()
    {
        var dir = AnalyzeFixtureCorpus.ResolvePostgresJsonDirectory();
        var pathA = Path.Combine(dir, "compare_before_seq_scan.json");
        var pathB = Path.Combine(dir, "compare_after_index_scan.json");
        Assert.True(File.Exists(pathA) && File.Exists(pathB));

        var jsonA = await File.ReadAllTextAsync(pathA);
        var jsonB = await File.ReadAllTextAsync(pathB);
        using var docA = JsonDocument.Parse(jsonA);
        using var docB = JsonDocument.Parse(jsonB);

        var svc = new PlanAnalysisService(new PostgresJsonExplainParser());
        var cmp = await svc.CompareAsync(docA.RootElement, docB.RootElement, CancellationToken.None);

        Assert.True(
            cmp.ComparisonStory is { ChangeBeats.Count: > 0 },
            "Canonical seq→index compare fixtures should emit comparison story beats so HTML export parity is exercised.");

        var html = svc.RenderCompareHtmlReport(cmp);
        Assert.Contains("Story beats", html, StringComparison.Ordinal);
    }

    [Fact]
    public async Task RenderCompareHtmlReport_includes_next_steps_when_compare_suggestions_exist()
    {
        var dir = AnalyzeFixtureCorpus.ResolvePostgresJsonDirectory();
        var pathA = Path.Combine(dir, "compare_before_seq_scan.json");
        var pathB = Path.Combine(dir, "compare_after_index_scan.json");
        Assert.True(File.Exists(pathA) && File.Exists(pathB));

        var jsonA = await File.ReadAllTextAsync(pathA);
        var jsonB = await File.ReadAllTextAsync(pathB);
        using var docA = JsonDocument.Parse(jsonA);
        using var docB = JsonDocument.Parse(jsonB);

        var svc = new PlanAnalysisService(new PostgresJsonExplainParser());
        var cmp = await svc.CompareAsync(docA.RootElement, docB.RootElement, CancellationToken.None);

        Assert.NotEmpty(cmp.CompareOptimizationSuggestions);

        var html = svc.RenderCompareHtmlReport(cmp);
        Assert.Contains("Next steps after this change", html, StringComparison.Ordinal);
    }

    [Fact]
    public async Task RenderCompareMarkdownReport_uses_same_next_steps_heading_as_html_export()
    {
        var dir = AnalyzeFixtureCorpus.ResolvePostgresJsonDirectory();
        var pathA = Path.Combine(dir, "compare_before_seq_scan.json");
        var pathB = Path.Combine(dir, "compare_after_index_scan.json");
        Assert.True(File.Exists(pathA) && File.Exists(pathB));

        var jsonA = await File.ReadAllTextAsync(pathA);
        var jsonB = await File.ReadAllTextAsync(pathB);
        using var docA = JsonDocument.Parse(jsonA);
        using var docB = JsonDocument.Parse(jsonB);

        var svc = new PlanAnalysisService(new PostgresJsonExplainParser());
        var cmp = await svc.CompareAsync(docA.RootElement, docB.RootElement, CancellationToken.None);

        var md = svc.RenderCompareMarkdownReport(cmp);
        Assert.Contains("## Next steps after this change", md, StringComparison.Ordinal);
        Assert.DoesNotContain("## Next steps after this change (compare)", md, StringComparison.Ordinal);
    }
}
