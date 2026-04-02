using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Analysis;

namespace PostgresQueryAutopsyTool.Core.Comparison;

/// <summary>
/// Compare-mode index posture and bounded <see cref="PlanIndexInsight"/> lists between two analyzed plans.
/// Uses node mapping where available; avoids prose equality for matching.
/// </summary>
public static class IndexComparisonAnalyzer
{
    public static IndexComparisonSummary Analyze(
        PlanAnalysisResult planA,
        PlanAnalysisResult planB,
        IReadOnlyList<NodeMatch> matches)
    {
        var mapAtoB = matches.ToDictionary(m => m.NodeIdA, m => m.NodeIdB, StringComparer.Ordinal);
        var mapBtoA = matches.ToDictionary(m => m.NodeIdB, m => m.NodeIdA, StringComparer.Ordinal);

        var overviewLines = BuildOverviewLines(planA.IndexOverview, planB.IndexOverview);
        var insightDiffs = DiffInsights(planA.IndexInsights, planB.IndexInsights, mapAtoB, mapBtoA);
        var narrativeBullets = BuildNarrativeBullets(overviewLines, insightDiffs);
        var chunked = planA.IndexOverview.SuggestsChunkedBitmapWorkload || planB.IndexOverview.SuggestsChunkedBitmapWorkload;

        return new IndexComparisonSummary(overviewLines, insightDiffs, narrativeBullets, chunked);
    }

    public static IReadOnlyList<string> IndexDeltaCuesForPair(
        string nodeIdA,
        string nodeIdB,
        NodePairIdentity identity,
        IndexComparisonSummary indexComparison)
    {
        var cues = new List<string>();

        var fa = identity.AccessPathFamilyA ?? "";
        var fb = identity.AccessPathFamilyB ?? "";
        if (!string.IsNullOrEmpty(fa) && !string.IsNullOrEmpty(fb) && !string.Equals(fa, fb, StringComparison.Ordinal))
            cues.Add($"Access path family: {FamilyLabel(fa)} → {FamilyLabel(fb)}");

        foreach (var d in indexComparison.InsightDiffs)
        {
            if (d.Kind == IndexInsightDiffKind.Unchanged) continue;
            if (!string.Equals(d.NodeIdA, nodeIdA, StringComparison.Ordinal) ||
                !string.Equals(d.NodeIdB, nodeIdB, StringComparison.Ordinal))
                continue;

            var prefix = d.Kind switch
            {
                IndexInsightDiffKind.New => "New index cue",
                IndexInsightDiffKind.Resolved => "Resolved index cue",
                IndexInsightDiffKind.Improved => "Improved index posture",
                IndexInsightDiffKind.Worsened => "Worsened index posture",
                IndexInsightDiffKind.Changed => "Index story shifted",
                _ => "Index cue"
            };
            cues.Add($"{prefix}: {CompactSummary(d.Summary)}");
            if (cues.Count >= 5) break;
        }

        return cues;
    }

    private static string CompactSummary(string s)
    {
        if (string.IsNullOrWhiteSpace(s)) return s;
        return s.Length <= 140 ? s : s[..137] + "…";
    }

    private static string FamilyLabel(string token) => token switch
    {
        IndexAccessPathTokens.SeqScan => "Seq Scan",
        IndexAccessPathTokens.IndexScan => "Index Scan",
        IndexAccessPathTokens.IndexOnlyScan => "Index Only Scan",
        IndexAccessPathTokens.BitmapHeapScan => "Bitmap Heap Scan",
        IndexAccessPathTokens.BitmapIndexScan => "Bitmap Index Scan",
        _ => token
    };

