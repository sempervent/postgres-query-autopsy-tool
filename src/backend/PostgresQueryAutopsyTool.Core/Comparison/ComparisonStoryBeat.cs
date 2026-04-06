namespace PostgresQueryAutopsyTool.Core.Comparison;

/// <summary>Phase 61: compare change-story line with optional mapped-pair focus.</summary>
public sealed record ComparisonStoryBeat(
    string Text,
    string? FocusNodeIdA,
    string? FocusNodeIdB,
    /// <summary>Human-readable pair label for UI (e.g. “Seq Scan on t → Index Scan on t”).</summary>
    string PairAnchorLabel,
    /// <summary>Phase 64: optional operator briefing for plan B (or shared context)—kept separate from <see cref="Text"/> for UI hierarchy.</summary>
    string? BeatBriefing = null);
