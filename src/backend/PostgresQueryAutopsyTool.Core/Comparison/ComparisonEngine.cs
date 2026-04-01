using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Domain;
using PostgresQueryAutopsyTool.Core.OperatorEvidence;
using IndexSig = PostgresQueryAutopsyTool.Core.Analysis.IndexSignalAnalyzer;

namespace PostgresQueryAutopsyTool.Core.Comparison;

public sealed class ComparisonEngine
{
    private readonly NodeMappingEngine _mapping;

    public ComparisonEngine(NodeMappingEngine? mapping = null)
    {
        _mapping = mapping ?? new NodeMappingEngine();
    }

    public PlanComparisonResultV2 Compare(PlanAnalysisResult a, PlanAnalysisResult b, bool includeDiagnostics = false)
    {
        var mapper = includeDiagnostics
            ? new NodeMappingEngine(new NodeMappingEngine.Options(IncludeDiagnostics: true))
            : _mapping;

        var (matches, unmatchedA, unmatchedB, diagnostics) = mapper.Map(a.Nodes, b.Nodes);

        var byIdA = a.Nodes.ToDictionary(n => n.NodeId, StringComparer.Ordinal);
        var byIdB = b.Nodes.ToDictionary(n => n.NodeId, StringComparer.Ordinal);

        var deltas = matches
            .Select(m => BuildNodeDelta(m, byIdA[m.NodeIdA], byIdB[m.NodeIdB]))
            .ToArray();

        var improved = deltas
            .OrderBy(d => ScoreWorsen(d)) // more negative => improved
            .Take(8)
            .ToArray();

        var worsened = deltas
            .OrderByDescending(d => ScoreWorsen(d))
            .Take(8)
            .ToArray();

        var summary = BuildSummary(a, b);
        var findingsDiff = DiffFindings(a, b, matches);
        var indexComparison = IndexComparisonAnalyzer.Analyze(a, b, matches);
        var (findingsLinked, indexLinked) = FindingIndexDiffLinker.Apply(findingsDiff, indexComparison);

        var pairDetails = matches.Select(m =>
            BuildPairDetail(a, b, m, byIdA[m.NodeIdA], byIdB[m.NodeIdB], findingsLinked, indexLinked)).ToArray();

        var narrative = BuildNarrative(summary, improved, worsened, pairDetails, findingsLinked, indexLinked);

        return new PlanComparisonResultV2(
            ComparisonId: Guid.NewGuid().ToString("n"),
            PlanA: a,
            PlanB: b,
            Summary: summary,
            Matches: matches,
            UnmatchedNodeIdsA: unmatchedA,
            UnmatchedNodeIdsB: unmatchedB,
            NodeDeltas: deltas,
            TopImprovedNodes: improved,
            TopWorsenedNodes: worsened,
            PairDetails: pairDetails,
            FindingsDiff: findingsLinked,
            IndexComparison: indexLinked,
            Narrative: narrative,
            Diagnostics: diagnostics
        );
    }