    private static IReadOnlyList<string> BuildOverviewLines(PlanIndexOverview a, PlanIndexOverview b)
    {
        var lines = new List<string>();

        void AddCountDelta(string label, int da, int db)
        {
            if (da == db) return;
            var dir = db > da ? "increased" : "decreased";
            lines.Add($"{label} {dir} from {da} to {db}.");
        }

        AddCountDelta("Sequential scans", a.SeqScanCount, b.SeqScanCount);
        AddCountDelta("Index scans", a.IndexScanCount, b.IndexScanCount);
        AddCountDelta("Index-only scans", a.IndexOnlyScanCount, b.IndexOnlyScanCount);
        AddCountDelta("Bitmap heap scans", a.BitmapHeapScanCount, b.BitmapHeapScanCount);
        AddCountDelta("Bitmap index scans", a.BitmapIndexScanCount, b.BitmapIndexScanCount);

        if (a.SuggestsChunkedBitmapWorkload && !b.SuggestsChunkedBitmapWorkload)
            lines.Add("Chunked bitmap workload pattern (Append + many bitmap heap scans) present on Plan A is not flagged on Plan B.");
        else if (!a.SuggestsChunkedBitmapWorkload && b.SuggestsChunkedBitmapWorkload)
            lines.Add("Plan B now matches a chunked bitmap workload pattern (Append + many bitmap heap scans).");
        else if (a.SuggestsChunkedBitmapWorkload && b.SuggestsChunkedBitmapWorkload)
            lines.Add("Chunked bitmap workload pattern remains flagged on both plans.");

        var indexishA = a.IndexScanCount + a.IndexOnlyScanCount + a.BitmapHeapScanCount + a.BitmapIndexScanCount;
        var indexishB = b.IndexScanCount + b.IndexOnlyScanCount + b.BitmapHeapScanCount + b.BitmapIndexScanCount;
        if (indexishB > indexishA && b.SeqScanCount < a.SeqScanCount && (a.SeqScanCount > 0 || indexishA > 0))
            lines.Add("Plan B shows more index/bitmap-backed scan operators and fewer sequential scans than Plan A.");
        else if (indexishB < indexishA && b.SeqScanCount > a.SeqScanCount)
            lines.Add("Plan B shows fewer index/bitmap-backed scan operators and more sequential scans than Plan A.");

        return lines;
    }

    private static IReadOnlyList<string> BuildNarrativeBullets(
        IReadOnlyList<string> overviewLines,
        IReadOnlyList<IndexInsightDiffItem> diffs)
    {
        var bullets = new List<string>();
        foreach (var o in overviewLines.Take(3))
            bullets.Add(o);

        var ranked = diffs
            .Where(d => d.Kind != IndexInsightDiffKind.Unchanged)
            .OrderByDescending(d => DiffPriority(d.Kind))
            .ThenByDescending(d => d.Summary.Length)
            .Take(5)
            .Select(d => $"{d.Kind}: {d.Summary}");

        bullets.AddRange(ranked);
        return bullets;
    }

    private static int DiffPriority(IndexInsightDiffKind k) => k switch
    {
        IndexInsightDiffKind.Worsened => 5,
        IndexInsightDiffKind.New => 4,
        IndexInsightDiffKind.Changed => 3,
        IndexInsightDiffKind.Resolved => 2,
        IndexInsightDiffKind.Improved => 2,
        _ => 0
    };

