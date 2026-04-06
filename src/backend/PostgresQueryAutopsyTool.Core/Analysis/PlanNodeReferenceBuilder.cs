using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using PostgresQueryAutopsyTool.Core.Comparison;
using PostgresQueryAutopsyTool.Core.Findings;

namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>Phase 61: derives human-readable anchors from plan evidence (bounded inference, hedged query hints).</summary>
public static class PlanNodeReferenceBuilder
{
    private static readonly Regex OrderByRx = new(@"\border\s+by\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex GroupByRx = new(@"\bgroup\s+by\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex TimeBucketRx = new(@"\btime_bucket\s*\(", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    public static PlanNodeHumanReference Build(AnalyzedPlanNode n, FindingEvaluationContext ctx) =>
        Build(n, ctx.ById, ctx.RootNodeId, queryText: null);

    public static PlanNodeHumanReference Build(
        AnalyzedPlanNode n,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId,
        string rootNodeId,
        string? queryText = null)
    {
        var type = n.Node.NodeType ?? "Unknown";
        var role = InferJoinChildRole(n, byId);
        var boundary = NearestBoundaryUnder(n, byId, rootNodeId);
        var queryHint = QueryHintForNode(n, type, queryText);
        var primary = PrimaryLabelCore(n, byId);
        return new PlanNodeHumanReference(n.NodeId, primary, role, boundary, queryHint);
    }

    /// <summary>Primary label only (no boundary/query); safe for parent snippets without recursive boundary walks.</summary>
    public static string PrimaryLabelCore(AnalyzedPlanNode n, IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        var type = n.Node.NodeType ?? "Unknown";
        var rel = n.Node.RelationName;
        var idx = n.Node.IndexName;
        var depth = n.Metrics.Depth;

        if (!string.IsNullOrWhiteSpace(rel) &&
            (type.Contains("Scan", StringComparison.OrdinalIgnoreCase) || type.Contains("Bitmap", StringComparison.OrdinalIgnoreCase)))
        {
            if (!string.IsNullOrWhiteSpace(idx) && type.Contains("Index", StringComparison.OrdinalIgnoreCase))
                return $"{type} on {rel} using {idx}";
            return $"{type} on {rel}";
        }

        if (type.Contains("Sort", StringComparison.OrdinalIgnoreCase))
        {
            var key = string.IsNullOrWhiteSpace(n.Node.SortKey) ? "plan sort keys" : TrimKey(n.Node.SortKey!, 56);
            var feed = n.ChildNodeIds.Count > 0 ? FirstDescendantRelation(n.ChildNodeIds[0], byId) : null;
            return feed is not null ? $"Sort on {feed} by {key}" : $"Sort by {key}";
        }

        if (type.Contains("Aggregate", StringComparison.OrdinalIgnoreCase) ||
            type.Contains("Group", StringComparison.OrdinalIgnoreCase))
        {
            var gk = string.IsNullOrWhiteSpace(n.Node.GroupKey) ? null : TrimKey(n.Node.GroupKey!, 48);
            var partial = n.Node.PartialMode;
            var prefix = partial is not null && partial.Contains("Partial", StringComparison.OrdinalIgnoreCase)
                ? "Partial aggregate"
                : partial is not null && partial.Contains("Final", StringComparison.OrdinalIgnoreCase)
                    ? "Final aggregate"
                    : "Aggregate";
            var primary = gk is not null ? $"{prefix} grouping on {gk}" : $"{prefix} ({type})";
            var childRel = n.ChildNodeIds.Count > 0 ? FirstDescendantRelation(n.ChildNodeIds[0], byId) : null;
            if (childRel is not null && !primary.Contains(childRel, StringComparison.OrdinalIgnoreCase))
                primary += $" over {childRel}";
            return primary;
        }

        if (type.Equals("Hash", StringComparison.OrdinalIgnoreCase))
        {
            if (!string.IsNullOrEmpty(n.ParentNodeId) &&
                byId.TryGetValue(n.ParentNodeId, out var hjParent) &&
                (hjParent.Node.NodeType ?? "").Contains("Hash Join", StringComparison.OrdinalIgnoreCase))
            {
                var (lRel, rRel) = JoinSideRelations(hjParent, byId);
                if (!string.IsNullOrWhiteSpace(lRel) && !string.IsNullOrWhiteSpace(rRel))
                    return $"Hash build table ({lRel} × {rRel})";
                return "Hash build table";
            }

            var hashFeed = n.ChildNodeIds.Count > 0 ? FirstDescendantRelation(n.ChildNodeIds[0], byId) : null;
            return hashFeed is not null ? $"Hash on {hashFeed}" : "Hash";
        }

        if (type.Contains("Join", StringComparison.OrdinalIgnoreCase) || type.Equals("Nested Loop", StringComparison.OrdinalIgnoreCase))
        {
            var (leftRel, rightRel) = JoinSideRelations(n, byId);
            if (!string.IsNullOrWhiteSpace(leftRel) && !string.IsNullOrWhiteSpace(rightRel))
                return $"{type} ({leftRel} × {rightRel})";
            if (!string.IsNullOrWhiteSpace(n.Node.JoinType))
                return $"{type} ({n.Node.JoinType})";
            return type;
        }

        if (type.Equals("CTE Scan", StringComparison.OrdinalIgnoreCase) ||
            type.Equals("Subquery Scan", StringComparison.OrdinalIgnoreCase))
        {
            var alias = string.IsNullOrWhiteSpace(n.Node.Alias) ? null : n.Node.Alias;
            return alias is not null ? $"{type} ({alias})" : $"{type} (subplan boundary)";
        }

        if (type.Equals("Append", StringComparison.OrdinalIgnoreCase))
            return "Append (chunk/union-style fan-out)";

        if (type.Contains("Gather", StringComparison.OrdinalIgnoreCase))
        {
            var under = n.ChildNodeIds.Count > 0 ? FirstMeaningfulChildType(n.ChildNodeIds[0], byId) : null;
            var aggHint = under is not null && under.Contains("Aggregate", StringComparison.OrdinalIgnoreCase)
                ? " above partial aggregate branch"
                : "";
            return type.Contains("Merge", StringComparison.OrdinalIgnoreCase)
                ? $"Gather Merge{aggHint}"
                : $"Gather{aggHint}";
        }

        if (type.Equals("Materialize", StringComparison.OrdinalIgnoreCase) || type.Equals("Memoize", StringComparison.OrdinalIgnoreCase))
            return $"{type} (intermediate cache)";

        if (!string.IsNullOrWhiteSpace(rel))
            return $"{type} on {rel}";

        return $"{type} (depth {depth})";
    }

    public static string DisplayLine(PlanNodeHumanReference r)
    {
        var parts = new List<string> { r.PrimaryLabel };
        if (!string.IsNullOrWhiteSpace(r.RoleInPlan))
            parts.Add(r.RoleInPlan);
        if (!string.IsNullOrWhiteSpace(r.BoundaryUnder))
            parts.Add(r.BoundaryUnder);
        var core = string.Join(" — ", parts);
        if (!string.IsNullOrWhiteSpace(r.QueryCorrespondenceHint))
            return $"{core}. {r.QueryCorrespondenceHint}";
        return core;
    }

    /// <summary>Safe label when only an id is known; avoids exposing <c>root.*</c> paths as primary copy.</summary>
    public static string SafePrimary(string? nodeId, FindingEvaluationContext ctx)
    {
        if (string.IsNullOrEmpty(nodeId))
            return "this plan";
        if (!ctx.ById.TryGetValue(nodeId, out var n))
            return LooksLikePlannerPath(nodeId) ? "an operator in this plan" : nodeId;
        return Build(n, ctx).PrimaryLabel;
    }

    public static string SafePrimary(string? nodeId, IReadOnlyDictionary<string, AnalyzedPlanNode> byId, string rootNodeId)
    {
        if (string.IsNullOrEmpty(nodeId))
            return "this plan";
        if (!byId.TryGetValue(nodeId, out var n))
            return LooksLikePlannerPath(nodeId) ? "an operator in this plan" : nodeId;
        return Build(n, byId, rootNodeId).PrimaryLabel;
    }

    public static string PairHumanLabel(
        AnalyzedPlanNode a,
        AnalyzedPlanNode b,
        FindingEvaluationContext ctxA,
        FindingEvaluationContext ctxB,
        MatchConfidence? mappingConfidence = null)
    {
        var la = DisplayLine(Build(a, ctxA));
        var lb = DisplayLine(Build(b, ctxB));
        var baseLabel = $"{la} → {lb}";
        if (mappingConfidence is null)
            return baseLabel;
        var shortSuffix = PairContinuityShortSuffix(a, b, ctxA, ctxB, mappingConfidence.Value);
        return shortSuffix is null ? baseLabel : $"{baseLabel} · {shortSuffix}";
    }

    private static bool GroupKeysLooselyMatch(string? x, string? y)
    {
        if (string.IsNullOrWhiteSpace(x) || string.IsNullOrWhiteSpace(y))
            return false;
        var nx = string.Join(" ", x.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).ToLowerInvariant();
        var ny = string.Join(" ", y.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).ToLowerInvariant();
        return nx == ny;
    }

    /// <summary>Structured continuity (hint + stable kind + outcome) for compare pair readouts.</summary>
    public static RegionContinuityData? TryPairRegionContinuity(
        AnalyzedPlanNode a,
        AnalyzedPlanNode b,
        FindingEvaluationContext ctxA,
        FindingEvaluationContext ctxB,
        MatchConfidence mappingConfidence,
        string? queryTextA = null,
        string? queryTextB = null)
    {
        static RegionContinuityData R(string hint, string kindKey, ContinuityOutcome o) => new(hint, kindKey, o);

        if (mappingConfidence < MatchConfidence.Medium)
            return null;

        var typeA = a.Node.NodeType ?? "";
        var typeB = b.Node.NodeType ?? "";

        static bool IsScanFamily(string t) =>
            t.Contains("Scan", StringComparison.OrdinalIgnoreCase) ||
            t.Contains("Bitmap", StringComparison.OrdinalIgnoreCase);

        static bool IsAggregateFamily(string t) =>
            t.Contains("Aggregate", StringComparison.OrdinalIgnoreCase);

        const string partialWin =
            " Partial win: access or ordering may have improved while the same output-shaping responsibility still matters—follow timing and buffers on feeds, siblings, and parents, not only this operator.";

        // Sort → scan family on same table: ordering responsibility continuity (structured column match when available).
        if (typeA.Contains("Sort", StringComparison.OrdinalIgnoreCase) &&
            IsScanFamily(typeB) &&
            a.ChildNodeIds is { Count: > 0 } &&
            FirstDescendantRelation(a.ChildNodeIds[0], ctxA.ById) is { } relFeed &&
            string.Equals(relFeed, b.Node.RelationName, StringComparison.OrdinalIgnoreCase))
        {
            var ord = ClassifyOrderingContinuity(
                a.Node.SortKey,
                b.Node.IndexCond,
                b.Node.PresortedKey,
                queryTextA,
                queryTextB);
            if (ord == OrderingContinuityEvidence.Strong)
            {
                return R(
                    $"Strong ordering evidence: same ordering region on `{relFeed}`—plan A materializes order via an explicit Sort; plan B’s access path carries index/presorted fields that line up with those sort keys, so the Sort step likely folded into traversal. Residual cost may still sit in index range I/O, heap fetches, bitmap recheck, or parents if row volume stays large.{partialWin}",
                    "ordering.strong",
                    ContinuityOutcome.Improved);
            }

            if (ord == OrderingContinuityEvidence.Weak)
            {
                return R(
                    $"Same ordering region on `{relFeed}`: plan A materializes order via an explicit Sort; plan B uses a different access path with a plausible (token-level) ordering link—confirm with the query text and whether top-level sort/temp work actually dropped. Token-level ordering link.{partialWin}",
                    "ordering.weak",
                    ContinuityOutcome.Mixed);
            }

            if (ord == OrderingContinuityEvidence.QueryAssisted)
            {
                return R(
                    $"Same ordering region on `{relFeed}`: planner JSON shows a weak ordering link, but the captured SQL shows an ORDER BY that lines up with the sort keys—treat this as a cautious ordering tie-breaker and still verify sort/temp I/O disappeared.{partialWin}",
                    "ordering.queryText",
                    ContinuityOutcome.Mixed);
            }
        }

        var relA = a.Node.RelationName;
        var relB = b.Node.RelationName;
        if (!string.IsNullOrWhiteSpace(relA) &&
            string.Equals(relA, relB, StringComparison.OrdinalIgnoreCase) &&
            IsScanFamily(typeA) &&
            IsScanFamily(typeB))
        {
            static bool Seq(string t) => t.Contains("Seq", StringComparison.OrdinalIgnoreCase) && t.Contains("Scan", StringComparison.OrdinalIgnoreCase);
            static bool BitmapHeap(string t) => t.Contains("Bitmap Heap", StringComparison.OrdinalIgnoreCase);
            static bool PlainIndex(string t) => t.Equals("Index Scan", StringComparison.OrdinalIgnoreCase);
            static bool IndexOnly(string t) =>
                t.Contains("Index Only", StringComparison.OrdinalIgnoreCase) &&
                t.Contains("Scan", StringComparison.OrdinalIgnoreCase);
            static bool IndexBacked(string t) => PlainIndex(t) || IndexOnly(t);

            // Seq Scan ↔ Bitmap Heap Scan
            if (Seq(typeA) && BitmapHeap(typeB))
                return R(
                    $"Same relation ({relA}): plan A used a sequential scan; plan B probes rows through a bitmap heap path on the same table—often a selectivity shift, not only an improvement.{partialWin}",
                    "access.seqToBitmap",
                    ContinuityOutcome.Mixed);
            if (Seq(typeB) && BitmapHeap(typeA))
                return R(
                    $"Same relation ({relA}): plan B returned to a sequential scan where A used a bitmap heap path—regression toward full-table reads; confirm statistics, predicates, and cost settings.{partialWin}",
                    "access.seqVsBitmap.regression",
                    ContinuityOutcome.Regressed);

            // Bitmap Heap ↔ Index Scan / Index Only Scan
            if (BitmapHeap(typeA) && IndexBacked(typeB))
                return R(
                    $"Same relation ({relA}): plan B uses a direct index-backed scan where A went through a bitmap heap stack—heap work and recheck often shrink, but verify row volume, visibility, and whether parents above became the new bottleneck.{partialWin}",
                    "access.bitmapToIndex",
                    ContinuityOutcome.Improved);
            if (BitmapHeap(typeB) && IndexBacked(typeA))
                return R(
                    $"Same relation ({relA}): plan B moved to a bitmap heap path where A used a direct index traversal—regression toward bitmap build + recheck; compare buffers and actual rows on both sides.{partialWin}",
                    "access.indexToBitmap.regression",
                    ContinuityOutcome.Regressed);

            // Index Scan ↔ Index Only Scan
            if (PlainIndex(typeA) && IndexOnly(typeB))
                return R(
                    $"Same relation ({relA}): plan B can satisfy more work from an index-only path—heap fetches often drop, yet this region may still dominate when many rows qualify or visibility-map checks add cost.{partialWin}",
                    "access.indexToIndexOnly",
                    ContinuityOutcome.Improved);
            if (PlainIndex(typeB) && IndexOnly(typeA))
                return R(
                    $"Same relation ({relA}): plan B reintroduced heap-backed index access where A was index-only—regression toward heap fetches; projection or visibility needs may have changed.{partialWin}",
                    "access.indexOnlyToHeap.regression",
                    ContinuityOutcome.Regressed);

            if (typeA.Contains("Seq", StringComparison.OrdinalIgnoreCase) &&
                typeB.Contains("Index", StringComparison.OrdinalIgnoreCase))
            {
                if (ImmediateParentIsSortLike(a, ctxA.ById))
                {
                    string? sortKeyFromParent = null;
                    if (!string.IsNullOrEmpty(a.ParentNodeId) && ctxA.ById.TryGetValue(a.ParentNodeId, out var sortParentNode))
                        sortKeyFromParent = sortParentNode.Node.SortKey;

                    var ord = ClassifyOrderingContinuity(
                        sortKeyFromParent,
                        b.Node.IndexCond,
                        b.Node.PresortedKey,
                        queryTextA,
                        queryTextB);
                    if (ord == OrderingContinuityEvidence.Strong)
                        return R(
                            $"Strong ordering evidence: same relation ({relA}): plan A used a sequential scan feeding an explicit sort; plan B reads via an index whose conditions include the same ORDER BY column(s)—ordering is likely satisfied during access. Access narrowed, but row volume or parents may still keep this area costly.{partialWin}",
                            "access.narrower.orderStrong",
                            ContinuityOutcome.Improved);
                    if (ord == OrderingContinuityEvidence.Weak)
                        return R(
                            $"Same relation ({relA}): plan A used a sequential scan feeding an explicit sort; plan B reads `{relA}` via an index-backed path with a token-level ordering link—verify sort/temp work dropped and whether joins or aggregates above carry residual cost. Token-level ordering link.{partialWin}",
                            "access.narrower.orderWeak",
                            ContinuityOutcome.Mixed);
                    if (ord == OrderingContinuityEvidence.QueryAssisted)
                        return R(
                            $"Same relation ({relA}): sort-over-seq on A vs index on B—ORDER BY text in the query aligns with the sort keys even though JSON evidence was thin; verify sort/temp I/O and buffer counters.{partialWin}",
                            "access.narrower.orderQueryText",
                            ContinuityOutcome.Mixed);
                    return R(
                        $"Same relation ({relA}): plan A used a broad sequential scan feeding an explicit sort step; plan B reads `{relA}` via an index-backed path—ordering is likely satisfied during access, so compare sort/temp work on A with index and heap reads on B.{partialWin}",
                        "access.narrower.sortParent",
                        ContinuityOutcome.Improved);
                }

                return R(
                    $"Same relation ({relA}): plan A used a broad sequential scan; plan B uses a narrower index-backed path—confirm shared reads and timing improved, then check joins, sorts, or aggregates above for residual cost.{partialWin}",
                    "access.narrower",
                    ContinuityOutcome.Improved);
            }

            if (typeB.Contains("Seq", StringComparison.OrdinalIgnoreCase) &&
                typeA.Contains("Index", StringComparison.OrdinalIgnoreCase))
                return R(
                    $"Same relation ({relA}): plan B shows a sequential scan where A used an index—regression toward broader heap reads; validate statistics, predicates, and buffers.{partialWin}",
                    "access.indexToSeq.regression",
                    ContinuityOutcome.Regressed);
            if (!string.Equals(typeA, typeB, StringComparison.OrdinalIgnoreCase))
                return R(
                    $"Same relation ({relA}) with a different access strategy between plans—compare buffer counters and actual rows, not only operator names.{partialWin}",
                    "access.generic",
                    ContinuityOutcome.Mixed);
        }

        static bool IsJoinRoot(string t) =>
            t.Equals("Nested Loop", StringComparison.OrdinalIgnoreCase) ||
            (t.Contains("Join", StringComparison.OrdinalIgnoreCase) && JoinFamilyTypeLooksBinary(t));

        if (IsJoinRoot(typeA) && IsJoinRoot(typeB))
        {
            var (l1, r1) = JoinSideRelations(a, ctxA.ById);
            var (l2, r2) = JoinSideRelations(b, ctxB.ById);
            var set1 = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var x in new[] { l1, r1 })
                if (!string.IsNullOrWhiteSpace(x))
                    set1.Add(x!);
            var set2 = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var x in new[] { l2, r2 })
                if (!string.IsNullOrWhiteSpace(x))
                    set2.Add(x!);
            if (set1.Count >= 2 && set2.Count >= 2 && set1.SetEquals(set2))
            {
                var relPhrase = JoinBetweenPhrase(l1, r1) ?? JoinBetweenPhrase(l2, r2) ?? "the same join inputs";
                if (typeA.Contains("Nested Loop", StringComparison.OrdinalIgnoreCase) &&
                    typeB.Contains("Hash Join", StringComparison.OrdinalIgnoreCase))
                    return R(
                        $"Same join region between {relPhrase}: plan A nested-loop inner work vs plan B hash build/probe—repeated inner probes gave way to a batched strategy; verify total time and reads still improved, not only reshaped.{partialWin}",
                        "join.nlToHash",
                        ContinuityOutcome.Mixed);
                if (typeA.Contains("Hash Join", StringComparison.OrdinalIgnoreCase) &&
                    typeB.Contains("Nested Loop", StringComparison.OrdinalIgnoreCase))
                    return R(
                        $"Same join region between {relPhrase}: plan B uses nested loops where A used a hash join—often smaller inputs or selective predicates; confirm inner-side cost is acceptable.{partialWin}",
                        "join.hashToNl",
                        ContinuityOutcome.Mixed);
                if (!string.Equals(typeA, typeB, StringComparison.OrdinalIgnoreCase))
                    return R(
                        $"Same join region between {relPhrase} with a different join operator on plan B—follow pair metrics to see whether pressure moved or truly shrank.{partialWin}",
                        "join.strategyShift",
                        ContinuityOutcome.Mixed);
            }
        }

        static bool IsGatherRoot(string t) =>
            t.Contains("Gather", StringComparison.OrdinalIgnoreCase) &&
            !t.Contains("Aggregate", StringComparison.OrdinalIgnoreCase);

        static bool IsNonPartialAggregateNode(string t) =>
            t.Contains("Aggregate", StringComparison.OrdinalIgnoreCase) &&
            !t.Contains("Partial Aggregate", StringComparison.OrdinalIgnoreCase);

        static bool GroupingKeysAlignForContinuity(string? gkA, string? gkB, string? qa, string? qb) =>
            GroupKeysLooselyMatch(gkA, gkB) || QueryTextGroupByBridgesKeys(gkA, gkB, qa, qb);

        static string TimeBucketWordingIfRelevant(string? qa, string? qb, string? gkA, string? gkB)
        {
            if (!QueryTextTimeBucketInQuery(qa, qb))
                return "";
            var blob = ((gkA ?? "") + " " + (gkB ?? "")).ToLowerInvariant();
            if (!blob.Contains("bucket", StringComparison.OrdinalIgnoreCase) &&
                !blob.Contains("time_bucket", StringComparison.OrdinalIgnoreCase))
                return "";
            return " Query text references time_bucket-style bucketing—treat gather/merge vs finalize cost in that analytical context (bounded heuristic).";
        }

        // Gather / Gather Merge over partial aggregates ↔ single-node hash/final aggregate.
        if (IsGatherRoot(typeA) && IsNonPartialAggregateNode(typeB) &&
            GroupingKeysAlignForContinuity(FirstDescendantAggregateGroupKey(a, ctxA.ById), b.Node.GroupKey, queryTextA, queryTextB))
        {
            var tbw = TimeBucketWordingIfRelevant(queryTextA, queryTextB, a.Node.GroupKey, b.Node.GroupKey);
            return R(
                $"Same grouped-output region: plan A merges presorted partial streams (gather-merge style stack); plan B finalizes grouping in a single aggregate node—finalization pressure moved between merge hops and one-shot work.{tbw} Partial win: scan/join volume feeding the group can still dominate.{partialWin}",
                "aggregate.gatherVsSingle",
                ContinuityOutcome.Mixed);
        }

        if (IsGatherRoot(typeB) && IsNonPartialAggregateNode(typeA) &&
            GroupingKeysAlignForContinuity(FirstDescendantAggregateGroupKey(b, ctxB.ById), a.Node.GroupKey, queryTextA, queryTextB))
        {
            var tbw = TimeBucketWordingIfRelevant(queryTextA, queryTextB, a.Node.GroupKey, b.Node.GroupKey);
            return R(
                $"Same grouped-output region: plan B uses a gather-merge stack over partial aggregates where A used a single-node aggregate—worker-side partial work may shrink final merge cost or only relocate grouped-output time.{tbw} Partial win: feeds and parents may still be the bottleneck.{partialWin}",
                "aggregate.singleVsGather",
                ContinuityOutcome.Mixed);
        }

        if (IsAggregateFamily(typeA) && IsAggregateFamily(typeB))
        {
            var gkA = a.Node.GroupKey;
            var gkB = b.Node.GroupKey;
            var keysMatch = GroupKeysLooselyMatch(gkA, gkB);
            var queryGroupBridge = !keysMatch && QueryTextGroupByBridgesKeys(gkA, gkB, queryTextA, queryTextB);
            if (keysMatch || queryGroupBridge)
            {
                var partialA = !string.IsNullOrWhiteSpace(a.Node.PartialMode);
                var partialB = !string.IsNullOrWhiteSpace(b.Node.PartialMode);
                var partialModeDiffers =
                    partialA != partialB ||
                    !string.Equals(a.Node.PartialMode ?? "", b.Node.PartialMode ?? "", StringComparison.OrdinalIgnoreCase);

                if (partialModeDiffers)
                {
                    var tbw = TimeBucketWordingIfRelevant(queryTextA, queryTextB, gkA, gkB);
                    var qBridge = queryGroupBridge
                        ? " Captured SQL GROUP BY aligns both sides even though planner group-key text differs—confirm expressions match before trusting equivalence."
                        : "";
                    var kind = queryGroupBridge ? "aggregate.partialFinal.queryText" : "aggregate.partialFinal";
                    return R(
                        $"Same output-shaping region: grouped keys line up{(queryGroupBridge ? " (bounded SQL hint)" : "")}; partial vs finalize or staging changed—compare gather/merge hops and whether finalization pressure moved or only reshaped.{tbw}{qBridge} Partial win: scans, joins, and row volume into this group can still dominate.{partialWin}",
                        kind,
                        ContinuityOutcome.Mixed);
                }

                if (queryGroupBridge)
                {
                    return R(
                        $"Same grouped-output intent: planner group-key strings differ on the surface, but captured SQL GROUP BY ties them together—treat as one analytical grouping boundary until you verify expressions match.{partialWin}",
                        "aggregate.queryTextGroupKeyBridge",
                        ContinuityOutcome.Mixed);
                }
            }
        }

        return null;
    }