    private static NodePairDetail BuildPairDetail(
        PlanAnalysisResult planA,
        PlanAnalysisResult planB,
        NodeMatch match,
        AnalyzedPlanNode a,
        AnalyzedPlanNode b,
        FindingsDiff findingsDiff,
        IndexComparisonSummary indexComparison)
    {
        var identity = new NodePairIdentity(
            NodeIdA: a.NodeId,
            NodeIdB: b.NodeId,
            NodeTypeA: a.Node.NodeType ?? "Unknown",
            NodeTypeB: b.Node.NodeType ?? "Unknown",
            RelationNameA: a.Node.RelationName,
            RelationNameB: b.Node.RelationName,
            IndexNameA: a.Node.IndexName,
            IndexNameB: b.Node.IndexName,
            JoinTypeA: a.Node.JoinType,
            JoinTypeB: b.Node.JoinType,
            DepthA: a.Metrics.Depth,
            DepthB: b.Metrics.Depth,
            MatchConfidence: match.Confidence,
            MatchScore: match.MatchScore,
            ScoreBreakdown: match.ScoreBreakdown,
            AccessPathFamilyA: IndexSig.AccessPathFamily(a.Node.NodeType),
            AccessPathFamilyB: IndexSig.AccessPathFamily(b.Node.NodeType));

        var raw = new NodePairRawFields(
            FilterA: a.Node.Filter,
            FilterB: b.Node.Filter,
            IndexCondA: a.Node.IndexCond,
            IndexCondB: b.Node.IndexCond,
            JoinFilterA: a.Node.JoinFilter,
            JoinFilterB: b.Node.JoinFilter,
            HashCondA: a.Node.HashCond,
            HashCondB: b.Node.HashCond,
            MergeCondA: a.Node.MergeCond,
            MergeCondB: b.Node.MergeCond,
            SortKeyA: a.Node.SortKey,
            SortKeyB: b.Node.SortKey,
            GroupKeyA: a.Node.GroupKey,
            GroupKeyB: b.Node.GroupKey,
            StrategyA: a.Node.Strategy,
            StrategyB: b.Node.Strategy,
            ParallelAwareA: a.Node.ParallelAware,
            ParallelAwareB: b.Node.ParallelAware,
            WorkersPlannedA: a.Node.WorkersPlanned,
            WorkersPlannedB: b.Node.WorkersPlanned,
            WorkersLaunchedA: a.Node.WorkersLaunched,
            WorkersLaunchedB: b.Node.WorkersLaunched,
            RowsRemovedByFilterA: a.Node.RowsRemovedByFilter,
            RowsRemovedByFilterB: b.Node.RowsRemovedByFilter,
            RowsRemovedByJoinFilterA: a.Node.RowsRemovedByJoinFilter,
            RowsRemovedByJoinFilterB: b.Node.RowsRemovedByJoinFilter,
            RowsRemovedByIndexRecheckA: a.Node.RowsRemovedByIndexRecheck,
            RowsRemovedByIndexRecheckB: b.Node.RowsRemovedByIndexRecheck,
            HeapFetchesA: a.Node.HeapFetches,
            HeapFetchesB: b.Node.HeapFetches,
            SortMethodA: a.Node.SortMethod,
            SortMethodB: b.Node.SortMethod,
            SortSpaceUsedKbA: a.Node.SortSpaceUsedKb,
            SortSpaceUsedKbB: b.Node.SortSpaceUsedKb,
            SortSpaceTypeA: a.Node.SortSpaceType,
            SortSpaceTypeB: b.Node.SortSpaceType,
            PresortedKeyA: a.Node.PresortedKey,
            PresortedKeyB: b.Node.PresortedKey,
            FullSortGroupsA: a.Node.FullSortGroups,
            FullSortGroupsB: b.Node.FullSortGroups,
            HashBucketsA: a.Node.HashBuckets,
            HashBucketsB: b.Node.HashBuckets,
            OriginalHashBucketsA: a.Node.OriginalHashBuckets,
            OriginalHashBucketsB: b.Node.OriginalHashBuckets,
            HashBatchesA: a.Node.HashBatches,
            HashBatchesB: b.Node.HashBatches,
            OriginalHashBatchesA: a.Node.OriginalHashBatches,
            OriginalHashBatchesB: b.Node.OriginalHashBatches,
            PeakMemoryUsageKbA: a.Node.PeakMemoryUsageKb,
            PeakMemoryUsageKbB: b.Node.PeakMemoryUsageKb,
            DiskUsageKbA: a.Node.DiskUsageKb,
            DiskUsageKbB: b.Node.DiskUsageKb,
            InnerUniqueA: a.Node.InnerUnique,
            InnerUniqueB: b.Node.InnerUnique,
            PartialModeA: a.Node.PartialMode,
            PartialModeB: b.Node.PartialMode,
            CacheKeyA: a.Node.CacheKey,
            CacheKeyB: b.Node.CacheKey,
            CacheHitsA: a.Node.CacheHits,
            CacheHitsB: b.Node.CacheHits,
            CacheMissesA: a.Node.CacheMisses,
            CacheMissesB: b.Node.CacheMisses,
            CacheEvictionsA: a.Node.CacheEvictions,
            CacheEvictionsB: b.Node.CacheEvictions,
            CacheOverflowsA: a.Node.CacheOverflows,
            CacheOverflowsB: b.Node.CacheOverflows);

        var metrics = new List<MetricDeltaDetail>
        {
            Metric("inclusiveActualTimeMs", a.Metrics.InclusiveActualTimeMs, b.Metrics.InclusiveActualTimeMs, betterWhenLower: true),
            Metric("exclusiveActualTimeMsApprox", a.Metrics.ExclusiveActualTimeMsApprox, b.Metrics.ExclusiveActualTimeMsApprox, betterWhenLower: true),
            Metric("subtreeTimeShare", a.Metrics.SubtreeTimeShare, b.Metrics.SubtreeTimeShare, betterWhenLower: true),
            Metric("sharedReadBlocks", a.Node.SharedReadBlocks, b.Node.SharedReadBlocks, betterWhenLower: true),
            Metric("subtreeSharedReadBlocks", a.Metrics.SubtreeSharedReadBlocks, b.Metrics.SubtreeSharedReadBlocks, betterWhenLower: true),
            Metric("bufferShareOfPlan", a.Metrics.BufferShareOfPlan, b.Metrics.BufferShareOfPlan, betterWhenLower: true),
            Metric("actualRowsTotal", a.Metrics.ActualRowsTotal, b.Metrics.ActualRowsTotal, betterWhenLower: null),
            Metric("estimatedRowsPerLoop", a.Node.PlanRows, b.Node.PlanRows, betterWhenLower: null),
            Metric("rowEstimateRatio", a.Metrics.RowEstimateRatio, b.Metrics.RowEstimateRatio, betterWhenLower: null),
            Metric("rowEstimateFactor", a.Metrics.RowEstimateFactor, b.Metrics.RowEstimateFactor, betterWhenLower: true),
            Metric("loops", a.Node.ActualLoops, b.Node.ActualLoops, betterWhenLower: null),
            Metric("subtreeNodeCount", (double)a.Metrics.SubtreeNodeCount, (double)b.Metrics.SubtreeNodeCount, betterWhenLower: null),
        };

        var findingsA = planA.Findings.Where(f => (f.NodeIds ?? Array.Empty<string>()).Contains(a.NodeId)).ToArray();
        var findingsB = planB.Findings.Where(f => (f.NodeIds ?? Array.Empty<string>()).Contains(b.NodeId)).ToArray();
        var relatedDiff = findingsDiff.Items.Where(i => i.NodeIdA == a.NodeId || i.NodeIdB == b.NodeId).ToArray();

        var indexCues = IndexComparisonAnalyzer.IndexDeltaCuesForPair(a.NodeId, b.NodeId, identity, indexComparison);
        var corroboration = FindingIndexDiffLinker.CorroborationCuesForPair(a.NodeId, b.NodeId, findingsDiff, indexComparison);

        return new NodePairDetail(
            Identity: identity,
            RawFields: raw,
            ContextEvidenceA: a.ContextEvidence,
            ContextEvidenceB: b.ContextEvidence,
            ContextDiff: ContextEvidenceDiffSummarizer.Diff(a.ContextEvidence, b.ContextEvidence),
            Metrics: metrics,
            Findings: new PairFindingsView(findingsA, findingsB, relatedDiff),
            IndexDeltaCues: indexCues,
            CorroborationCues: corroboration);
    }