    private static IReadOnlyList<IndexInsightDiffItem> DiffInsights(
        IReadOnlyList<PlanIndexInsight> listA,
        IReadOnlyList<PlanIndexInsight> listB,
        IReadOnlyDictionary<string, string> mapAtoB,
        IReadOnlyDictionary<string, string> mapBtoA)
    {
        var a = listA.ToList();
        var b = listB.ToList();
        var usedA = new HashSet<int>();
        var usedB = new HashSet<int>();
        var results = new List<IndexInsightDiffItem>();

        // 1) Same mapped node id (strongest tie).
        for (var i = 0; i < a.Count; i++)
        {
            if (usedA.Contains(i)) continue;
            if (!mapAtoB.TryGetValue(a[i].NodeId, out var nb)) continue;

            var candidates = b
                .Select((ins, j) => (ins, j))
                .Where(x => !usedB.Contains(x.j) && string.Equals(x.ins.NodeId, nb, StringComparison.Ordinal))
                .ToArray();

            if (candidates.Length == 0) continue;

            var best = candidates
                .OrderByDescending(x => SignalOverlap(a[i].SignalKinds, x.ins.SignalKinds))
                .ThenByDescending(x => RelationMatchScore(a[i].RelationName, x.ins.RelationName))
                .First();

            usedA.Add(i);
            usedB.Add(best.j);
            results.Add(ClassifyPair(a[i], best.ins));
        }

        // 2) Fingerprint match (structured, not prose).
        for (var i = 0; i < a.Count; i++)
        {
            if (usedA.Contains(i)) continue;
            var fp = Fingerprint(a[i]);
            var hit = -1;
            for (var j = 0; j < b.Count; j++)
            {
                if (usedB.Contains(j)) continue;
                if (Fingerprint(b[j]) != fp) continue;
                hit = j;
                break;
            }

            if (hit < 0) continue;
            usedA.Add(i);
            usedB.Add(hit);
            results.Add(ClassifyPair(a[i], b[hit]));
        }

        // 3) Soft match: same normalized relation + any overlapping signal kind.
        for (var i = 0; i < a.Count; i++)
        {
            if (usedA.Contains(i)) continue;
            var relA = NormalizeRelation(a[i].RelationName);
            if (relA.Length == 0) continue;

            var bestJ = -1;
            var bestScore = 0;
            for (var j = 0; j < b.Count; j++)
            {
                if (usedB.Contains(j)) continue;
                if (!string.Equals(NormalizeRelation(b[j].RelationName), relA, StringComparison.OrdinalIgnoreCase))
                    continue;
                var ov = SignalOverlap(a[i].SignalKinds, b[j].SignalKinds);
                if (ov > bestScore)
                {
                    bestScore = ov;
                    bestJ = j;
                }
            }

            if (bestJ < 0 || bestScore == 0) continue;
            usedA.Add(i);
            usedB.Add(bestJ);
            results.Add(ClassifyPair(a[i], b[bestJ]));
        }

        for (var i = 0; i < a.Count; i++)
        {
            if (usedA.Contains(i)) continue;
            results.Add(ResolvedOnly(a[i]));
        }

        for (var j = 0; j < b.Count; j++)
        {
            if (usedB.Contains(j)) continue;
            results.Add(NewOnly(b[j], mapBtoA));
        }

        return results
            .OrderByDescending(r => DiffPriority(r.Kind))
            .ThenByDescending(r => r.Summary.Length)
            .ToArray();
    }

    private static int SignalOverlap(IReadOnlyList<string> x, IReadOnlyList<string> y)
    {
        if (x.Count == 0 || y.Count == 0) return 0;
        var setY = new HashSet<string>(y, StringComparer.OrdinalIgnoreCase);
        return x.Count(s => setY.Contains(s));
    }

    private static int RelationMatchScore(string? ra, string? rb)
    {
        var a = NormalizeRelation(ra);
        var b = NormalizeRelation(rb);
        if (a.Length == 0 && b.Length == 0) return 0;
        return string.Equals(a, b, StringComparison.OrdinalIgnoreCase) ? 2 : 0;
    }

    private static string NormalizeRelation(string? r)
        => string.IsNullOrWhiteSpace(r) ? "" : r.Trim();

    private static string Fingerprint(PlanIndexInsight i)
    {
        var sk = string.Join(",", i.SignalKinds.Order(StringComparer.OrdinalIgnoreCase));
        return $"{sk}|{NormalizeRelation(i.RelationName)}|{NormalizeRelation(i.IndexName ?? "")}|{i.AccessPathFamily}";
    }

