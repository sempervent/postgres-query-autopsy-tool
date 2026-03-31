namespace PostgresQueryAutopsyTool.Core.OperatorEvidence;

public static class ContextEvidenceDiffSummarizer
{
    public sealed record Options(
        int MaxHighlights = 4,
        double SignificantPct = 0.30);

    public static OperatorContextEvidenceDiff? Diff(OperatorContextEvidence? a, OperatorContextEvidence? b, Options? options = null)
    {
        if (a is null && b is null) return null;
        var opt = options ?? new Options();

        var hash = DiffHashBuild(a?.HashJoin, b?.HashJoin, opt);
        var waste = DiffScanWaste(a?.ScanWaste, b?.ScanWaste, opt);
        var sort = DiffSort(a?.Sort, b?.Sort, opt);
        var memo = DiffMemoize(a?.Memoize, b?.Memoize, opt);
        var nl = DiffNestedLoop(a?.NestedLoop, b?.NestedLoop, opt);

        var highlights = new List<string>();
        AddHighlights(highlights, hash?.Summary);
        AddHighlights(highlights, waste?.Summary);
        AddHighlights(highlights, sort?.Summary);
        AddHighlights(highlights, memo?.Summary);
        AddHighlights(highlights, nl?.Summary);

        highlights = highlights.Where(s => !string.IsNullOrWhiteSpace(s)).Distinct(StringComparer.Ordinal).Take(opt.MaxHighlights).ToList();

        var overall = ReduceOverall(new[]
        {
            hash?.PressureDirection,
            waste?.WasteDirection,
            sort?.SortSpillDirection,
            memo?.EffectivenessDirection,
            nl?.AmplificationDirection
        });

        if (hash is null && waste is null && sort is null && memo is null && nl is null)
            return null;

        return new OperatorContextEvidenceDiff(hash, waste, sort, memo, nl, highlights, overall);
    }

    private static HashBuildContextDiff? DiffHashBuild(HashJoinContextEvidence? a, HashJoinContextEvidence? b, Options opt)
    {
        var ha = a?.ChildHash;
        var hb = b?.ChildHash;
        if (ha is null && hb is null) return null;

        var batches = DeltaLong(ha?.HashBatches, hb?.HashBatches, betterWhenLower: true);
        var disk = DeltaLong(ha?.DiskUsageKb, hb?.DiskUsageKb, betterWhenLower: true);
        var mem = DeltaLong(ha?.PeakMemoryUsageKb, hb?.PeakMemoryUsageKb, betterWhenLower: null);

        // Pressure direction: batching/disk are the primary signals; memory is ambiguous.
        var pressure = ReduceDirection(new[] { batches.Direction, disk.Direction }, preferMixed: true);

        string? summary = null;
        if (batches.Delta is not null && Math.Abs(batches.Delta.Value) > 0)
            summary = $"hash build: batches {Fmt(ha?.HashBatches)}→{Fmt(hb?.HashBatches)}";
        if (disk.Delta is not null && (disk.B ?? 0) > 0 && (disk.A ?? 0) == 0)
            summary = Append(summary, $"; disk 0→{FmtKb(hb?.DiskUsageKb)}");
        else if (disk.Delta is not null && Math.Abs(disk.Delta.Value) > 0)
            summary = Append(summary, $"; disk {FmtKb(ha?.DiskUsageKb)}→{FmtKb(hb?.DiskUsageKb)}");

        return new HashBuildContextDiff(batches, disk, mem, pressure, summary);
    }

    private static ScanWasteContextDiff? DiffScanWaste(ScanWasteContextEvidence? a, ScanWasteContextEvidence? b, Options opt)
    {
        if (a is null && b is null) return null;

        var removed = DeltaLong(a?.RowsRemovedByFilter, b?.RowsRemovedByFilter, betterWhenLower: true);
        var share = DeltaDouble(a?.RemovedRowsShareApprox, b?.RemovedRowsShareApprox, betterWhenLower: true);
        var recheck = DeltaLong(a?.RowsRemovedByIndexRecheck, b?.RowsRemovedByIndexRecheck, betterWhenLower: true);
        var heap = DeltaLong(a?.HeapFetches, b?.HeapFetches, betterWhenLower: true);

        var wasteDir = ReduceDirection(new[] { removed.Direction, share.Direction, recheck.Direction, heap.Direction }, preferMixed: true);

        string? summary = null;
        if (removed.Delta is not null && Math.Abs(removed.Delta.Value) > 0)
            summary = $"scan waste: removedByFilter {Fmt(a?.RowsRemovedByFilter)}→{Fmt(b?.RowsRemovedByFilter)}";
        else if (share.Delta is not null && Math.Abs(share.Delta.Value) > 0.01)
            summary = $"scan waste: removedShare {FmtPct(a?.RemovedRowsShareApprox)}→{FmtPct(b?.RemovedRowsShareApprox)}";

        if (summary is not null && (recheck.Delta is not null && Math.Abs(recheck.Delta.Value) > 0))
            summary = Append(summary, $"; recheck {Fmt(a?.RowsRemovedByIndexRecheck)}→{Fmt(b?.RowsRemovedByIndexRecheck)}");

        return new ScanWasteContextDiff(removed, share, recheck, heap, wasteDir, summary);
    }

