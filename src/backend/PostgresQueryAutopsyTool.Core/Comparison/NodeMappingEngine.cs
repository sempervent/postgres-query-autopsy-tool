using PostgresQueryAutopsyTool.Core.Analysis;

namespace PostgresQueryAutopsyTool.Core.Comparison;

public sealed class NodeMappingEngine
{
    public sealed record Options(
        // Lower threshold is intentional: we prefer "low/medium confidence match" over "no match"
        // for common rewrites (Seq Scan → Index Scan, Nested Loop → Hash Join, etc.).
        double MinScoreToMatch = 0.50,
        double HighConfidenceScore = 0.88,
        bool IncludeDiagnostics = false,
        int MaxDiagnosticsCandidatesPerNode = 5);

    private readonly Options _options;

    public NodeMappingEngine(Options? options = null)
    {
        _options = options ?? new Options();
    }

    public (IReadOnlyList<NodeMatch> Matches, IReadOnlyList<string> UnmatchedA, IReadOnlyList<string> UnmatchedB, ComparisonDiagnostics? Diagnostics) Map(
        IReadOnlyList<AnalyzedPlanNode> nodesA,
        IReadOnlyList<AnalyzedPlanNode> nodesB)
    {
        var featuresA = nodesA.ToDictionary(n => n.NodeId, BuildFeatures, StringComparer.Ordinal);
        var featuresB = nodesB.ToDictionary(n => n.NodeId, BuildFeatures, StringComparer.Ordinal);

        // Generate candidate pairs with scores.
        var candidates = new List<(string a, string b, double score, Dictionary<string, double> breakdown)>();
        foreach (var a in nodesA)
        {
            foreach (var b in nodesB)
            {
                var (score, breakdown) = Score(featuresA[a.NodeId], featuresB[b.NodeId]);
                if (score >= _options.MinScoreToMatch)
                    candidates.Add((a.NodeId, b.NodeId, score, breakdown));
            }
        }

        // Diagnostics are computed after we pick winners, to explain decisions.
        ComparisonDiagnostics? diagnostics = null;

        // Greedy max-score matching.
        var chosen = new List<NodeMatch>();
        var usedA = new HashSet<string>(StringComparer.Ordinal);
        var usedB = new HashSet<string>(StringComparer.Ordinal);

        foreach (var c in candidates.OrderByDescending(c => c.score))
        {
            if (usedA.Contains(c.a) || usedB.Contains(c.b)) continue;
            usedA.Add(c.a);
            usedB.Add(c.b);

            var confidence =
                c.score >= _options.HighConfidenceScore ? MatchConfidence.High :
                c.score >= 0.72 ? MatchConfidence.Medium :
                MatchConfidence.Low;

            chosen.Add(new NodeMatch(
                NodeIdA: c.a,
                NodeIdB: c.b,
                MatchScore: c.score,
                Confidence: confidence,
                ScoreBreakdown: c.breakdown));
        }

        // Prefer mapping roots if present (stabilizes the diff).
        // If root ids differ but both exist, ensure the best root-root pairing is included.
        // (Our parser uses "root" for both, so this is mostly defensive.)

        if (_options.IncludeDiagnostics)
        {
            var byA = candidates
                .GroupBy(c => c.a, StringComparer.Ordinal)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.score).ToArray(), StringComparer.Ordinal);

            var winnerByA = chosen.ToDictionary(m => m.NodeIdA, StringComparer.Ordinal);

