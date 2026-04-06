using System.Security.Cryptography;
using System.Text;
using PostgresQueryAutopsyTool.Core.Domain;
using PostgresQueryAutopsyTool.Core.Findings;

namespace PostgresQueryAutopsyTool.Core.Analysis;

internal static class PlanBottleneckBuilder
{
    private const int MaxInsights = 4;

    public static IReadOnlyList<PlanBottleneckInsight> Build(
        FindingEvaluationContext ctx,
        IReadOnlyList<AnalysisFinding> rankedFindings,
        string? queryText = null)
    {
        var byId = ctx.ById;
        var usedNodes = new HashSet<string>(StringComparer.Ordinal);
        var list = new List<PlanBottleneckInsight>();
        var rank = 1;

        void TryAdd(
            string kind,
            BottleneckClass bc,
            BottleneckCauseHint cause,
            string headline,
            string detail,
            IReadOnlyList<string> nodeIds,
            IReadOnlyList<string> findingIds,
            string? symptom,
            AnalyzedPlanNode? anchorNode = null)
        {
            if (list.Count >= MaxInsights) return;
            var id = StableId(kind, nodeIds, rank);
            var prop = BottleneckPropagationHelper.PropagationNote(anchorNode, byId, kind, bc, cause);
            var human = HumanAnchorFor(anchorNode, nodeIds, byId, ctx.RootNodeId, queryText);
            list.Add(new PlanBottleneckInsight(id, rank++, kind, bc, cause, headline, detail, nodeIds, findingIds, symptom, prop, human));
            foreach (var nid in nodeIds)
                usedNodes.Add(nid);
        }

        // 1) Exclusive-time leaders
        var exclusiveLeaders = ctx.Nodes
            .Where(n => n.Metrics.ExclusiveActualTimeMsApprox is not null)
            .OrderByDescending(n => n.Metrics.ExclusiveActualTimeMsApprox)
            .Take(3)
            .ToArray();

        foreach (var n in exclusiveLeaders)
        {
            if (list.Count >= MaxInsights) break;
            if (usedNodes.Contains(n.NodeId)) continue;
            var share = ctx.ExclusiveTimeShareOfPlan(n);
            var ex = n.Metrics.ExclusiveActualTimeMsApprox!.Value;
            var label = NodeLabelFormatter.ShortLabel(n, byId);
            var sh = share is > 0 ? $" (~{share:P0} of root inclusive time)" : "";
            var symptom = OperatorNarrativeHelper.SymptomNoteIfJoinHeavySide(n, byId, ctx.RootNodeId);
            var bc = BottleneckClassifier.ClassForExclusiveOrSubtreeNode(n, ctx);
            var cause = BottleneckClassifier.CauseHintFor("time_exclusive", n, byId, rank);
            TryAdd(
                "time_exclusive",
                bc,
                cause,
                $"Primary work at: {label}",
                $"{OperatorNarrativeHelper.BottleneckDetailLine(n, byId)} Exclusive time ≈ {ex:F2}ms{sh}.",
                new[] { n.NodeId },
                Array.Empty<string>(),
                symptom,
                n);
        }

        // 2) Largest subtree
        var subtreeLeader = ctx.Nodes
            .Where(n => n.Metrics.SubtreeInclusiveTimeMs is not null && !n.Metrics.IsRoot)
            .OrderByDescending(n => n.Metrics.SubtreeInclusiveTimeMs)
            .FirstOrDefault();

        if (subtreeLeader is not null && list.Count < MaxInsights && !usedNodes.Contains(subtreeLeader.NodeId))
        {
            var stShare = ctx.SubtreeTimeShareOfPlan(subtreeLeader);
            var st = subtreeLeader.Metrics.SubtreeInclusiveTimeMs!.Value;
            var label = NodeLabelFormatter.ShortLabel(subtreeLeader, byId);
            var sh = stShare is > 0 ? $" (~{stShare:P0} of plan time under this subtree)" : "";
            var bc = BottleneckClassifier.ClassForExclusiveOrSubtreeNode(subtreeLeader, ctx);
            var cause = BottleneckClassifier.CauseHintFor("time_subtree", subtreeLeader, byId, rank);
            TryAdd(
                "time_subtree",
                bc,
                cause,
                $"Largest timed subtree: {label}",
                $"Inclusive time under this branch ≈ {st:F2}ms{sh}. Inspect children to see whether cost is local or from descendants.",
                new[] { subtreeLeader.NodeId },
                Array.Empty<string>(),
                OperatorNarrativeHelper.SymptomNoteIfJoinHeavySide(subtreeLeader, byId, ctx.RootNodeId),
                subtreeLeader);
        }

        // 3) Shared-read concentration
        if (ctx.HasBuffers && list.Count < MaxInsights)
        {
            var readLeader = ctx.Nodes
                .Where(n => n.Node.SharedReadBlocks is > 0)
                .OrderByDescending(n => n.Node.SharedReadBlocks)
                .FirstOrDefault();

            if (readLeader is not null && !usedNodes.Contains(readLeader.NodeId))
            {
                var rShare = ctx.SharedReadShareOfPlan(readLeader);
                var blocks = readLeader.Node.SharedReadBlocks!.Value;
                var label = NodeLabelFormatter.ShortLabel(readLeader, byId);
                var sh = rShare is > 0 ? $" (~{rShare:P0} of root shared reads)" : "";
                var bc = BottleneckClassifier.ClassForIoReadNode(readLeader, ctx);
                var cause = BottleneckClassifier.CauseHintFor("io_read", readLeader, byId, rank);
                TryAdd(
                    "io_read",
                    bc,
                    cause,
                    $"I/O hotspot: {label}",
                    $"Shared read blocks ≈ {blocks}{sh}. Pair with timing on this branch—high reads can be a symptom of join shape or weak selectivity, not only “missing index.”",
                    new[] { readLeader.NodeId },
                    Array.Empty<string>(),
                    OperatorNarrativeHelper.SymptomNoteIfJoinHeavySide(readLeader, byId, ctx.RootNodeId),
                    readLeader);
            }
        }

        // 4) High-severity findings
        foreach (var f in rankedFindings.Where(f => f.Severity >= FindingSeverity.High).Take(4))
        {
            if (list.Count >= MaxInsights) break;
            var nid = f.NodeIds?.FirstOrDefault();
            if (nid is null || usedNodes.Contains(nid)) continue;
            if (!byId.TryGetValue(nid, out var node)) continue;
            var bc = BottleneckClassifier.ClassForFinding(f);
            var cause = BottleneckClassifier.CauseHintFor("finding", node, byId, rank);
            TryAdd(
                "finding",
                bc,
                cause,
                f.Title,
                $"{f.Summary} {f.Explanation}".Trim(),
                new[] { nid },
                new[] { f.FindingId },
                OperatorNarrativeHelper.SymptomNoteIfJoinHeavySide(node, byId, ctx.RootNodeId),
                node);
        }

        // 5) Query-shape boundary
        foreach (var f in rankedFindings.Where(f =>
                     f.RuleId.Equals("S.query-shape-boundary", StringComparison.OrdinalIgnoreCase))
                 .Take(2))
        {
            if (list.Count >= MaxInsights) break;
            var nid = f.NodeIds?.FirstOrDefault();
            if (nid is null || usedNodes.Contains(nid)) continue;
            byId.TryGetValue(nid, out var node);
            var cause = node is not null
                ? BottleneckClassifier.CauseHintFor("query_shape", node, byId, rank)
                : BottleneckCauseHint.PrimaryFocus;
            TryAdd(
                "query_shape",
                BottleneckClass.QueryShapeBoundary,
                cause,
                f.Title,
                f.Summary,
                f.NodeIds ?? new[] { nid },
                new[] { f.FindingId },
                null,
                node);
        }

        return list;
    }

    private static string? HumanAnchorFor(
        AnalyzedPlanNode? anchorNode,
        IReadOnlyList<string> nodeIds,
        IReadOnlyDictionary<string, AnalyzedPlanNode> byId,
        string rootNodeId,
        string? queryText)
    {
        if (anchorNode is not null)
            return PlanNodeReferenceBuilder.DisplayLine(
                PlanNodeReferenceBuilder.Build(anchorNode, byId, rootNodeId, queryText));
        var nid = nodeIds.FirstOrDefault();
        if (nid is null)
            return null;
        if (!byId.TryGetValue(nid, out var n))
            return PlanNodeReferenceBuilder.SafePrimary(nid, byId, rootNodeId);
        return PlanNodeReferenceBuilder.DisplayLine(PlanNodeReferenceBuilder.Build(n, byId, rootNodeId, queryText));
    }

    private static string StableId(string kind, IReadOnlyList<string> nodeIds, int rank)
    {
        var raw = $"{kind}:{rank}:{string.Join(",", nodeIds)}";
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        return "bn_" + Convert.ToHexString(hash)[..12].ToLowerInvariant();
    }
}
