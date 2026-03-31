using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings.Rules;

public sealed class HashJoinPressureRule : IFindingRule
{
    public string RuleId => "L.hash-join-pressure";
    public string Title => "Hash join pressure / cost signal";
    public FindingCategory Category => FindingCategory.JoinStrategyConcern;

    public IEnumerable<AnalysisFinding> Evaluate(FindingEvaluationContext context)
    {
        if (!context.HasActualTiming)
            yield break;

        foreach (var n in context.Nodes)
        {
            if (!string.Equals(n.Node.NodeType, "Hash Join", StringComparison.OrdinalIgnoreCase))
                continue;

            var subtreeShare = context.SubtreeTimeShareOfPlan(n);
            var inclusive = n.Metrics.InclusiveActualTimeMs;
            if (subtreeShare is null || inclusive is null)
                continue;

            if (subtreeShare.Value < 0.30 && inclusive.Value < 30)
                continue;

            // Hash join pressure details often live on the child "Hash" node.
            var hashChild = n.ChildNodeIds
                .Select(id => context.ById[id])
                .FirstOrDefault(c => string.Equals(c.Node.NodeType, "Hash", StringComparison.OrdinalIgnoreCase));

            long? batches = hashChild?.Node.HashBatches;
            long? origBatches = hashChild?.Node.OriginalHashBatches;
            long? buckets = hashChild?.Node.HashBuckets;
            long? origBuckets = hashChild?.Node.OriginalHashBuckets;
            long? memKb = hashChild?.Node.PeakMemoryUsageKb ?? n.Node.PeakMemoryUsageKb;
            long? diskKb = hashChild?.Node.DiskUsageKb ?? n.Node.DiskUsageKb;

            var showsBatching = batches is > 1 || (origBatches is > 1);
            var showsDisk = diskKb is > 0;

            var severity =
                (showsDisk || showsBatching) && subtreeShare.Value >= 0.40 ? FindingSeverity.High :
                (showsDisk || showsBatching) && subtreeShare.Value >= 0.30 ? FindingSeverity.Medium :
                subtreeShare.Value >= 0.60 ? FindingSeverity.High :
                subtreeShare.Value >= 0.40 ? FindingSeverity.Medium :
                (showsDisk || showsBatching) ? FindingSeverity.Medium :
                FindingSeverity.Low;

            var confidence = n.Node.HashCond is not null ? FindingConfidence.High : FindingConfidence.Medium;

            yield return new AnalysisFinding(
                FindingId: $"{RuleId}:{n.NodeId}",
                RuleId: RuleId,
                Severity: severity,
                Confidence: confidence,
                Category: Category,
                Title: "Hash join dominates runtime",
                Summary: $"Hash Join `{n.NodeId}` consumes a large share of runtime (~{subtreeShare.Value:P0} of plan).",
                Explanation:
                (showsDisk || showsBatching)
                    ? "This hash join shows batching/disk signals (multiple batches and/or disk usage), suggesting memory pressure or large build-side inputs. " +
                      "This rule flags hash joins whose subtree dominates runtime and appears resource-stressed."
                    : "Hash joins are often efficient, but can become the primary bottleneck when the build/probe sides are large or when estimates are off. " +
                      "This rule flags hash joins whose subtree dominates runtime.",
                NodeIds: new[] { n.NodeId },
                Evidence: new Dictionary<string, object?>
                {
                    ["nodeId"] = n.NodeId,
                    ["nodeType"] = n.Node.NodeType,
                    ["hashCond"] = n.Node.HashCond,
                    ["inclusiveActualTimeMs"] = inclusive,
                    ["subtreeTimeShareOfPlan"] = subtreeShare,
                    ["actualRowsTotal"] = n.Metrics.ActualRowsTotal,
                    ["rowEstimateFactor"] = n.Metrics.RowEstimateFactor,
                    ["hashBuckets"] = buckets,
                    ["originalHashBuckets"] = origBuckets,
                    ["hashBatches"] = batches,
                    ["originalHashBatches"] = origBatches,
                    ["peakMemoryUsageKb"] = memKb,
                    ["diskUsageKb"] = diskKb,
                },
                Suggestion:
                (showsDisk || showsBatching
                    ? "This hash join looks stressed. Validate input row estimates and consider increasing work_mem for this workload if appropriate. "
                    : "Validate join predicate selectivity and row estimates. ") +
                "If inputs are larger than expected, improve statistics or consider index support on join keys.",
                RankScore: null
            );
        }
    }
}

