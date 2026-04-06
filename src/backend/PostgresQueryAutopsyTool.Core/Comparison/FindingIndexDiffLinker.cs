using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Analysis;

namespace PostgresQueryAutopsyTool.Core.Comparison;

/// <summary>
/// Cross-links ranked <see cref="FindingDiffItem"/> entries with <see cref="IndexInsightDiffItem"/> entries
/// using mapped node ids, relation hints from evidence/insights, and rule↔signal family alignment (no prose equality).
/// </summary>
public static class FindingIndexDiffLinker
{
    private const int MaxLinksPerItem = 4;

    public static (FindingsDiff Findings, IndexComparisonSummary Index) Apply(
        FindingsDiff findings,
        IndexComparisonSummary index)
    {
        var fList = findings.Items.ToList();
        var iList = index.InsightDiffs.ToList();
        var fToI = Enumerable.Range(0, fList.Count).Select(_ => new List<int>()).ToArray();
        var iToF = Enumerable.Range(0, iList.Count).Select(_ => new List<int>()).ToArray();

        for (var fi = 0; fi < fList.Count; fi++)
        {
            for (var ii = 0; ii < iList.Count; ii++)
            {
                if (ShouldLink(fList[fi], iList[ii], index))
                {
                    fToI[fi].Add(ii);
                    iToF[ii].Add(fi);
                }
            }
        }

        var newFindings = fList
            .Select((f, i) => f with
            {
                RelatedIndexDiffIndexes = DistinctTake(fToI[i], MaxLinksPerItem),
                RelatedIndexDiffIds = IdsFromInsightIndexes(fToI[i], iList, MaxLinksPerItem)
            })
            .ToArray();

        var newInsights = iList
            .Select((item, i) => item with
            {
                RelatedFindingDiffIndexes = DistinctTake(iToF[i], MaxLinksPerItem),
                RelatedFindingDiffIds = IdsFromFindingIndexes(iToF[i], fList, MaxLinksPerItem)
            })
            .ToArray();

        return (new FindingsDiff(newFindings), index with { InsightDiffs = newInsights });
    }

    /// <summary>Compact corroboration lines for the selected mapped pair (max 3).</summary>
    public static IReadOnlyList<string> CorroborationCuesForPair(
        string nodeIdA,
        string nodeIdB,
        FindingsDiff findings,
        IndexComparisonSummary index)
    {
        var cues = new List<string>();
        for (var fi = 0; fi < findings.Items.Count; fi++)
        {
            var f = findings.Items[fi];
            if (!SameMappedPair(f, nodeIdA, nodeIdB)) continue;
            foreach (var idx in LinkedInsightsForFinding(f, index))
            {
                if (!string.Equals(idx.NodeIdA, nodeIdA, StringComparison.Ordinal) ||
                    !string.Equals(idx.NodeIdB, nodeIdB, StringComparison.Ordinal))
                    continue;

                cues.Add(
                    $"Index posture shifted ({FormatKind(idx.Kind)}); the finding “{f.Title}” {HumanizeFindingChange(f.ChangeType)} in the same neighborhood.");
                if (cues.Count >= 3) return cues;
            }
        }

        return cues;
    }

    public static IReadOnlyList<string> LinkedNarrativeLines(FindingsDiff findings, IndexComparisonSummary index, int maxLines = 2)
    {
        var lines = new List<string>();
        foreach (var f in findings.Items)
        {
            var linked = LinkedInsightsForFinding(f, index).Take(2).ToArray();
            if (linked.Length == 0) continue;
            foreach (var idx in linked)
            {
                if (idx.Kind == IndexInsightDiffKind.Unchanged) continue;

                var line = TryBuildCorroborationSentence(f, idx);
                if (line is not null)
                {
                    lines.Add(line);
                    if (lines.Count >= maxLines) return lines;
                }
            }
        }

        return lines;
    }

