namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>Phase 59: whether this bottleneck anchor is likely the main lever vs downstream of upstream shape.</summary>
public enum BottleneckCauseHint
{
    /// <summary>Strongest signal to inspect first at this anchor (conservative).</summary>
    PrimaryFocus,
    /// <summary>Hot here, but plan shape suggests upstream drivers (e.g. nested-loop inner, row explosion feeding this node).</summary>
    DownstreamSymptom,
    /// <summary>Not enough structure to call primary vs symptom.</summary>
    Ambiguous
}
