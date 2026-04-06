namespace PostgresQueryAutopsyTool.Core.Comparison;

/// <summary>Structured continuity for pair readouts; drives compact summary cues without relying on substring heuristics alone.</summary>
public sealed record RegionContinuityData(
    string Hint,
    /// <summary>Stable key for cue mapping (e.g. <c>access.narrower</c>, <c>access.regression.indexToBitmap</c>).</summary>
    string KindKey,
    ContinuityOutcome Outcome);

public enum ContinuityOutcome
{
    Neutral = 0,
    Improved = 1,
    Regressed = 2,
    Mixed = 3
}
