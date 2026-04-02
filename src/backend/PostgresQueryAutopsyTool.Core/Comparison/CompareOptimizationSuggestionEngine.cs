using System.Security.Cryptography;
using System.Text;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Comparison;

/// <summary>
/// Compare-scoped next steps: not a verbatim replay of single-plan suggestions.
/// </summary>
public static class CompareOptimizationSuggestionEngine
{
    private const string ValExplain =
        "Compare before/after with EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON).";

    public static IReadOnlyList<OptimizationSuggestion> Build(PlanComparisonResultV2 cmp)
    {
        var list = new List<OptimizationSuggestion>();
        var items = cmp.FindingsDiff.Items;
        var idx = cmp.IndexComparison;

        AddResolvedAccessPathValidation(list, items, idx, cmp);
        AddNewAccessPathConcern(list, items, idx);
        AddChunkedPosture(list, cmp);
        AddSortFindingShift(list, items);
        AddIndexCorroborated(list, items, idx);
        AddRemainingHighPriorityFromPlanB(list, cmp.PlanB);

        return list
            .GroupBy(s => s.SuggestionId)
            .Select(g => g.First())
            .OrderByDescending(s => PriorityVal(s.Priority))
            .ThenByDescending(s => ConfidenceVal(s.Confidence))
            .Take(10)
            .ToArray();
    }

    private static void AddResolvedAccessPathValidation(
        List<OptimizationSuggestion> list,
        IReadOnlyList<FindingDiffItem> items,
        IndexComparisonSummary idx,
        PlanComparisonResultV2 cmp)
    {
        static bool IsAccessFinding(string rule) =>
            rule.Contains("seq-scan", StringComparison.OrdinalIgnoreCase) ||
            rule.Contains("potential-indexing", StringComparison.OrdinalIgnoreCase) ||
            rule.Contains("nl-inner-index", StringComparison.OrdinalIgnoreCase);

        var resolved = items.FirstOrDefault(i =>
            i.ChangeType == FindingChangeType.Resolved && IsAccessFinding(i.RuleId));
        if (resolved is null) return;

        var indexAligned = idx.InsightDiffs.Any(d =>
            d.Kind is IndexInsightDiffKind.Resolved or IndexInsightDiffKind.Improved);

        list.Add(CmpMake(
            OptimizationSuggestionCategory.ObserveBeforeChange,
            SuggestedActionType.ValidateWithExplainAnalyze,
            "Resolved access-path concern — validate the new path before more indexes",
            indexAligned
                ? "A missing-index-style or inner-side cue cleared between plans, and index insight diffs move in a favorable direction. Confirm the after-plan stays healthy on representative data."
                : "A prior access-path finding no longer appears. Validate that runtime and buffer counters improved for the intended workload—not only on this one comparison.",
            $"Resolved rule `{resolved.RuleId}` on plan A anchor `{resolved.NodeIdA ?? "n/a"}` → B `{resolved.NodeIdB ?? "n/a"}`.",
            "Findings diff + index posture shift.",
            SuggestionConfidenceLevel.Medium,
            SuggestionPriorityLevel.High,
            new[] { resolved.NodeIdB ?? resolved.NodeIdA ?? "" }.Where(s => !string.IsNullOrEmpty(s)).ToArray(),
            Array.Empty<string>(),
            Array.Empty<string>(),
            new[]
            {
                "Regression can reappear with different parameters; keep a saved before/after EXPLAIN.",
                cmp.PlanB.IndexOverview.SuggestsChunkedBitmapWorkload
                    ? "Chunked bitmap workloads can still be read-heavy even when a seq scan finding disappears."
                    : ""
            }.Where(s => !string.IsNullOrWhiteSpace(s)).ToArray(),
            new[]
            {
                "Re-run with production-like predicates and measure shared reads/temp blocks on plan B.",
                ValExplain
            },
            string.IsNullOrEmpty(resolved.DiffId) ? null : new[] { resolved.DiffId },
            null));
    }