    private static MetricDeltaDetail Metric(string key, double? a, double? b, bool? betterWhenLower)
    {
        if (a is null || b is null)
            return new MetricDeltaDetail(key, a, b, null, null, DeltaDirection.NotApplicable);

        var delta = b.Value - a.Value;
        var pct = Math.Abs(a.Value) > 1e-9 ? (delta / a.Value) : (double?)null;

        var dir = DeltaDirection.Ambiguous;
        if (betterWhenLower is true)
            dir = Math.Abs(delta) < 1e-9 ? DeltaDirection.Neutral : (delta < 0 ? DeltaDirection.Improved : DeltaDirection.Worsened);
        else if (betterWhenLower is false)
            dir = Math.Abs(delta) < 1e-9 ? DeltaDirection.Neutral : (delta > 0 ? DeltaDirection.Improved : DeltaDirection.Worsened);
        else
            dir = Math.Abs(delta) < 1e-9 ? DeltaDirection.Neutral : DeltaDirection.Ambiguous;

        return new MetricDeltaDetail(key, a, b, delta, pct, dir);
    }

    private static MetricDeltaDetail Metric(string key, long? a, long? b, bool? betterWhenLower)
        => Metric(key, a is null ? null : (double)a.Value, b is null ? null : (double)b.Value, betterWhenLower);