    private static string? TryBuildCorroborationSentence(FindingDiffItem f, IndexInsightDiffItem idx)
    {
        var rel = idx.InsightB?.RelationName ?? idx.InsightA?.RelationName ?? RelationFromFinding(f);
        var relPart = string.IsNullOrWhiteSpace(rel) ? "the highlighted relation" : rel;

        if ((f.RuleId.Contains("seq-scan", StringComparison.OrdinalIgnoreCase) ||
             f.RuleId.Contains("potential-indexing", StringComparison.OrdinalIgnoreCase)) &&
            f.ChangeType == FindingChangeType.Resolved &&
            idx.Kind is IndexInsightDiffKind.Resolved or IndexInsightDiffKind.Improved)
        {
            return $"The prior missing-index-style stress on {relPart} clears on B alongside a favorable index/access-path shift—validate timing and reads, not only the green diff.";
        }

        if (f.RuleId.Contains("index-access-still-heavy", StringComparison.OrdinalIgnoreCase) &&
            (f.ChangeType is FindingChangeType.New or FindingChangeType.Worsened or FindingChangeType.Unchanged) &&
            idx.Kind is not IndexInsightDiffKind.Resolved)
        {
            return $"Index-backed access on {relPart} still looks read-heavy; the index delta agrees volume or recheck/heap work—not a simple “add another index” story—may dominate.";
        }

        if (f.RuleId.Contains("sort-cost", StringComparison.OrdinalIgnoreCase) &&
            InsightHasSignal(idx, IndexSignalAnalyzer.SignalSortOrderSupportOpportunity))
        {
            return $"Sort-pressure finding shifts line up with sort-order or index-alignment movement on {relPart}—worth validating before rewriting indexes.";
        }

        return null;
    }

    private static bool ShouldLink(FindingDiffItem f, IndexInsightDiffItem idx, IndexComparisonSummary indexSummary)
    {
        if (idx.Kind == IndexInsightDiffKind.Unchanged) return false;

        if (IsAppendChunkPlanFinding(f))
            return PlanLevelAppendLinks(f, idx, indexSummary);

        var nodeOk = NodesOverlap(f, idx);
        var relOk = RelationsAlign(f, idx);
        if (!nodeOk && !relOk) return false;

        if (RuleMatchesSignals(f.RuleId, idx)) return true;
        if (nodeOk && relOk && IsIndexAdjacentRule(f.RuleId)) return true;
        return false;
    }

    private static bool IsAppendChunkPlanFinding(FindingDiffItem f)
        => f.RuleId.Contains("append-chunk-bitmap", StringComparison.OrdinalIgnoreCase);

    private static bool PlanLevelAppendLinks(FindingDiffItem f, IndexInsightDiffItem idx, IndexComparisonSummary indexSummary)
    {
        if (!indexSummary.EitherPlanSuggestsChunkedBitmapWorkload) return false;
        var signals = CollectSignals(idx);
        if (signals.Contains(IndexSignalAnalyzer.SignalBitmapRecheckOrHeapHeavy) ||
            signals.Contains(IndexSignalAnalyzer.SignalIndexPathStillCostly))
            return true;

        var famA = idx.AccessPathFamilyA ?? "";
        var famB = idx.AccessPathFamilyB ?? "";
        if (famA is IndexAccessPathTokens.BitmapHeapScan or IndexAccessPathTokens.BitmapIndexScan ||
            famB is IndexAccessPathTokens.BitmapHeapScan or IndexAccessPathTokens.BitmapIndexScan)
            return true;

        return idx.Kind == IndexInsightDiffKind.Changed && signals.Count > 0;
    }

    private static bool NodesOverlap(FindingDiffItem f, IndexInsightDiffItem idx)
    {
        if (idx.NodeIdA is null && idx.NodeIdB is null) return false;
        if (f.NodeIdA is not null && f.NodeIdA == idx.NodeIdA) return true;
        if (f.NodeIdB is not null && f.NodeIdB == idx.NodeIdB) return true;
        return f.NodeIdA is not null && f.NodeIdB is not null &&
               f.NodeIdA == idx.NodeIdA && f.NodeIdB == idx.NodeIdB;
    }

