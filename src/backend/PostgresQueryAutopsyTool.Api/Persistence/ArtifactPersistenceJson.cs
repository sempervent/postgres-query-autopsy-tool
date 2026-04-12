using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace PostgresQueryAutopsyTool.Api.Persistence;

/// <summary>JSON options aligned with API responses (camelCase, same attributes on Core models).</summary>
public static class ArtifactPersistenceJson
{
    public static JsonSerializerOptions Options { get; } = Create();

    private static JsonSerializerOptions Create()
    {
        var o = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
            WriteIndented = false,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        };
        o.Converters.Add(new RelaxedOptimizationSuggestionJsonConverter());
        o.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false));
        return o;
    }

    /// <summary>
    /// Copy settings onto <see cref="Microsoft.AspNetCore.Http.Json.HttpJsonOptions.SerializerOptions"/> so request bodies
    /// (snapshot exports, artifacts) cannot drift from persistence serialization (Phase 116).
    /// </summary>
    public static void ApplyToHttpSerializerOptions(JsonSerializerOptions target)
    {
        var s = Options;
        target.PropertyNamingPolicy = s.PropertyNamingPolicy;
        target.PropertyNameCaseInsensitive = s.PropertyNameCaseInsensitive;
        target.WriteIndented = s.WriteIndented;
        target.DefaultIgnoreCondition = s.DefaultIgnoreCondition;
        foreach (var c in s.Converters)
        {
            var ct = c.GetType();
            if (target.Converters.Any(x => x.GetType() == ct))
                continue;
            target.Converters.Add(c);
        }
    }
}
