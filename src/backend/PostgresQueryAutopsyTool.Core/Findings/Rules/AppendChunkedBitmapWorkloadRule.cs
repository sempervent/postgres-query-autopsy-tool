using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings.Rules;

/// <summary>
/// TimescaleDB-style: Append over many chunk bitmap scans — indexes are in use but aggregate cost remains high.
/// </summary>
public sealed class AppendChunkedBitmapWorkloadRule : IFindingRule
{
    public string RuleId => "P.append-chunk-bitmap-workload";
    public string Title => "Chunked bitmap index access with large aggregate I/O";
    public FindingCategory Category => FindingCategory.PotentialIndexingOpportunity;

    public IEnumerable<AnalysisFinding> Evaluate(FindingEvaluationContext context)
    {
        var overview = IndexSignalAnalyzer.BuildOverview(context.Nodes, context);
        if (!overview.SuggestsChunkedBitmapWorkload)
            yield break;

        if (!context.HasBuffers || context.RootSharedReadBlocks < 10_000)
            yield break;

        var appendCount = context.Nodes.Count(n =>
            string.Equals(n.Node.NodeType, "Append", StringComparison.OrdinalIgnoreCase));

        yield return new AnalysisFinding(
            FindingId: $"{RuleId}:plan",
            RuleId: RuleId,
            Severity: FindingSeverity.Medium,
            Confidence: FindingConfidence.High,
            Category: Category,
            Title: Title,
            Summary:
            "Many bitmap heap scans under Append suggest per-chunk indexes are already participating; total shared reads/temp work may still be large for other reasons.",
            Explanation:
            "This is not a naive “missing index” signal. The shape indicates repeated index-assisted chunk access. " +
            "Heavy I/O often reflects query window width, chunk count, correlation, ordering/sorts after scans, or partial bitmap lossiness—not only absent indexes.",
            NodeIds: new[] { context.RootNodeId },
            Evidence: new Dictionary<string, object?>
            {
                ["appendOperatorCount"] = appendCount,
                ["bitmapHeapScanCount"] = overview.BitmapHeapScanCount,
                ["rootSharedReadBlocks"] = context.RootSharedReadBlocks,
                ["chunkedWorkloadNote"] = overview.ChunkedWorkloadNote,
            },
            Suggestion:
            "Review time-range pruning, number of chunks touched, whether ORDER BY can align with index order, and post-scan sorts/aggregates. Compare plans with narrower windows or different orderings before proposing new indexes.",
            RankScore: null
        );
    }
}