    private static IndexInsightDiffItem ClassifyPair(PlanIndexInsight ia, PlanIndexInsight ib)
    {
        var nodeA = ia.NodeId;
        var nodeB = ib.NodeId;
        var famA = ia.AccessPathFamily;
        var famB = ib.AccessPathFamily;

        if (Fingerprint(ia) == Fingerprint(ib))
        {
            var stress = CompareStress(ia.Facts, ib.Facts);
            if (stress > 0.06)
                return Item(IndexInsightDiffKind.Worsened,
                    $"Same index signals on `{Rel(ia)}`; read/time stress proxies increased on Plan B.",
                    ia, ib, nodeA, nodeB, famA, famB);
            if (stress < -0.06)
                return Item(IndexInsightDiffKind.Improved,
                    $"Same index signals on `{Rel(ia)}`; read/time stress proxies decreased on Plan B.",
                    ia, ib, nodeA, nodeB, famA, famB);
            return Item(IndexInsightDiffKind.Unchanged,
                $"Index investigation emphasis unchanged on mapped node (`{Rel(ia)}`).",
                ia, ib, nodeA, nodeB, famA, famB);
        }

        var missA = Has(ia, IndexSignalAnalyzer.SignalMissingIndexInvestigation);
        var missB = Has(ib, IndexSignalAnalyzer.SignalMissingIndexInvestigation);
        var costlyA = Has(ia, IndexSignalAnalyzer.SignalIndexPathStillCostly);
        var costlyB = Has(ib, IndexSignalAnalyzer.SignalIndexPathStillCostly);
        var sortA = Has(ia, IndexSignalAnalyzer.SignalSortOrderSupportOpportunity);
        var sortB = Has(ib, IndexSignalAnalyzer.SignalSortOrderSupportOpportunity);
        var bmpA = Has(ia, IndexSignalAnalyzer.SignalBitmapRecheckOrHeapHeavy);
        var bmpB = Has(ib, IndexSignalAnalyzer.SignalBitmapRecheckOrHeapHeavy);
        var nlA = Has(ia, IndexSignalAnalyzer.SignalJoinInnerIndexSupport);
        var nlB = Has(ib, IndexSignalAnalyzer.SignalJoinInnerIndexSupport);

        if (missA && !missB)
        {
            if (costlyB && IsIndexishFamily(ib.AccessPathFamily))
                return Item(IndexInsightDiffKind.Changed,
                    $"Missing-index-style cue on Plan A is absent on Plan B; mapped node now shows an index path that remains read-heavy (`{Rel(ib)}`).",
                    ia, ib, nodeA, nodeB, famA, famB);
            if (IsIndexishFamily(ib.AccessPathFamily) || IsBitmapFamily(ib.AccessPathFamily))
                return Item(IndexInsightDiffKind.Improved,
                    $"Missing-index-style investigation cue on `{Rel(ia)}` is not present on the mapped Plan B node; access shifted toward index/bitmap-backed operators.",
                    ia, ib, nodeA, nodeB, famA, famB);
            return Item(IndexInsightDiffKind.Improved,
                $"Missing-index-style investigation cue on `{Rel(ia)}` no longer appears on the mapped Plan B node.",
                ia, ib, nodeA, nodeB, famA, famB);
        }

        if (!missA && missB)
            return Item(IndexInsightDiffKind.Worsened,
                $"Plan B introduces a missing-index-style investigation cue on `{Rel(ib)}` where Plan A did not flag one on the mapped node.",
                ia, ib, nodeA, nodeB, famA, famB);

        if (costlyA && !costlyB)
            return Item(IndexInsightDiffKind.Improved,
                $"Index-path still-costly cue on `{Rel(ia)}` is not present on the mapped Plan B node.",
                ia, ib, nodeA, nodeB, famA, famB);

        if (!costlyA && costlyB)
            return Item(IndexInsightDiffKind.Worsened,
                $"Plan B flags an index path as still read-heavy on `{Rel(ib)}` where Plan A did not on the mapped node.",
                ia, ib, nodeA, nodeB, famA, famB);

        if (costlyA && costlyB)
        {
            var stress = CompareStress(ia.Facts, ib.Facts);
            if (stress > 0.06)
                return Item(IndexInsightDiffKind.Worsened,
                    $"Index path remains costly on `{Rel(ia)}`; stress proxies worsened on Plan B.",
                    ia, ib, nodeA, nodeB, famA, famB);
            if (stress < -0.06)
                return Item(IndexInsightDiffKind.Improved,
                    $"Index path remains costly on `{Rel(ia)}`; stress proxies improved on Plan B.",
                    ia, ib, nodeA, nodeB, famA, famB);
            return Item(IndexInsightDiffKind.Changed,
                $"Index path still read-heavy on both sides; emphasis or facts shifted on `{Rel(ia)}`.",
                ia, ib, nodeA, nodeB, famA, famB);
        }

        if (sortA && !sortB)
            return Item(IndexInsightDiffKind.Improved,
                $"Sort-order support opportunity flagged on Plan A is not present on the mapped Plan B node.",
                ia, ib, nodeA, nodeB, famA, famB);

        if (!sortA && sortB)
            return Item(IndexInsightDiffKind.Worsened,
                $"Plan B introduces a sort-order support opportunity on the mapped node.",
                ia, ib, nodeA, nodeB, famA, famB);

        if (bmpA && !bmpB)
            return Item(IndexInsightDiffKind.Improved,
                $"Bitmap/recheck or heap-heavy index cue on Plan A is not present on the mapped Plan B node.",
                ia, ib, nodeA, nodeB, famA, famB);

        if (!bmpA && bmpB)
            return Item(IndexInsightDiffKind.Worsened,
                $"Plan B introduces a bitmap/recheck or heap-heavy index cue on the mapped node.",
                ia, ib, nodeA, nodeB, famA, famB);

        if (nlA && !nlB)
            return Item(IndexInsightDiffKind.Improved,
                $"Nested-loop inner-side index support concern on Plan A is not flagged on the mapped Plan B node.",
                ia, ib, nodeA, nodeB, famA, famB);

        if (!nlA && nlB)
            return Item(IndexInsightDiffKind.Worsened,
                $"Plan B flags nested-loop inner-side index support on the mapped node.",
                ia, ib, nodeA, nodeB, famA, famB);

        return Item(IndexInsightDiffKind.Changed,
            $"Index investigation emphasis shifted between plans on mapped node (`{Rel(ia)}` / `{Rel(ib)}`).",
            ia, ib, nodeA, nodeB, famA, famB);
    }