    private static void AddNewAccessPathConcern(
        List<OptimizationSuggestion> list,
        IReadOnlyList<FindingDiffItem> items,
        IndexComparisonSummary idx)
    {
        var worrisome = items.FirstOrDefault(i =>
            (i.ChangeType == FindingChangeType.New || i.ChangeType == FindingChangeType.Worsened) &&
            (i.RuleId.Contains("seq-scan", StringComparison.OrdinalIgnoreCase) ||
             i.RuleId.Contains("potential-indexing", StringComparison.OrdinalIgnoreCase) ||
             i.RuleId.Contains("index-access-still-heavy", StringComparison.OrdinalIgnoreCase)));

        if (worrisome is null) return;

        IReadOnlyList<string>? worrisomeIndexDiffIds = null;
        if (worrisome.RelatedIndexDiffIds is { Count: > 0 })
            worrisomeIndexDiffIds = worrisome.RelatedIndexDiffIds;
        else if (worrisome.RelatedIndexDiffIndexes.Count > 0)
        {
            var acc = new List<string>();
            foreach (var ii in worrisome.RelatedIndexDiffIndexes)
            {
                if ((uint)ii >= (uint)idx.InsightDiffs.Count) continue;
                var id = idx.InsightDiffs[ii].InsightDiffId;
                if (!string.IsNullOrEmpty(id)) acc.Add(id);
            }

            if (acc.Count > 0) worrisomeIndexDiffIds = acc.ToArray();
        }

        var corroborated = (worrisome.RelatedIndexDiffIds?.Count ?? 0) > 0 ||
                           (worrisome.RelatedIndexDiffIndexes?.Count ?? 0) > 0 ||
                           idx.InsightDiffs.Any(d => d.Kind is IndexInsightDiffKind.New or IndexInsightDiffKind.Worsened);

        list.Add(CmpMake(
            OptimizationSuggestionCategory.IndexExperiment,
            SuggestedActionType.CreateIndexCandidate,
            "New or worsened access-path concern after your change",
            corroborated
                ? "Findings and index insight diffs both point at access-path stress on plan B—treat the next experiment as index + predicate shape, validated with EXPLAIN."
                : "Plan B shows a new or stronger access-path finding. Investigate predicates and supporting indexes before broad schema changes.",
            worrisome.Summary,
            $"Change type={worrisome.ChangeType}, rule `{worrisome.RuleId}`.",
            SuggestionConfidenceLevel.Medium,
            MapPriorityFromFinding(worrisome.SeverityB ?? worrisome.SeverityA),
            new[] { worrisome.NodeIdB ?? worrisome.NodeIdA ?? "" }.Where(s => !string.IsNullOrEmpty(s)).ToArray(),
            Array.Empty<string>(),
            Array.Empty<string>(),
            new[] { "A rewrite can also regress; compare buffer/timing evidence, not only node types." },
            new[] { ValExplain, "Check whether filter selectivity matches expectations on plan B." },
            string.IsNullOrEmpty(worrisome.DiffId) ? null : new[] { worrisome.DiffId },
            worrisomeIndexDiffIds));
    }

