using System.Security.Cryptography;
using System.Text;
using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>
/// Synthesizes investigation-oriented optimization suggestions from findings, index insights, and operator evidence.
/// Deterministic for a given <see cref="PlanAnalysisResult"/> snapshot.
/// </summary>
public static class OptimizationSuggestionEngine
{
    private const string ValExplainBuffers =
        "Re-run EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) on representative parameters and compare timing plus buffer counters before vs after your change.";

    private static OptimizationSuggestionFamily FamilyFor(OptimizationSuggestionCategory category) => category switch
    {
        OptimizationSuggestionCategory.IndexExperiment => OptimizationSuggestionFamily.IndexExperiments,
        OptimizationSuggestionCategory.StatisticsMaintenance => OptimizationSuggestionFamily.StatisticsPlannerAccuracy,
        OptimizationSuggestionCategory.TimescaledbWorkload or OptimizationSuggestionCategory.PartitioningChunking =>
            OptimizationSuggestionFamily.SchemaWorkloadShape,
        OptimizationSuggestionCategory.ObserveBeforeChange => OptimizationSuggestionFamily.OperationalTuningValidation,
        _ => OptimizationSuggestionFamily.QueryShapeOrdering
    };

    private static string HumanLabel(string? nodeId, IReadOnlyDictionary<string, AnalyzedPlanNode> byId) =>
        string.IsNullOrEmpty(nodeId) || !byId.TryGetValue(nodeId, out var n)
            ? nodeId ?? ""
            : NodeLabelFormatter.ShortLabel(n, byId);

    public static IReadOnlyList<OptimizationSuggestion> Build(PlanAnalysisResult analysis)
    {
        var list = new List<OptimizationSuggestion>();
        var byId = analysis.Nodes.ToDictionary(n => n.NodeId, StringComparer.Ordinal);
        var findings = analysis.Findings;
        var overview = analysis.IndexOverview;
        var insights = analysis.IndexInsights;

        var chunkedWorkload =
            overview.SuggestsChunkedBitmapWorkload ||
            findings.Any(f => f.RuleId.Equals("P.append-chunk-bitmap-workload", StringComparison.OrdinalIgnoreCase));

        if (chunkedWorkload)
            AddChunkedTimescaleSuggestions(list, findings, overview, byId);

        if (!chunkedWorkload)
        {
            foreach (var f in findings.Where(x => x.RuleId.Equals("F.seq-scan-concern", StringComparison.OrdinalIgnoreCase)))
                AddSeqScanIndexExperiment(list, f, byId);

            foreach (var f in findings.Where(x => x.RuleId.Equals("J.potential-indexing-opportunity", StringComparison.OrdinalIgnoreCase)))
                AddPotentialIndexing(list, f, byId);
        }

        foreach (var f in findings.Where(x => x.RuleId.Equals("R.index-access-still-heavy", StringComparison.OrdinalIgnoreCase)))
            AddIndexStillHeavy(list, f, byId, chunkedWorkload);

        foreach (var insight in insights)
        {
            if (chunkedWorkload && insight.AccessPathFamily == IndexAccessPathTokens.BitmapHeapScan)
                continue;
            AddFromIndexInsight(list, insight, findings, chunkedWorkload, byId);
        }

        foreach (var f in findings.Where(x => x.RuleId.Equals("K.sort-cost-concern", StringComparison.OrdinalIgnoreCase)))
            AddSortSuggestion(list, f, byId);

        foreach (var f in findings.Where(x => x.RuleId.Equals("Q.nl-inner-index-support", StringComparison.OrdinalIgnoreCase)))
            AddNlInnerSuggestion(list, f, byId);

        AddStatisticsSuggestionsForPlan(list, findings, byId);

        foreach (var f in findings.Where(x => x.RuleId.Equals("L.hash-join-pressure", StringComparison.OrdinalIgnoreCase)))
            AddHashJoinSuggestion(list, f, byId);

        foreach (var f in findings.Where(x => x.RuleId.Equals("M.materialize-loops-concern", StringComparison.OrdinalIgnoreCase)))
            AddMaterializeSuggestion(list, f, byId);

        AddTempSortSpillFromNodes(list, analysis.Nodes);
        AddParallelSkewFromNodes(list, analysis.Nodes);

        return DedupeAndRank(list)
            .Take(16)
            .ToArray();
    }

