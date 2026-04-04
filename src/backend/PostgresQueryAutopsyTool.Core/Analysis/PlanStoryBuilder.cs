using System.Text;
using PostgresQueryAutopsyTool.Core.Domain;
using PostgresQueryAutopsyTool.Core.Findings;

namespace PostgresQueryAutopsyTool.Core.Analysis;

public static class PlanStoryBuilder
{
    public static PlanStory Build(
        string rootNodeId,
        PlanSummary summary,
        IReadOnlyList<AnalyzedPlanNode> nodes,
        IReadOnlyList<AnalysisFinding> findings,
        AnalysisNarrative narrative,
        PlanIndexOverview? indexOverview,
        IReadOnlyList<PlanIndexInsight> indexInsights,
        IReadOnlyList<OptimizationSuggestion> suggestions,
        string? queryText = null)
    {
        var ctx = new FindingEvaluationContext(rootNodeId, nodes);
        var byId = ctx.ById;
        var shape = OperatorNarrativeHelper.ExecutionShapeSummary(ctx);

        string Label(string id) => PlanNodeReferenceBuilder.SafePrimary(id, ctx);

        string planOverview;
        if (summary.RootInclusiveActualTimeMs is { } rt)
            planOverview =
                $"This snapshot shows ~{rt:F1}ms root inclusive time across {summary.TotalNodeCount} operators (max depth {summary.MaxDepth}). {shape}";
        else
            planOverview =
                $"This plan has {summary.TotalNodeCount} operators to max depth {summary.MaxDepth}. {shape}";

        var workSb = new StringBuilder();
        if (summary.TopExclusiveTimeHotspotNodeIds.Count > 0)
        {
            var id = summary.TopExclusiveTimeHotspotNodeIds[0];
            workSb.Append($"Exclusive-time work peaks first at “{Label(id)}”. ");
        }

        if (summary.TopInclusiveTimeHotspotNodeIds.Count > 0)
        {
            var id = summary.TopInclusiveTimeHotspotNodeIds[0];
            workSb.Append($"Largest subtree-time anchor: “{Label(id)}”. ");
        }

        if (summary.HasBuffers && summary.TopSharedReadHotspotNodeIds.Count > 0)
        {
            var id = summary.TopSharedReadHotspotNodeIds[0];
            workSb.Append($"Shared-read concentration: “{Label(id)}”. ");
        }

        var workConcentration = workSb.Length > 0
            ? workSb.ToString().Trim()
            : summary.HasActualTiming
                ? "Timing anchors are sparse—use findings and operator detail when hotspots are thin."
                : "No timing anchors; buffer and structural cues from findings matter most.";

        var driverParts = new List<string>();
        foreach (var b in summary.Bottlenecks.Take(2))
            driverParts.Add(ClassPhrase(b.BottleneckClass));

        var topSev = findings.Where(f => f.Severity >= FindingSeverity.Medium).Take(2).Select(f => f.Title).ToArray();
        if (topSev.Length > 0 && driverParts.Count < 2)
            driverParts.AddRange(topSev.Take(2 - driverParts.Count));

        string likelyExpense;
        if (driverParts.Count > 0)
            likelyExpense = "Likely cost emphasis: " + string.Join("; ", driverParts) + ".";
        else if (!string.IsNullOrWhiteSpace(narrative.WhereTimeWent))
            likelyExpense = "Hotspot orientation: " + TrimSentence(narrative.WhereTimeWent, 220);
        else
            likelyExpense = "No strong automated expense headline—inspect timings and findings together when present.";

        var inspectParts = new List<string>();
        if (summary.Bottlenecks.Count > 0)
        {
            var b = summary.Bottlenecks[0];
            inspectParts.Add(
                $"1) Start with ranked bottleneck #{b.Rank} ({ClassPhrase(b.BottleneckClass)}): {b.Headline}.");
            inspectParts.Add(
                b.CauseHint == BottleneckCauseHint.DownstreamSymptom
                    ? "2) Then walk upstream parents of that node for join shape and row volume."
                    : "2) Drill children under that subtree if subtree time—not local exclusive time—dominates.");
        }
        else
        {
            inspectParts.Add("1) Use exclusive-time and shared-read hotspots below when timing exists.");
        }

        inspectParts.Add("3) Cross-check top findings for corroborating evidence.");
        if (suggestions.Count > 0)
        {
            var s0 = suggestions[0];
            var next = string.IsNullOrWhiteSpace(s0.RecommendedNextAction) ? s0.Summary : s0.RecommendedNextAction!;
            inspectParts.Add($"4) Next experiment: {s0.Title} — {next}");
        }

        var inspectFirst = string.Join(" ", inspectParts);

        var propagation = new List<StoryPropagationBeat>();
        foreach (var b in summary.Bottlenecks)
        {
            if (string.IsNullOrWhiteSpace(b.PropagationNote))
                continue;
            var nid = b.NodeIds.FirstOrDefault();
            string anchor;
            if (nid is not null && byId.TryGetValue(nid, out var bn))
                anchor = PlanNodeReferenceBuilder.PrimaryLabelCore(bn, byId);
            else
                anchor = nid is not null ? PlanNodeReferenceBuilder.SafePrimary(nid, ctx) : "";
            propagation.Add(new StoryPropagationBeat(b.PropagationNote!, nid, anchor));
            if (propagation.Count >= 4)
                break;
        }

        var indexNote = IndexShapeNote(indexOverview, indexInsights, ctx, queryText);

        return new PlanStory(
            PlanOverview: planOverview,
            WorkConcentration: workConcentration,
            LikelyExpenseDrivers: likelyExpense,
            ExecutionShape: shape,
            InspectFirstPath: inspectFirst,
            PropagationBeats: propagation,
            IndexShapeNote: indexNote);
    }

