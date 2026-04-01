using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings.Rules;

public sealed class SortCostConcernRule : IFindingRule
{
    public string RuleId => "K.sort-cost-concern";
    public string Title => "Sort cost concern";
    public FindingCategory Category => FindingCategory.CpuHotspot;

    public IEnumerable<AnalysisFinding> Evaluate(FindingEvaluationContext context)
    {
        if (!context.HasActualTiming)
            yield break;

        foreach (var n in context.Nodes)
        {
            var nodeType = n.Node.NodeType ?? "Unknown";
            var isSort =
                nodeType.Contains("Sort", StringComparison.OrdinalIgnoreCase);

            if (!isSort)
                continue;

            var exclusive = n.Metrics.ExclusiveActualTimeMsApprox;
            var share = context.ExclusiveTimeShareOfPlan(n);
            if (exclusive is null || share is null)
                continue;

            var method = n.Node.SortMethod;
            var spaceKb = n.Node.SortSpaceUsedKb;
            var spaceType = n.Node.SortSpaceType;
            var diskKb = n.Node.DiskUsageKb;

            var looksExternal =
                (!string.IsNullOrWhiteSpace(method) && method.Contains("external", StringComparison.OrdinalIgnoreCase)) ||
                string.Equals(spaceType, "Disk", StringComparison.OrdinalIgnoreCase) ||
                (diskKb is > 0);

            // Heuristics: either it is a major exclusive hotspot or takes a meaningful share of plan time,
            // or we have explicit external/disk sort indicators.
            if (!looksExternal && exclusive.Value < 20 && share.Value < 0.20)
                continue;

            var severity =
                looksExternal && share.Value >= 0.30 ? FindingSeverity.High :
                looksExternal && share.Value >= 0.20 ? FindingSeverity.Medium :
                share.Value >= 0.45 ? FindingSeverity.High :
                share.Value >= 0.30 ? FindingSeverity.Medium :
                looksExternal ? FindingSeverity.Medium :
                FindingSeverity.Low;

            var confidence = (n.Node.SortKey is not null || method is not null) ? FindingConfidence.High : FindingConfidence.Medium;
            var orderIndexHint = !string.IsNullOrWhiteSpace(n.Node.SortKey);

            yield return new AnalysisFinding(
                FindingId: $"{RuleId}:{n.NodeId}",
                RuleId: RuleId,
                Severity: severity,
                Confidence: confidence,
                Category: Category,
                Title: "Sort operator is a major time hotspot",
                Summary: $"Sort `{n.NodeId}` ({nodeType}) consumes notable exclusive time (~{share.Value:P0} of plan).",
                Explanation:
                looksExternal
                    ? "This sort shows external/disk-backed indicators (method/space/disk usage). External sorts are often slower and can signal memory pressure or large row volumes."
                    : "Sorts can be expensive when they process many rows. This rule flags sort operators that dominate exclusive time.",
                NodeIds: new[] { n.NodeId },
                Evidence: new Dictionary<string, object?>
                {
                    ["nodeId"] = n.NodeId,
                    ["nodeType"] = nodeType,
                    ["exclusiveActualTimeMsApprox"] = exclusive,
                    ["exclusiveTimeShareOfPlan"] = share,
                    ["sortKey"] = n.Node.SortKey,
                    ["sortMethod"] = method,
                    ["sortSpaceUsedKb"] = spaceKb,
                    ["sortSpaceType"] = spaceType,
                    ["peakMemoryUsageKb"] = n.Node.PeakMemoryUsageKb,
                    ["diskUsageKb"] = diskKb,
                    ["presortedKey"] = n.Node.PresortedKey,
                    ["actualRowsTotal"] = n.Metrics.ActualRowsTotal,
                    ["estimatedRowsPerLoop"] = n.Node.PlanRows,
                    ["sortOrderIndexInvestigation"] = orderIndexHint,
                    ["indexSignal_sortOrderSupport"] = orderIndexHint && (looksExternal || share.Value >= 0.15)
                        ? IndexSignalAnalyzer.SignalSortOrderSupportOpportunity
                        : null,
                },
                Suggestion:
                (looksExternal
                    ? "This sort looks disk-backed. If possible, reduce rows flowing into the sort (push filters earlier, reduce join fan-out) or consider increasing work_mem for this workload. "
                    : "If this sort is expected, consider whether an index can satisfy the ordering, or whether a LIMIT can be applied earlier. ") +
                (orderIndexHint
                    ? " With an explicit sort key, also investigate whether an index-aligned scan could provide the needed order and shrink sort input. "
                    : " ") +
                "Verify row counts feeding the sort and whether ordering can be satisfied earlier in the plan.",
                RankScore: null
            );
        }
    }
}

