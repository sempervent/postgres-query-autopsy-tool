using PostgresQueryAutopsyTool.Core.Analysis;

namespace PostgresQueryAutopsyTool.Tests.Unit;

internal static class AnalysisTestDefaults
{
    public static PlanIndexOverview EmptyIndexOverview { get; } = new(
        SeqScanCount: 0,
        IndexScanCount: 0,
        IndexOnlyScanCount: 0,
        BitmapHeapScanCount: 0,
        BitmapIndexScanCount: 0,
        HasAppendOperator: false,
        SuggestsChunkedBitmapWorkload: false,
        ChunkedWorkloadNote: null);

    public static IReadOnlyList<PlanIndexInsight> EmptyIndexInsights { get; } = Array.Empty<PlanIndexInsight>();
}