            var diagNodes = new List<NodeDiagnostics>();
            foreach (var a in nodesA)
            {
                var ranked = byA.TryGetValue(a.NodeId, out var list)
                    ? list
                    : Array.Empty<(string a, string b, double score, Dictionary<string, double> breakdown)>();

                var topCandidates = ranked
                    .Take(_options.MaxDiagnosticsCandidatesPerNode)
                    .Select(c => new CandidateMatch(c.a, c.b, c.score, c.breakdown))
                    .ToArray();

                MatchDecisionDiagnostics? decision = null;
                if (winnerByA.TryGetValue(a.NodeId, out var winner))
                {
                    var winnerCandidate = new CandidateMatch(winner.NodeIdA, winner.NodeIdB, winner.MatchScore, winner.ScoreBreakdown);
                    var winningFactors = winner.ScoreBreakdown
                        .OrderByDescending(kv => kv.Value)
                        .Take(3)
                        .Select(kv => new KeyFactor(kv.Key, kv.Value))
                        .ToArray();

                    var rejected = ranked
                        .Where(c => c.b != winner.NodeIdB)
                        .Take(_options.MaxDiagnosticsCandidatesPerNode)
                        .Select(c =>
                        {
                            var why = new List<string>();
                            if (usedB.Contains(c.b))
                                why.Add("candidate was matched to a different A node (one-to-one constraint)");

                            var topDiffs = winner.ScoreBreakdown.Keys
                                .Union(c.breakdown.Keys, StringComparer.Ordinal)
                                .Select(k => new
                                {
                                    k,
                                    w = winner.ScoreBreakdown.TryGetValue(k, out var wv) ? wv : 0.0,
                                    r = c.breakdown.TryGetValue(k, out var rv) ? rv : 0.0
                                })
                                .OrderByDescending(x => (x.w - x.r))
                                .Take(2)
                                .Where(x => x.w > x.r + 0.05)
                                .Select(x => $"weaker on `{x.k}`")
                                .ToArray();

                            why.AddRange(topDiffs);

                            // Concrete operator-field hints (best-effort, bounded).
                            if (ranked.Length > 0)
                            {
                                var winnerEntry = ranked.FirstOrDefault(x => x.b == winner.NodeIdB);
                                if (winnerEntry.a is not null)
                                {
                                    var fA = featuresA[winner.NodeIdA];
                                    var wB = featuresB[winner.NodeIdB];
                                    var rB = featuresB[c.b];

                                    if (!string.IsNullOrWhiteSpace(fA.RelationName) &&
                                        string.Equals(fA.RelationName, rB.RelationName, StringComparison.OrdinalIgnoreCase) &&
                                        !string.Equals(fA.RelationName, wB.RelationName, StringComparison.OrdinalIgnoreCase))
                                        why.Add("rejected shares relation name with A, but winner matched other context better");

                                    if (!string.IsNullOrWhiteSpace(fA.IndexName) &&
                                        string.Equals(fA.IndexName, rB.IndexName, StringComparison.OrdinalIgnoreCase) &&
                                        !string.Equals(fA.IndexName, wB.IndexName, StringComparison.OrdinalIgnoreCase))
                                        why.Add("rejected shares index context but lost on overall similarity");

                                    if (!string.IsNullOrWhiteSpace(wB.SortMethod) || !string.IsNullOrWhiteSpace(rB.SortMethod))
                                    {
                                        if (!string.Equals(wB.SortMethod, rB.SortMethod, StringComparison.OrdinalIgnoreCase))
                                            why.Add("sort method differs from winner candidate");
                                    }

                                    if (wB.WorkersPlanned is not null || rB.WorkersPlanned is not null)
                                    {
                                        if (wB.WorkersPlanned != rB.WorkersPlanned || wB.WorkersLaunched != rB.WorkersLaunched)
                                            why.Add("parallel worker metadata differs from winner candidate");
                                    }

                                    if (wB.HashBatches is not null || rB.HashBatches is not null)
                                    {
                                        if (wB.HashBatches != rB.HashBatches)
                                            why.Add("hash batching differs from winner candidate");
                                    }
                                }
                            }
                            if (why.Count == 0)
                                why.Add("lower overall score");

                            return new RejectedCandidate(
                                Candidate: new CandidateMatch(c.a, c.b, c.score, c.breakdown),
                                WhyLost: why);
                        })
                        .ToArray();

                    decision = new MatchDecisionDiagnostics(
                        NodeIdA: a.NodeId,
                        Winner: winnerCandidate,
                        WinningFactors: winningFactors,
                        RejectedCandidates: rejected);
                }

                diagNodes.Add(new NodeDiagnostics(a.NodeId, topCandidates, decision));
            }

