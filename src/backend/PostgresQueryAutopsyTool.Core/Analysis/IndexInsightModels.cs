namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>Coarse access-path bucket for index tuning and compare-mode deltas.</summary>
public static class IndexAccessPathTokens
{
    public const string Other = "other";
    public const string SeqScan = "seqScan";
    public const string IndexScan = "indexScan";
    public const string IndexOnlyScan = "indexOnlyScan";
    public const string BitmapHeapScan = "bitmapHeapScan";
    public const string BitmapIndexScan = "bitmapIndexScan";
}

/// <summary>Structured index-tuning signal attached to a plan node (compact, investigation-oriented).</summary>
public sealed record PlanIndexInsight(
    string NodeId,
    /// <summary>Token from <see cref="IndexAccessPathTokens"/>.</summary>
    string AccessPathFamily,
    string? NodeType,
    string? RelationName,
    string? IndexName,
    IReadOnlyList<string> SignalKinds,
    string Headline,
    IReadOnlyDictionary<string, object?> Facts);

/// <summary>Plan-level rollup for index/access-path posture (chunked bitmap workloads, scan mix).</summary>
public sealed record PlanIndexOverview(
    int SeqScanCount,
    int IndexScanCount,
    int IndexOnlyScanCount,
    int BitmapHeapScanCount,
    int BitmapIndexScanCount,
    bool HasAppendOperator,
    bool SuggestsChunkedBitmapWorkload,
    string? ChunkedWorkloadNote);
