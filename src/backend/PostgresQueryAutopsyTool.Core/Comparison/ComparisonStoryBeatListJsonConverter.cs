using System.Text.Json;
using System.Text.Json.Serialization;

namespace PostgresQueryAutopsyTool.Core.Comparison;

/// <summary>Reads legacy string change beats or Phase 61 anchored beats.</summary>
public sealed class ComparisonStoryBeatListJsonConverter : JsonConverter<IReadOnlyList<ComparisonStoryBeat>>
{
    public override IReadOnlyList<ComparisonStoryBeat> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType != JsonTokenType.StartArray)
            throw new JsonException("Expected start of array for change beats.");

        var list = new List<ComparisonStoryBeat>();
        while (reader.Read())
        {
            if (reader.TokenType == JsonTokenType.EndArray)
                return list;

            if (reader.TokenType == JsonTokenType.String)
            {
                list.Add(new ComparisonStoryBeat(reader.GetString() ?? "", null, null, ""));
                continue;
            }

            if (reader.TokenType != JsonTokenType.StartObject)
                throw new JsonException("Expected string or object for change beat.");

            using var doc = JsonDocument.ParseValue(ref reader);
            var root = doc.RootElement;
            var text = root.TryGetProperty("text", out var te) ? te.GetString() ?? "" : "";
            string? fa = root.TryGetProperty("focusNodeIdA", out var fae) && fae.ValueKind == JsonValueKind.String
                ? fae.GetString()
                : null;
            string? fb = root.TryGetProperty("focusNodeIdB", out var fbe) && fbe.ValueKind == JsonValueKind.String
                ? fbe.GetString()
                : null;
            var pair = root.TryGetProperty("pairAnchorLabel", out var pe) && pe.ValueKind == JsonValueKind.String
                ? pe.GetString() ?? ""
                : "";
            list.Add(new ComparisonStoryBeat(text, fa, fb, pair));
        }

        throw new JsonException("Unclosed array for change beats.");
    }

    public override void Write(Utf8JsonWriter writer, IReadOnlyList<ComparisonStoryBeat> value, JsonSerializerOptions options)
    {
        writer.WriteStartArray();
        foreach (var b in value)
        {
            writer.WriteStartObject();
            writer.WriteString("text", b.Text);
            if (b.FocusNodeIdA is not null)
                writer.WriteString("focusNodeIdA", b.FocusNodeIdA);
            if (b.FocusNodeIdB is not null)
                writer.WriteString("focusNodeIdB", b.FocusNodeIdB);
            writer.WriteString("pairAnchorLabel", b.PairAnchorLabel);
            writer.WriteEndObject();
        }

        writer.WriteEndArray();
    }
}