    /// <summary>Full-sentence hint for pair readouts (selected-pair panel); null when evidence is weak or confidence is low.</summary>
    public static string? PairRegionContinuityHint(
        AnalyzedPlanNode a,
        AnalyzedPlanNode b,
        FindingEvaluationContext ctxA,
        FindingEvaluationContext ctxB,
        MatchConfidence mappingConfidence,
        string? queryTextA = null,
        string? queryTextB = null)
        => TryPairRegionContinuity(a, b, ctxA, ctxB, mappingConfidence, queryTextA, queryTextB)?.Hint;

    private static string? PairContinuityShortSuffix(
        AnalyzedPlanNode a,
        AnalyzedPlanNode b,
        FindingEvaluationContext ctxA,
        FindingEvaluationContext ctxB,
        MatchConfidence mappingConfidence)
    {
        var longHint = PairRegionContinuityHint(a, b, ctxA, ctxB, mappingConfidence);
        if (longHint is null)
            return null;
        var typeA = a.Node.NodeType ?? "";
        var typeB = b.Node.NodeType ?? "";
        var rel = a.Node.RelationName ?? b.Node.RelationName;
        if (!string.IsNullOrWhiteSpace(rel) &&
            string.Equals(a.Node.RelationName, b.Node.RelationName, StringComparison.OrdinalIgnoreCase) &&
            typeA.Contains("Seq", StringComparison.OrdinalIgnoreCase) &&
            typeB.Contains("Bitmap Heap", StringComparison.OrdinalIgnoreCase))
            return "same relation; bitmap heap on B";
        if (!string.IsNullOrWhiteSpace(rel) &&
            string.Equals(a.Node.RelationName, b.Node.RelationName, StringComparison.OrdinalIgnoreCase) &&
            typeB.Contains("Seq", StringComparison.OrdinalIgnoreCase) &&
            typeA.Contains("Bitmap Heap", StringComparison.OrdinalIgnoreCase))
            return "same relation; seq scan on B";
        if (!string.IsNullOrWhiteSpace(rel) &&
            string.Equals(a.Node.RelationName, b.Node.RelationName, StringComparison.OrdinalIgnoreCase) &&
            typeA.Contains("Bitmap Heap", StringComparison.OrdinalIgnoreCase) &&
            (typeB.Equals("Index Scan", StringComparison.OrdinalIgnoreCase) ||
             typeB.Contains("Index Only", StringComparison.OrdinalIgnoreCase)))
            return "same relation; index path on B";
        if (!string.IsNullOrWhiteSpace(rel) &&
            string.Equals(a.Node.RelationName, b.Node.RelationName, StringComparison.OrdinalIgnoreCase) &&
            typeB.Contains("Bitmap Heap", StringComparison.OrdinalIgnoreCase) &&
            (typeA.Equals("Index Scan", StringComparison.OrdinalIgnoreCase) ||
             typeA.Contains("Index Only", StringComparison.OrdinalIgnoreCase)))
            return "same relation; bitmap heap on B";
        if (!string.IsNullOrWhiteSpace(rel) &&
            string.Equals(a.Node.RelationName, b.Node.RelationName, StringComparison.OrdinalIgnoreCase) &&
            typeA.Equals("Index Scan", StringComparison.OrdinalIgnoreCase) &&
            typeB.Contains("Index Only", StringComparison.OrdinalIgnoreCase))
            return "same relation; index-only on B";
        if (!string.IsNullOrWhiteSpace(rel) &&
            string.Equals(a.Node.RelationName, b.Node.RelationName, StringComparison.OrdinalIgnoreCase) &&
            typeB.Equals("Index Scan", StringComparison.OrdinalIgnoreCase) &&
            typeA.Contains("Index Only", StringComparison.OrdinalIgnoreCase))
            return "same relation; index scan on B";
        if (!string.IsNullOrWhiteSpace(rel) &&
            string.Equals(a.Node.RelationName, b.Node.RelationName, StringComparison.OrdinalIgnoreCase) &&
            typeA.Contains("Seq", StringComparison.OrdinalIgnoreCase) &&
            typeB.Contains("Index", StringComparison.OrdinalIgnoreCase))
            return ImmediateParentIsSortLike(a, ctxA.ById)
                ? "ordering region; index path on B"
                : "same relation; index path on B";
        if (!string.IsNullOrWhiteSpace(rel) &&
            string.Equals(a.Node.RelationName, b.Node.RelationName, StringComparison.OrdinalIgnoreCase) &&
            typeB.Contains("Seq", StringComparison.OrdinalIgnoreCase) &&
            typeA.Contains("Index", StringComparison.OrdinalIgnoreCase))
            return "same relation; seq scan on B";
        if (typeA.Contains("Nested Loop", StringComparison.OrdinalIgnoreCase) &&
            typeB.Contains("Hash Join", StringComparison.OrdinalIgnoreCase))
            return "same tables; hash join on B";
        if (typeA.Contains("Hash Join", StringComparison.OrdinalIgnoreCase) &&
            typeB.Contains("Nested Loop", StringComparison.OrdinalIgnoreCase))
            return "same tables; nested loop on B";
        if (longHint is not null &&
            longHint.Contains("Strong ordering evidence:", StringComparison.OrdinalIgnoreCase))
            return "strong ordering; access path on B";
        if (longHint is not null &&
            longHint.Contains("Token-level ordering link", StringComparison.OrdinalIgnoreCase))
            return "ordering link weak; verify";
        if (longHint is not null &&
            typeA.Contains("Sort", StringComparison.OrdinalIgnoreCase) &&
            (typeB.Contains("Scan", StringComparison.OrdinalIgnoreCase) || typeB.Contains("Bitmap", StringComparison.OrdinalIgnoreCase)))
            return "ordering; index-backed access on B";
        return "same region; strategy shift";
    }

