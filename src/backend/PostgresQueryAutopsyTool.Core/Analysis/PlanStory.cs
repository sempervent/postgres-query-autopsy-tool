using System.Text.Json.Serialization;

namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>
/// Phase 60: structured “plan story” for Analyze — complements <see cref="Domain.AnalysisNarrative"/> paragraphs
/// without replacing them (persistence + reports still use narrative).
/// </summary>
public sealed record PlanStory(
    /// <summary>Broad picture: scale, timing when present, execution shape in one breath.</summary>
    string PlanOverview,
    /// <summary>Where exclusive / subtree / I/O anchors concentrate.</summary>
    string WorkConcentration,
    /// <summary>Heuristic read of what likely drives cost (bottleneck classes + findings).</summary>
    string LikelyExpenseDrivers,
    /// <summary>Same lineage as <see cref="OperatorNarrativeHelper.ExecutionShapeSummary"/>.</summary>
    string ExecutionShape,
    /// <summary>Ordered investigation path (numbered clauses in one string for compact UI).</summary>
    string InspectFirstPath,
    /// <summary>Short “because → likely” beats tied to ranked bottlenecks (max ~4 in builder). Phase 61: anchored for UI focus.</summary>
    [property: JsonConverter(typeof(StoryPropagationBeatListJsonConverter))]
    IReadOnlyList<StoryPropagationBeat> PropagationBeats,
    /// <summary>Index / chunk / access-path investigation angle; empty when nothing notable.</summary>
    string IndexShapeNote);
