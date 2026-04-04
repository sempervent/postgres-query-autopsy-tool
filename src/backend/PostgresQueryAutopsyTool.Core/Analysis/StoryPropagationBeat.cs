namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>Phase 61: one plan-story propagation line with optional graph focus anchor.</summary>
public sealed record StoryPropagationBeat(
    string Text,
    /// <summary>Canonical node id for UI focus; null when beat is not tied to a single node.</summary>
    string? FocusNodeId,
    /// <summary>Short human label for the focus target (button/tooltip); may match <see cref="Text"/> prefix.</summary>
    string AnchorLabel);