    private static void AddChunkedPosture(List<OptimizationSuggestion> list, PlanComparisonResultV2 cmp)
    {
        if (!cmp.IndexComparison.EitherPlanSuggestsChunkedBitmapWorkload &&
            !cmp.PlanB.IndexOverview.SuggestsChunkedBitmapWorkload)
            return;

        var stillHeavy = cmp.PlanB.IndexOverview.BitmapHeapScanCount >= 4 ||
                         cmp.PlanB.Findings.Any(f =>
                             f.RuleId.Equals("P.append-chunk-bitmap-workload", StringComparison.OrdinalIgnoreCase));

        if (!stillHeavy) return;

        list.Add(CmpMake(
            OptimizationSuggestionCategory.TimescaledbWorkload,
            SuggestedActionType.RevisitChunkingOrRetention,
            "Chunked bitmap access still dominates — prefer shape/window experiments",
            "After the change, the plan still looks like many per-chunk bitmap accesses. Next steps are usually time-window tightening, ordering alignment, aggregates/continuous aggregates, or retention—not another blind index.",
            cmp.PlanB.IndexOverview.ChunkedWorkloadNote ?? "Append + multiple bitmap heap scans detected on plan B.",
            "Compare index overview on plan B.",
            SuggestionConfidenceLevel.High,
            SuggestionPriorityLevel.High,
            Array.Empty<string>(),
            Array.Empty<string>(),
            Array.Empty<string>(),
            new[] { "Do not assume missing indexes when chunk-level index paths are already present." },
            new[]
            {
                "Compare shared read totals with narrower time predicates.",
                "Review whether ORDER BY forces a wide merge/sort after chunk union.",
                ValExplain
            },
            null,
            null));
    }

    private static void AddSortFindingShift(List<OptimizationSuggestion> list, IReadOnlyList<FindingDiffItem> items)
    {
        var sortDiff = items.FirstOrDefault(i =>
            i.RuleId.Contains("sort-cost", StringComparison.OrdinalIgnoreCase) &&
            i.ChangeType != FindingChangeType.Resolved &&
            i.ChangeType != FindingChangeType.Improved);
        if (sortDiff is null) return;

        var persists = sortDiff.ChangeType == FindingChangeType.Unchanged ||
                       sortDiff.ChangeType == FindingChangeType.Worsened;

        list.Add(CmpMake(
            OptimizationSuggestionCategory.SortOrdering,
            SuggestedActionType.ChangeGroupingOrOrderingStrategy,
            persists ? "Order-support opportunity persists after the rewrite" : "Sort cost emerged or worsened on plan B",
            persists
                ? "If expensive sort or spill survived your change, test aligning index order to final sort keys or reducing sorted columns where semantics allow."
                : "New sort pressure on plan B: reduce sorted volume or test index-delivered ordering before raising work_mem.",
            sortDiff.Summary,
            $"Rule `{sortDiff.RuleId}`, change={sortDiff.ChangeType}.",
            SuggestionConfidenceLevel.Medium,
            SuggestionPriorityLevel.Medium,
            new[] { sortDiff.NodeIdB ?? sortDiff.NodeIdA ?? "" }.Where(s => !string.IsNullOrEmpty(s)).ToArray(),
            Array.Empty<string>(),
            Array.Empty<string>(),
            new[] { "work_mem tuning is a follow-up measurement, not a substitute for less work." },
            new[] { "Confirm spill metrics move with your experiment.", ValExplain },
            string.IsNullOrEmpty(sortDiff.DiffId) ? null : new[] { sortDiff.DiffId },
            null));
    }

    private static void AddIndexCorroborated(
        List<OptimizationSuggestion> list,
        IReadOnlyList<FindingDiffItem> items,
        IndexComparisonSummary idx)
    {
        foreach (var diff in idx.InsightDiffs.Where(d =>
                     (d.RelatedFindingDiffIds?.Count ?? 0) > 0 || d.RelatedFindingDiffIndexes.Count > 0))
        {
            if (diff.Kind == IndexInsightDiffKind.Unchanged) continue;

            FindingDiffItem? f = null;
            if (diff.RelatedFindingDiffIds is { Count: > 0 } idList)
                f = items.FirstOrDefault(x => string.Equals(x.DiffId, idList[0], StringComparison.Ordinal));
            if (f is null && diff.RelatedFindingDiffIndexes.Count > 0)
            {
                var firstIdx = diff.RelatedFindingDiffIndexes[0];
                if ((uint)firstIdx < (uint)items.Count)
                    f = items[firstIdx];
            }

            if (f is null) continue;

            list.Add(CmpMake(
                OptimizationSuggestionCategory.ObserveBeforeChange,
                SuggestedActionType.ValidateWithExplainAnalyze,
                "Index delta corroborates a findings change — design the next experiment around both",
                $"{diff.Summary} Related finding diff: `{f.RuleId}` ({f.ChangeType}). Use both signals when choosing whether to chase indexes, predicates, or workload shape.",
                diff.Summary,
                "Index insight diff cross-link (Phase 31).",
                SuggestionConfidenceLevel.Medium,
                SuggestionPriorityLevel.Medium,
                new[] { diff.NodeIdB ?? diff.NodeIdA ?? "" }.Where(s => !string.IsNullOrEmpty(s)).ToArray(),
                Array.Empty<string>(),
                Array.Empty<string>(),
                new[] { "Corroboration is heuristic; low-confidence node matches can mis-link stories." },
                new[] { ValExplain },
                string.IsNullOrEmpty(f.DiffId) ? null : new[] { f.DiffId },
                string.IsNullOrEmpty(diff.InsightDiffId) ? null : new[] { diff.InsightDiffId }));
        }
    }

