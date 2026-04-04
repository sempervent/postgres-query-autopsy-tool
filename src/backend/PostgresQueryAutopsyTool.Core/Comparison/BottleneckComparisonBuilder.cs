using PostgresQueryAutopsyTool.Core.Analysis;

namespace PostgresQueryAutopsyTool.Core.Comparison;

internal static class BottleneckComparisonBuilder
{
    public static BottleneckComparisonBrief Build(PlanAnalysisResult a, PlanAnalysisResult b)
    {
        var ba = a.Summary.Bottlenecks;
        var bb = b.Summary.Bottlenecks;
        var lines = new List<string>();

        if (ba.Count == 0 && bb.Count == 0)
            return new BottleneckComparisonBrief(Array.Empty<string>());

        if (ba.Count == 0 && bb.Count > 0)
        {
            lines.Add(
                "Plan B has prioritized bottlenecks while plan A does not—often timing/buffer evidence differs, or the snapshot is incomplete on A.");
            AppendPrimary(bb, lines, "B");
            return new BottleneckComparisonBrief(lines);
        }

        if (ba.Count > 0 && bb.Count == 0)
        {
            lines.Add(
                "Plan A had prioritized bottlenecks but plan B does not—B may lack ANALYZE timing, or the plan shape changed enough that heuristics no longer anchor.");
            return new BottleneckComparisonBrief(lines);
        }

        var ca = ba[0].BottleneckClass;
        var cb = bb[0].BottleneckClass;
        if (ca == cb)
        {
            lines.Add(
                $"Primary bottleneck class is unchanged ({FormatClass(cb)}). Use pair timing and read deltas to see whether magnitude improved.");
        }
        else
        {
            lines.Add($"Primary bottleneck class shifted: plan A was {FormatClass(ca)}; plan B is {FormatClass(cb)}.");
        }

        var setA = ba.Take(3).Select(x => x.BottleneckClass).ToHashSet();
        var setB = bb.Take(3).Select(x => x.BottleneckClass).ToHashSet();
        var onlyB = setB.Where(c => !setA.Contains(c)).ToArray();
        if (onlyB.Length > 0)
            lines.Add("Plan B adds ranked emphasis on: " + string.Join(", ", onlyB.Select(FormatClass)) + ".");

        var onlyA = setA.Where(c => !setB.Contains(c)).ToArray();
        if (onlyA.Length > 0)
            lines.Add("Plan A had ranked emphasis not seen in B’s top three: " + string.Join(", ", onlyA.Select(FormatClass)) + ".");

        AppendCauseShift(ba[0], bb[0], lines);

        return new BottleneckComparisonBrief(lines.Take(5).ToArray());
    }

    private static void AppendPrimary(IReadOnlyList<PlanBottleneckInsight> b, List<string> lines, string label)
    {
        if (b.Count == 0) return;
        var x = b[0];
        lines.Add($"Plan {label} primary: {FormatClass(x.BottleneckClass)} — {x.Headline} ({FormatCause(x.CauseHint)}).");
    }

    private static void AppendCauseShift(
        PlanBottleneckInsight a,
        PlanBottleneckInsight b,
        List<string> lines)
    {
        if (a.BottleneckClass != b.BottleneckClass || a.CauseHint == b.CauseHint) return;
        lines.Add(
            $"Framing differs: A marked as {FormatCause(a.CauseHint)}; B as {FormatCause(b.CauseHint)} for the leading anchor—treat as guidance, not proof of causality.");
    }

    private static string FormatClass(BottleneckClass c) =>
        c switch
        {
            BottleneckClass.CpuHotspot => "CPU / operator hotspot",
            BottleneckClass.IoHotspot => "shared-read / I/O concentration",
            BottleneckClass.SortOrSpillPressure => "sort or spill pressure",
            BottleneckClass.JoinAmplification => "join or repeated inner work",
            BottleneckClass.ScanFanout => "scan fan-out / row inflation",
            BottleneckClass.AggregationPressure => "aggregation pressure",
            BottleneckClass.QueryShapeBoundary => "CTE/subquery boundary shape",
            BottleneckClass.PlannerMisestimation => "planner mis-estimation signal",
            BottleneckClass.AccessPathMismatch => "index path still read-heavy",
            _ => "general timing concentration"
        };

    private static string FormatCause(BottleneckCauseHint h) =>
        h switch
        {
            BottleneckCauseHint.PrimaryFocus => "primary focus",
            BottleneckCauseHint.DownstreamSymptom => "likely downstream of upstream shape",
            _ => "ambiguous framing"
        };
}