    private static bool RelationsAlign(FindingDiffItem f, IndexInsightDiffItem idx)
    {
        var rf = RelationFromFinding(f);
        var ri = idx.InsightB?.RelationName ?? idx.InsightA?.RelationName;
        if (string.IsNullOrWhiteSpace(rf) || string.IsNullOrWhiteSpace(ri)) return false;
        return string.Equals(rf.Trim(), ri.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    private static string? RelationFromFinding(FindingDiffItem f)
    {
        if (TryEvidenceString(f.EvidenceB, "relationName", out var b)) return b;
        if (TryEvidenceString(f.EvidenceA, "relationName", out var a)) return a;
        if (TryEvidenceString(f.EvidenceB, "primaryRelationName", out var b2)) return b2;
        if (TryEvidenceString(f.EvidenceA, "primaryRelationName", out var a2)) return a2;
        return null;
    }

    private static bool TryEvidenceString(IReadOnlyDictionary<string, object?> ev, string key, out string value)
    {
        value = "";
        if (!ev.TryGetValue(key, out var o) || o is null) return false;
        value = o switch
        {
            string s => s,
            JsonElement je when je.ValueKind == JsonValueKind.String => je.GetString() ?? "",
            _ => o.ToString() ?? ""
        };
        return !string.IsNullOrWhiteSpace(value);
    }

    private static bool RuleMatchesSignals(string ruleId, IndexInsightDiffItem idx)
    {
        if (ruleId.Contains("seq-scan", StringComparison.OrdinalIgnoreCase) ||
            ruleId.Contains("potential-indexing", StringComparison.OrdinalIgnoreCase))
            return InsightHasSignal(idx, IndexSignalAnalyzer.SignalMissingIndexInvestigation);

        if (ruleId.Contains("index-access-still-heavy", StringComparison.OrdinalIgnoreCase))
            return InsightHasSignal(idx, IndexSignalAnalyzer.SignalIndexPathStillCostly);

        if (ruleId.Contains("bitmap-recheck", StringComparison.OrdinalIgnoreCase))
            return InsightHasSignal(idx, IndexSignalAnalyzer.SignalBitmapRecheckOrHeapHeavy);

        if (ruleId.Contains("sort-cost", StringComparison.OrdinalIgnoreCase))
            return InsightHasSignal(idx, IndexSignalAnalyzer.SignalSortOrderSupportOpportunity);

        if (ruleId.Contains("nl-inner-index", StringComparison.OrdinalIgnoreCase))
            return InsightHasSignal(idx, IndexSignalAnalyzer.SignalJoinInnerIndexSupport);

        if (ruleId.Contains("append-chunk-bitmap", StringComparison.OrdinalIgnoreCase))
            return InsightHasSignal(idx, IndexSignalAnalyzer.SignalBitmapRecheckOrHeapHeavy) ||
                   InsightHasSignal(idx, IndexSignalAnalyzer.SignalIndexPathStillCostly);

        return false;
    }

    private static bool IsIndexAdjacentRule(string ruleId)
        => ruleId.Contains("seq-scan", StringComparison.OrdinalIgnoreCase) ||
           ruleId.Contains("potential-indexing", StringComparison.OrdinalIgnoreCase) ||
           ruleId.Contains("index-access", StringComparison.OrdinalIgnoreCase) ||
           ruleId.Contains("bitmap-recheck", StringComparison.OrdinalIgnoreCase) ||
           ruleId.Contains("sort-cost", StringComparison.OrdinalIgnoreCase) ||
           ruleId.Contains("nl-inner-index", StringComparison.OrdinalIgnoreCase) ||
           ruleId.Contains("append-chunk", StringComparison.OrdinalIgnoreCase);

    private static HashSet<string> CollectSignals(IndexInsightDiffItem idx)
    {
        var h = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var s in idx.InsightA?.SignalKinds ?? Array.Empty<string>()) h.Add(s);
        foreach (var s in idx.InsightB?.SignalKinds ?? Array.Empty<string>()) h.Add(s);
        return h;
    }

    private static bool InsightHasSignal(IndexInsightDiffItem idx, string kind)
        => CollectSignals(idx).Contains(kind);

    private static bool SameMappedPair(FindingDiffItem f, string nodeIdA, string nodeIdB)
    {
        if (f.NodeIdA is null || f.NodeIdB is null) return false;
        return string.Equals(f.NodeIdA, nodeIdA, StringComparison.Ordinal) &&
               string.Equals(f.NodeIdB, nodeIdB, StringComparison.Ordinal);
    }

    private static string HumanizeFindingChange(FindingChangeType t) =>
        t switch
        {
            FindingChangeType.New => "new on B",
            FindingChangeType.Worsened => "worsened on B",
            FindingChangeType.Resolved => "resolved",
            FindingChangeType.Improved => "improved on B",
            FindingChangeType.Unchanged => "unchanged",
            FindingChangeType.Unmapped => "unmapped",
            _ => t.ToString().ToLowerInvariant()
        };

    private static string FormatKind(IndexInsightDiffKind k) => k switch
    {
        IndexInsightDiffKind.New => "new",
        IndexInsightDiffKind.Resolved => "resolved",
        IndexInsightDiffKind.Improved => "improved",
        IndexInsightDiffKind.Worsened => "worsened",
        IndexInsightDiffKind.Changed => "changed",
        _ => "unchanged"
    };

    private static IEnumerable<IndexInsightDiffItem> LinkedInsightsForFinding(
        FindingDiffItem f,
        IndexComparisonSummary index)
    {
        if (f.RelatedIndexDiffIds is { Count: > 0 })
        {
            foreach (var id in f.RelatedIndexDiffIds)
            {
                foreach (var d in index.InsightDiffs)
                {
                    if (string.Equals(d.InsightDiffId, id, StringComparison.Ordinal))
                    {
                        yield return d;
                        break;
                    }
                }
            }

            yield break;
        }

        foreach (var ii in f.RelatedIndexDiffIndexes)
        {
            if ((uint)ii >= (uint)index.InsightDiffs.Count) continue;
            yield return index.InsightDiffs[ii];
        }
    }

    private static string[] IdsFromInsightIndexes(List<int> indexes, IReadOnlyList<IndexInsightDiffItem> iList, int max)
    {
        var ids = new List<string>();
        foreach (var ii in indexes)
        {
            if ((uint)ii >= (uint)iList.Count) continue;
            var id = iList[ii].InsightDiffId;
            if (!string.IsNullOrEmpty(id) && !ids.Contains(id, StringComparer.Ordinal))
                ids.Add(id);
            if (ids.Count >= max) break;
        }

        return ids.ToArray();
    }

    private static string[] IdsFromFindingIndexes(List<int> indexes, IReadOnlyList<FindingDiffItem> fList, int max)
    {
        var ids = new List<string>();
        foreach (var fi in indexes)
        {
            if ((uint)fi >= (uint)fList.Count) continue;
            var id = fList[fi].DiffId;
            if (!string.IsNullOrEmpty(id) && !ids.Contains(id, StringComparer.Ordinal))
                ids.Add(id);
            if (ids.Count >= max) break;
        }

        return ids.ToArray();
    }

    private static int[] DistinctTake(List<int> source, int max)
    {
        var set = new HashSet<int>();
        var list = new List<int>();
        foreach (var x in source)
        {
            if (set.Add(x))
                list.Add(x);
            if (list.Count >= max) break;
        }

        return list.ToArray();
    }
}