    private static NodeDelta BuildNodeDelta(NodeMatch m, AnalyzedPlanNode a, AnalyzedPlanNode b)
    {
        return new NodeDelta(
            NodeIdA: a.NodeId,
            NodeIdB: b.NodeId,
            MatchScore: m.MatchScore,
            MatchConfidence: m.Confidence,
            NodeTypeA: a.Node.NodeType ?? "Unknown",
            NodeTypeB: b.Node.NodeType ?? "Unknown",
            RelationName: a.Node.RelationName ?? b.Node.RelationName,
            IndexName: a.Node.IndexName ?? b.Node.IndexName,
            InclusiveTimeMs: Delta(a.Metrics.InclusiveActualTimeMs, b.Metrics.InclusiveActualTimeMs),
            ExclusiveTimeMsApprox: Delta(a.Metrics.ExclusiveActualTimeMsApprox, b.Metrics.ExclusiveActualTimeMsApprox),
            SubtreeTimeShare: Delta(a.Metrics.SubtreeTimeShare, b.Metrics.SubtreeTimeShare),
            SharedReadBlocks: DeltaLongToDouble(a.Node.SharedReadBlocks, b.Node.SharedReadBlocks),
            SharedReadShare: Delta(a.Metrics.BufferShareOfPlan, b.Metrics.BufferShareOfPlan),
            RowEstimateFactor: Delta(a.Metrics.RowEstimateFactor, b.Metrics.RowEstimateFactor),
            ActualRowsTotal: Delta(a.Metrics.ActualRowsTotal, b.Metrics.ActualRowsTotal),
            Loops: DeltaLongToDouble(a.Node.ActualLoops, b.Node.ActualLoops)
        );
    }

    private static ComparisonSummary BuildSummary(PlanAnalysisResult a, PlanAnalysisResult b)
    {
        var rtA = a.Summary.RootInclusiveActualTimeMs;
        var rtB = b.Summary.RootInclusiveActualTimeMs;
        var rtDelta = (rtA is not null && rtB is not null) ? rtB.Value - rtA.Value : (double?)null;
        double? rtPct = (rtA is not null && rtA.Value > 0 && rtB is not null)
            ? (rtDelta!.Value / rtA.Value)
            : null;

        var rA = a.Nodes.First(n => n.NodeId == a.RootNodeId).Metrics.SubtreeSharedReadBlocks ?? 0;
        var rB = b.Nodes.First(n => n.NodeId == b.RootNodeId).Metrics.SubtreeSharedReadBlocks ?? 0;
        var rDelta = rB - rA;
        double? rPct = rA > 0 ? (double)rDelta / rA : null;

        return new ComparisonSummary(
            RuntimeMsA: rtA,
            RuntimeMsB: rtB,
            RuntimeDeltaMs: rtDelta,
            RuntimeDeltaPct: rtPct,
            SharedReadBlocksA: rA,
            SharedReadBlocksB: rB,
            SharedReadDeltaBlocks: rDelta,
            SharedReadDeltaPct: rPct,
            NodeCountA: a.Summary.TotalNodeCount,
            NodeCountB: b.Summary.TotalNodeCount,
            NodeCountDelta: b.Summary.TotalNodeCount - a.Summary.TotalNodeCount,
            MaxDepthA: a.Summary.MaxDepth,
            MaxDepthB: b.Summary.MaxDepth,
            MaxDepthDelta: b.Summary.MaxDepth - a.Summary.MaxDepth,
            SevereFindingsCountA: a.Summary.SevereFindingsCount,
            SevereFindingsCountB: b.Summary.SevereFindingsCount,
            SevereFindingsDelta: b.Summary.SevereFindingsCount - a.Summary.SevereFindingsCount
        );
    }

