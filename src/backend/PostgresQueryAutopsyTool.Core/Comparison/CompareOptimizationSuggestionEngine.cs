using System.Security.Cryptography;
using System.Text;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Domain;
using PostgresQueryAutopsyTool.Core.Findings;

namespace PostgresQueryAutopsyTool.Core.Comparison;

/// <summary>
/// Compare-scoped next steps: not a verbatim replay of single-plan suggestions.
/// </summary>
public static class CompareOptimizationSuggestionEngine
{
    private const string ValExplain =
        "Re-run EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) on representative parameters and compare timing plus buffer counters before vs after your change.";

    private static OptimizationSuggestionFamily CmpFamily(OptimizationSuggestionCategory category) => category switch
    {
        OptimizationSuggestionCategory.IndexExperiment => OptimizationSuggestionFamily.IndexExperiments,
        OptimizationSuggestionCategory.StatisticsMaintenance => OptimizationSuggestionFamily.StatisticsPlannerAccuracy,
        OptimizationSuggestionCategory.TimescaledbWorkload or OptimizationSuggestionCategory.PartitioningChunking =>
            OptimizationSuggestionFamily.SchemaWorkloadShape,
        OptimizationSuggestionCategory.ObserveBeforeChange => OptimizationSuggestionFamily.OperationalTuningValidation,
        _ => OptimizationSuggestionFamily.QueryShapeOrdering
    };

    private static string CmpHumanLabel(string? nodeId, PlanAnalysisResult plan)
    {
        if (string.IsNullOrEmpty(nodeId)) return "";
        var ctx = new FindingEvaluationContext(plan.RootNodeId, plan.Nodes);
        return PlanNodeReferenceBuilder.SafePrimary(nodeId, ctx);
    }

    private static string CmpPairHumanAnchors(FindingDiffItem item, PlanComparisonResultV2 cmp)
    {
        var a = CmpHumanLabel(item.NodeIdA, cmp.PlanA);
        var b = CmpHumanLabel(item.NodeIdB, cmp.PlanB);
        if (string.IsNullOrEmpty(item.NodeIdA) && string.IsNullOrEmpty(item.NodeIdB))
            return "anchors unavailable in diff metadata";
        if (string.IsNullOrEmpty(item.NodeIdA))
            return $"plan B at “{b}”";
        if (string.IsNullOrEmpty(item.NodeIdB))
            return $"plan A at “{a}”";
        return $"plan A “{a}” vs plan B “{b}”";
    }

    public static IReadOnlyList<OptimizationSuggestion> Build(PlanComparisonResultV2 cmp)
    {
        var list = new List<OptimizationSuggestion>();
        var items = cmp.FindingsDiff.Items;
        var idx = cmp.IndexComparison;

        AddResolvedAccessPathValidation(list, items, idx, cmp);
        AddNewAccessPathConcern(list, items, idx, cmp);
        AddChunkedPosture(list, cmp);
        AddSortFindingShift(list, items, cmp);
        AddIndexCorroborated(list, items, idx, cmp);
        AddRemainingHighPriorityFromPlanB(list, cmp.PlanB);
        AddRegionContinuityRewriteCue(list, cmp);

        return list
            .GroupBy(s => s.SuggestionId)
            .Select(g => g.First())
            .OrderByDescending(s => PriorityVal(s.Priority))
            .ThenByDescending(s => ConfidenceVal(s.Confidence))
            .Take(10)
            .ToArray();
    }

