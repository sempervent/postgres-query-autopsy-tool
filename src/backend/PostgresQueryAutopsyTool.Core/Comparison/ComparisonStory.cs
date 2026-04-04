using System.Text.Json.Serialization;

namespace PostgresQueryAutopsyTool.Core.Comparison;

/// <summary>Phase 60: compact before/after story for Compare (works with <see cref="BottleneckComparisonBrief"/>).</summary>
public sealed record ComparisonStory(
    string Overview,
    [property: JsonConverter(typeof(ComparisonStoryBeatListJsonConverter))]
    IReadOnlyList<ComparisonStoryBeat> ChangeBeats,
    string InvestigationPath,
    string StructuralReading);