    private static FindingsDiff DiffFindings(PlanAnalysisResult a, PlanAnalysisResult b, IReadOnlyList<NodeMatch> matches)
    {
        var mapAtoB = matches.ToDictionary(m => m.NodeIdA, m => m.NodeIdB, StringComparer.Ordinal);
        var mapBtoA = matches.ToDictionary(m => m.NodeIdB, m => m.NodeIdA, StringComparer.Ordinal);

        // Anchor each finding to its primary node (first node id) for MVP mapping.
        var aItems = a.Findings.Select(f => new
        {
            Finding = f,
            AnchorA = (f.NodeIds ?? Array.Empty<string>()).FirstOrDefault()
        }).ToArray();

        var bItems = b.Findings.Select(f => new
        {
            Finding = f,
            AnchorB = (f.NodeIds ?? Array.Empty<string>()).FirstOrDefault()
        }).ToArray();

        // Index B by (ruleId, mappedAnchorFromA) so we can match across the mapping.
        var bIndex = new Dictionary<string, Queue<Domain.AnalysisFinding>>(StringComparer.Ordinal);
        foreach (var bi in bItems)
        {
            var key = $"{bi.Finding.RuleId}|{bi.AnchorB ?? "-"}";
            if (!bIndex.TryGetValue(key, out var q))
            {
                q = new Queue<Domain.AnalysisFinding>();
                bIndex[key] = q;
            }
            q.Enqueue(bi.Finding);
        }

        var items = new List<FindingDiffItem>();
        var usedB = new HashSet<string>(StringComparer.Ordinal);

        foreach (var ai in aItems)
        {
            var mappedAnchor = (ai.AnchorA is not null && mapAtoB.TryGetValue(ai.AnchorA, out var mb)) ? mb : null;
            var key = $"{ai.Finding.RuleId}|{mappedAnchor ?? "-"}";

            Domain.AnalysisFinding? matchedB = null;
            if (mappedAnchor is not null && bIndex.TryGetValue(key, out var queue) && queue.Count > 0)
                matchedB = queue.Dequeue();

            if (matchedB is null)
            {
                items.Add(new FindingDiffItem(
                    RuleId: ai.Finding.RuleId,
                    ChangeType: FindingChangeType.Resolved,
                    NodeIdA: ai.AnchorA,
                    NodeIdB: mappedAnchor,
                    SeverityA: ai.Finding.Severity,
                    SeverityB: null,
                    ConfidenceA: ai.Finding.Confidence,
                    ConfidenceB: null,
                    Title: ai.Finding.Title,
                    Summary: ai.Finding.Summary,
                    EvidenceA: ai.Finding.Evidence,
                    EvidenceB: new Dictionary<string, object?>(),
                    RelatedIndexDiffIndexes: Array.Empty<int>()));
                continue;
            }

            var idKey = matchedB.FindingId;
            usedB.Add(idKey);

            var change = CompareSeverity(ai.Finding.Severity, matchedB.Severity);
            items.Add(new FindingDiffItem(
                RuleId: ai.Finding.RuleId,
                ChangeType: change,
                NodeIdA: ai.AnchorA,
                NodeIdB: mappedAnchor,
                SeverityA: ai.Finding.Severity,
                SeverityB: matchedB.Severity,
                ConfidenceA: ai.Finding.Confidence,
                ConfidenceB: matchedB.Confidence,
                Title: matchedB.Title,
                Summary: matchedB.Summary,
                EvidenceA: ai.Finding.Evidence,
                EvidenceB: matchedB.Evidence,
                RelatedIndexDiffIndexes: Array.Empty<int>()));
        }

        // Remaining B findings are new (or unmapped).
        foreach (var bi in bItems)
        {
            if (usedB.Contains(bi.Finding.FindingId)) continue;
            items.Add(new FindingDiffItem(
                RuleId: bi.Finding.RuleId,
                ChangeType: FindingChangeType.New,
                NodeIdA: (bi.AnchorB is not null && mapBtoA.TryGetValue(bi.AnchorB, out var ma)) ? ma : null,
                NodeIdB: bi.AnchorB,
                SeverityA: null,
                SeverityB: bi.Finding.Severity,
                ConfidenceA: null,
                ConfidenceB: bi.Finding.Confidence,
                Title: bi.Finding.Title,
                Summary: bi.Finding.Summary,
                EvidenceA: new Dictionary<string, object?>(),
                EvidenceB: bi.Finding.Evidence,
                RelatedIndexDiffIndexes: Array.Empty<int>()));
        }

        // Rank diff findings: worsened/new first, then resolved, then improved.
        var ranked = items
            .OrderByDescending(i => i.ChangeType == FindingChangeType.Worsened ? 3 :
                                   i.ChangeType == FindingChangeType.New ? 2 :
                                   i.ChangeType == FindingChangeType.Resolved ? 1 : 0)
            .ThenByDescending(i => (int?)i.SeverityB ?? (int?)i.SeverityA ?? 0)
            .ToArray();

        return new FindingsDiff(ranked);
    }

