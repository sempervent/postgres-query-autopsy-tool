using System.Text.Json.Serialization;

namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>
/// Evidence-backed, prioritized bottleneck line for summary + UI (not a second findings engine).
/// Phase 59 adds <see cref="BottleneckClass"/> and <see cref="CauseHint"/> for readability.
/// </summary>
public sealed record PlanBottleneckInsight(
    string InsightId,
    int Rank,
    /// <summary>Stable kind: <c>time_exclusive</c>, <c>time_subtree</c>, <c>io_read</c>, <c>finding</c>, <c>query_shape</c>.</summary>
    string Kind,
    [property: JsonConverter(typeof(BottleneckClassCamelCaseJsonConverter))] BottleneckClass BottleneckClass,
    [property: JsonConverter(typeof(BottleneckCauseHintCamelCaseJsonConverter))] BottleneckCauseHint CauseHint,
    string Headline,
    string Detail,
    IReadOnlyList<string> NodeIds,
    IReadOnlyList<string> RelatedFindingIds,
    /// <summary>Optional: when cost may be driven upstream (e.g. nested-loop inner).</summary>
    string? SymptomNote,
    /// <summary>Phase 60: conservative “because → likely” propagation cue (evidence-hedged).</summary>
    string? PropagationNote = null,
    /// <summary>Phase 61: human anchor for UI/copy (never a raw <c>root.*</c> path as primary).</summary>
    string? HumanAnchorLabel = null);