    private static void AddChunkedTimescaleSuggestions(
        List<OptimizationSuggestion> list,
        IReadOnlyList<AnalysisFinding> findings,
        PlanIndexOverview overview,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        var relFinding = findings.FirstOrDefault(f =>
            f.RuleId.Equals("P.append-chunk-bitmap-workload", StringComparison.OrdinalIgnoreCase));

        var nodeIds = relFinding?.NodeIds is { Count: > 0 } ? relFinding.NodeIds! : Array.Empty<string>();
        var rationale = relFinding is not null
            ? $"Finding `{relFinding.RuleId}`: {relFinding.Summary}"
            : "Plan overview matches Append with many bitmap heap scans: indexes likely participate per chunk; aggregate cost can still be large.";

        list.Add(Make(
            scope: "ana",
            category: OptimizationSuggestionCategory.TimescaledbWorkload,
            action: SuggestedActionType.RevisitChunkingOrRetention,
            title: "Treat heavy I/O as workload shape first, not only missing indexes",
            summary:
            "Many bitmap heap scans under Append usually mean chunk-level indexes are already in play. Narrow the time window, improve pruning, or revisit ordering/aggregates before assuming another index will fix it.",
            details:
            (overview.ChunkedWorkloadNote ?? "") +
            (overview.BitmapHeapScanCount > 0
                ? $" Observed {overview.BitmapHeapScanCount} bitmap heap scan operators and Append in the plan."
                : ""),
            rationale,
            MapConfidence(relFinding?.Confidence ?? FindingConfidence.High),
            SuggestionPriorityLevel.High,
            nodeIds,
            relFinding is not null ? new[] { relFinding.FindingId } : Array.Empty<string>(),
            Array.Empty<string>(),
            new[]
            {
                "This is not a guarantee that indexes are optimal—only that a naive “add an index everywhere” story is usually wrong here.",
                "Chunk count, correlation, and post-scan sorts can dominate even when each chunk uses an index."
            },
            new[]
            {
                "Compare plans with a narrower time predicate and measure shared reads/temp blocks.",
                "Review whether continuous aggregates or pre-aggregation can shrink scanned volume for this query shape.",
                ValExplainBuffers
            },
            recommendedNextAction:
            "Narrow the time window or change aggregation shape first; only then consider another index experiment, measured across all touched chunks.",
            whyItMatters:
            "Per-chunk bitmap paths can already be indexed; total work is often dominated by how many chunks qualify and how rows are merged afterward."));

        list.Add(Make(
            scope: "ana",
            category: OptimizationSuggestionCategory.SortOrdering,
            action: SuggestedActionType.ChangeGroupingOrOrderingStrategy,
            title: "Review ORDER BY / GROUP BY alignment with chunk access",
            summary:
            "If the planner sorts or groups large rowsets after per-chunk bitmap access, try aligning sort keys with indexed order or reducing sort width.",
            details: "Chunked plans often spend time merging or sorting combined chunk outputs.",
            rationale,
            SuggestionConfidenceLevel.Medium,
            SuggestionPriorityLevel.Medium,
            nodeIds,
            relFinding is not null ? new[] { relFinding.FindingId } : Array.Empty<string>(),
            Array.Empty<string>(),
            new[] { "Reducing ORDER BY columns without changing results is not always possible—validate semantics." },
            new[]
            {
                "Check whether final sort spill or external sort disappears when the driving time predicate is tighter.",
                ValExplainBuffers
            },
            recommendedNextAction:
            "Try aligning ORDER BY keys with chunk-serving indexes, or reduce rows entering the final sort/merge after the Append.",
            whyItMatters:
            "Chunk unions often feed a late sort; fixing ordering upstream avoids sorting a synthetic cross-chunk rowset."));

        list.Add(Make(
            scope: "ana",
            category: OptimizationSuggestionCategory.ObserveBeforeChange,
            action: SuggestedActionType.ValidateWithExplainAnalyze,
            title: "Validate any index experiment against chunk fan-out",
            summary:
            "If you still test an index, measure whether it reduces total shared reads and temp IO across all touched chunks—not only a single operator.",
            details: "EXPLAIN should be run on representative data volume and time windows.",
            rationale,
            SuggestionConfidenceLevel.Medium,
            SuggestionPriorityLevel.Medium,
            nodeIds,
            relFinding is not null ? new[] { relFinding.FindingId } : Array.Empty<string>(),
            Array.Empty<string>(),
            new[] { "A locally faster scan can be offset if more chunks become eligible or sort merge costs rise." },
            new[]
            {
                "Capture buffers and timing with both narrow and wide windows.",
                ValExplainBuffers
            },
            recommendedNextAction:
            "If you test an index, compare shared reads and temp I/O for both narrow and representative wide windows on plan B.",
            whyItMatters:
            "A win on one chunk window can disappear when more chunks qualify or when sort/merge costs rise."));

    }

    private static void AddSeqScanIndexExperiment(
        List<OptimizationSuggestion> list,
        AnalysisFinding f,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        var nodeId = f.NodeIds?.FirstOrDefault();
        if (nodeId is null || !byId.TryGetValue(nodeId, out var n)) return;
        var rel = n.Node.RelationName ?? "relation";
        var filterHint = string.IsNullOrWhiteSpace(n.Node.Filter) ? "" : " Match filtering predicates when drafting a candidate index.";

        list.Add(Make(
            scope: "ana",
            category: OptimizationSuggestionCategory.IndexExperiment,
            action: SuggestedActionType.CreateIndexCandidate,
            title: $"Consider an index experiment for Seq Scan on {rel}",
            summary:
            $"The plan spends meaningful time or reads on a sequential scan of `{rel}`.{filterHint} Validate with EXPLAIN (ANALYZE, BUFFERS) before keeping any new index.",
            details: f.Explanation,
            $"Finding `{f.RuleId}`: {f.Summary}",
            MapConfidence(f.Confidence),
            MapPriority(f.Severity),
            new[] { nodeId },
            new[] { f.FindingId },
            Array.Empty<string>(),
            new[]
            {
                "The tool suggests investigation, not a guaranteed winning index definition.",
                "Low-selectivity predicates may not benefit from another btree."
            },
            new[]
            {
                ValExplainBuffers,
                "Confirm the planner stops using the costly seq scan or that runtime and reads improve materially."
            },
            recommendedNextAction:
            $"Draft a btree (or appropriate) index on `{rel}` that matches the scan’s filter and measure the plan with EXPLAIN (ANALYZE, BUFFERS).",
            whyItMatters:
            "Sequential scans on large relations often dominate I/O; an index is not always right, but it is the standard experiment when selectivity is favorable.",
            targetDisplayLabel: HumanLabel(nodeId, byId)));
    }

