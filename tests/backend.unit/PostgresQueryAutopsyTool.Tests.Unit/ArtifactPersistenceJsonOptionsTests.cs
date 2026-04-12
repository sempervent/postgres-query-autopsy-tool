using System.Text.Json;
using PostgresQueryAutopsyTool.Api.Persistence;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

/// <summary>Phase 116: HTTP JSON options stay aligned with artifact persistence serializers.</summary>
public sealed class ArtifactPersistenceJsonOptionsTests
{
    [Fact]
    public void ApplyToHttpSerializerOptions_adds_relaxed_suggestion_converter_once()
    {
        var target = new JsonSerializerOptions();
        ArtifactPersistenceJson.ApplyToHttpSerializerOptions(target);
        ArtifactPersistenceJson.ApplyToHttpSerializerOptions(target);
        var relaxed = 0;
        foreach (var c in target.Converters)
        {
            if (c.GetType().Name.Contains("RelaxedOptimizationSuggestionJsonConverter", StringComparison.Ordinal))
                relaxed++;
        }
        Assert.Equal(1, relaxed);
    }
}
