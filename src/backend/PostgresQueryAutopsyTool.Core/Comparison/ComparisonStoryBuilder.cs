using System.Linq;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Findings;

namespace PostgresQueryAutopsyTool.Core.Comparison;

public static class ComparisonStoryBuilder
{
    public static ComparisonStory Build(
        PlanAnalysisResult planA,
        PlanAnalysisResult planB,
        ComparisonSummary summary,
        IReadOnlyList<NodeDelta> topWorsened,
        IReadOnlyList<NodeDelta> topImproved,
        FindingsDiff findingsDiff)
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
                ? PlanNodeReferenceBuilder.PairHumanLabel(na, nb, ctxA, ctxB)
                : $"{w.NodeTypeA} → {w.NodeTypeB}";
            beats.Add(
                new ComparisonStoryBeat(
                    $"Largest measured shift is in mapped pair “{pairLabel}”—open it for time, read, and estimate deltas on both plans.",
                    w.NodeIdA,
                    w.NodeIdB,
                    pairLabel));
        }

        if (planA.Summary.Bottlenecks.Count > 0 && planB.Summary.Bottlenecks.Count > 0)
            beats.Add(
                new ComparisonStoryBeat(
                    "Both plans carry ranked bottlenecks—use posture lines plus pair deltas to see whether the primary pain moved, shrank, or stayed the same class.",
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
        }
        else
            overview = "Root runtime delta needs ANALYZE timing on both sides to read clearly.";

        if (summary.NodeCountDelta != 0)
        {
            beats.Add(
                new ComparisonStoryBeat(
                    summary.NodeCountDelta > 0
                        ? $"Structure: B has {summary.NodeCountDelta} more operator(s) than A—often a shape rewrite, not only parameter drift."
                        : $"Structure: B has {-summary.NodeCountDelta} fewer operator(s)—often simplification or a different access path.",
                    null,
                    null,
                    ""));
        }

        if (summary.MaxDepthDelta != 0)
            beats.Add(
                new ComparisonStoryBeat(
                    $"Depth delta {summary.MaxDepthDelta:+#;-#;0}: deeper trees can hide bottlenecks further from the root.",
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
                    $"Findings diff: +{news} new, −{resolved} resolved—resolved items are encouraging but not proof every path improved.",
                    null,
                    null,
                    ""));

        if (topImproved.Count > 0 && summary.RuntimeDeltaMs is < 0)
            beats.Add(
                new ComparisonStoryBeat(
                    "Runtime improved: check whether gains are broad (multiple pairs) or concentrated in one subtree.",
                    null,
                    null,
                    ""));

        if (topWorsened.Count > 0 && summary.RuntimeDeltaMs is > 0)
            beats.Add(
                new ComparisonStoryBeat(
                    "Runtime regressed: top worsened pairs in the navigator usually explain where B spends new time.",
                    null,
                    null,
                    ""));

        var structural =
            "Heuristic read: similar node counts with big runtime swing often mean selectivity, join order, or access-path changes; large node-count jumps usually mean a structural plan rewrite.";

        string investigation;
        if (topWorsened.Count > 0)
        {
            var w = topWorsened[0];
            byIdA.TryGetValue(w.NodeIdA, out var na);
            byIdB.TryGetValue(w.NodeIdB, out var nb);
            var pairLabel = na is not null && nb is not null
                ? PlanNodeReferenceBuilder.PairHumanLabel(na, nb, ctxA, ctxB)
                : $"{w.NodeTypeA} → {w.NodeTypeB}";
            investigation =
                $"Start with “{pairLabel}” in the pair navigator, then read bottleneck posture and compare suggestions for plan B.";
        }
        else if (topImproved.Count > 0)
            investigation =
                "No worsened pairs surfaced—review improved pairs and bottleneck posture to confirm where B got simpler or cheaper.";
        else
            investigation =
                "Use metric tiles and bottleneck posture first; drill mapped pairs from the navigator when you need operator-level proof.";

        return new ComparisonStory(overview, beats, investigation, structural);
    }
}