    private static void AddPotentialIndexing(
        List<OptimizationSuggestion> list,
        AnalysisFinding f,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        var nodeId = f.NodeIds?.FirstOrDefault();
        var target = nodeId is not null && byId.TryGetValue(nodeId, out var n)
            ? n.Node.RelationName ?? n.Node.NodeType ?? "node"
            : "hotspot";

        list.Add(Make(
            scope: "ana",
            category: OptimizationSuggestionCategory.IndexExperiment,
            action: SuggestedActionType.CreateIndexCandidate,
            title: $"Investigate index support near {target}",
            summary: f.Suggestion,
            details: f.Explanation,
            $"Finding `{f.RuleId}`: {f.Summary}",
            MapConfidence(f.Confidence),
            MapPriority(f.Severity),
            nodeId is not null ? new[] { nodeId } : Array.Empty<string>(),
            new[] { f.FindingId },
            Array.Empty<string>(),
            new[] { "Correlations and data skew can make textbook indexes ineffective." },
            new[] { ValExplainBuffers, "Check whether rows removed by filters move as expected after changes." },
            recommendedNextAction:
            "Prototype an index whose leading columns match the hotspot predicates, then confirm filter rows removed and shared reads move the right direction.",
            whyItMatters:
            "When the planner already suspects indexing, validating predicate↔index alignment is faster than guessing join or sort fixes.",
            targetDisplayLabel: nodeId is not null ? HumanLabel(nodeId, byId) : null));
    }

    private static void AddIndexStillHeavy(
        List<OptimizationSuggestion> list,
        AnalysisFinding f,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId,
        bool chunkedWorkload)
    {
        var nodeId = f.NodeIds?.FirstOrDefault();
        if (nodeId is null || !byId.TryGetValue(nodeId, out var n)) return;
        var ix = n.Node.IndexName ?? "existing index";

        list.Add(Make(
            scope: "ana",
            category: OptimizationSuggestionCategory.IndexExperiment,
            action: SuggestedActionType.ReviewExistingIndex,
            title: $"Review index design for `{ix}` (path still read-heavy)",
            summary:
            "An index scan is in use but heap fetches, recheck lossiness, or read share remain high. Consider selectivity, composite column order, and covering (index-only) opportunities.",
            details: f.Explanation,
            $"Finding `{f.RuleId}`: {f.Summary}",
            MapConfidence(f.Confidence),
            MapPriority(f.Severity),
            new[] { nodeId },
            new[] { f.FindingId },
            new[] { nodeId },
            new[]
            {
                "Another index is not always the fix—sometimes the predicate cannot be answered tightly from the index.",
                chunkedWorkload ? "Under chunked bitmap workloads, total scanned volume across chunks may dominate." : ""
            }.Where(s => !string.IsNullOrWhiteSpace(s)).ToArray(),
            new[]
            {
                ValExplainBuffers,
                "Compare shared read blocks and heap fetches before vs after any index or query change."
            },
            recommendedNextAction:
            "Re-check whether heap fetches, recheck lossiness, and shared reads drop after column reorder, covering columns, or predicate tightening.",
            whyItMatters:
            "An index that cannot answer the predicate tightly still visits the heap often; the fix may be shape or column order, not ‘more indexes’.",
            targetDisplayLabel: HumanLabel(nodeId, byId)));
    }

    private static void AddFromIndexInsight(
        List<OptimizationSuggestion> list,
        PlanIndexInsight insight,
        IReadOnlyList<AnalysisFinding> findings,
        bool chunkedWorkload,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        if (insight.SignalKinds.Contains(IndexSignalAnalyzer.SignalMissingIndexInvestigation))
        {
            if (chunkedWorkload && insight.AccessPathFamily == IndexAccessPathTokens.SeqScan)
                return;

            if (!byId.TryGetValue(insight.NodeId, out var n)) return;
            var rel = insight.RelationName ?? n.Node.RelationName ?? "relation";
            var filter = n.Node.Filter;
            var filterLine = string.IsNullOrWhiteSpace(filter) ? "" : $" Predicate context: `{Truncate(filter, 120)}`.";

            list.Add(Make(
                scope: "ana",
                category: OptimizationSuggestionCategory.IndexExperiment,
                action: SuggestedActionType.CreateIndexCandidate,
                title: $"Index experiment on filtering columns for {rel}",
                summary:
                $"Consider testing an index aligned with filters or join keys used by {insight.NodeType ?? "scan"} on `{rel}`.{filterLine} Validate with EXPLAIN (ANALYZE, BUFFERS) before keeping it.",
                details: insight.Headline,
                "Index insight signal: missingIndexInvestigation.",
                SuggestionConfidenceLevel.Medium,
                SuggestionPriorityLevel.Medium,
                new[] { insight.NodeId },
                RelatedFindingsForNode(findings, insight.NodeId),
                new[] { insight.NodeId },
                new[]
                {
                    "This is an investigation lead, not a guaranteed winning index.",
                    chunkedWorkload ? "Chunked hypertable queries may need window and shape changes more than another per-chunk index." : ""
                }.Where(s => !string.IsNullOrWhiteSpace(s)).ToArray(),
                new[]
                {
                    ValExplainBuffers,
                    "Verify that rows removed by filter actually improve after the experiment."
                },
                recommendedNextAction:
                $"Sketch an index on `{rel}` aligned with the filters/join keys driving this scan, then validate with EXPLAIN (ANALYZE, BUFFERS).",
                whyItMatters:
                "Missing-index signals are leads: confirming filter selectivity and read reduction matters more than the index definition you first try.",
                targetDisplayLabel: HumanLabel(insight.NodeId, byId)));
        }

        if (insight.SignalKinds.Contains(IndexSignalAnalyzer.SignalIndexPathStillCostly))
        {
            AddIndexStillHeavyFromInsight(list, insight, findings, chunkedWorkload, byId);
        }

        if (insight.SignalKinds.Contains(IndexSignalAnalyzer.SignalSortOrderSupportOpportunity))
        {
            AddSortFromInsight(list, insight, findings, byId);
        }

        if (insight.SignalKinds.Contains(IndexSignalAnalyzer.SignalJoinInnerIndexSupport))
        {
            AddNlFromInsight(list, insight, findings, byId);
        }
    }