    private static void AddRemainingHighPriorityFromPlanB(List<OptimizationSuggestion> list, PlanAnalysisResult planB)
    {
        var top = planB.OptimizationSuggestions
            .Where(s => s.Priority >= SuggestionPriorityLevel.High)
            .Take(2)
            .ToArray();

        foreach (var s in top)
        {
            list.Add(s with
            {
                Title = $"After this change: {s.Title}",
                Summary = s.Summary,
                Rationale = $"Carried from plan B analysis — {s.Rationale}",
                SuggestionId = CmpStableId("carry", s.Category, s.SuggestedActionType, s.Title)
            });
        }
    }

    private static OptimizationSuggestion CmpMake(
        OptimizationSuggestionCategory category,
        SuggestedActionType action,
        string title,
        string summary,
        string details,
        string rationale,
        SuggestionConfidenceLevel confidence,
        SuggestionPriorityLevel priority,
        IReadOnlyList<string> targetNodeIds,
        IReadOnlyList<string> relatedFindingIds,
        IReadOnlyList<string> relatedIndexInsightNodeIds,
        IReadOnlyList<string> cautions,
        IReadOnlyList<string> validationSteps,
        IReadOnlyList<string>? relatedFindingDiffIds = null,
        IReadOnlyList<string>? relatedIndexInsightDiffIds = null) =>
        new(
            CmpStableId("cmp", category, action, title, targetNodeIds),
            category,
            action,
            title,
            summary,
            details,
            rationale,
            confidence,
            priority,
            targetNodeIds,
            relatedFindingIds,
            relatedIndexInsightNodeIds,
            cautions,
            validationSteps,
            relatedFindingDiffIds,
            relatedIndexInsightDiffIds);

    private static string CmpStableId(string scope, OptimizationSuggestionCategory c, SuggestedActionType a, string title, IReadOnlyList<string>? nodes = null)
    {
        var n = nodes is { Count: > 0 } ? string.Join(",", nodes.OrderBy(x => x)) : "";
        var raw = $"{scope}|{c}|{a}|{title}|{n}";
        return $"sg_{Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)))[..16].ToLowerInvariant()}";
    }

    private static SuggestionPriorityLevel MapPriorityFromFinding(FindingSeverity? s) => s switch
    {
        FindingSeverity.Critical or FindingSeverity.High => SuggestionPriorityLevel.High,
        FindingSeverity.Medium => SuggestionPriorityLevel.Medium,
        _ => SuggestionPriorityLevel.Medium
    };

    private static int PriorityVal(SuggestionPriorityLevel p) => p switch
    {
        SuggestionPriorityLevel.Critical => 4,
        SuggestionPriorityLevel.High => 3,
        SuggestionPriorityLevel.Medium => 2,
        _ => 1
    };

    private static int ConfidenceVal(SuggestionConfidenceLevel c) => c switch
    {
        SuggestionConfidenceLevel.High => 3,
        SuggestionConfidenceLevel.Medium => 2,
        _ => 1
    };
}
