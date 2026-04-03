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
        return o;
    }
}