    private static void AddIndexStillHeavyFromInsight(
        List<OptimizationSuggestion> list,
        PlanIndexInsight insight,
        IReadOnlyList<AnalysisFinding> findings,
        bool chunkedWorkload,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        if (findings.Any(f => f.RuleId.Equals("R.index-access-still-heavy", StringComparison.OrdinalIgnoreCase) &&
                              f.NodeIds?.Contains(insight.NodeId) == true))
            return;

        byId.TryGetValue(insight.NodeId, out var n);
        var ix = insight.IndexName ?? n?.Node.IndexName ?? "index";

        list.Add(Make(
            scope: "ana",
            category: OptimizationSuggestionCategory.IndexExperiment,
            action: SuggestedActionType.ReviewExistingIndex,
            title: $"Review `{ix}` — index path still costly",
            summary: insight.Headline,
            details: string.Join("; ", insight.Facts.Select(kv => $"{kv.Key}={kv.Value}")),
            "Index insight: indexPathStillCostly.",
            SuggestionConfidenceLevel.Medium,
            SuggestionPriorityLevel.Medium,
            new[] { insight.NodeId },
            RelatedFindingsForNode(findings, insight.NodeId),
            new[] { insight.NodeId },
            new[]
            {
                "Covering or column reorder may help—or the predicate may resist index-only plans.",
                chunkedWorkload ? "Chunk fan-out can inflate total reads even when each step uses an index." : ""
            }.Where(s => !string.IsNullOrWhiteSpace(s)).ToArray(),
            new[]
            {
                "Compare heap fetches and shared reads after any index definition tweak; index-only paths are not automatic.",
                ValExplainBuffers
            },
            recommendedNextAction:
            "Inspect whether composite column order or covering columns removes heap hits; pair that with buffer evidence from EXPLAIN.",
            whyItMatters:
            "High read volume on an index scan usually means the index is not selective enough or cannot satisfy the projection.",
            targetDisplayLabel: HumanLabel(insight.NodeId, byId)));
    }

    private static void AddSortFromInsight(
        List<OptimizationSuggestion> list,
        PlanIndexInsight insight,
        IReadOnlyList<AnalysisFinding> findings,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        if (findings.Any(f => f.RuleId.Equals("K.sort-cost-concern", StringComparison.OrdinalIgnoreCase) &&
                              f.NodeIds?.Contains(insight.NodeId) == true))
            return;

        byId.TryGetValue(insight.NodeId, out var n);
        var keys = n?.Node.SortKey;

        list.Add(Make(
            scope: "ana",
            category: OptimizationSuggestionCategory.SortOrdering,
            action: SuggestedActionType.ChangeGroupingOrOrderingStrategy,
            title: "Test index order support for expensive sort",
            summary:
            string.IsNullOrWhiteSpace(keys)
                ? "A sort node is costly or spilling; consider whether an index can deliver presorted order for the same keys."
                : $"Sort keys include `{Truncate(keys, 160)}`; consider whether a supporting index can avoid a large sort or spill.",
            details: insight.Headline,
            "Index insight: sortOrderSupportOpportunity.",
            SuggestionConfidenceLevel.Medium,
            SuggestionPriorityLevel.Medium,
            new[] { insight.NodeId },
            RelatedFindingsForNode(findings, insight.NodeId),
            new[] { insight.NodeId },
            new[] { "Removing ORDER BY is only valid when semantics allow." },
            new[]
            {
                "Confirm whether sort spill disappears or runtime drops meaningfully.",
                ValExplainBuffers
            },
            recommendedNextAction:
            string.IsNullOrWhiteSpace(keys)
                ? "Measure rows entering the sort and trial an index that can emit rows in the required order."
                : $"Trial an index that supports `{Truncate(keys!, 80)}` in scan order so the sort node shrinks or disappears.",
            whyItMatters:
            "Presorted access avoids CPU and temp files for large sorts; it is usually preferable to raising work_mem without reducing rows.",
            targetDisplayLabel: HumanLabel(insight.NodeId, byId)));
    }

