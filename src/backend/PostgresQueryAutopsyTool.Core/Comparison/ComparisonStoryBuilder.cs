using System.Linq;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Findings;

namespace PostgresQueryAutopsyTool.Core.Comparison;

public static class ComparisonStoryBuilder
{
    private static string? TrimBeatBrief(string? s, int max = 200)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var t = s.Trim().Replace('\n', ' ');
        if (t.Length <= max) return t;
        return t[..(max - 1)] + "…";
    }

    public static ComparisonStory Build(
        PlanAnalysisResult planA,
        PlanAnalysisResult planB,
        ComparisonSummary summary,
        IReadOnlyList<NodeDelta> topWorsened,
        IReadOnlyList<NodeDelta> topImproved,
        FindingsDiff findingsDiff,
        BottleneckComparisonBrief? bottleneckBrief = null)
    {
        var byIdA = planA.Nodes.ToDictionary(n => n.NodeId, StringComparer.Ordinal);
        var byIdB = planB.Nodes.ToDictionary(n => n.NodeId, StringComparer.Ordinal);
        var ctxA = new FindingEvaluationContext(planA.RootNodeId, planA.Nodes);
        var ctxB = new FindingEvaluationContext(planB.RootNodeId, planB.Nodes);

        var beats = new List<ComparisonStoryBeat>();

        if (topWorsened.Count > 0)
        {
            var w = topWorsened[0];
            byIdA.TryGetValue(w.NodeIdA, out var na);
            byIdB.TryGetValue(w.NodeIdB, out var nb);
            var pairLabel = na is not null && nb is not null
                ? PlanNodeReferenceBuilder.PairHumanLabel(na, nb, ctxA, ctxB, w.MatchConfidence)
                : $"{w.NodeTypeA} → {w.NodeTypeB}";
            string regressionLine;
            if (na is not null && nb is not null)
            {
                var regCont = PlanNodeReferenceBuilder.PairRegionContinuityHint(
                    na, nb, ctxA, ctxB, w.MatchConfidence, planA.QueryText, planB.QueryText);
                var groupedTail = GroupedOutputContinuityTail(regCont);
                regressionLine = regCont is not null
                    ? $"Largest regression maps to “{pairLabel}”. {regCont}{groupedTail} Open the pair to compare timing, buffers, and row estimates."
                    : $"Largest regression maps to “{pairLabel}”—open the pair to compare timing, buffers, and row estimates before drawing conclusions.";
            }
            else
                regressionLine =
                    $"Largest regression maps to “{pairLabel}”—open the pair to compare timing, buffers, and row estimates before drawing conclusions.";

            beats.Add(
                new ComparisonStoryBeat(
                    regressionLine,
                    w.NodeIdA,
                    w.NodeIdB,
                    pairLabel,
                    TrimBeatBrief(nb?.OperatorBriefingLine)));

            if (summary.RuntimeDeltaMs is > 0 &&
                bottleneckBrief?.Lines.Count > 0 &&
                bottleneckBrief.Lines[0].Contains("unchanged", StringComparison.OrdinalIgnoreCase))
            {
                beats.Add(
                    new ComparisonStoryBeat(
                        "Wall-clock regressed while the headline bottleneck class can look unchanged—that often means the same pressure moved shape (different operators, similar pain). Prove it on the regression pair’s timing and reads.",
                        null,
                        null,
                        ""));
            }
        }

        if (planA.Summary.Bottlenecks.Count > 0 && planB.Summary.Bottlenecks.Count > 0)
            beats.Add(
                new ComparisonStoryBeat(
                    "Both plans rank bottlenecks—read posture below, then pair deltas, to see whether the dominant pain moved, shrank, or only changed costume.",
                    null,
                    null,
                    ""));

        string overview;
        if (summary.RuntimeDeltaMs is { } d && summary.RuntimeMsA is { } aRt && aRt > 1e-6)
        {
            var pct = summary.RuntimeDeltaPct is { } p ? Math.Abs(p) * 100 : (double?)null;
            var dir = d > 0 ? "slower" : "faster";
            var pctPart = pct is { } x ? $" (~{x:F0}% of A)" : "";
            overview = $"Plan B is ~{Math.Abs(d):F1}ms {dir} than A at root inclusive time{pctPart}.";
            if (d < 0 && topWorsened.Count > 0)
                overview +=
                    " Net win at the root does not erase every hotspot—scan change beats for a regression pair that may still carry pressure.";
            else if (d > 0 && topImproved.Count > 0)
                overview +=
                    " Wall time worsened overall, but check improved pairs below—localized wins can coexist with a worse root (pain may have moved, not vanished).";
        }
        else
            overview = "Root runtime delta needs ANALYZE timing on both sides to read clearly.";

        if (summary.SevereFindingsDelta != 0)
            beats.Add(
                new ComparisonStoryBeat(
                    summary.SevereFindingsDelta > 0
                        ? $"High-severity finding count rose by {summary.SevereFindingsDelta} on B—pair that signal with worsened operators, not only root runtime."
                        : $"High-severity finding count dropped by {-summary.SevereFindingsDelta} on B—still confirm buffers and timings moved the way you expect.",
                    null,
                    null,
                    ""));

        if (summary.NodeCountDelta != 0)
        {
            beats.Add(
                new ComparisonStoryBeat(
                    summary.NodeCountDelta > 0
                        ? $"Operator count: B carries {summary.NodeCountDelta} more node(s)—usually a structural rewrite, not bind-parameter noise alone."
                        : $"Operator count: B trims {-summary.NodeCountDelta} node(s)—often simplification or a cheaper access path.",
                    null,
                    null,
                    ""));
        }

        if (summary.MaxDepthDelta != 0)
            beats.Add(
                new ComparisonStoryBeat(
                    $"Depth delta {summary.MaxDepthDelta:+#;-#;0}: deeper trees bury hotspots under more framing operators—pair navigation matters more.",
                    null,
                    null,
                    ""));

        if (summary.SharedReadDeltaBlocks != 0 && summary.SharedReadBlocksA > 0)
        {
            var dir = summary.SharedReadDeltaBlocks > 0 ? "more" : "fewer";
            beats.Add(
                new ComparisonStoryBeat(
                    $"Shared reads at root subtree: B shows {Math.Abs(summary.SharedReadDeltaBlocks)} {dir} blocks than A—pair with index/access-path deltas.",
                    null,
                    null,
                    ""));
        }

        var news = findingsDiff.Items.Count(i => i.ChangeType == FindingChangeType.New);
        var resolved = findingsDiff.Items.Count(i => i.ChangeType == FindingChangeType.Resolved);
        if (news > 0 || resolved > 0)
            beats.Add(
                new ComparisonStoryBeat(
                    $"Finding delta: {news} new or stronger on B, {resolved} cleared versus A—cleared signals help, yet they do not prove every subtree got cheaper.",
                    null,
                    null,
                    ""));

        if (topImproved.Count > 0 && summary.RuntimeDeltaMs is < 0)
        {
            var imp = topImproved[0];
            byIdA.TryGetValue(imp.NodeIdA, out var ia);
            byIdB.TryGetValue(imp.NodeIdB, out var ib);
            string improvedText;
            if (ia is not null && ib is not null)
            {
                var cont = PlanNodeReferenceBuilder.PairRegionContinuityHint(
                    ia, ib, ctxA, ctxB, imp.MatchConfidence, planA.QueryText, planB.QueryText);
                var pl = PlanNodeReferenceBuilder.PairHumanLabel(ia, ib, ctxA, ctxB, imp.MatchConfidence);
                var groupedTail = GroupedOutputContinuityTail(cont);
                improvedText = cont is not null
                    ? $"Runtime improved: top mapped pair “{pl}”. {cont}{groupedTail}"
                    : "Runtime improved: check whether gains are broad (multiple pairs) or concentrated in one subtree.";
            }
            else
                improvedText =
                    "Runtime improved: check whether gains are broad (multiple pairs) or concentrated in one subtree.";

            beats.Add(new ComparisonStoryBeat(improvedText, null, null, ""));
        }

        if (topWorsened.Count > 0 && summary.RuntimeDeltaMs is > 0)
            beats.Add(
                new ComparisonStoryBeat(
                    "Runtime regressed: top worsened pairs in the navigator usually explain where B spends new time.",
                    null,
                    null,
                    ""));

        var structural =
            "Engineering read: when operator counts barely move but runtime swings, suspect selectivity, join order, or access-path drift—not only parameter values. Big node-count jumps usually mean a different strategy, not a tweak.";

        string investigation;
        if (topWorsened.Count > 0)
        {
            var w = topWorsened[0];
            byIdA.TryGetValue(w.NodeIdA, out var na);
            byIdB.TryGetValue(w.NodeIdB, out var nb);
            var pairLabel = na is not null && nb is not null
                ? PlanNodeReferenceBuilder.PairHumanLabel(na, nb, ctxA, ctxB, w.MatchConfidence)
                : $"{w.NodeTypeA} → {w.NodeTypeB}";
            investigation =
                $"Open “{pairLabel}” first, then bottleneck posture (A vs B), then compare-scoped experiments—that sequence usually shows whether B is healthier or just reshuffled.";
        }
        else if (topImproved.Count > 0)
            investigation =
                "No worsened pairs ranked—scan improved pairs plus bottleneck posture to confirm B is cheaper where it matters, not only on average.";
        else
            investigation =
                "Start from metric tiles and bottleneck posture; use mapped pairs when you need operator-level evidence for a specific claim.";

        return new ComparisonStory(overview, beats, investigation, structural);
    }

    /// <summary>Phase 71: when continuity is about grouped output, stress residual feed/parent pressure after a partial win.</summary>
    private static string GroupedOutputContinuityTail(string? continuityHint)
    {
        if (string.IsNullOrWhiteSpace(continuityHint))
            return "";
        var h = continuityHint.ToLowerInvariant();
        if (!h.Contains("grouped-output", StringComparison.OrdinalIgnoreCase) &&
            !h.Contains("output-shaping", StringComparison.OrdinalIgnoreCase) &&
            !h.Contains("partial vs finalize", StringComparison.OrdinalIgnoreCase) &&
            !h.Contains("gather-merge", StringComparison.OrdinalIgnoreCase))
            return "";
        return " If wall time improved, scans or joins feeding buckets or partial aggregates may still dominate—compare subtree timing and shared reads, not only the grouped-output hop.";
    }
}
