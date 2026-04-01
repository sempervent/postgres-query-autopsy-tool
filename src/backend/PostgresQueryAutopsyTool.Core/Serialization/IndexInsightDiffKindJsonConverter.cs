using System.Text.Json;
using System.Text.Json.Serialization;
using PostgresQueryAutopsyTool.Core.Comparison;

namespace PostgresQueryAutopsyTool.Core.Serialization;

/// <summary>Serializes <see cref="IndexInsightDiffKind"/> as lowercase JSON strings (new, resolved, …).</summary>
public sealed class IndexInsightDiffKindJsonConverter : JsonConverter<IndexInsightDiffKind>
{
    public override IndexInsightDiffKind Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number && reader.TryGetInt32(out var n))
            return (IndexInsightDiffKind)n;

        var s = reader.GetString();
        return s?.ToLowerInvariant() switch
        {
            "new" => IndexInsightDiffKind.New,
            "resolved" => IndexInsightDiffKind.Resolved,
            "improved" => IndexInsightDiffKind.Improved,
            "worsened" => IndexInsightDiffKind.Worsened,
            "changed" => IndexInsightDiffKind.Changed,
            "unchanged" => IndexInsightDiffKind.Unchanged,
            _ => Enum.TryParse<IndexInsightDiffKind>(s, true, out var e) ? e : IndexInsightDiffKind.Unchanged
        };
    }

    public override void Write(Utf8JsonWriter writer, IndexInsightDiffKind value, JsonSerializerOptions options)
    {
        var str = value switch
        {
            IndexInsightDiffKind.New => "new",
            IndexInsightDiffKind.Resolved => "resolved",
            IndexInsightDiffKind.Improved => "improved",
            IndexInsightDiffKind.Worsened => "worsened",
            IndexInsightDiffKind.Changed => "changed",
            IndexInsightDiffKind.Unchanged => "unchanged",
            _ => "unchanged"
        };
        writer.WriteStringValue(str);
    }
}