    private static FindingChangeType CompareSeverity(FindingSeverity a, FindingSeverity b)
    {
        if ((int)b > (int)a) return FindingChangeType.Worsened;
        if ((int)b < (int)a) return FindingChangeType.Improved;
        return FindingChangeType.Unchanged;
    }

    private static string BuildNarrative(
        ComparisonSummary summary,
        IReadOnlyList<NodeDelta> improved,
        IReadOnlyList<NodeDelta> worsened,
        IReadOnlyList<NodePairDetail> pairDetails,
        FindingsDiff findingsDiff,
        IndexComparisonSummary indexComparison)
    {
        var sections = new List<string>();

        // 1) Overall shift
        {
            var overall = new List<string>();
            if (summary.RuntimeDeltaPct is not null)
            {
                var dir = summary.RuntimeDeltaPct.Value < 0 ? "faster" : "slower";
                overall.Add($"Overall runtime is {dir} by {Math.Abs(summary.RuntimeDeltaPct.Value):P0} (Δ {summary.RuntimeDeltaMs:F2}ms).");
            }
            else overall.Add("Overall runtime delta unavailable (missing ANALYZE timing fields).");

            if (summary.SharedReadDeltaPct is not null)
            {
                var dir = summary.SharedReadDeltaPct.Value < 0 ? "less" : "more";
                overall.Add($"Shared reads are {dir} by {Math.Abs(summary.SharedReadDeltaPct.Value):P0} (Δ {summary.SharedReadDeltaBlocks} blocks).");
            }
            else overall.Add("Shared read delta unavailable (missing BUFFERS fields).");

            sections.Add(string.Join(" ", overall));
        }

        // 2) Primary drivers: top worsened / improved pairs with evidence
        var driverLines = new List<string>();
        if (worsened.Count > 0)
        {
            var d = worsened[0];
            var p = FindPair(pairDetails, d.NodeIdA, d.NodeIdB);
            driverLines.Add("Primary regression:");
            driverLines.Add(FormatPairEvidence(p, d));
        }
        if (improved.Count > 0)
        {
            var d = improved[0];
            var p = FindPair(pairDetails, d.NodeIdA, d.NodeIdB);
            driverLines.Add("Primary improvement:");
            driverLines.Add(FormatPairEvidence(p, d));
        }
        if (driverLines.Count > 0)
            sections.Add(string.Join(" ", driverLines));

        // 2b) Index / access-path story (structured deltas; conservative wording)
        {
            var idx = new List<string>();
            var famShift = pairDetails
                .Select(p => (p.Identity.AccessPathFamilyA, p.Identity.AccessPathFamilyB))
                .Count(t => t.AccessPathFamilyA is not null && t.AccessPathFamilyB is not null &&
                            !string.Equals(t.AccessPathFamilyA, t.AccessPathFamilyB, StringComparison.Ordinal));
            if (famShift > 0)
                idx.Add($"{famShift} mapped pair(s) show a coarse access-path family change (for example seq scan vs index/bitmap).");

            foreach (var line in indexComparison.OverviewLines.Take(3))
                idx.Add(line);

            foreach (var d in indexComparison.InsightDiffs
                         .Where(i => i.Kind != IndexInsightDiffKind.Unchanged)
                         .Take(3))
                idx.Add($"{d.Kind}: {d.Summary}");

            if (indexComparison.EitherPlanSuggestsChunkedBitmapWorkload &&
                indexComparison.InsightDiffs.Any(i => i.Kind != IndexInsightDiffKind.Unchanged))
                idx.Add("Chunked bitmap access can remain dominant even when indexes exist per chunk; treat heavy I/O as a shape/selectivity problem, not only a missing-index story.");

            if (idx.Count > 0)
                sections.Add(string.Join(" ", idx));
        }

        // 3) Findings changes
        var changeLines = new List<string>();
        var majorNew = findingsDiff.Items.FirstOrDefault(i => i.ChangeType is FindingChangeType.New or FindingChangeType.Worsened);
        var majorResolved = findingsDiff.Items.FirstOrDefault(i => i.ChangeType == FindingChangeType.Resolved);

        if (majorNew is not null)
            changeLines.Add($"New/worsened finding: `{majorNew.RuleId}` ({majorNew.ChangeType}) near node `{majorNew.NodeIdB ?? majorNew.NodeIdA}`.");
        if (majorResolved is not null)
            changeLines.Add($"Resolved finding: `{majorResolved.RuleId}` near node `{majorResolved.NodeIdA ?? majorResolved.NodeIdB}`.");

        if (changeLines.Count > 0)
            sections.Add(string.Join(" ", changeLines));

        var linkedNarrative = FindingIndexDiffLinker.LinkedNarrativeLines(findingsDiff, indexComparison, maxLines: 2);
        if (linkedNarrative.Count > 0)
            sections.Add(string.Join(" ", linkedNarrative));
        else
        {
            var indexInsightResolved = indexComparison.InsightDiffs.Any(i => i.Kind == IndexInsightDiffKind.Resolved);
            var indexCorrelatedFinding = findingsDiff.Items.Any(i =>
                i.ChangeType == FindingChangeType.Resolved &&
                (i.RuleId.Contains("seq-scan", StringComparison.OrdinalIgnoreCase) ||
                 i.RuleId.Contains("potential-indexing", StringComparison.OrdinalIgnoreCase) ||
                 i.RuleId.Contains("index-access-still-heavy", StringComparison.OrdinalIgnoreCase) ||
                 i.RuleId.Contains("bitmap-recheck", StringComparison.OrdinalIgnoreCase) ||
                 i.RuleId.Contains("nl-inner-index", StringComparison.OrdinalIgnoreCase)));
            if (indexInsightResolved && indexCorrelatedFinding)
                sections.Add("Some resolved findings overlap with cleared or shifted index investigation cues—use as corroboration; mapping remains heuristic.");
        }

        // 4) Investigation guidance
        var guidance = new List<string>();
        if (worsened.Count > 0)
            guidance.Add("Start by inspecting the primary regression pair and its subtree deltas (time, shared reads, and estimate quality).");
        if (worsened.Count == 0 && improved.Count > 0)
            guidance.Add("This looks like a net improvement; confirm the primary improvement pair aligns with the same relation and predicates.");
        guidance.Add("Note: node correspondence is heuristic; treat low-confidence matches as leads, not identity.");
        sections.Add(string.Join(" ", guidance));

        return string.Join(Environment.NewLine + Environment.NewLine, sections);
    }

