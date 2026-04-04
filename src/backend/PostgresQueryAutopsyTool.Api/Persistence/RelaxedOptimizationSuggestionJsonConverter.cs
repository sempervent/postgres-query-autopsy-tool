using System.Text.Json;
using System.Text.Json.Serialization;
using PostgresQueryAutopsyTool.Core.Analysis;

namespace PostgresQueryAutopsyTool.Api.Persistence;

/// <summary>
/// Deserializes <see cref="OptimizationSuggestion"/> from SQLite payloads that may omit Phase 47+ fields.
/// </summary>
public sealed class RelaxedOptimizationSuggestionJsonConverter : JsonConverter<OptimizationSuggestion>
{
    public override OptimizationSuggestion Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType != JsonTokenType.StartObject)
            throw new JsonException("Expected start object for OptimizationSuggestion.");
        using var doc = JsonDocument.ParseValue(ref reader);
        return ReadElement(doc.RootElement, options);
    }

    private static OptimizationSuggestion ReadElement(JsonElement o, JsonSerializerOptions options)
    {
        var id = GetString(o, "suggestionId") ?? throw new JsonException("suggestionId required.");
        var category = DeserializeEnum<OptimizationSuggestionCategory>(o, "category", options);
        var action = DeserializeEnum<SuggestedActionType>(o, "suggestedActionType", options);
        var title = GetString(o, "title") ?? "";
        var summary = GetString(o, "summary") ?? "";
        var details = GetString(o, "details") ?? "";
        var rationale = GetString(o, "rationale") ?? "";
        var confidence = TryDeserializeEnum<SuggestionConfidenceLevel>(o, "confidence", options) ?? SuggestionConfidenceLevel.Medium;
        var priority = TryDeserializeEnum<SuggestionPriorityLevel>(o, "priority", options) ?? SuggestionPriorityLevel.Medium;
        var targets = ReadStringArray(o, "targetNodeIds");
        var rf = ReadStringArray(o, "relatedFindingIds");
        var rii = ReadStringArray(o, "relatedIndexInsightNodeIds");
        var cautions = ReadStringArray(o, "cautions");
        var validation = ReadStringArray(o, "validationSteps");
        var family = TryDeserializeEnum<OptimizationSuggestionFamily>(o, "suggestionFamily", options)
                     ?? OptimizationSuggestionFamily.QueryShapeOrdering;
        var next = GetString(o, "recommendedNextAction") ?? "";
        var why = GetString(o, "whyItMatters") ?? "";
        var label = GetString(o, "targetDisplayLabel");
        var grouped = o.TryGetProperty("isGroupedCluster", out var g) && g.ValueKind == JsonValueKind.True;
        var fd = ReadOptionalStringArray(o, "relatedFindingDiffIds");
        var iid = ReadOptionalStringArray(o, "relatedIndexInsightDiffIds");
        var rb = ReadOptionalStringArray(o, "relatedBottleneckInsightIds");
        var aka = ReadOptionalStringArray(o, "alsoKnownAs");

        return new OptimizationSuggestion(
            id,
            category,
            action,
            title,
            summary,
            details,
            rationale,
            confidence,
            priority,
            targets,
            rf,
            rii,
            cautions,
            validation,
            family,
            next,
            why,
            label,
            grouped,
            fd,
            iid,
            rb,
            aka);
    }

    private static T DeserializeEnum<T>(JsonElement parent, string name, JsonSerializerOptions options) where T : struct, Enum
    {
        if (!parent.TryGetProperty(name, out var p))
            throw new JsonException($"Missing enum {name}.");
        return JsonSerializer.Deserialize<T>(p.GetRawText(), options);
    }

    private static T? TryDeserializeEnum<T>(JsonElement parent, string name, JsonSerializerOptions options) where T : struct, Enum
    {
        if (!parent.TryGetProperty(name, out var p) || p.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            return null;
        try
        {
            return JsonSerializer.Deserialize<T>(p.GetRawText(), options);
        }
        catch
        {
            return null;
        }
    }

    private static string? GetString(JsonElement o, string name) =>
        o.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;

    private static IReadOnlyList<string> ReadStringArray(JsonElement o, string name)
    {
        if (!o.TryGetProperty(name, out var p) || p.ValueKind != JsonValueKind.Array)
            return Array.Empty<string>();
        var list = new List<string>();
        foreach (var x in p.EnumerateArray())
        {
            if (x.ValueKind == JsonValueKind.String && x.GetString() is { } s)
                list.Add(s);
        }

        return list;
    }

    private static IReadOnlyList<string>? ReadOptionalStringArray(JsonElement o, string name)
    {
        if (!o.TryGetProperty(name, out var p) || p.ValueKind != JsonValueKind.Array)
            return null;
        var list = new List<string>();
        foreach (var x in p.EnumerateArray())
        {
            if (x.ValueKind == JsonValueKind.String && x.GetString() is { } s)
                list.Add(s);
        }

        return list.Count == 0 ? null : list;
    }

    public override void Write(Utf8JsonWriter writer, OptimizationSuggestion value, JsonSerializerOptions options)
    {
        var clone = new JsonSerializerOptions(options);
        for (var i = clone.Converters.Count - 1; i >= 0; i--)
        {
            if (clone.Converters[i] is RelaxedOptimizationSuggestionJsonConverter)
                clone.Converters.RemoveAt(i);
        }

        JsonSerializer.Serialize(writer, value, clone);
    }
}
