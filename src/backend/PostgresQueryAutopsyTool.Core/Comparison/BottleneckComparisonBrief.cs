namespace PostgresQueryAutopsyTool.Core.Comparison;

/// <summary>Phase 59: compact human lines comparing bottleneck posture between plans A and B.</summary>
public sealed record BottleneckComparisonBrief(IReadOnlyList<string> Lines);
