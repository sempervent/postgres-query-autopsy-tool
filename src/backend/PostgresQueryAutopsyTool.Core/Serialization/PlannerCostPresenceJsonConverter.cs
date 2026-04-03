using System.Text.Json;
using System.Text.Json.Serialization;
using PostgresQueryAutopsyTool.Core.Analysis;

namespace PostgresQueryAutopsyTool.Core.Serialization;

public sealed class PlannerCostPresenceJsonConverter : JsonConverter<PlannerCostPresence>
{
    public override PlannerCostPresence Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number && reader.TryGetInt32(out var n))
            return (PlannerCostPresence)n;

        var s = reader.GetString();
        return s?.ToLowerInvariant() switch
        {
            "unknown" => PlannerCostPresence.Unknown,
            "present" => PlannerCostPresence.Present,
            "notdetected" => PlannerCostPresence.NotDetected,
            "not_detected" => PlannerCostPresence.NotDetected,
            "mixed" => PlannerCostPresence.Mixed,
            _ => Enum.TryParse<PlannerCostPresence>(s, true, out var e) ? e : PlannerCostPresence.Unknown
        };
    }

    public override void Write(Utf8JsonWriter writer, PlannerCostPresence value, JsonSerializerOptions options)
    {
        var str = value switch
        {
            PlannerCostPresence.Unknown => "unknown",
            PlannerCostPresence.Present => "present",
            PlannerCostPresence.NotDetected => "notDetected",
            PlannerCostPresence.Mixed => "mixed",
            _ => "unknown"
        };
        writer.WriteStringValue(str);
    }
}
