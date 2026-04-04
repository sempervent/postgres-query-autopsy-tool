namespace PostgresQueryAutopsyTool.Core.Analysis;

internal static class NodeLabelFormatter
{
    /// <summary>Compact primary label for tables, findings, and inline references (Phase 61: operator-aware, no raw paths).</summary>
    public static string ShortLabel(AnalyzedPlanNode n, IReadOnlyDictionary<string, AnalyzedPlanNode> byId) =>
        PlanNodeReferenceBuilder.PrimaryLabelCore(n, byId);
}