    private static void AddNlFromInsight(
        List<OptimizationSuggestion> list,
        PlanIndexInsight insight,
        IReadOnlyList<AnalysisFinding> findings,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        if (findings.Any(f => f.RuleId.Equals("Q.nl-inner-index-support", StringComparison.OrdinalIgnoreCase)))
            return;

        byId.TryGetValue(insight.NodeId, out _);
        var innerRel = insight.RelationName ?? "inner side";

        list.Add(Make(
            scope: "ana",
            category: OptimizationSuggestionCategory.JoinStrategy,
            action: SuggestedActionType.ReviewJoinShape,
            title: $"Nested loop inner side: better index support on {innerRel}?",
            summary:
            "The inner side of a nested loop repeats work; investigate whether a tighter index matches the join predicate and reduces repeated heap access.",
            details: insight.Headline,
            "Index insight: joinInnerIndexSupport.",
            SuggestionConfidenceLevel.Medium,
            SuggestionPriorityLevel.Medium,
            new[] { insight.NodeId },
            RelatedFindingsForNode(findings, insight.NodeId),
            new[] { insight.NodeId },
            new[] { "Sometimes a hash/merge join is preferable if row counts mislead the planner—validate with evidence." },
            new[]
            {
                "Compare alternative plans after a focused index experiment.",
                ValExplainBuffers
            },
            recommendedNextAction:
            $"Add or tighten an index on `{innerRel}` so each inner probe does less heap work for the join predicate.",
            whyItMatters:
            "Nested loops multiply inner cost by outer cardinality; a small inner improvement can dominate total runtime.",
            targetDisplayLabel: HumanLabel(insight.NodeId, byId)));
    }

    private static void AddSortSuggestion(
        List<OptimizationSuggestion> list,
        AnalysisFinding f,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        var nodeId = f.NodeIds?.FirstOrDefault();
        byId.TryGetValue(nodeId ?? "", out var n);
        var keys = n?.Node.SortKey;
        var human = HumanLabel(nodeId, byId);
        var shareText = f.Evidence.TryGetValue("exclusiveTimeShareOfPlan", out var sh) && sh is double d
            ? $" It accounts for about {d:P0} of the plan’s measured time."
            : "";

        var summary = string.IsNullOrWhiteSpace(keys)
            ? $"The sort at {human} is a major hotspot.{shareText} Reduce rows feeding the sort or test whether an index can supply ordering before tuning work_mem."
            : $"The sort at {human} is costly.{shareText} Keys include {Truncate(keys!, 160)}. See whether a supporting index can shrink or remove this sort.";

        list.Add(Make(
            scope: "ana",
            category: OptimizationSuggestionCategory.SortOrdering,
            action: SuggestedActionType.ChangeGroupingOrOrderingStrategy,
            title: "Try to eliminate or shrink this expensive sort",
            summary,
            details: $"{f.Explanation}\n\nOriginal finding summary: {f.Summary}",
            $"Finding `{f.RuleId}`: {f.Summary}",
            MapConfidence(f.Confidence),
            MapPriority(f.Severity),
            nodeId is not null ? new[] { nodeId } : Array.Empty<string>(),
            new[] { f.FindingId },
            Array.Empty<string>(),
            new[]
            {
                "work_mem changes are operational tuning—only consider after measuring spill and with workload-aware testing."
            },
            new[]
            {
                "Re-run EXPLAIN (ANALYZE, BUFFERS) and confirm the sort no longer spills to disk (or shrinks materially) after your change.",
                ValExplainBuffers
            },
            recommendedNextAction:
            string.IsNullOrWhiteSpace(keys)
                ? "Cut rows entering the sort (predicates, join order) or add an index-ordered path; measure spill bytes and timing."
                : "Prototype an index aligned with the ORDER BY / sort keys and compare sort method and disk usage in EXPLAIN output.",
            whyItMatters:
            "Large sorts distort memory use and can spill; fixing row volume or sort order at the source usually beats repeatedly raising work_mem.",
            targetDisplayLabel: human));
    }

    private static void AddNlInnerSuggestion(
        List<OptimizationSuggestion> list,
        AnalysisFinding f,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        var nodeId = f.NodeIds?.FirstOrDefault();
        byId.TryGetValue(nodeId ?? "", out var n);
        var innerHint = n?.ContextEvidence?.NestedLoop?.InnerNodeId is { } innerId && byId.TryGetValue(innerId, out var inner)
            ? inner.Node.RelationName ?? inner.Node.NodeType ?? innerId
            : "inner relation";

        list.Add(Make(
            scope: "ana",
            category: OptimizationSuggestionCategory.JoinStrategy,
            action: SuggestedActionType.CreateIndexCandidate,
            title: $"Nested loop inner access on {innerHint} may need tighter index support",
            summary:
            "The inner branch of this nested loop runs many times; if each probe is expensive, a better index on the inner predicate is usually the first experiment.",
            details: $"{f.Explanation}\n\nOriginal suggestion text: {f.Suggestion}",
            $"Finding `{f.RuleId}`: {f.Summary}",
            MapConfidence(f.Confidence),
            MapPriority(f.Severity),
            nodeId is not null ? new[] { nodeId } : Array.Empty<string>(),
            new[] { f.FindingId },
            Array.Empty<string>(),
            new[] { "High loop counts amplify any inner-side weakness—small improvements can matter." },
            new[]
            {
                "After an index trial, compare loops × inner time and shared reads on the inner node.",
                ValExplainBuffers
            },
            recommendedNextAction:
            $"Target `{innerHint}` with an index that matches the inner join/filter predicates, then re-measure nested-loop cost.",
            whyItMatters:
            "Nested-loop cost scales with outer rows; weak inner indexes show up as repeated heap access or bitmap churn.",
            targetDisplayLabel: nodeId is not null ? HumanLabel(nodeId, byId) : innerHint));
    }