    private static NodePairDetail? FindPair(IReadOnlyList<NodePairDetail> pairs, string nodeIdA, string nodeIdB)
        => pairs.FirstOrDefault(p => p.Identity.NodeIdA == nodeIdA && p.Identity.NodeIdB == nodeIdB);

    private static string FormatPairEvidence(NodePairDetail? pair, NodeDelta d)
    {
        var nodeA = $"{d.NodeTypeA}";
        var nodeB = $"{d.NodeTypeB}";

        string? rel = pair?.Identity.RelationNameA ?? pair?.Identity.RelationNameB ?? d.RelationName;
        string relPart = rel is not null ? $" on `{rel}`" : string.Empty;

        var rewriteHint = pair is not null
            ? BuildRewriteHint(pair.Identity.NodeTypeA, pair.Identity.NodeTypeB, pair.Identity.MatchConfidence)
            : null;

        var timeDelta = d.InclusiveTimeMs.Delta is not null ? $"time Δ {d.InclusiveTimeMs.Delta.Value:F2}ms" : "time Δ n/a";
        var readDelta = d.SharedReadBlocks.Delta is not null ? $"reads Δ {d.SharedReadBlocks.Delta.Value:F0} blocks" : "reads Δ n/a";

        var conf = pair is not null ? $"{pair.Identity.MatchConfidence} (score {pair.Identity.MatchScore:F2})" : $"{d.MatchConfidence} (score {d.MatchScore:F2})";

        var line = $"{nodeA} → {nodeB}{relPart}; {timeDelta}, {readDelta}; match confidence {conf}.";
        if (!string.IsNullOrWhiteSpace(rewriteHint))
            line += $" {rewriteHint}";

        // Context diff hints (only when present; keep short and factual).
        if (pair?.ContextDiff is not null)
        {
            var cd = pair.ContextDiff;

            // Side-attributed join hints (only when evidence is explicitly side-scoped).
            if (cd.HashBuild?.Summary is not null &&
                (d.NodeTypeA.Contains("Hash Join", StringComparison.OrdinalIgnoreCase) ||
                 d.NodeTypeB.Contains("Hash Join", StringComparison.OrdinalIgnoreCase)))
            {
                line += $" Build side: {cd.HashBuild.Summary}.";
            }

            if (cd.NestedLoop?.InnerSideWaste?.Summary is not null &&
                (d.NodeTypeA.Contains("Nested Loop", StringComparison.OrdinalIgnoreCase) ||
                 d.NodeTypeB.Contains("Nested Loop", StringComparison.OrdinalIgnoreCase)))
            {
                line += $" Inner side: {cd.NestedLoop.InnerSideWaste.Summary}.";
            }

            // Generic context diff hints (bounded).
            if (cd.Highlights.Count > 0)
                line += $" Context: {string.Join("; ", cd.Highlights.Take(2))}.";
        }
        return line;
    }

