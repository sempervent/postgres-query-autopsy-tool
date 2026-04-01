using System.Linq;

namespace PostgresQueryAutopsyTool.Core.Domain;

/// <summary>Small, evidence-based helpers for parallel worker rows (display + light narrative).</summary>
public static class PlanWorkerStatsHelper
{
    public static bool HasWorkers(NormalizedPlanNode node) => node.Workers.Count > 0;

    public static int WorkerCount(NormalizedPlanNode node) => node.Workers.Count;

    public static (long Min, long Max)? SharedReadRange(IReadOnlyList<PlanWorkerStats> workers)
    {
        long? min = null;
        long? max = null;
        foreach (var w in workers)
        {
            if (w.SharedReadBlocks is null) continue;
            var v = w.SharedReadBlocks.Value;
            min = min is null ? v : Math.Min(min.Value, v);
            max = max is null ? v : Math.Max(max.Value, v);
        }

        return min is null || max is null ? null : (min.Value, max.Value);
    }

    public static (long Min, long Max)? TempReadRange(IReadOnlyList<PlanWorkerStats> workers)
    {
        long? min = null;
        long? max = null;
        foreach (var w in workers)
        {
            if (w.TempReadBlocks is null) continue;
            var v = w.TempReadBlocks.Value;
            min = min is null ? v : Math.Min(min.Value, v);
            max = max is null ? v : Math.Max(max.Value, v);
        }

        return min is null || max is null ? null : (min.Value, max.Value);
    }

    public static (double Min, double Max)? TotalTimeMsRange(IReadOnlyList<PlanWorkerStats> workers)
    {
        double? min = null;
        double? max = null;
        foreach (var w in workers)
        {
            if (w.ActualTotalTimeMs is null) continue;
            var v = w.ActualTotalTimeMs.Value;
            min = min is null ? v : Math.Min(min.Value, v);
            max = max is null ? v : Math.Max(max.Value, v);
        }

        return min is null || max is null ? null : (min.Value, max.Value);
    }

    /// <summary>True when shared-read counts differ enough to mention unevenness (conservative).</summary>
    public static bool SharedReadsClearlyUneven(IReadOnlyList<PlanWorkerStats> workers)
    {
        var r = SharedReadRange(workers);
        if (r is null) return false;
        var min = r.Value.Min;
        var max = r.Value.Max;
        if (max == min) return false;
        if (min == 0 && max > 0) return max >= 500;
        if (min <= 0) return false;
        var ratio = max / (double)min;
        var spread = max - min;
        return ratio >= 1.2 && spread >= 500;
    }

    /// <summary>True when worker total times differ clearly (same units as PG actual total time).</summary>
    public static bool TotalTimesClearlyUneven(IReadOnlyList<PlanWorkerStats> workers)
    {
        var r = TotalTimeMsRange(workers);
        if (r is null) return false;
        var min = r.Value.Min;
        var max = r.Value.Max;
        if (max <= 0 || Math.Abs(max - min) < 1e-6) return false;
        return max / Math.Max(min, 1e-6) >= 1.35;
    }

    public static bool AnyWorkerHasTempIo(IReadOnlyList<PlanWorkerStats> workers) =>
        workers.Any(w =>
            (w.TempReadBlocks is not null && w.TempReadBlocks.Value != 0) ||
            (w.TempWrittenBlocks is not null && w.TempWrittenBlocks.Value != 0));
}