    private static void AddRegionContinuityRewriteCue(List<OptimizationSuggestion> list, PlanComparisonResultV2 cmp)
    {
        var p = cmp.PairDetails
            .Where(x => !string.IsNullOrWhiteSpace(x.RegionContinuityHint))
            .OrderByDescending(x => (int)x.Identity.MatchConfidence)
            .FirstOrDefault(x => x.Identity.MatchConfidence >= MatchConfidence.Medium);
        if (p is null) return;

        if (list.Any(s => s.Title.Contains("Rewrite changed operator shape", StringComparison.OrdinalIgnoreCase)))
            return;

        var idA = p.Identity.NodeIdA;
        var idB = p.Identity.NodeIdB;
        var targetIds = new[] { idA, idB }.Where(s => !string.IsNullOrEmpty(s)).Distinct(StringComparer.Ordinal).ToArray();
        var labelB = CmpHumanLabel(idB, cmp.PlanB);
        if (string.IsNullOrWhiteSpace(labelB))
            labelB = p.Identity.NodeTypeB;

        var followUp = RegionContinuityFollowUpSentence(p.RegionContinuityHint);
        list.Add(CmpMake(
            OptimizationSuggestionCategory.ObserveBeforeChange,
            SuggestedActionType.ValidateWithExplainAnalyze,
            "Rewrite changed operator shape — track where the work moved",
            $"{p.RegionContinuityHint} {followUp}",
            $"Mapped pair {p.Identity.NodeTypeA} → {p.Identity.NodeTypeB} with continuity readout at plan B “{labelB}”.",
            "Pair-detail region continuity + structural operator change.",
            SuggestionConfidenceLevel.Medium,
            SuggestionPriorityLevel.Medium,
            targetIds,
            Array.Empty<string>(),
            Array.Empty<string>(),
            new[]
            {
                "Continuity hints are heuristic; validate when predicates, statistics, or parallelism differ materially between captures."
            },
            new[] { ValExplain },
            recommendedNextAction:
            "Trace the same logical tables through both plans and confirm where buffer/temp pressure landed after the rewrite.",
            whyItMatters:
            "Operator rewrites can move work without removing total cost; tracking the region keeps comparisons actionable.",
            targetDisplayLabel: labelB));
    }

