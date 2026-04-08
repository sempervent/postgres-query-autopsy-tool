using System.Text.Json;
using PostgresQueryAutopsyTool.Api.Persistence;
using PostgresQueryAutopsyTool.Core.Parsing;
using PostgresQueryAutopsyTool.Core.Services;
using PostgresQueryAutopsyTool.Tests.Unit.Support;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

/// <summary>Phase 87: JSON report payloads expose the same high-value guidance as UI/reports (camelCase, API serializer).</summary>
public sealed class ReportJsonExportParityTests
{
    [Fact]
    public async Task Analyze_json_shape_includes_planStory_inspectFirstSteps_when_present()
    {
        var dir = AnalyzeFixtureCorpus.ResolvePostgresJsonDirectory();
        var path = Path.Combine(dir, "simple_seq_scan.json");
        Assert.True(File.Exists(path));

        var json = await File.ReadAllTextAsync(path);
        using var doc = JsonDocument.Parse(json);

        var svc = new PlanAnalysisService(new PostgresJsonExplainParser());
        var analysis = await svc.AnalyzeAsync(doc.RootElement, CancellationToken.None);

        var serialized = JsonSerializer.Serialize(analysis, ArtifactPersistenceJson.Options);
        using var round = JsonDocument.Parse(serialized);
        var root = round.RootElement;

        Assert.True(root.TryGetProperty("planStory", out var storyEl) && storyEl.ValueKind != JsonValueKind.Null,
            "planStory should be present for analyzed fixtures.");

        if (analysis.PlanStory?.InspectFirstSteps is { Count: > 0 })
        {
            Assert.True(storyEl.TryGetProperty("inspectFirstSteps", out var steps) && steps.ValueKind == JsonValueKind.Array);
            Assert.True(steps.GetArrayLength() > 0);
            var first = steps[0];
            Assert.True(first.TryGetProperty("stepNumber", out _) && first.TryGetProperty("title", out _) && first.TryGetProperty("body", out _));
        }
    }

    [Fact]
    public async Task Compare_json_shape_includes_suggestions_and_rewrite_verdict_when_fixture_has_them()
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

        var serialized = JsonSerializer.Serialize(cmp, ArtifactPersistenceJson.Options);
        using var round = JsonDocument.Parse(serialized);
        var root = round.RootElement;

        Assert.True(root.TryGetProperty("comparisonId", out var cid) && cid.GetString()?.Length > 0);

        Assert.True(root.TryGetProperty("compareOptimizationSuggestions", out var sugs) && sugs.ValueKind == JsonValueKind.Array);
        if (cmp.CompareOptimizationSuggestions.Count > 0)
        {
            Assert.True(sugs.GetArrayLength() > 0);
            var first = sugs[0];
            Assert.True(first.TryGetProperty("suggestionId", out _) && first.TryGetProperty("suggestionFamily", out _));
        }

        Assert.True(root.TryGetProperty("pairDetails", out var pairs) && pairs.ValueKind == JsonValueKind.Array);
        var hasVerdict = cmp.PairDetails.Any(p => !string.IsNullOrWhiteSpace(p.RewriteVerdictOneLiner));
        if (hasVerdict)
        {
            var found = false;
            foreach (var p in pairs.EnumerateArray())
            {
                if (p.TryGetProperty("rewriteVerdictOneLiner", out var rv) &&
                    rv.ValueKind == JsonValueKind.String &&
                    rv.GetString() is { Length: > 0 })
                {
                    found = true;
                    break;
                }
            }

            Assert.True(found, "Serialized pairDetails should include rewriteVerdictOneLiner when the model has a verdict.");
        }
    }
}