    private static SortContextDiff? DiffSort(SortContextEvidence? a, SortContextEvidence? b, Options opt)
    {
        if (a is null && b is null) return null;

        var method = DeltaString(a?.SortMethod, b?.SortMethod);
        var disk = DeltaLong(a?.DiskUsageKb, b?.DiskUsageKb, betterWhenLower: true);
        var space = DeltaLong(a?.SortSpaceUsedKb, b?.SortSpaceUsedKb, betterWhenLower: true);

        var spilledA = (a?.DiskUsageKb ?? 0) > 0 || (a?.SortMethod?.Contains("external", StringComparison.OrdinalIgnoreCase) ?? false);
        var spilledB = (b?.DiskUsageKb ?? 0) > 0 || (b?.SortMethod?.Contains("external", StringComparison.OrdinalIgnoreCase) ?? false);

        EvidenceChangeDirection spillDir =
            spilledA == spilledB ? EvidenceChangeDirection.Neutral :
            spilledB && !spilledA ? EvidenceChangeDirection.Worsened :
            !spilledB && spilledA ? EvidenceChangeDirection.Improved :
            EvidenceChangeDirection.Changed;

        string? summary = null;
        if (spilledA != spilledB)
            summary = $"sort context: {(spilledA ? "disk-backed" : "in-memory")}→{(spilledB ? "disk-backed" : "in-memory")}";
        else if (method.Direction == EvidenceChangeDirection.Changed)
            summary = $"sort context: method {a?.SortMethod ?? "n/a"}→{b?.SortMethod ?? "n/a"}";

        return new SortContextDiff(method, disk, space, spillDir, summary);
    }

    private static MemoizeContextDiff? DiffMemoize(MemoizeContextEvidence? a, MemoizeContextEvidence? b, Options opt)
    {
        if (a is null && b is null) return null;
        var hits = DeltaLong(a?.CacheHits, b?.CacheHits, betterWhenLower: null);
        var misses = DeltaLong(a?.CacheMisses, b?.CacheMisses, betterWhenLower: true);
        var hr = DeltaDouble(a?.HitRate, b?.HitRate, betterWhenLower: false);

        var eff = ReduceDirection(new[] { hr.Direction, misses.Direction }, preferMixed: true);

        string? summary = null;
        if (hr.Delta is not null && Math.Abs(hr.Delta.Value) > 0.05)
            summary = $"memoize: hitRate {FmtPct(a?.HitRate)}→{FmtPct(b?.HitRate)}";

        return new MemoizeContextDiff(hits, misses, hr, eff, summary);
    }

    private static NestedLoopContextDiff? DiffNestedLoop(NestedLoopContextEvidence? a, NestedLoopContextEvidence? b, Options opt)
    {
        if (a is null && b is null) return null;
        var loops = DeltaLong(a?.InnerLoopsApprox, b?.InnerLoopsApprox, betterWhenLower: true);
        var share = DeltaDouble(a?.InnerSubtreeTimeShareOfPlan, b?.InnerSubtreeTimeShareOfPlan, betterWhenLower: true);

        var innerWaste = DiffScanWaste(a?.InnerSideScanWaste, b?.InnerSideScanWaste, opt);
        var amp = ReduceDirection(new[] { loops.Direction, share.Direction }.Concat(innerWaste is null ? Array.Empty<EvidenceChangeDirection>() : new[] { innerWaste.WasteDirection }), preferMixed: true);

        string? summary = null;
        if (loops.Delta is not null && Math.Abs(loops.Delta.Value) > 0)
            summary = $"nested loop: inner loops {Fmt(a?.InnerLoopsApprox)}→{Fmt(b?.InnerLoopsApprox)}";

        return new NestedLoopContextDiff(loops, share, innerWaste, amp, summary);
    }

    private static void AddHighlights(List<string> list, string? summary)
    {
        if (!string.IsNullOrWhiteSpace(summary)) list.Add(summary);
    }

