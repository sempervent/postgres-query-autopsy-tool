namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>Phase 60: conservative “because → likely” one-liners for bottleneck cards (not causal proof).</summary>
internal static class BottleneckPropagationHelper
{
    public static string? PropagationNote(
        AnalyzedPlanNode? node,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId,
        string kind,
        BottleneckClass bc,
        BottleneckCauseHint cause)
    {
        if (node is null)
            return null;

        if (bc == BottleneckClass.SortOrSpillPressure && cause == BottleneckCauseHint.DownstreamSymptom)
            return "Because → likely: heavy ordering here often follows a wide or repeated rowset upstream—inspect what feeds this sort before sort-only tuning.";

        if (bc == BottleneckClass.SortOrSpillPressure && cause == BottleneckCauseHint.PrimaryFocus)
            return "Because → likely: many rows or wide rows reaching this sort—reducing row volume or satisfying order earlier usually beats tweaking the sort node alone.";

        if (bc == BottleneckClass.JoinAmplification)
            return "Because → likely: repeated inner-side work scales with outer cardinality and inner access path together—both sides merit inspection.";

        if (kind.Equals("io_read", StringComparison.OrdinalIgnoreCase) && bc == BottleneckClass.AccessPathMismatch)
            return "Because → likely: an index path is in play but heap fetches, rechecks, or pruning may dominate—test filter vs join-key vs order support before adding indexes.";

        if (bc == BottleneckClass.IoHotspot && kind.Equals("io_read", StringComparison.OrdinalIgnoreCase))
            return "Because → likely: high shared reads here may reflect weak selectivity, join amplification, or chunk fan-out—not only a missing btree.";

        if (bc == BottleneckClass.ScanFanout)
            return "Because → likely: scan cost can amplify everything downstream; reducing fan-out upstream often beats micro-tuning this scan.";

        if (bc == BottleneckClass.QueryShapeBoundary)
            return "Because → likely: row volume crossing this CTE/subquery boundary feeds the outer plan—shape here is a primary lever before leaf optimizations.";

        if (bc == BottleneckClass.AggregationPressure)
            return "Because → likely: large grouped input or heavy partial aggregates upstream usually dominates aggregation cost here.";

        if (bc == BottleneckClass.PlannerMisestimation)
            return "Because → likely: mis-estimation is a signal to verify statistics and predicate selectivity; the hot operator may still be a symptom of shape.";

        if (cause == BottleneckCauseHint.DownstreamSymptom)
            return "Because → likely: heat here may be driven by upstream join or row multiplication—walk parents before local fixes.";

        return null;
    }
}
