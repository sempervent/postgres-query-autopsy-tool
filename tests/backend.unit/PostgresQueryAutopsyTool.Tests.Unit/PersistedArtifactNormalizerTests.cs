using System.Text.Json;
using System.Text.Json.Serialization;
using PostgresQueryAutopsyTool.Api.Persistence;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Comparison;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class PersistedArtifactNormalizerTests
{
    [Fact]
    public void NormalizeLoadedAnalysis_throws_when_schema_newer_than_supported()
    {
        var baseAnalysis = AnalysisFixtureBuilder.Build("simple_seq_scan.json");
        var raw = baseAnalysis with { ArtifactSchemaVersion = ArtifactSchema.MaxSupported + 1 };

        Assert.Throws<UnsupportedArtifactSchemaVersionException>(() =>
            PersistedArtifactNormalizer.NormalizeLoadedAnalysis(raw, null));
    }

    [Fact]
    public void NormalizeFields_fills_missing_suggestion_presentation_from_category_and_validation()
    {
        var s = new OptimizationSuggestion(
            SuggestionId: "sg_test",
            Category: OptimizationSuggestionCategory.StatisticsMaintenance,
            SuggestedActionType: SuggestedActionType.RefreshStatistics,
            Title: "t",
            Summary: "Short summary",
            Details: "",
            Rationale: "",
            Confidence: SuggestionConfidenceLevel.Medium,
            Priority: SuggestionPriorityLevel.Medium,
            TargetNodeIds: Array.Empty<string>(),
            RelatedFindingIds: Array.Empty<string>(),
            RelatedIndexInsightNodeIds: Array.Empty<string>(),
            Cautions: Array.Empty<string>(),
            ValidationSteps: new[] { "Run ANALYZE on hot tables" },
            SuggestionFamily: OptimizationSuggestionFamily.QueryShapeOrdering,
            RecommendedNextAction: "",
            WhyItMatters: "",
            TargetDisplayLabel: null,
            IsGroupedCluster: false,
            RelatedFindingDiffIds: null,
            RelatedIndexInsightDiffIds: null,
            RelatedBottleneckInsightIds: null,
            AlsoKnownAs: null);

        var n = OptimizationSuggestionCompat.NormalizeFields(s);
        Assert.Equal(OptimizationSuggestionFamily.StatisticsPlannerAccuracy, n.SuggestionFamily);
        Assert.Contains("ANALYZE", n.RecommendedNextAction, StringComparison.Ordinal);
        Assert.False(string.IsNullOrWhiteSpace(n.WhyItMatters));
    }

    [Fact]
    public void NormalizeLoadedComparison_adds_also_known_as_for_carried_plan_b_suggestions()
    {
        var a = AnalysisFixtureBuilder.Build("simple_seq_scan.json");
        var b = AnalysisFixtureBuilder.Build("hash_join.json");
        var cmp = new ComparisonEngine().Compare(a, b);
        var carried = cmp.CompareOptimizationSuggestions.FirstOrDefault(x =>
            x.Title.StartsWith("After this change:", StringComparison.Ordinal));
        if (carried is null)
            return;

        var legacy = CompareOptimizationSuggestionEngine.LegacyCarriedTitleBasedSuggestionId(carried);
        if (string.Equals(legacy, carried.SuggestionId, StringComparison.Ordinal))
            return;

        var norm = PersistedArtifactNormalizer.NormalizeLoadedComparison(cmp, null);
        var hit = norm.CompareOptimizationSuggestions.First(x => x.SuggestionId == carried.SuggestionId);
        Assert.NotNull(hit.AlsoKnownAs);
        Assert.Contains(legacy, hit.AlsoKnownAs!);
    }

    [Fact]
    public void NormalizeLoadedComparison_backfills_comparison_story_when_property_absent()
    {
        var a = AnalysisFixtureBuilder.Build("compare_before_seq_scan.json");
        var b = AnalysisFixtureBuilder.Build("compare_after_index_scan.json");
        var cmp = new ComparisonEngine().Compare(a, b);
        var json = JsonSerializer.Serialize(cmp with { ComparisonStory = null }, ArtifactPersistenceJson.Options);
        var roundTrip = JsonSerializer.Deserialize<PlanComparisonResultV2>(json, ArtifactPersistenceJson.Options);
        Assert.NotNull(roundTrip);
        Assert.Null(roundTrip!.ComparisonStory);
        var norm = PersistedArtifactNormalizer.NormalizeLoadedComparison(roundTrip, null);
        Assert.NotNull(norm.ComparisonStory);
        Assert.False(string.IsNullOrWhiteSpace(norm.ComparisonStory!.Overview));
    }

    [Fact]
    public void NormalizeLoadedAnalysis_backfills_plan_story_when_property_absent_from_json()
    {
        var analysis = AnalysisFixtureBuilder.Build("simple_seq_scan.json");
        Assert.NotNull(analysis.PlanStory);
        var json = JsonSerializer.Serialize(analysis with { PlanStory = null }, ArtifactPersistenceJson.Options);
        var roundTrip = JsonSerializer.Deserialize<PlanAnalysisResult>(json, ArtifactPersistenceJson.Options);
        Assert.NotNull(roundTrip);
        Assert.Null(roundTrip!.PlanStory);
        var norm = PersistedArtifactNormalizer.NormalizeLoadedAnalysis(roundTrip, null);
        Assert.NotNull(norm.PlanStory);
        Assert.False(string.IsNullOrWhiteSpace(norm.PlanStory!.PlanOverview));
    }

    [Fact]
    public void Story_propagation_beat_json_converter_reads_legacy_string_array()
    {
        var opts = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        opts.Converters.Add(new StoryPropagationBeatListJsonConverter());
        var json = """{"propagationBeats":["legacy beat one"]}""";
        var w = JsonSerializer.Deserialize<PropagationBeatWrap>(json, opts);
        Assert.NotNull(w);
        Assert.Single(w!.PropagationBeats);
        Assert.Equal("legacy beat one", w.PropagationBeats[0].Text);
        Assert.Null(w.PropagationBeats[0].FocusNodeId);
    }

    private sealed record PropagationBeatWrap(
        [property: JsonConverter(typeof(StoryPropagationBeatListJsonConverter))]
        IReadOnlyList<StoryPropagationBeat> PropagationBeats);

    [Fact]
    public void Legacy_json_without_explicit_schema_deserializes_and_normalizes_with_current_version()
    {
        var analysis = AnalysisFixtureBuilder.Build("simple_seq_scan.json");
        var json = JsonSerializer.Serialize(analysis, ArtifactPersistenceJson.Options);
        using var doc = JsonDocument.Parse(json);
        var o = doc.RootElement.Clone();
        if (o.TryGetProperty("artifactSchemaVersion", out _))
        {
            var node = System.Text.Json.Nodes.JsonNode.Parse(json)!.AsObject();
            node.Remove("artifactSchemaVersion");
            json = node.ToJsonString();
        }

        var roundTrip = JsonSerializer.Deserialize<PlanAnalysisResult>(json, ArtifactPersistenceJson.Options);
        Assert.NotNull(roundTrip);
        var norm = PersistedArtifactNormalizer.NormalizeLoadedAnalysis(roundTrip!, null);
        Assert.Equal(ArtifactSchema.Current, norm.ArtifactSchemaVersion);
    }
}