    private static string? BuildRewriteHint(string nodeTypeA, string nodeTypeB, MatchConfidence confidence)
    {
        if (string.Equals(nodeTypeA, nodeTypeB, StringComparison.OrdinalIgnoreCase))
            return null;

        // Hedge more when confidence is low.
        var hedge = confidence == MatchConfidence.Low ? "appears to have" : "likely";

        if (nodeTypeA.Contains("Seq Scan", StringComparison.OrdinalIgnoreCase) &&
            (nodeTypeB.Contains("Index Scan", StringComparison.OrdinalIgnoreCase) ||
             nodeTypeB.Contains("Bitmap", StringComparison.OrdinalIgnoreCase)))
            return $"Rewrite hint: a sequential scan {hedge} been replaced by an index-based access path.";

        if (nodeTypeA.Contains("Nested Loop", StringComparison.OrdinalIgnoreCase) &&
            nodeTypeB.Contains("Hash Join", StringComparison.OrdinalIgnoreCase))
            return $"Rewrite hint: a nested loop join {hedge} shifted to a hash join in a similar structural location.";

        if (nodeTypeA.Contains("Sort", StringComparison.OrdinalIgnoreCase) &&
            nodeTypeB.Contains("Incremental Sort", StringComparison.OrdinalIgnoreCase))
            return $"Rewrite hint: sort {hedge} changed to incremental sort.";

        if (!nodeTypeA.Contains("Materialize", StringComparison.OrdinalIgnoreCase) &&
            nodeTypeB.Contains("Materialize", StringComparison.OrdinalIgnoreCase))
            return $"Rewrite hint: materialization {hedge} was introduced.";

        if (nodeTypeA.Contains("Materialize", StringComparison.OrdinalIgnoreCase) &&
            !nodeTypeB.Contains("Materialize", StringComparison.OrdinalIgnoreCase))
            return $"Rewrite hint: materialization {hedge} was removed.";

        return null;
    }

    private static double ScoreWorsen(NodeDelta d)
    {
        // Positive means worse. Weight runtime and I/O deltas.
        var score = 0.0;
        score += (d.InclusiveTimeMs.Delta ?? 0);
        score += (d.SharedReadBlocks.Delta ?? 0) * 0.001;
        score += (d.SubtreeTimeShare.Delta ?? 0) * 100;
        return score;
    }

    private static NumericDelta Delta(double? a, double? b)
    {
        if (a is null || b is null) return new NumericDelta(a, b, null, null);
        var delta = b.Value - a.Value;
        var pct = Math.Abs(a.Value) > 1e-9 ? (delta / a.Value) : (double?)null;
        return new NumericDelta(a, b, delta, pct);
    }

    private static NumericDelta DeltaLongToDouble(long? a, long? b)
    {
        double? da = a is null ? null : a.Value;
        double? db = b is null ? null : b.Value;
        return Delta(da, db);
    }
}

