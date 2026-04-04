using System.Text.Json;
using System.Text.Json.Serialization;

namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>Reads legacy <c>string[]</c> beats or Phase 61 object beats; always writes object form.</summary>
public sealed class StoryPropagationBeatListJsonConverter : JsonConverter<IReadOnlyList<StoryPropagationBeat>>
{
    public override IReadOnlyList<StoryPropagationBeat> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType != JsonTokenType.StartArray)
            throw new JsonException("Expected start of array for propagation beats.");

        var list = new List<StoryPropagationBeat>();
        while (reader.Read())
        {
            if (reader.TokenType == JsonTokenType.EndArray)
                return list;

            if (reader.TokenType == JsonTokenType.String)
            {
                list.Add(new StoryPropagationBeat(reader.GetString() ?? "", null, ""));
                continue;
            }

            if (reader.TokenType != JsonTokenType.StartObject)
                throw new JsonException("Expected string or object for propagation beat.");

            using var doc = JsonDocument.ParseValue(ref reader);
            var root = doc.RootElement;
            var text = root.TryGetProperty("text", out var te) ? te.GetString() ?? "" : "";
            string? focus = root.TryGetProperty("focusNodeId", out var fe) && fe.ValueKind == JsonValueKind.String
                ? fe.GetString()
                : null;
            var anchor = root.TryGetProperty("anchorLabel", out var ae) && ae.ValueKind == JsonValueKind.String
                ? ae.GetString() ?? ""
                : "";
            list.Add(new StoryPropagationBeat(text, focus, anchor));
        }

        throw new JsonException("Unclosed array for propagation beats.");
    }

    public override void Write(Utf8JsonWriter writer, IReadOnlyList<StoryPropagationBeat> value, JsonSerializerOptions options)
    {
        writer.WriteStartArray();
        foreach (var b in value)
        {
            writer.WriteStartObject();
            writer.WriteString("text", b.Text);
            if (b.FocusNodeId is not null)
                writer.WriteString("focusNodeId", b.FocusNodeId);
            writer.WriteString("anchorLabel", b.AnchorLabel);
            writer.WriteEndObject();
        }

        writer.WriteEndArray();
    }
}
