using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Parsing;
using PostgresQueryAutopsyTool.Core.Services;

namespace PostgresQueryAutopsyTool.Tests.Unit;

/// <summary>
/// Phase 72: dynamic analyze validation over the single-file postgres JSON corpus.
/// <para><b>Inclusion:</b> every <c>*.json</c> file directly under <c>fixtures/postgres-json/</c> (no subdirectories).
/// Compare-specific paired plans live under <c>fixtures/comparison/&lt;case&gt;/planA|B.json</c> and are covered separately.</para>
/// <para><b>Exclusions:</b> add file names to <see cref="ExcludedFixtureFiles"/> only for intentional non-analyze payloads.</para>
/// </summary>
public sealed class PostgresJsonAnalyzeFixtureSweepTests
{
    private static readonly HashSet<string> ExcludedFixtureFiles = new(StringComparer.OrdinalIgnoreCase)
    {
        // None today — keep explicit if a non-plan JSON ever lands next to analyze fixtures.
    };

    private static string PostgresJsonDir =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../fixtures/postgres-json"));

    [Fact]
    public async Task Every_postgres_json_fixture_completes_full_analyze_pipeline()
    {
        Assert.True(Directory.Exists(PostgresJsonDir), $"Missing fixture dir: {PostgresJsonDir}");

        var paths = Directory
            .GetFiles(PostgresJsonDir, "*.json", SearchOption.TopDirectoryOnly)
            .Where(p => !ExcludedFixtureFiles.Contains(Path.GetFileName(p)))
            .OrderBy(p => p, StringComparer.Ordinal)
            .ToArray();

        Assert.NotEmpty(paths);

        var svc = new PlanAnalysisService(new PostgresJsonExplainParser());
        var failures = new List<string>();

        foreach (var path in paths)
        {
            var name = Path.GetFileName(path);
            try
            {
                var json = File.ReadAllText(path);
                using var doc = JsonDocument.Parse(json);
                var result = await svc.AnalyzeAsync(doc.RootElement, CancellationToken.None);
                AssertStructuralSanity(name, result, stage: "post-analyze");
            }
            catch (JsonException jx)
            {
                failures.Add($"[{name}] JSON parse: {jx.Message}");
            }
            catch (Exception ex)
            {
                failures.Add($"[{name}] {ex.GetType().Name}: {ex.Message}");
            }
        }

        Assert.True(failures.Count == 0, "Fixture analyze sweep failures:\n" + string.Join("\n", failures));
    }

    [Fact]
    public async Task Cumulative_group_by_fixture_has_sort_aggregate_and_plan_story()
    {
        const string file = "cumulative_group_by.json";
        if (ExcludedFixtureFiles.Contains(file))
            return;

        var path = Path.Combine(PostgresJsonDir, file);
        Assert.True(File.Exists(path), $"Missing {file}");

        var json = File.ReadAllText(path);
        using var doc = JsonDocument.Parse(json);
        var svc = new PlanAnalysisService(new PostgresJsonExplainParser());
        var r = await svc.AnalyzeAsync(doc.RootElement, CancellationToken.None);

        AssertStructuralSanity(file, r, "post-analyze");
        Assert.Contains(
            r.Nodes,
            n => (n.Node.NodeType ?? "").Contains("Sort", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(
            r.Nodes,
            n => (n.Node.NodeType ?? "").Contains("Aggregate", StringComparison.OrdinalIgnoreCase));
        Assert.NotNull(r.PlanStory);
        Assert.False(string.IsNullOrWhiteSpace(r.PlanStory!.PlanOverview));
        Assert.True(
            r.Nodes.Any(n => (n.Node.TempReadBlocks ?? 0) > 0 || (n.Node.TempWrittenBlocks ?? 0) > 0) ||
            r.Summary.TotalNodeCount > 8,
            "Expected temp I/O or substantive node count for cumulative/grouped workload shape.");
    }

    private static void AssertStructuralSanity(string fixtureName, PlanAnalysisResult r, string stage)
    {
        if (string.IsNullOrWhiteSpace(r.AnalysisId))
            throw new InvalidOperationException($"[{fixtureName}] {stage}: AnalysisId empty");
        if (string.IsNullOrWhiteSpace(r.RootNodeId))
            throw new InvalidOperationException($"[{fixtureName}] {stage}: RootNodeId empty");
        if (r.Nodes is not { Count: > 0 })
            throw new InvalidOperationException($"[{fixtureName}] {stage}: Nodes missing or empty");

        if (r.Findings is null)
            throw new InvalidOperationException($"[{fixtureName}] {stage}: Findings null");
        if (r.Narrative is null)
            throw new InvalidOperationException($"[{fixtureName}] {stage}: Narrative null");
        if (string.IsNullOrWhiteSpace(r.Narrative.WhatHappened))
            throw new InvalidOperationException($"[{fixtureName}] {stage}: Narrative.WhatHappened empty");

        if (r.Summary.TotalNodeCount <= 0)
            throw new InvalidOperationException($"[{fixtureName}] {stage}: Summary.TotalNodeCount invalid");
        if (r.Summary.MaxDepth < 0)
            throw new InvalidOperationException($"[{fixtureName}] {stage}: Summary.MaxDepth invalid");

        if (r.IndexOverview is null)
            throw new InvalidOperationException($"[{fixtureName}] {stage}: IndexOverview null");
        if (r.IndexInsights is null)
            throw new InvalidOperationException($"[{fixtureName}] {stage}: IndexInsights null");

        if (r.OptimizationSuggestions is null)
            throw new InvalidOperationException($"[{fixtureName}] {stage}: OptimizationSuggestions null");

        if (r.PlanStory is null)
            throw new InvalidOperationException($"[{fixtureName}] {stage}: PlanStory null");
        if (string.IsNullOrWhiteSpace(r.PlanStory.PlanOverview))
            throw new InvalidOperationException($"[{fixtureName}] {stage}: PlanStory.PlanOverview empty");
    }
}