    /// <summary>Phase 68: tail guidance tuned to scan vs ordering continuity (keeps suggestion evidence-bound, not generic).</summary>
    private static string RegionContinuityFollowUpSentence(string? hint)
    {
        if (string.IsNullOrWhiteSpace(hint))
            return "If timings improved, still inspect sorts and aggregates that follow this join: one pain class often shifts after a structural change.";

        var h = hint.ToLowerInvariant();
        if (h.Contains("strong ordering evidence"))
            return "Structured sort-key alignment is stronger signal than name overlap alone—still confirm row volume, buffer counters, and whether parents above became the limiter.";
        if (h.Contains("token-level ordering link"))
            return "Token overlap is a weak ordering signal—verify ORDER BY text, sort/temp I/O, and whether the planner truly folded ordering into the access path.";
        if (h.Contains("order by text") && h.Contains("cautious ordering tie-breaker"))
            return "Query text supports ORDER BY alignment—still confirm the planner actually removed expensive sort/temp work, not only renamed nodes.";
        if (h.Contains("order by text") && h.Contains("json evidence was thin"))
            return "Query text supports ORDER BY where planner JSON was thin—still verify sort/temp I/O and buffer counters, not only operator labels.";
        if (h.Contains("bitmap heap path") || (h.Contains("bitmap heap") && h.Contains("same relation")))
            return "Bitmap paths trade full sequential reads for bitmap build + heap recheck—follow recheck/actual rows and whether joins or sorts absorbed any win.";
        if (h.Contains("index-only path") || h.Contains("index only"))
            return "Index-only cuts heap fetches but not always total time—visibility-map checks, wide indexes, and downstream volume can still dominate.";
        if (h.Contains("access narrowed") && h.Contains("residual"))
            return "The access path improved, but this region can stay relevant—trace parents for joins, sorts, and row amplification before treating the rewrite as finished.";
        if (h.Contains("explicit sort") || h.Contains("ordering region") || h.Contains("ordering cost"))
            return "If the top-level sort step shrank or disappeared, validate with larger rowsets—ordering cost can move into index range/heap steps or reappear under joins and aggregates.";
        if (h.Contains("same ordering region"))
            return "Index-backed ordering can still be read-heavy; confirm buffer counters on B and whether downstream row volume or grouping is now the dominant cost.";
        if (h.Contains("sequential scan") && h.Contains("index-backed"))
            return "Narrower access often shifts pressure to joins, residual filters, or later sorts—trace the same relation through parents and siblings before declaring the rewrite fully done.";
        if (h.Contains("grouped-output") || h.Contains("output-shaping region") || h.Contains("partial vs finalize"))
            return "Grouped-output continuity is about staging and finalization—compare gather/merge vs single-node cost, input volume from scans/joins, and whether parallel partial work truly shrank end-to-end time.";
        if (h.Contains("partial win"))
            return "Continuity marks the same rough region—if timing is still tight, pressure is often upstream (feeds) or downstream (parents), not only this operator.";
        if (h.Contains("nested-loop") || h.Contains("hash build"))
            return "If timings improved, still inspect sorts and aggregates that follow this join: one pain class often shifts after a join-strategy change.";

        return "If timings improved, scan siblings and parents for residual sort, aggregate, or join volume—the same logical region can show a different bottleneck class after a rewrite.";
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
            $"Resolved finding “{resolved.Title}” at {CmpPairHumanAnchors(resolved, cmp)}.",
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
            recommendedNextAction:
            "Exercise plan B with production-like parameters and confirm buffer/timing wins you expect from the resolved access-path finding.",
            whyItMatters:
            "Resolved findings can hide regressions under different predicates; validation keeps the comparison honest.",
            targetDisplayLabel: CmpHumanLabel(resolved.NodeIdB ?? resolved.NodeIdA, cmp.PlanB),
            relatedFindingDiffIds: string.IsNullOrEmpty(resolved.DiffId) ? null : new[] { resolved.DiffId },
            relatedIndexInsightDiffIds: null));
    }

    private static void AddNewAccessPathConcern(
        List<OptimizationSuggestion> list,
        IReadOnlyList<FindingDiffItem> items,
        IndexComparisonSummary idx,
        PlanComparisonResultV2 cmp)
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
            $"{HumanizeChange(worrisome.ChangeType)} on “{worrisome.Title}”.",
            SuggestionConfidenceLevel.Medium,
            MapPriorityFromFinding(worrisome.SeverityB ?? worrisome.SeverityA),
            new[] { worrisome.NodeIdB ?? worrisome.NodeIdA ?? "" }.Where(s => !string.IsNullOrEmpty(s)).ToArray(),
            Array.Empty<string>(),
            Array.Empty<string>(),
            new[] { "A rewrite can also regress; compare buffer/timing evidence, not only node types." },
            new[]
            {
                "Check whether rows removed by filter drop after adding the candidate index or tightening predicates on plan B.",
                ValExplain
            },
            recommendedNextAction:
            "Start from predicates + selective indexes on plan B; measure shared reads and rows removed by filter before broader schema work.",
            whyItMatters:
            "New access-path stress after a change usually means the rewrite shifted selectivity or ordering—indexes help only when aligned with that new shape.",
            targetDisplayLabel: CmpHumanLabel(worrisome.NodeIdB ?? worrisome.NodeIdA, cmp.PlanB),
            relatedFindingDiffIds: string.IsNullOrEmpty(worrisome.DiffId) ? null : new[] { worrisome.DiffId },
            relatedIndexInsightDiffIds: worrisomeIndexDiffIds));
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
                "If this is a TimescaleDB workload, compare a narrower time window or pre-aggregated path before adding more indexes.",
                ValExplain
            },
            recommendedNextAction:
            "Tighten time predicates or try continuous aggregates / pre-aggregation, then re-measure total shared reads across chunks.",
            whyItMatters:
            "Chunked bitmap work still dominates when many chunks qualify; another btree per chunk rarely fixes that root cause.",
            relatedFindingDiffIds: null,
            relatedIndexInsightDiffIds: null));
    }

    private static void AddSortFindingShift(List<OptimizationSuggestion> list, IReadOnlyList<FindingDiffItem> items, PlanComparisonResultV2 cmp)
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
            new[]
            {
                "Re-run EXPLAIN (ANALYZE, BUFFERS) and confirm the sort no longer spills to disk (or shrinks materially) after your experiment.",
                ValExplain
            },
            recommendedNextAction:
            persists
                ? "After this change, the sort is still expensive; test whether order-aligned indexing or reducing sorted rows changes that."
                : "New sort pressure on plan B: prototype index-delivered ordering or cut rows feeding the sort before raising work_mem.",
            whyItMatters:
            "Sorts that survive a rewrite often mean ordering or row volume changed; treat them as a shape problem first.",
            targetDisplayLabel: CmpHumanLabel(sortDiff.NodeIdB ?? sortDiff.NodeIdA, cmp.PlanB),
            relatedFindingDiffIds: string.IsNullOrEmpty(sortDiff.DiffId) ? null : new[] { sortDiff.DiffId },
            relatedIndexInsightDiffIds: null));
    }

    private static void AddIndexCorroborated(
        List<OptimizationSuggestion> list,
        IReadOnlyList<FindingDiffItem> items,
        IndexComparisonSummary idx,
        PlanComparisonResultV2 cmp)
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
                new[]
                {
                    "Use EXPLAIN (ANALYZE, BUFFERS) to confirm the index delta and finding diff both tell the same story on plan B.",
                    ValExplain
                },
                recommendedNextAction:
                "Design the next experiment using both the index insight diff and the related finding change—then validate with buffers on plan B.",
                whyItMatters:
                "When two signals agree, you waste less time chasing a single-operator red herring.",
                targetDisplayLabel: CmpHumanLabel(diff.NodeIdB ?? diff.NodeIdA, cmp.PlanB),
                relatedFindingDiffIds: string.IsNullOrEmpty(f.DiffId) ? null : new[] { f.DiffId },
                relatedIndexInsightDiffIds: string.IsNullOrEmpty(diff.InsightDiffId) ? null : new[] { diff.InsightDiffId }));
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
                SuggestionId = CmpCarriedFromPlanBId(s)
            });
        }
    }

    /// <summary>
    /// Stable compare id for suggestions carried from plan B analysis: based on structured fields + source <c>sg_*</c> id, not the prefixed display title.
    /// </summary>
    private static string CmpCarriedFromPlanBId(OptimizationSuggestion s)
    {
        var tn = string.Join(",", s.TargetNodeIds.OrderBy(x => x, StringComparer.Ordinal));
        var rf = string.Join(",", s.RelatedFindingIds.OrderBy(x => x, StringComparer.Ordinal));
        var rii = string.Join(",", s.RelatedIndexInsightNodeIds.OrderBy(x => x, StringComparer.Ordinal));
        var raw =
            $"carry|planB|src={s.SuggestionId}|{s.Category}|{s.SuggestedActionType}|{s.SuggestionFamily}|{tn}|{rf}|{rii}";
        return $"sg_{Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)))[..16].ToLowerInvariant()}";
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
        string recommendedNextAction,
        string whyItMatters,
        string? targetDisplayLabel = null,
        bool isGroupedCluster = false,
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
            CmpFamily(category),
            recommendedNextAction,
            whyItMatters,
            targetDisplayLabel,
            isGroupedCluster,
            relatedFindingDiffIds,
            relatedIndexInsightDiffIds,
            null,
            null);

    /// <summary>
    /// Pre–Phase-48 carried plan-B suggestions used <see cref="CmpStableId"/> with the prefixed display title.
    /// Exposed for Phase 49 deep-link aliasing on persisted comparisons.
    /// </summary>
    public static string LegacyCarriedTitleBasedSuggestionId(OptimizationSuggestion s) =>
        CmpStableId("cmp", s.Category, s.SuggestedActionType, s.Title, s.TargetNodeIds);

    private static string CmpStableId(string scope, OptimizationSuggestionCategory c, SuggestedActionType a, string title, IReadOnlyList<string>? nodes = null)
    {
        var n = nodes is { Count: > 0 } ? string.Join(",", nodes.OrderBy(x => x)) : "";
        var raw = $"{scope}|{c}|{a}|{title}|{n}";
        return $"sg_{Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)))[..16].ToLowerInvariant()}";
    }

    private static string HumanizeChange(FindingChangeType t) =>
        t switch
        {
            FindingChangeType.New => "New signal",
            FindingChangeType.Worsened => "Worsened signal",
            FindingChangeType.Resolved => "Resolved signal",
            FindingChangeType.Improved => "Improved signal",
            FindingChangeType.Unchanged => "Unchanged signal",
            _ => "Finding change"
        };

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