    internal static bool LooksLikePlannerPath(string nodeId) =>
        nodeId.StartsWith("root", StringComparison.Ordinal) && nodeId.Contains('.', StringComparison.Ordinal);

    private static string? QueryHintForNode(AnalyzedPlanNode n, string type, string? queryText)
    {
        if (string.IsNullOrWhiteSpace(queryText))
            return null;

        if (type.Contains("Sort", StringComparison.OrdinalIgnoreCase) && OrderByRx.IsMatch(queryText))
            return "Likely corresponds to ORDER BY shape in the source query (heuristic).";

        if ((type.Contains("Aggregate", StringComparison.OrdinalIgnoreCase) ||
             type.Contains("Group", StringComparison.OrdinalIgnoreCase)) && GroupByRx.IsMatch(queryText))
            return "Likely aligns with a GROUP BY boundary in the source query (heuristic).";

        if (!string.IsNullOrWhiteSpace(n.Node.RelationName) &&
            n.Node.RelationName.Contains("_hyper_", StringComparison.OrdinalIgnoreCase) &&
            TimeBucketRx.IsMatch(queryText))
            return "Chunk-style relation with time_bucket in the query often implies chunk fan-out in the plan (heuristic).";

        return null;
    }

    private static string? InferJoinChildRole(AnalyzedPlanNode n, IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        var current = n;
        for (var hop = 0; hop < 48; hop++)
        {
            if (string.IsNullOrEmpty(current.ParentNodeId))
                return null;
            if (!byId.TryGetValue(current.ParentNodeId, out var parent))
                return null;

            if (!IsBinaryJoinOperator(parent))
            {
                current = parent;
                continue;
            }

            var side = SideIndexUnderJoin(parent, n, byId);
            if (side is null)
            {
                current = parent;
                continue;
            }

            return FormatJoinSideRole(parent, side.Value, byId);
        }

        return null;
    }

