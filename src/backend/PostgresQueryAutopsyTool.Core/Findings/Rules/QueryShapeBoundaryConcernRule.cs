using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings.Rules;

/// <summary>
/// Phase 58: flags CTE Scan / Subquery Scan boundaries (and similar) when row volume or nested-loop context suggests query-shape cost.
/// Evidence-only; does not parse SQL.
/// </summary>
public sealed class QueryShapeBoundaryConcernRule : IFindingRule
{
    public string RuleId => "S.query-shape-boundary";
    public string Title => "Query-shape boundary (CTE/subquery scan)";
    public FindingCategory Category => FindingCategory.PlanComplexityConcern;

    public IEnumerable<AnalysisFinding> Evaluate(FindingEvaluationContext context)
    {
        foreach (var n in context.Nodes)
        {
            var t = n.Node.NodeType ?? "";
            if (!IsBoundaryScan(t))
                continue;

            var rows = n.Metrics.ActualRowsTotal ?? n.Node.ActualRows;
            var loops = n.Node.ActualLoops ?? 1;
            var underNl = ParentIsNestedLoop(n, context.ById);
            var highRows = rows is >= 50_000;
            var mediumRows = rows is >= 8_000;
            var heavyLoop = loops >= 150 && underNl;

            if (!highRows && !heavyLoop && !(mediumRows && underNl && loops >= 40))
                continue;

            var severity =
                highRows || loops >= 800 ? FindingSeverity.High :
                mediumRows || loops >= 200 ? FindingSeverity.Medium :
                FindingSeverity.Low;

            var rowText = rows is > 0 ? $" ~{rows:0} rows at this boundary." : "";

            yield return new AnalysisFinding(
                FindingId: $"{RuleId}:{n.NodeId}",
                RuleId: RuleId,
                Severity: severity,
                Confidence: rows is > 0 ? FindingConfidence.High : FindingConfidence.Medium,
                Category: Category,
                Title: $"{t} may be shaping expensive work",
                Summary:
                $"{t} `{n.NodeId}` reports{rowText} When large rowsets cross CTE/subquery boundaries, later joins and sorts often process that volume.",
                Explanation:
                "The planner exposes CTE and subquery scans as explicit operators. High row counts or repeated execution under nested loops suggest the query shape (what is computed before what) may be worth revisiting—" +
                "for example moving selective filters earlier, reducing columns carried through the boundary, or restructuring so intermediate rowsets shrink before joins or sorts.",
                NodeIds: new[] { n.NodeId },
                Evidence: new Dictionary<string, object?>
                {
                    ["nodeId"] = n.NodeId,
                    ["nodeType"] = t,
                    ["actualRowsTotal"] = rows,
                    ["actualLoops"] = loops,
                    ["underNestedLoopParent"] = underNl,
                },
                Suggestion:
                "Investigate row width and row count crossing this boundary. Test whether equivalent logic can filter or aggregate earlier (still correct semantically) and re-measure with EXPLAIN (ANALYZE, BUFFERS).",
                RankScore: null);
        }
    }

    private static bool IsBoundaryScan(string nodeType) =>
        nodeType.Equals("CTE Scan", StringComparison.OrdinalIgnoreCase) ||
        nodeType.Equals("Subquery Scan", StringComparison.OrdinalIgnoreCase);

    private static bool ParentIsNestedLoop(AnalyzedPlanNode n, IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        if (string.IsNullOrEmpty(n.ParentNodeId) || !byId.TryGetValue(n.ParentNodeId, out var p))
            return false;
        return (p.Node.NodeType ?? "").Contains("Nested Loop", StringComparison.OrdinalIgnoreCase);
    }
}