    private static void AddStatisticsSuggestionsForPlan(
        List<OptimizationSuggestion> list,
        IReadOnlyList<AnalysisFinding> findings,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        var statFindings = findings.Where(x =>
                x.RuleId.Equals("G.potential-statistics-issue", StringComparison.OrdinalIgnoreCase) ||
                x.RuleId.Equals("A.row-misestimation", StringComparison.OrdinalIgnoreCase))
            .ToList();
        if (statFindings.Count == 0) return;
        if (statFindings.Count >= 2)
        {
            AddMergedStatisticsSuggestion(list, statFindings, byId);
            return;
        }

        AddSingleStatisticsSuggestion(list, statFindings[0], byId);
    }

    private static void AddMergedStatisticsSuggestion(
        List<OptimizationSuggestion> list,
        List<AnalysisFinding> statFindings,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        var nodeIds = statFindings
            .SelectMany(f => f.NodeIds ?? Array.Empty<string>())
            .Distinct(StringComparer.Ordinal)
            .OrderBy(x => x, StringComparer.Ordinal)
            .ToArray();
        var findingIds = statFindings.Select(f => f.FindingId).OrderBy(x => x, StringComparer.Ordinal).ToArray();
        var conf = statFindings.Select(f => MapConfidence(f.Confidence)).OrderByDescending(ConfidenceOrder).First();
        var pri = statFindings.Max(f => MapPriority(f.Severity));

        string TLabel()
        {
            if (nodeIds.Length == 0) return "Multiple plan nodes";
            if (nodeIds.Length <= 2) return string.Join(" · ", nodeIds.Select(id => HumanLabel(id, byId)));
            return $"{nodeIds.Length} nodes ({string.Join(", ", nodeIds.Take(2).Select(id => HumanLabel(id, byId)))}, …)";
        }

        var details = string.Join("\n", statFindings.Select(f => $"• `{f.RuleId}` — {f.Summary}"));

        list.Add(Make(
            scope: "ana",
            category: OptimizationSuggestionCategory.StatisticsMaintenance,
            action: SuggestedActionType.RefreshStatistics,
            title: "Planner estimates look unreliable—tighten statistics before big index or join changes",
            summary:
            "Multiple findings agree cardinality estimates do not match what executed. Run ANALYZE (and extended statistics where predicates correlate) before chasing speculative indexes.",
            details: details,
            rationale: string.Join(" ", findingIds.Select(id => $"`{id}`")),
            conf,
            pri,
            nodeIds,
            findingIds,
            Array.Empty<string>(),
            new[]
            {
                "Bad statistics can mimic an index problem; fix estimates before large DDL.",
                "Consider extended statistics when errors track specific column combinations."
            },
            new[]
            {
                "After ANALYZE, compare estimated vs actual rows on the join and scan nodes involved here.",
                "If misestimates remain on correlated filters, trial extended statistics on those column groups.",
                ValExplainBuffers
            },
            recommendedNextAction:
            "Run ANALYZE on the relations behind the worst mismatches, then re-run EXPLAIN (ANALYZE) and diff estimates vs actuals on the listed nodes.",
            whyItMatters:
            "Misestimated cardinalities steer join order, nested-loop choices, and memory; correcting the model often moves the plan more than a blind index.",
            targetDisplayLabel: TLabel(),
            isGroupedCluster: true));
    }

    private static void AddSingleStatisticsSuggestion(
        List<OptimizationSuggestion> list,
        AnalysisFinding f,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        var nodeId = f.NodeIds?.FirstOrDefault();
        var human = HumanLabel(nodeId, byId);
        var isRowMis = f.RuleId.StartsWith("A.", StringComparison.Ordinal);
        var title = isRowMis
            ? "Investigate why the planner badly underestimated row counts here"
            : f.Title;
        var summary = isRowMis
            ? $"Estimated rows diverged strongly from actuals at {human}. Verify ANALYZE freshness, predicate selectivity, and whether extended statistics are needed before large schema experiments."
            : f.Suggestion;

        list.Add(Make(
            scope: "ana",
            category: OptimizationSuggestionCategory.StatisticsMaintenance,
            action: SuggestedActionType.RefreshStatistics,
            title,
            summary,
            details: $"{f.Explanation}\n\nOriginal finding summary: {f.Summary}",
            $"Finding `{f.RuleId}`: {f.Summary}",
            MapConfidence(f.Confidence),
            isRowMis ? SuggestionPriorityLevel.High : MapPriority(f.Severity),
            nodeId is not null ? new[] { nodeId } : Array.Empty<string>(),
            new[] { f.FindingId },
            Array.Empty<string>(),
            new[]
            {
                "Bad statistics can mimic an index problem; fix estimates before large DDL.",
                "Consider extended statistics when planner errors correlate with column combinations."
            },
            new[]
            {
                "After ANALYZE, compare estimated vs actual rows on the join and scan nodes involved here.",
                ValExplainBuffers
            },
            recommendedNextAction:
            "Refresh statistics on the driving relations, then re-check EXPLAIN estimates vs actual rows on this subtree.",
            whyItMatters:
            "When estimates are off by orders of magnitude, the planner may pick the wrong join order or memory strategy; fixing stats is cheaper than guessing indexes.",
            targetDisplayLabel: string.IsNullOrEmpty(human) ? null : human));
    }

