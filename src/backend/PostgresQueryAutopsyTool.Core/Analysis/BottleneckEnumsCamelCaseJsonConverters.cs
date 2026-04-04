using System.Text.Json;
using System.Text.Json.Serialization;

namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>
/// Serializes bottleneck enums as camelCase strings (e.g. <c>cpuHotspot</c>) without enabling string enums globally
/// (which would break numeric <see cref="Domain.FindingSeverity"/> etc. in API payloads).
/// </summary>
public sealed class BottleneckClassCamelCaseJsonConverter : JsonConverter<BottleneckClass>
{
    public override BottleneckClass Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number && reader.TryGetInt32(out var n) && Enum.IsDefined(typeof(BottleneckClass), n))
            return (BottleneckClass)n;

        if (reader.TokenType != JsonTokenType.String)
            throw new JsonException("Expected string or number for BottleneckClass.");

        var s = reader.GetString()!;
        foreach (var name in Enum.GetNames<BottleneckClass>())
        {
            if (string.Equals(s, JsonNamingPolicy.CamelCase.ConvertName(name), StringComparison.Ordinal))
                return Enum.Parse<BottleneckClass>(name);
        }

        if (Enum.TryParse<BottleneckClass>(s, ignoreCase: true, out var parsed))
            return parsed;

        throw new JsonException($"Unknown BottleneckClass value: {s}");
    }

    public override void Write(Utf8JsonWriter writer, BottleneckClass value, JsonSerializerOptions options)
    {
        var name = value.ToString();
        writer.WriteStringValue(JsonNamingPolicy.CamelCase.ConvertName(name));
    }
}

public sealed class BottleneckCauseHintCamelCaseJsonConverter : JsonConverter<BottleneckCauseHint>
{
    public override BottleneckCauseHint Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number && reader.TryGetInt32(out var n) && Enum.IsDefined(typeof(BottleneckCauseHint), n))
            return (BottleneckCauseHint)n;

        if (reader.TokenType != JsonTokenType.String)
            throw new JsonException("Expected string or number for BottleneckCauseHint.");

        var s = reader.GetString()!;
        foreach (var name in Enum.GetNames<BottleneckCauseHint>())
        {
            if (string.Equals(s, JsonNamingPolicy.CamelCase.ConvertName(name), StringComparison.Ordinal))
                return Enum.Parse<BottleneckCauseHint>(name);
        }

        if (Enum.TryParse<BottleneckCauseHint>(s, ignoreCase: true, out var parsed))
            return parsed;

        throw new JsonException($"Unknown BottleneckCauseHint value: {s}");
    }

    public override void Write(Utf8JsonWriter writer, BottleneckCauseHint value, JsonSerializerOptions options)
    {
        var name = value.ToString();
        writer.WriteStringValue(JsonNamingPolicy.CamelCase.ConvertName(name));
    }
}
