namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>Phase 83: one actionable item in the Analyze “Start here” path (JSON camelCase <c>inspectFirstSteps</c>).</summary>
public sealed record InspectFirstStep(
    int StepNumber,
    string Title,
    string Body,
    /// <summary>Optional planner node id for Focus in the UI.</summary>
    string? FocusNodeId = null);