    private static void AddHashJoinSuggestion(
        List<OptimizationSuggestion> list,
        AnalysisFinding f,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        var nodeId = f.NodeIds?.FirstOrDefault();
        list.Add(Make(
            scope: "ana",
            category: OptimizationSuggestionCategory.JoinStrategy,
            action: SuggestedActionType.ReduceSortOrHashVolume,
            title: "Hash join memory pressure or spills",
            summary: f.Suggestion,
            details: f.Explanation,
            $"Finding `{f.RuleId}`: {f.Summary}",
            MapConfidence(f.Confidence),
            MapPriority(f.Severity),
            nodeId is not null ? new[] { nodeId } : Array.Empty<string>(),
            new[] { f.FindingId },
            Array.Empty<string>(),
            new[]
            {
                "work_mem is a session/cluster knob—treat increases as experiments, not defaults.",
                "Reducing build-side rows (predicate pushdown) often beats raising memory."
            },
            new[]
            {
                "Check hash batch and disk usage before vs after query rewrites.",
                ValExplainBuffers
            },
            recommendedNextAction:
            "Reduce build-side rows (stronger filters, better join order) or trial a controlled work_mem change while watching hash batch/disk counters.",
            whyItMatters:
            "Hash joins that spill trade CPU for disk; shrinking the build side usually beats repeatedly raising memory without measurement.",
            targetDisplayLabel: nodeId is not null ? HumanLabel(nodeId, byId) : null));
    }

    private static void AddMaterializeSuggestion(
        List<OptimizationSuggestion> list,
        AnalysisFinding f,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        var nodeId = f.NodeIds?.FirstOrDefault();
        list.Add(Make(
            scope: "ana",
            category: OptimizationSuggestionCategory.QueryRewrite,
            action: SuggestedActionType.ReviewMaterializeOrMemoize,
            title: "Materialize / memoize loops worth reviewing",
            summary: f.Suggestion,
            details: f.Explanation,
            $"Finding `{f.RuleId}`: {f.Summary}",
            MapConfidence(f.Confidence),
            SuggestionPriorityLevel.Medium,
            nodeId is not null ? new[] { nodeId } : Array.Empty<string>(),
            new[] { f.FindingId },
            Array.Empty<string>(),
            new[] { "May indicate repeated work that a rewrite or different join order could avoid." },
            new[]
            {
                "Capture whether memoize/materialize loops drop after rewriting duplicated subtrees or changing join order.",
                ValExplainBuffers
            },
            recommendedNextAction:
            "Inspect whether the same subtree is recomputed; consider rewriting to share results or changing join order to avoid repeated materialization.",
            whyItMatters:
            "Memoize/materialize nodes often flag quadratic or repeated work that indexes alone cannot fix.",
            targetDisplayLabel: nodeId is not null ? HumanLabel(nodeId, byId) : null));
    }

    private static void AddTempSortSpillFromNodes(List<OptimizationSuggestion> list, IReadOnlyList<AnalyzedPlanNode> nodes)
    {
        var byIdLocal = nodes.ToDictionary(x => x.NodeId, StringComparer.Ordinal);
        foreach (var n in nodes)
        {
            var sort = n.ContextEvidence?.Sort;
            if (sort is null) continue;
            var spill = sort.DiskUsageKb is > 0 ||
                        (sort.SortMethod?.Contains("external", StringComparison.OrdinalIgnoreCase) ?? false);
            if (!spill) continue;

            if (list.Any(s => s.TargetNodeIds.Contains(n.NodeId) &&
                              s.Category == OptimizationSuggestionCategory.SortOrdering))
                continue;

            list.Add(Make(
                scope: "ana",
                category: OptimizationSuggestionCategory.SortOrdering,
                action: SuggestedActionType.ReduceSortOrHashVolume,
                title: "Sort spill or external sort detected",
                summary:
                "Reduce sorted row volume (stronger predicates, fewer columns) or test index-delivered ordering. Treat work_mem tweaks as a measured operational follow-up, not a first resort.",
                details:
                $"sortMethod={sort.SortMethod ?? "n/a"}, diskUsageKb={sort.DiskUsageKb?.ToString() ?? "n/a"}, sortSpaceUsedKb={sort.SortSpaceUsedKb?.ToString() ?? "n/a"}",
                "Operator evidence on sort node.",
                SuggestionConfidenceLevel.High,
                SuggestionPriorityLevel.High,
                new[] { n.NodeId },
                Array.Empty<string>(),
                Array.Empty<string>(),
                new[] { "Increasing work_mem can hide symptoms without reducing total work." },
                new[]
                {
                    "Confirm spill disappears and compare buffers/timing after changes.",
                    ValExplainBuffers
                },
                recommendedNextAction:
                "Reduce rows or width entering the sort, or add an index-ordered path; only then revisit work_mem using EXPLAIN sort metrics.",
                whyItMatters:
                "External sorts are both slow and a signal that too many rows are being ordered; removing work beats hiding spill with memory.",
                targetDisplayLabel: HumanLabel(n.NodeId, byIdLocal)));
        }
    }