    private static bool IsBinaryJoinOperator(AnalyzedPlanNode p)
    {
        var kids = p.ChildNodeIds;
        if (kids is null || kids.Count < 2)
            return false;
        var t = p.Node.NodeType ?? "";
        if (t.Contains("Bitmap Heap", StringComparison.OrdinalIgnoreCase) ||
            t.Contains("Bitmap Index", StringComparison.OrdinalIgnoreCase))
            return false;

        return JoinFamilyTypeLooksBinary(t);
    }

    /// <summary>True for common PostgreSQL join node types (incl. semi/anti variants) with two plan children.</summary>
    internal static bool JoinFamilyTypeLooksBinary(string nodeType)
    {
        if (string.IsNullOrEmpty(nodeType))
            return false;
        if (nodeType.Equals("Nested Loop", StringComparison.OrdinalIgnoreCase))
            return true;
        if (!nodeType.Contains("Join", StringComparison.OrdinalIgnoreCase))
            return false;
        return nodeType.Contains(" Join", StringComparison.OrdinalIgnoreCase) ||
               nodeType.EndsWith("Join", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Which top-level join child (0=left plan child, 1=right) contains <paramref name="descendant"/>.</summary>
    private static int? SideIndexUnderJoin(
        AnalyzedPlanNode join,
        AnalyzedPlanNode descendant,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        var kids = join.ChildNodeIds;
        if (kids is null || kids.Count < 2)
            return null;

        var id = descendant.NodeId;
        for (var i = 0; i < 64; i++)
        {
            if (!byId.TryGetValue(id, out var node))
                return null;
            if (string.Equals(node.ParentNodeId, join.NodeId, StringComparison.Ordinal))
            {
                for (var k = 0; k < Math.Min(2, kids.Count); k++)
                {
                    if (string.Equals(id, kids[k], StringComparison.Ordinal))
                        return k;
                }

                return null;
            }

            if (string.IsNullOrEmpty(node.ParentNodeId))
                break;
            id = node.ParentNodeId;
        }

        return null;
    }

    /// <summary>
    /// Infer hash-join probe vs build child index. Phase 64: shallow Hash discovery under each side (skips nested join subtrees),
    /// row-magnitude tie-break when both sides look like build candidates, and smaller-side-as-build when both direct children are Hash.
    /// </summary>
    private static (int ProbeChildIndex, int BuildChildIndex, bool ChildOrderFallback) HashJoinProbeBuildIndices(
        AnalyzedPlanNode join,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        var kids = join.ChildNodeIds ?? Array.Empty<string>();
        if (kids.Count < 2)
            return (0, 1, true);

        byId.TryGetValue(kids[0], out var ln);
        byId.TryGetValue(kids[1], out var rn);
        var leftIsHash = ln is not null && (ln.Node.NodeType ?? "").Equals("Hash", StringComparison.OrdinalIgnoreCase);
        var rightIsHash = rn is not null && (rn.Node.NodeType ?? "").Equals("Hash", StringComparison.OrdinalIgnoreCase);

        if (rightIsHash && !leftIsHash)
            return (0, 1, false);
        if (leftIsHash && !rightIsHash)
            return (1, 0, false);

        if (leftIsHash && rightIsHash)
        {
            var r0 = JoinSideRowMagnitude(ln!);
            var r1 = JoinSideRowMagnitude(rn!);
            if (r0 is > 0 && r1 is > 0 && Math.Abs(r0.Value - r1.Value) > 1e-3)
                return r0 <= r1 ? (1, 0, false) : (0, 1, false);
            return (0, 1, true);
        }

        var leftHasShallow = JoinSideHasShallowBuildHash(kids[0], byId);
        var rightHasShallow = JoinSideHasShallowBuildHash(kids[1], byId);
        if (leftHasShallow && !rightHasShallow)
            return (1, 0, false);
        if (rightHasShallow && !leftHasShallow)
            return (0, 1, false);
        if (leftHasShallow && rightHasShallow)
        {
            var r0 = JoinSideRowMagnitude(ln);
            var r1 = JoinSideRowMagnitude(rn);
            if (r0 is > 0 && r1 is > 0 && Math.Abs(r0.Value - r1.Value) > 1e-3)
                return r0 <= r1 ? (1, 0, false) : (0, 1, false);
            return (0, 1, true);
        }

        return (0, 1, true);
    }

    private static double? JoinSideRowMagnitude(AnalyzedPlanNode? n)
    {
        if (n is null) return null;
        if (n.Metrics.ActualRowsTotal is { } t && t > 0)
            return t;
        if (n.Node.ActualRows is { } ar)
        {
            var loops = n.Node.ActualLoops ?? 1;
            return ar * Math.Max(1, loops);
        }

        if (n.Node.PlanRows is { } pr && pr > 0)
            return pr;
        return null;
    }

    /// <summary>
    /// True when a <c>Hash</c> build operator appears soon under this join child without crossing a nested join root.
    /// </summary>
    private static bool JoinSideHasShallowBuildHash(string startId, IReadOnlyDictionary<string, AnalyzedPlanNode> byId, int maxHops = 5)
    {
        if (!byId.TryGetValue(startId, out var root))
            return false;
        var rt = root.Node.NodeType ?? "";
        if (JoinFamilyTypeLooksBinary(rt) || rt.Equals("Nested Loop", StringComparison.OrdinalIgnoreCase))
            return false;

        var queue = new Queue<(string Id, int Depth)>();
        var seen = new HashSet<string>(StringComparer.Ordinal) { startId };
        queue.Enqueue((startId, 0));
        while (queue.Count > 0)
        {
            var (id, d) = queue.Dequeue();
            if (d > maxHops) continue;
            if (!byId.TryGetValue(id, out var n)) continue;
            var t = n.Node.NodeType ?? "";
            if (t.Equals("Hash", StringComparison.OrdinalIgnoreCase))
                return true;
            if (d > 0 &&
                (JoinFamilyTypeLooksBinary(t) || t.Equals("Nested Loop", StringComparison.OrdinalIgnoreCase)))
                continue;

            foreach (var c in n.ChildNodeIds ?? Array.Empty<string>())
            {
                if (seen.Add(c))
                    queue.Enqueue((c, d + 1));
            }
        }

        return false;
    }

    private static string? FormatJoinSideRole(
        AnalyzedPlanNode join,
        int sideIndex,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        var pt = join.Node.NodeType ?? "";
        var (lRel, rRel) = JoinSideRelations(join, byId);
        var between = JoinBetweenPhrase(lRel, rRel);

        var isSemi = pt.Contains("Semi Join", StringComparison.OrdinalIgnoreCase);
        var isAnti = pt.Contains("Anti Join", StringComparison.OrdinalIgnoreCase);
        var isNl = pt.Contains("Nested Loop", StringComparison.OrdinalIgnoreCase);
        var isMj = pt.Contains("Merge Join", StringComparison.OrdinalIgnoreCase);
        var isPlainHj = pt.Contains("Hash Join", StringComparison.OrdinalIgnoreCase) && !isSemi && !isAnti;
        var isHashFamily = pt.Contains("Hash", StringComparison.OrdinalIgnoreCase) &&
                           pt.Contains("Join", StringComparison.OrdinalIgnoreCase) &&
                           !isNl;

        if (isSemi || isAnti)
        {
            if (isHashFamily)
            {
                var (probeIdx, buildIdx, _) = HashJoinProbeBuildIndices(join, byId);
                var roleWord = sideIndex == probeIdx ? "probe" : sideIndex == buildIdx ? "build" : sideIndex == 0 ? "probe" : "build";
                var testHint = isAnti ? "anti-match test on inner rows" : "existence test on inner rows";
                return between is not null
                    ? $"{roleWord} side of {pt} between {between} ({testHint})"
                    : $"{roleWord} side of {pt} ({testHint})";
            }

            if (isNl || isMj)
            {
                var sideWord = sideIndex == 0
                    ? "outer (driving)"
                    : isAnti
                        ? "inner (anti probe)"
                        : "inner (existence probe)";
                return between is not null
                    ? $"{sideWord} side of {pt} between {between}"
                    : $"{sideWord} side of {pt}";
            }
        }

        if (isNl || isMj)
        {
            var sideWord = sideIndex == 0 ? "outer" : "inner";
            return between is not null
                ? $"{sideWord} side of {pt} between {between}"
                : $"{sideWord} side of {pt}";
        }

        if (isPlainHj || (isHashFamily && !isSemi && !isAnti))
        {
            var (probeIdx, buildIdx, childOrderFallback) = HashJoinProbeBuildIndices(join, byId);
            string? roleWord = null;
            if (sideIndex == probeIdx)
                roleWord = "probe";
            else if (sideIndex == buildIdx)
                roleWord = "build";

            if (roleWord is null)
                return null;

            if (between is not null)
                return $"{roleWord} side of {pt} between {between}";
            return childOrderFallback
                ? $"{roleWord} side of {pt} (probe/build unclear—defaulting to child order)"
                : $"{roleWord} side of {pt}";
        }

        return null;
    }

    private static string? JoinBetweenPhrase(string? leftRel, string? rightRel)
    {
        if (!string.IsNullOrWhiteSpace(leftRel) && !string.IsNullOrWhiteSpace(rightRel))
            return $"{leftRel} and {rightRel}";
        return null;
    }

    private static string? NearestBoundaryUnder(AnalyzedPlanNode n, IReadOnlyDictionary<string, AnalyzedPlanNode> byId, string rootNodeId)
    {
        var cur = n;
        for (var i = 0; i < 24 && !string.IsNullOrEmpty(cur.ParentNodeId); i++)
        {
            if (!byId.TryGetValue(cur.ParentNodeId, out var p))
                break;
            var t = p.Node.NodeType ?? "";
            var isJoin = t.Contains("Join", StringComparison.OrdinalIgnoreCase) || t.Equals("Nested Loop", StringComparison.OrdinalIgnoreCase);
            var isAgg = t.Contains("Aggregate", StringComparison.OrdinalIgnoreCase);
            var isSort = t.Contains("Sort", StringComparison.OrdinalIgnoreCase);
            var isGather = t.Contains("Gather", StringComparison.OrdinalIgnoreCase);
            if (isJoin || isAgg || isSort || isGather)
                return $"under {PrimaryLabelCore(p, byId)}";
            if (string.Equals(p.NodeId, rootNodeId, StringComparison.Ordinal))
                break;
            cur = p;
        }

        return null;
    }

    private static (string? Left, string? Right) JoinSideRelations(AnalyzedPlanNode join, IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        var kids = join.ChildNodeIds ?? Array.Empty<string>();
        if (kids.Count < 2)
            return (null, null);

        var leftRel = RelationThroughHashWrapper(kids[0], byId);
        var rightRel = RelationThroughHashWrapper(kids[1], byId);

        return (leftRel, rightRel);
    }

    /// <summary>First scan relation under this subtree, unwrapping a single <c>Hash</c> child when present (either side).</summary>
    private static string? RelationThroughHashWrapper(string childId, IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        if (!byId.TryGetValue(childId, out var child))
            return null;
        var t = child.Node.NodeType ?? "";
        if (t.Equals("Hash", StringComparison.OrdinalIgnoreCase) && child.ChildNodeIds.Count > 0)
            return FirstDescendantRelation(child.ChildNodeIds[0], byId) ?? FirstDescendantRelation(childId, byId);
        return FirstDescendantRelation(childId, byId);
    }

    private static string? FirstMeaningfulChildType(string nodeId, IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        if (!byId.TryGetValue(nodeId, out var n))
            return null;
        return n.Node.NodeType;
    }

    public static string? FirstDescendantRelation(string nodeId, IReadOnlyDictionary<string, AnalyzedPlanNode> byId, int maxNodes = 28)
    {
        var queue = new Queue<string>();
        var seen = new HashSet<string>(StringComparer.Ordinal) { nodeId };
        queue.Enqueue(nodeId);
        var steps = 0;

        while (queue.Count > 0 && steps < maxNodes)
        {
            var id = queue.Dequeue();
            if (!byId.TryGetValue(id, out var n))
                continue;

            if (!string.IsNullOrWhiteSpace(n.Node.RelationName))
                return n.Node.RelationName;

            foreach (var c in n.ChildNodeIds ?? Array.Empty<string>())
            {
                if (seen.Add(c))
                    queue.Enqueue(c);
            }

            steps++;
        }

        return null;
    }

    private static bool ImmediateParentIsSortLike(AnalyzedPlanNode child, IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        var pid = child.ParentNodeId;
        if (string.IsNullOrEmpty(pid) || !byId.TryGetValue(pid, out var p))
            return false;
        var t = p.Node.NodeType ?? "";
        return t.Contains("Sort", StringComparison.OrdinalIgnoreCase);
    }

    private enum OrderingContinuityEvidence
    {
        None = 0,
        Weak = 1,
        Strong = 2,
        /// <summary>ORDER BY in supplied query text overlaps sort-key columns; planner JSON did not expose a tight match.</summary>
        QueryAssisted = 3
    }

    /// <summary>Structured column alignment (preferred), token overlap, then bounded query-text ORDER BY check.</summary>
    private static OrderingContinuityEvidence ClassifyOrderingContinuity(
        string? sortKey,
        string? indexCond,
        string? presortedKey,
        string? queryTextA,
        string? queryTextB)
    {
        if (string.IsNullOrWhiteSpace(sortKey))
            return OrderingContinuityEvidence.None;

        foreach (var col in OrderingColumnNamesFromSortKey(sortKey))
        {
            if (col.Length < 2)
                continue;
            if (!string.IsNullOrWhiteSpace(indexCond) && IndexCondReferencesColumn(indexCond, col))
                return OrderingContinuityEvidence.Strong;
            if (!string.IsNullOrWhiteSpace(presortedKey) && IndexCondReferencesColumn(presortedKey, col))
                return OrderingContinuityEvidence.Strong;
        }

        if (OrderingEvidenceLikelyRelated(sortKey, indexCond, presortedKey))
            return OrderingContinuityEvidence.Weak;

        if (QueryTextOrderBySupportsSortKey(sortKey, queryTextA, queryTextB))
            return OrderingContinuityEvidence.QueryAssisted;

        return OrderingContinuityEvidence.None;
    }

    /// <summary>Conservative: at least one sort-key column appears as an identifier in the ORDER BY section of either query string.</summary>
    private static bool QueryTextOrderBySupportsSortKey(string? sortKey, string? queryTextA, string? queryTextB)
    {
        var qb = string.Join('\n', new[] { queryTextA, queryTextB }.Where(s => !string.IsNullOrWhiteSpace(s)));
        if (string.IsNullOrWhiteSpace(qb) || string.IsNullOrWhiteSpace(sortKey))
            return false;

        var orderIdx = qb.IndexOf("ORDER BY", StringComparison.OrdinalIgnoreCase);
        if (orderIdx < 0)
            return false;

        var orderSection = qb[orderIdx..];
        foreach (var col in OrderingColumnNamesFromSortKey(sortKey))
        {
            if (col.Length < 3)
                continue;
            if (IndexCondReferencesColumn(orderSection, col))
                return true;
        }

        return false;
    }

    private static IEnumerable<string> OrderingColumnNamesFromSortKey(string sortKey)
    {
        foreach (var piece in sortKey.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
        {
            var t = piece.Trim();
            if (t.Length == 0)
                continue;

            foreach (var suff in new[] { " NULLS LAST", " NULLS FIRST", " DESC", " ASC" })
            {
                if (t.EndsWith(suff, StringComparison.OrdinalIgnoreCase))
                    t = t[..^suff.Length].TrimEnd();
            }

            var lastDot = t.LastIndexOf('.');
            var col = lastDot >= 0 ? t[(lastDot + 1)..] : t;
            col = col.Trim().Trim('"');
            if (col.Length >= 2 && (char.IsLetter(col[0]) || col[0] == '_'))
                yield return col;
        }
    }

    private static bool IndexCondReferencesColumn(string haystack, string column)
    {
        if (string.IsNullOrWhiteSpace(haystack) || string.IsNullOrWhiteSpace(column))
            return false;

        for (var idx = 0;; idx++)
        {
            idx = haystack.IndexOf(column, idx, StringComparison.OrdinalIgnoreCase);
            if (idx < 0)
                return false;

            var before = idx > 0 ? haystack[idx - 1] : '(';
            var after = idx + column.Length < haystack.Length ? haystack[idx + column.Length] : ')';
            var beforeOk = !char.IsLetterOrDigit(before) && before != '_';
            var afterOk = !char.IsLetterOrDigit(after) && after != '_';
            if (beforeOk && afterOk)
                return true;

            idx++;
        }
    }

    private static bool OrderingEvidenceLikelyRelated(string? sortKey, string? indexCond, string? presortedKey)
    {
        if (string.IsNullOrWhiteSpace(sortKey))
            return false;

        var hasIndexCond = !string.IsNullOrWhiteSpace(indexCond);
        var hasPresorted = !string.IsNullOrWhiteSpace(presortedKey);
        if (!hasIndexCond && !hasPresorted)
            return false;

        foreach (var token in ExtractOrderingTokens(sortKey))
        {
            if (token.Length < 4)
                continue;
            if (hasIndexCond && indexCond!.Contains(token, StringComparison.OrdinalIgnoreCase))
                return true;
            if (hasPresorted && presortedKey!.Contains(token, StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }

    private static IEnumerable<string> ExtractOrderingTokens(string sortKey)
    {
        var parts = sortKey.Split(
            new[]
            {
                ' ', ',', '(', ')', '.', '[', ']', '"', '\''
            },
            StringSplitOptions.RemoveEmptyEntries);
        foreach (var p in parts)
        {
            var t = p.Trim();
            if (t.Length < 4)
                continue;
            if (t.Equals("DESC", StringComparison.OrdinalIgnoreCase) ||
                t.Equals("ASC", StringComparison.OrdinalIgnoreCase) ||
                t.Equals("NULLS", StringComparison.OrdinalIgnoreCase) ||
                t.Equals("FIRST", StringComparison.OrdinalIgnoreCase) ||
                t.Equals("LAST", StringComparison.OrdinalIgnoreCase))
                continue;
            yield return t;
        }
    }

    /// <summary>First aggregate descendant under a gather (or any subtree) that exposes a group key.</summary>
    private static string? FirstDescendantAggregateGroupKey(
        AnalyzedPlanNode root,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
    {
        var queue = new Queue<string>();
        foreach (var c in root.ChildNodeIds ?? Array.Empty<string>())
            queue.Enqueue(c);
        var steps = 0;
        while (queue.Count > 0 && steps++ < 256)
        {
            var id = queue.Dequeue();
            if (!byId.TryGetValue(id, out var n))
                continue;
            var t = n.Node.NodeType ?? "";
            if (t.Contains("Aggregate", StringComparison.OrdinalIgnoreCase) &&
                !string.IsNullOrWhiteSpace(n.Node.GroupKey))
                return n.Node.GroupKey;
            foreach (var c in n.ChildNodeIds ?? Array.Empty<string>())
                queue.Enqueue(c);
        }

        return null;
    }

    /// <summary>
    /// Bounded: GROUP BY clause in captured SQL references column names from both planner group-key strings; keys must overlap logically.
    /// </summary>
    private static bool QueryTextGroupByBridgesKeys(string? gkA, string? gkB, string? queryTextA, string? queryTextB)
    {
        if (GroupKeysLooselyMatch(gkA, gkB))
            return false;

        var section = ExtractSqlClauseAfterHeader(queryTextA, queryTextB, "GROUP BY");
        if (string.IsNullOrWhiteSpace(section))
            return false;

        var colsA = OrderingColumnNamesFromSortKey(gkA ?? "").Where(c => c.Length >= 3).ToArray();
        var colsB = OrderingColumnNamesFromSortKey(gkB ?? "").Where(c => c.Length >= 3).ToArray();
        if (colsA.Length == 0 || colsB.Length == 0)
            return false;

        var setA = colsA.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var setB = colsB.ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (!setA.Overlaps(setB))
            return false;

        var hitA = colsA.Any(c => IndexCondReferencesColumn(section, c));
        var hitB = colsB.Any(c => IndexCondReferencesColumn(section, c));
        return hitA && hitB;
    }

    private static bool QueryTextTimeBucketInQuery(string? queryTextA, string? queryTextB)
    {
        var merged = string.Join('\n', new[] { queryTextA, queryTextB }.Where(s => !string.IsNullOrWhiteSpace(s)));
        return merged.Contains("time_bucket", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Substring after clause header, trimmed at common following clauses (not a SQL parser).</summary>
    private static string? ExtractSqlClauseAfterHeader(string? queryTextA, string? queryTextB, string header)
    {
        var merged = string.Join('\n', new[] { queryTextA, queryTextB }.Where(s => !string.IsNullOrWhiteSpace(s)));
        var idx = merged.IndexOf(header, StringComparison.OrdinalIgnoreCase);
        if (idx < 0)
            return null;

        var rest = merged[(idx + header.Length)..].TrimStart();
        if (rest.Length == 0)
            return null;

        var span = rest.Length <= 400 ? rest : rest[..400];
        foreach (var stop in new[] { "\r\nORDER BY", "\nORDER BY", "\r\nHAVING", "\nHAVING", "\r\nLIMIT", "\nLIMIT", "\r\nOFFSET", "\nOFFSET", "\r\nUNION", "\nUNION", ";" })
        {
            var si = span.IndexOf(stop, StringComparison.OrdinalIgnoreCase);
            if (si >= 0)
                span = span[..si];
        }

        return span.Trim();
    }

    private static string TrimKey(string s, int maxLen)
    {
        var t = string.Join(" ", s.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (t.Length <= maxLen)
            return t;
        return t[..(maxLen - 1)] + "…";
    }
}
