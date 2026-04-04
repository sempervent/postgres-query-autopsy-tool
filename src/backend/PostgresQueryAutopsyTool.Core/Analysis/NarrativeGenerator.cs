using System.Linq;
using PostgresQueryAutopsyTool.Core.Domain;
using PostgresQueryAutopsyTool.Core.Findings;

namespace PostgresQueryAutopsyTool.Core.Analysis;

public static class NarrativeGenerator
{
    public static AnalysisNarrative From(
        PlanSummary summary,
        IReadOnlyList<AnalyzedPlanNode> nodes,
        IReadOnlyList<AnalysisFinding> rankedFindings)
    {
        var byId = nodes.ToDictionary(n => n.NodeId, StringComparer.Ordinal);
        var rootId = nodes.FirstOrDefault(n => n.Metrics.IsRoot)?.NodeId ?? nodes[0].NodeId;
        var ctx = new FindingEvaluationContext(rootId, nodes);

        string Label(string nodeId) => PlanNodeReferenceBuilder.SafePrimary(nodeId, ctx);

        var headline = rankedFindings.Take(3).ToArray();
        var headlineText = headline.Length == 0
            ? "No findings were emitted."
            : string.Join(" ", headline.Select(f => $"[{f.Severity}] {f.Title}."));

        var shape = OperatorNarrativeHelper.ExecutionShapeSummary(ctx);
        var hasBottlenecks = summary.Bottlenecks.Count > 0;

        var whatHappened = summary.RootInclusiveActualTimeMs is not null
            ? $"Root inclusive runtime ≈ {summary.RootInclusiveActualTimeMs.Value:F2}ms. {headlineText}"
            : $"No actual runtime fields were observed. {headlineText}";

        whatHappened += $" Execution pattern: {shape}";

        var workerParentCount = nodes.Count(n => PlanWorkerStatsHelper.HasWorkers(n.Node));
        if (workerParentCount > 0)
        {
            whatHappened += $" {workerParentCount} operator(s) include explicit per-worker stats (parallel execution).";
            if (nodes.Any(n => PlanWorkerStatsHelper.SharedReadsClearlyUneven(n.Node.Workers)))
                whatHappened += " Worker shared-read counts vary across workers on at least one node; inspect the Workers section there.";
        }

        // Phase 59: avoid repeating bottleneck card copy—orient toward hotspots + guide rail.
        var whereTimeWent = summary.TopExclusiveTimeHotspotNodeIds.Count > 0
            ? $"Top exclusive-time anchors: {string.Join("; ", summary.TopExclusiveTimeHotspotNodeIds.Take(5).Select(Label))}."
            : "Exclusive-time anchors unavailable (missing timing fields).";

        if (summary.TopInclusiveTimeHotspotNodeIds.Count > 0)
        {
            whereTimeWent +=
                $" Subtree-time leaders: {string.Join("; ", summary.TopInclusiveTimeHotspotNodeIds.Take(3).Select(Label))}.";
        }

        if (hasBottlenecks)
        {
            var classes = string.Join(
                ", ",
                summary.Bottlenecks.Take(3).Select(b => HumanClassPhrase(b.BottleneckClass)));
            whereTimeWent +=
                $" Ranked bottlenecks (see Main bottlenecks in the plan guide) cover: {classes}.";
        }

        var whatMatters = summary.HasBuffers && summary.TopSharedReadHotspotNodeIds.Count > 0
            ? $"Top shared-read anchors: {string.Join("; ", summary.TopSharedReadHotspotNodeIds.Take(5).Select(Label))}."
            : summary.HasBuffers
                ? "Buffer counters are present (shared/local/temp). Shared-read anchors are listed when node-level read counts stand out; temp/local activity may dominate some plans."
                : "No buffer counters were detected on plan nodes (use EXPLAIN (ANALYZE, BUFFERS); worker-only stats are merged onto the parent when the leader omits totals).";

        if (hasBottlenecks)
        {
            var first = summary.Bottlenecks[0];
            var cause = first.CauseHint switch
            {
                BottleneckCauseHint.PrimaryFocus => "treat as the first place to inspect",
                BottleneckCauseHint.DownstreamSymptom => "may be driven by upstream join or row volume—investigate parents as well",
                _ => "use the card detail for context"
            };
            whatMatters +=
                $" Start with bottleneck (1): {HumanClassPhrase(first.BottleneckClass)} — {first.Headline.ToLowerInvariant()} ({cause}).";
            if (!string.IsNullOrWhiteSpace(first.SymptomNote))
                whatMatters += $" {first.SymptomNote}";
        }

        var whatDoesNot = summary.Warnings.Count > 0
            ? $"Limitations: {string.Join(" ", summary.Warnings)}"
            : "No major limitations detected in the input plan fields.";

        return new AnalysisNarrative(
            WhatHappened: whatHappened,
            WhereTimeWent: whereTimeWent,
            WhatLikelyMatters: whatMatters,
            WhatProbablyDoesNotMatter: whatDoesNot
        );
    }

    private static string HumanClassPhrase(BottleneckClass c) =>
        c switch
        {
            BottleneckClass.CpuHotspot => "CPU / operator work",
            BottleneckClass.IoHotspot => "shared-read / I/O",
            BottleneckClass.SortOrSpillPressure => "sort or spill pressure",
            BottleneckClass.JoinAmplification => "join or repeated inner work",
            BottleneckClass.ScanFanout => "scan fan-out",
            BottleneckClass.AggregationPressure => "aggregation",
            BottleneckClass.QueryShapeBoundary => "CTE/subquery boundary",
            BottleneckClass.PlannerMisestimation => "planner mis-estimation",
            BottleneckClass.AccessPathMismatch => "index path still heavy",
            _ => "general timing"
        };
}