    private static void AddParallelSkewFromNodes(List<OptimizationSuggestion> list, IReadOnlyList<AnalyzedPlanNode> nodes)
    {
        var byIdLocal = nodes.ToDictionary(x => x.NodeId, StringComparer.Ordinal);
        foreach (var n in nodes)
        {
            var w = n.Node.Workers;
            if (w.Count < 2) continue;
            if (!PlanWorkerStatsHelper.SharedReadsClearlyUneven(w) && !PlanWorkerStatsHelper.TotalTimesClearlyUneven(w))
                continue;

            if (list.Any(s => s.SuggestedActionType == SuggestedActionType.MeasureWorkerSkew && s.TargetNodeIds.Contains(n.NodeId)))
                continue;

            list.Add(Make(
                scope: "ana",
                category: OptimizationSuggestionCategory.Parallelism,
                action: SuggestedActionType.MeasureWorkerSkew,
                title: "Check parallel worker balance on this node",
                summary:
                "Worker-level timings or shared reads differ enough to inspect skew. This is not proof parallelism is “broken”—it is a cue to validate effectiveness.",
                details: $"workers={w.Count}",
                "Uneven worker metrics on a parallel-aware operator.",
                SuggestionConfidenceLevel.Medium,
                SuggestionPriorityLevel.Low,
                new[] { n.NodeId },
                Array.Empty<string>(),
                Array.Empty<string>(),
                new[] { "Skew can be data-dependent; compare multiple executions." },
                new[]
                {
                    "Inspect per-worker rows and buffer counters in EXPLAIN (ANALYZE, BUFFERS) output.",
                    ValExplainBuffers
                },
                recommendedNextAction:
                "Compare per-worker actual rows and buffer counters; if skew is real, revisit data distribution or parallel thresholds for this query.",
                whyItMatters:
                "Uneven parallel work leaves some workers idle while others carry the query; fixing skew improves wall-clock time more than adding random indexes.",
                targetDisplayLabel: HumanLabel(n.NodeId, byIdLocal)));
        }
    }

    private static OptimizationSuggestion Make(
        string scope,
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
        bool isGroupedCluster = false)
    {
        var id = StableSuggestionId(scope, category, action, title, targetNodeIds, relatedFindingIds);
        return new OptimizationSuggestion(
            id,
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
            FamilyFor(category),
            recommendedNextAction,
            whyItMatters,
            targetDisplayLabel,
            isGroupedCluster,
            null,
            null,
            null);
    }

    private static string StableSuggestionId(
        string scope,
        OptimizationSuggestionCategory category,
        SuggestedActionType action,
        string title,
        IReadOnlyList<string> targetNodeIds,
        IReadOnlyList<string> relatedFindingIds)
    {
        var tn = string.Join(",", targetNodeIds.OrderBy(x => x, StringComparer.Ordinal));
        var rf = string.Join(",", relatedFindingIds.OrderBy(x => x, StringComparer.Ordinal));
        var raw = $"{scope}|{category}|{action}|{title}|{tn}|{rf}";
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)))[..16].ToLowerInvariant();
        return $"sg_{hash}";
    }

    private static IEnumerable<OptimizationSuggestion> DedupeAndRank(List<OptimizationSuggestion> list)
    {
        return list
            .GroupBy(s => s.SuggestionId)
            .Select(g => g.First())
            .OrderByDescending(s => PriorityOrder(s.Priority))
            .ThenByDescending(s => ConfidenceOrder(s.Confidence))
            .ThenBy(s => s.Title, StringComparer.Ordinal);
    }

    private static int PriorityOrder(SuggestionPriorityLevel p) => p switch
    {
        SuggestionPriorityLevel.Critical => 4,
        SuggestionPriorityLevel.High => 3,
        SuggestionPriorityLevel.Medium => 2,
        _ => 1
    };

    private static int ConfidenceOrder(SuggestionConfidenceLevel c) => c switch
    {
        SuggestionConfidenceLevel.High => 3,
        SuggestionConfidenceLevel.Medium => 2,
        _ => 1
    };

    private static SuggestionConfidenceLevel MapConfidence(FindingConfidence c) => c switch
    {
        FindingConfidence.High => SuggestionConfidenceLevel.High,
        FindingConfidence.Medium => SuggestionConfidenceLevel.Medium,
        _ => SuggestionConfidenceLevel.Low
    };

    private static SuggestionPriorityLevel MapPriority(FindingSeverity s) => s switch
    {
        FindingSeverity.Critical => SuggestionPriorityLevel.Critical,
        FindingSeverity.High => SuggestionPriorityLevel.High,
        FindingSeverity.Medium => SuggestionPriorityLevel.Medium,
        _ => SuggestionPriorityLevel.Low
    };

    private static IReadOnlyList<string> RelatedFindingsForNode(IReadOnlyList<AnalysisFinding> findings, string nodeId) =>
        findings.Where(f => f.NodeIds?.Contains(nodeId) == true).Select(f => f.FindingId).Take(6).ToArray();

    private static string Truncate(string s, int max)
    {
        if (string.IsNullOrEmpty(s) || s.Length <= max) return s;
        return s[..max] + "…";
    }
}
