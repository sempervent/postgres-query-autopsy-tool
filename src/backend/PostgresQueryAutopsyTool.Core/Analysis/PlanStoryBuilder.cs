using System.Linq;
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
            likelyExpense = "Primary pressure types: " + string.Join("; ", driverParts) + ".";
        else if (!string.IsNullOrWhiteSpace(narrative.WhereTimeWent))
            likelyExpense = "Hotspot orientation: " + TrimSentence(narrative.WhereTimeWent, 220);
        else
            likelyExpense = "No strong automated expense headline—inspect timings and findings together when present.";

        var inspectSteps = new List<InspectFirstStep>();
        if (summary.Bottlenecks.Count > 0)
        {
            var b = summary.Bottlenecks[0];
            var nid = b.NodeIds.FirstOrDefault();
            var body1 =
                $"Bottleneck #{b.Rank} ({ClassPhrase(b.BottleneckClass)}): {b.Headline}. Operator briefing lives on the bottleneck card when present.";
            inspectSteps.Add(new InspectFirstStep(0, "Anchor on the ranked bottleneck", body1, nid));

            var body2 = b.CauseHint == BottleneckCauseHint.DownstreamSymptom
                ? "Join order, semi/anti shape, and row multiplication often explain inner-side or sort symptoms."
                : "If subtree time dominates, drill children before assuming this node is the sole culprit.";
            inspectSteps.Add(new InspectFirstStep(0, "Trace how work arrives here", body2, null));
        }
        else
        {
            inspectSteps.Add(
                new InspectFirstStep(
                    0,
                    "Find timing anchors",
                    "When timing exists, start from exclusive-time and shared-read hotspots in the guide.",
                    null));
        }

        inspectSteps.Add(
            new InspectFirstStep(
                0,
                "Cross-check findings",
                "Automated rules should echo what timings show—use findings as corroboration, not a second story.",
                null));
        if (suggestions.Count > 0)
        {
            inspectSteps.Add(
                new InspectFirstStep(
                    0,
                    "Open ranked suggestions",
                    "Optimization suggestions in the Plan guide are ordered by leverage—start with the top card instead of repeating the same text here.",
                    null));
        }

        RenumberSteps(inspectSteps);
        var inspectFirst = string.Join(
            " ",
            inspectSteps.Select(s => $"{s.StepNumber}) {s.Title}: {s.Body}"));

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
        var indexWithTimeBucket = AppendTimeBucketAnalyticalHint(indexNote, queryText);

        return new PlanStory(
            PlanOverview: planOverview,
            WorkConcentration: workConcentration,
            LikelyExpenseDrivers: likelyExpense,
            ExecutionShape: shape,
            InspectFirstPath: inspectFirst,
            InspectFirstSteps: inspectSteps,
            PropagationBeats: propagation,
            IndexShapeNote: indexWithTimeBucket);
    }

    private static void RenumberSteps(List<InspectFirstStep> steps)
    {
        for (var i = 0; i < steps.Count; i++)
        {
            var s = steps[i];
            steps[i] = s with { StepNumber = i + 1 };
        }
    }

    /// <summary>Phase 82: bounded hint when SQL suggests time bucketing—does not deep-parse; keeps index note honest.</summary>
    private static string AppendTimeBucketAnalyticalHint(string indexNote, string? queryText)
    {
        if (string.IsNullOrWhiteSpace(queryText) ||
            queryText.IndexOf("time_bucket", StringComparison.OrdinalIgnoreCase) < 0)
            return indexNote;

        const string hint =
            "Time-bucketed / analytical shape: wall time often concentrates in scans or joins feeding the bucket or partial aggregate, not only the finalize hop—pair timings upstream of the grouped output.";
        if (string.IsNullOrWhiteSpace(indexNote))
            return hint;
        if (indexNote.Contains("time_bucket", StringComparison.OrdinalIgnoreCase) ||
            indexNote.Contains("bucket", StringComparison.OrdinalIgnoreCase))
            return indexNote;
        return $"{indexNote.TrimEnd()} {hint}";
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