    private static string IndexShapeNote(
        PlanIndexOverview? overview,
        IReadOnlyList<PlanIndexInsight> insights,
        FindingEvaluationContext ctx,
        string? queryText)
    {
        if (overview?.SuggestsChunkedBitmapWorkload == true &&
            !string.IsNullOrWhiteSpace(overview.ChunkedWorkloadNote))
            return overview.ChunkedWorkloadNote!;

        if (overview?.SuggestsChunkedBitmapWorkload == true)
            return
                "Chunked/bitmap-heavy posture: indexes may already be in play—next experiments often target pruning, selectivity, and shape, not only “add another index.”";

        var head = insights.FirstOrDefault(i =>
            i.SignalKinds.Any(k => k.Contains("order", StringComparison.OrdinalIgnoreCase) ||
                                   k.Contains("filter", StringComparison.OrdinalIgnoreCase) ||
                                   k.Contains("join", StringComparison.OrdinalIgnoreCase)));
        if (head is not null)
        {
            var at = ctx.ById.TryGetValue(head.NodeId, out var n)
                ? $" (see {PlanNodeReferenceBuilder.Build(n, ctx.ById, ctx.RootNodeId, queryText).PrimaryLabel})"
                : "";
            return $"Index investigation angle: {head.Headline}{at}.";
        }

        return "";
    }

    private static string ClassPhrase(BottleneckClass c) =>
        c switch
        {
            BottleneckClass.CpuHotspot => "CPU / operator work",
            BottleneckClass.IoHotspot => "shared-read / I/O",
            BottleneckClass.SortOrSpillPressure => "sort or spill pressure",
            BottleneckClass.JoinAmplification => "join / repeated inner work",
            BottleneckClass.ScanFanout => "scan fan-out",
            BottleneckClass.AggregationPressure => "aggregation load",
            BottleneckClass.QueryShapeBoundary => "CTE/subquery boundary",
            BottleneckClass.PlannerMisestimation => "planner mis-estimation",
            BottleneckClass.AccessPathMismatch => "index path still read-heavy",
            _ => "general timing concentration"
        };

    private static string TrimSentence(string s, int max)
    {
        var t = s.Trim();
        if (t.Length <= max) return t;
        return t[..(max - 1)] + "…";
    }
}