    private static bool IsIndexishFamily(string f) =>
        f is IndexAccessPathTokens.IndexScan or IndexAccessPathTokens.IndexOnlyScan;

    private static bool IsBitmapFamily(string f) =>
        f is IndexAccessPathTokens.BitmapHeapScan or IndexAccessPathTokens.BitmapIndexScan;

    private static bool Has(PlanIndexInsight i, string kind)
        => i.SignalKinds.Any(s => string.Equals(s, kind, StringComparison.OrdinalIgnoreCase));

    private static string Rel(PlanIndexInsight i)
        => string.IsNullOrWhiteSpace(i.RelationName) ? "relation" : i.RelationName!;

    private static double CompareStress(IReadOnlyDictionary<string, object?> fa, IReadOnlyDictionary<string, object?> fb)
    {
        var a = Stress(fa);
        var b = Stress(fb);
        return b - a;
    }

    private static double Stress(IReadOnlyDictionary<string, object?> f)
    {
        var t = GetDouble(f, "subtreeTimeShareOfPlan");
        var r = GetDouble(f, "sharedReadShareOfPlan");
        return (t ?? 0) + (r ?? 0) * 1.5;
    }

    private static double? GetDouble(IReadOnlyDictionary<string, object?> f, string key)
    {
        if (!f.TryGetValue(key, out var v) || v is null) return null;
        return v switch
        {
            double d => d,
            float fl => fl,
            int i => i,
            long l => l,
            JsonElement je when je.ValueKind == JsonValueKind.Number => je.GetDouble(),
            _ => null
        };
    }

    private static IndexInsightDiffItem ResolvedOnly(PlanIndexInsight ia)
        => new(
            IndexInsightDiffKind.Resolved,
            $"Resolved on Plan B side (no matching bounded index insight): {ia.Headline}",
            ia,
            null,
            ia.NodeId,
            null,
            ia.AccessPathFamily,
            null,
            Array.Empty<int>(),
            "",
            null);

    private static IndexInsightDiffItem NewOnly(PlanIndexInsight ib, IReadOnlyDictionary<string, string> mapBtoA)
    {
        mapBtoA.TryGetValue(ib.NodeId, out var nodeA);
        return new(
            IndexInsightDiffKind.New,
            $"New on Plan B (no matching Plan A insight): {ib.Headline}",
            null,
            ib,
            nodeA,
            ib.NodeId,
            null,
            ib.AccessPathFamily,
            Array.Empty<int>(),
            "",
            null);
    }

    private static IndexInsightDiffItem Item(
        IndexInsightDiffKind kind,
        string summary,
        PlanIndexInsight? ia,
        PlanIndexInsight? ib,
        string? nodeA,
        string? nodeB,
        string? famA,
        string? famB)
        => new(kind, summary, ia, ib, nodeA, nodeB, famA, famB, Array.Empty<int>(), "", null);
}