    private static EvidenceChangeDirection ReduceOverall(IEnumerable<EvidenceChangeDirection?> dirs)
    {
        var d = dirs.Where(x => x is not null).Select(x => x!.Value).ToArray();
        if (d.Length == 0) return EvidenceChangeDirection.NotApplicable;
        if (d.Any(x => x == EvidenceChangeDirection.Mixed)) return EvidenceChangeDirection.Mixed;
        if (d.Any(x => x == EvidenceChangeDirection.Worsened) && d.Any(x => x == EvidenceChangeDirection.Improved)) return EvidenceChangeDirection.Mixed;
        if (d.Any(x => x == EvidenceChangeDirection.Worsened)) return EvidenceChangeDirection.Worsened;
        if (d.Any(x => x == EvidenceChangeDirection.Improved)) return EvidenceChangeDirection.Improved;
        if (d.All(x => x == EvidenceChangeDirection.Neutral)) return EvidenceChangeDirection.Neutral;
        return EvidenceChangeDirection.Changed;
    }

    private static EvidenceChangeDirection ReduceDirection(IEnumerable<EvidenceChangeDirection> dirs, bool preferMixed)
    {
        var d = dirs.Where(x => x is not EvidenceChangeDirection.NotApplicable and not EvidenceChangeDirection.Unknown).ToArray();
        if (d.Length == 0) return EvidenceChangeDirection.NotApplicable;
        if (d.All(x => x == EvidenceChangeDirection.Neutral)) return EvidenceChangeDirection.Neutral;
        var hasImp = d.Any(x => x == EvidenceChangeDirection.Improved);
        var hasW = d.Any(x => x == EvidenceChangeDirection.Worsened);
        if (hasImp && hasW) return EvidenceChangeDirection.Mixed;
        if (hasW) return EvidenceChangeDirection.Worsened;
        if (hasImp) return EvidenceChangeDirection.Improved;
        return preferMixed ? EvidenceChangeDirection.Changed : EvidenceChangeDirection.Changed;
    }

    private static ScalarDeltaLong DeltaLong(long? a, long? b, bool? betterWhenLower)
    {
        if (a is null && b is null) return new ScalarDeltaLong(a, b, null, null, EvidenceChangeDirection.NotApplicable);
        if (a is null || b is null) return new ScalarDeltaLong(a, b, null, null, EvidenceChangeDirection.Unknown);
        var delta = b.Value - a.Value;
        var pct = a.Value != 0 ? (double)delta / a.Value : (double?)null;
        var dir = Direction(delta, betterWhenLower);
        return new ScalarDeltaLong(a, b, delta, pct, dir);
    }

    private static ScalarDeltaDouble DeltaDouble(double? a, double? b, bool? betterWhenLower)
    {
        if (a is null && b is null) return new ScalarDeltaDouble(a, b, null, null, EvidenceChangeDirection.NotApplicable);
        if (a is null || b is null) return new ScalarDeltaDouble(a, b, null, null, EvidenceChangeDirection.Unknown);
        var delta = b.Value - a.Value;
        var pct = Math.Abs(a.Value) > 1e-9 ? (delta / a.Value) : (double?)null;
        var dir = Direction(delta, betterWhenLower);
        return new ScalarDeltaDouble(a, b, delta, pct, dir);
    }

    private static ScalarDeltaString DeltaString(string? a, string? b)
    {
        if (string.IsNullOrWhiteSpace(a) && string.IsNullOrWhiteSpace(b))
            return new ScalarDeltaString(a, b, EvidenceChangeDirection.NotApplicable);
        if (string.Equals(a, b, StringComparison.OrdinalIgnoreCase))
            return new ScalarDeltaString(a, b, EvidenceChangeDirection.Neutral);
        return new ScalarDeltaString(a, b, EvidenceChangeDirection.Changed);
    }

    private static EvidenceChangeDirection Direction(double delta, bool? betterWhenLower)
    {
        if (Math.Abs(delta) < 1e-9) return EvidenceChangeDirection.Neutral;
        if (betterWhenLower is true) return delta < 0 ? EvidenceChangeDirection.Improved : EvidenceChangeDirection.Worsened;
        if (betterWhenLower is false) return delta > 0 ? EvidenceChangeDirection.Improved : EvidenceChangeDirection.Worsened;
        return EvidenceChangeDirection.Changed;
    }

    private static string Append(string? baseText, string addition)
        => string.IsNullOrWhiteSpace(baseText) ? addition : $"{baseText}{addition}";

    private static string Fmt(long? v) => v is null ? "n/a" : v.Value.ToString();
    private static string Fmt(double? v) => v is null ? "n/a" : v.Value.ToString("F3");
    private static string FmtKb(long? v) => v is null ? "n/a" : $"{v.Value}";
    private static string FmtPct(double? v) => v is null ? "n/a" : v.Value.ToString("P0");
}