            diagnostics = new ComparisonDiagnostics(_options.MaxDiagnosticsCandidatesPerNode, diagNodes);
        }

        var unmatchedA = nodesA.Select(n => n.NodeId).Where(id => !usedA.Contains(id)).ToArray();
        var unmatchedB = nodesB.Select(n => n.NodeId).Where(id => !usedB.Contains(id)).ToArray();

        return (chosen, unmatchedA, unmatchedB, diagnostics);
    }

    private static NodeFeatures BuildFeatures(AnalyzedPlanNode n)
    {
        var nodeType = (n.Node.NodeType ?? "Unknown").Trim();
        var rel = (n.Node.RelationName ?? "").Trim();
        var idx = (n.Node.IndexName ?? "").Trim();
        var join = (n.Node.JoinType ?? "").Trim();

        var childTypes = n.ChildNodeIds
            .Select(id => id) // placeholder; actual child types computed later by Score via signature
            .ToArray();

        return new NodeFeatures(
            NodeId: n.NodeId,
            NodeType: nodeType,
            RelationName: rel,
            IndexName: idx,
            JoinType: join,
            Depth: n.Metrics.Depth,
            ChildCount: n.Metrics.ChildCount,
            SubtreeNodeCount: n.Metrics.SubtreeNodeCount,
            ChildTypesSignature: "", // computed in Score using node ids on demand
            HasFilter: !string.IsNullOrWhiteSpace(n.Node.Filter),
            HasIndexCond: !string.IsNullOrWhiteSpace(n.Node.IndexCond),
            SortMethod: (n.Node.SortMethod ?? "").Trim(),
            HashBatches: n.Node.HashBatches,
            WorkersPlanned: n.Node.WorkersPlanned,
            WorkersLaunched: n.Node.WorkersLaunched);
    }

    private sealed record NodeFeatures(
        string NodeId,
        string NodeType,
        string RelationName,
        string IndexName,
        string JoinType,
        int Depth,
        int ChildCount,
        long SubtreeNodeCount,
        string ChildTypesSignature,
        bool HasFilter,
        bool HasIndexCond,
        string SortMethod,
        long? HashBatches,
        int? WorkersPlanned,
        int? WorkersLaunched);

    private static (double score, Dictionary<string, double> breakdown) Score(NodeFeatures a, NodeFeatures b)
    {
        // Weighted scoring. Total is normalized to [0,1].
        // The goal is usefulness over perfect correctness; uncertainty is exposed via confidence.
        const double wType = 0.28;
        const double wFamily = 0.12;
        const double wRel = 0.18;
        const double wIdx = 0.14;
        const double wJoin = 0.06;
        const double wDepth = 0.10;
        const double wShape = 0.10;
        const double wPred = 0.07;
        const double wAncestor = 0.05;

        var type = SimilarityExact(a.NodeType, b.NodeType);
        var family = SimilarityFamily(a.NodeType, b.NodeType);
        var rel = SimilarityString(a.RelationName, b.RelationName);
        var idx = SimilarityString(a.IndexName, b.IndexName);
        var join = SimilarityString(a.JoinType, b.JoinType);

        var depth = 1.0 - Math.Min(1.0, Math.Abs(a.Depth - b.Depth) / 8.0);
        var shape = 1.0 - Math.Min(1.0, Math.Abs(a.ChildCount - b.ChildCount) / 3.0);
        shape = (shape + (1.0 - Math.Min(1.0, Math.Abs(a.SubtreeNodeCount - b.SubtreeNodeCount) / 20.0))) / 2.0;

        var pred = 0.0;
        pred += (a.HasFilter == b.HasFilter) ? 0.5 : 0.0;
        pred += (a.HasIndexCond == b.HasIndexCond) ? 0.5 : 0.0;

        // Lightweight "ancestor signature" proxy: depth proximity plus predicate presence already help.
        // Here we add a small bonus when relation matches (or both absent) AND family matches.
        var ancestor = (rel >= 0.5 && family >= 0.7) ? 1.0 : 0.0;

        // Phase 68–69: same-relation scan-family rewrites (seq ↔ index/index-only, seq ↔ bitmap heap, bitmap ↔ index, index ↔ index-only)—boost so continuity hints can apply at Medium+.
        var accessRewrite =
            rel >= 0.99 && family >= 0.99 && ScanAccessRewritePair(a.NodeType, b.NodeType) ? 0.24 : 0.0;

        // Phase 71: Gather / Gather Merge roots often sit over Partial Aggregate vs a single-node hash/final aggregate—boost mapping when relation context is absent on both.
        var gatherAggRewrite =
            GatherAggregateRewritePair(a.NodeType, b.NodeType) && rel >= 0.99 ? 0.20 : 0.0;

        var total =
            wType * type +
            wFamily * family +
            wRel * rel +
            wIdx * idx +
            wJoin * join +
            wDepth * depth +
            wShape * shape +
            wPred * pred +
            wAncestor * ancestor +
            accessRewrite +
            gatherAggRewrite;

        var breakdown = new Dictionary<string, double>
        {
            ["type"] = type,
            ["family"] = family,
            ["relation"] = rel,
            ["index"] = idx,
            ["joinType"] = join,
            ["depth"] = depth,
            ["shape"] = shape,
            ["predicates"] = pred,
            ["ancestorProxy"] = ancestor,
            ["accessRewrite"] = accessRewrite,
            ["gatherAggRewrite"] = gatherAggRewrite
        };

        return (Math.Clamp(total, 0, 1), breakdown);
    }

    private static double SimilarityExact(string a, string b)
        => string.Equals(a, b, StringComparison.OrdinalIgnoreCase) ? 1.0 : 0.0;

    private static double SimilarityString(string a, string b)
    {
        if (string.IsNullOrWhiteSpace(a) && string.IsNullOrWhiteSpace(b)) return 1.0;
        if (string.IsNullOrWhiteSpace(a) || string.IsNullOrWhiteSpace(b)) return 0.0;
        return string.Equals(a, b, StringComparison.OrdinalIgnoreCase) ? 1.0 : 0.0;
    }

    private static double SimilarityFamily(string nodeTypeA, string nodeTypeB)
    {
        var a = ClassifyFamily(nodeTypeA);
        var b = ClassifyFamily(nodeTypeB);
        if (a == OperatorFamily.Unknown || b == OperatorFamily.Unknown) return 0.0;
        if (a == b) return 1.0;

        // Near-family compatibility: scans vs bitmap scans.
        if (a == OperatorFamily.Scan && b == OperatorFamily.Scan) return 1.0;

        // Phase 71: parallel gather-merge stack vs single-node aggregate finalization.
        if ((a == OperatorFamily.Gather && b == OperatorFamily.Aggregate) ||
            (b == OperatorFamily.Gather && a == OperatorFamily.Aggregate))
            return 0.80;

        return 0.0;
    }

    private static bool GatherAggregateRewritePair(string? nodeTypeA, string? nodeTypeB)
    {
        var a = (nodeTypeA ?? "").Trim();
        var b = (nodeTypeB ?? "").Trim();
        if (a.Length == 0 || b.Length == 0)
            return false;

        static bool IsGatherRoot(string t) =>
            t.Contains("Gather", StringComparison.OrdinalIgnoreCase) &&
            !t.Contains("Aggregate", StringComparison.OrdinalIgnoreCase);

        static bool IsAggregateNode(string t) => t.Contains("Aggregate", StringComparison.OrdinalIgnoreCase);

        return (IsGatherRoot(a) && IsAggregateNode(b)) || (IsGatherRoot(b) && IsAggregateNode(a));
    }

    private enum OperatorFamily
    {
        Unknown = 0,
        Scan = 1,
        Join = 2,
        Aggregate = 3,
        SortMaterialize = 4,
        Append = 5,
        Gather = 6
    }

    private static bool ScanAccessRewritePair(string? nodeTypeA, string? nodeTypeB)
    {
        var a = (nodeTypeA ?? "").Trim();
        var b = (nodeTypeB ?? "").Trim();
        if (a.Length == 0 || b.Length == 0) return false;

        static bool IsSeq(string t) => t.Equals("Seq Scan", StringComparison.OrdinalIgnoreCase);

        static bool IsBitmapHeap(string t) => t.Contains("Bitmap Heap", StringComparison.OrdinalIgnoreCase);

        static bool IsIndexScan(string t) => t.Equals("Index Scan", StringComparison.OrdinalIgnoreCase);

        static bool IsIndexOnlyScan(string t) =>
            t.Contains("Index Only", StringComparison.OrdinalIgnoreCase) &&
            t.Contains("Scan", StringComparison.OrdinalIgnoreCase);

        static bool IsIndexBackedScan(string t) =>
            t.Contains("Index", StringComparison.OrdinalIgnoreCase) &&
            (t.Contains("Scan", StringComparison.OrdinalIgnoreCase) || t.Contains("Only", StringComparison.OrdinalIgnoreCase));

        if ((IsSeq(a) && IsIndexBackedScan(b)) || (IsSeq(b) && IsIndexBackedScan(a)))
            return true;
        if ((IsSeq(a) && IsBitmapHeap(b)) || (IsSeq(b) && IsBitmapHeap(a)))
            return true;
        if ((IsBitmapHeap(a) && IsIndexBackedScan(b)) || (IsBitmapHeap(b) && IsIndexBackedScan(a)))
            return true;
        if ((IsIndexScan(a) && IsIndexOnlyScan(b)) || (IsIndexScan(b) && IsIndexOnlyScan(a)))
            return true;

        return false;
    }

    private static OperatorFamily ClassifyFamily(string nodeType)
    {
        var t = (nodeType ?? "").Trim().ToLowerInvariant();

        // Scan family
        if (t is "seq scan" or "index scan" or "index only scan" or "bitmap heap scan" or "bitmap index scan" or "tid scan" or "subquery scan")
            return OperatorFamily.Scan;

        // Join family
        if (t is "nested loop" or "hash join" or "merge join")
            return OperatorFamily.Join;

        // Aggregate family
        if (t.Contains("aggregate"))
            return OperatorFamily.Aggregate;

        // Sort / materialization family
        if (t is "sort" or "incremental sort" or "materialize" or "memoize")
            return OperatorFamily.SortMaterialize;

        // Append family
        if (t is "append" or "merge append")
            return OperatorFamily.Append;

        // Gather / Gather Merge (not “Partial Aggregate”)
        if (t.Contains("gather", StringComparison.OrdinalIgnoreCase) &&
            !t.Contains("aggregate", StringComparison.OrdinalIgnoreCase))
            return OperatorFamily.Gather;

        return OperatorFamily.Unknown;
    }
}

