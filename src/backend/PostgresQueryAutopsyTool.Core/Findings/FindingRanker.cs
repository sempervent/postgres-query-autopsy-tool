using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings;

public static class FindingRanker
{
    public static IReadOnlyList<AnalysisFinding> RankAndDedupe(IReadOnlyList<AnalysisFinding> findings)
    {
        // Deduplicate near-duplicates by (ruleId, nodeIds-set).
        var unique = new Dictionary<string, AnalysisFinding>(StringComparer.Ordinal);
        foreach (var f in findings)
        {
            var key = $"{f.RuleId}|{NormalizeNodeKey(f.NodeIds)}";
            if (!unique.TryGetValue(key, out var existing))
            {
                unique[key] = f;
                continue;
            }

            // Keep the higher-severity, then higher-confidence candidate.
            if ((int)f.Severity > (int)existing.Severity ||
                ((int)f.Severity == (int)existing.Severity && (int)f.Confidence > (int)existing.Confidence))
            {
                unique[key] = f;
            }
        }

        var scored = unique.Values
            .Select(f => f with { RankScore = ComputeScore(f) })
            .OrderByDescending(f => f.RankScore ?? 0)
            .ToArray();

        return scored;
    }

    private static double ComputeScore(AnalysisFinding f)
    {
        // Defensible, simple weighting:
        // - severity dominates
        // - confidence adds a smaller lift
        // - impact signals (time/buffer shares, misestimation magnitude) contribute if present in evidence
        var severityWeight = f.Severity switch
        {
            FindingSeverity.Critical => 1000,
            FindingSeverity.High => 600,
            FindingSeverity.Medium => 250,
            FindingSeverity.Low => 100,
            _ => 25
        };

        var confidenceWeight = f.Confidence switch
        {
            FindingConfidence.High => 80,
            FindingConfidence.Medium => 40,
            _ => 10
        };

        var impact = 0.0;

        impact += TryGetDouble(f.Evidence, "exclusiveTimeShareOfPlan") * 500;
        impact += TryGetDouble(f.Evidence, "subtreeTimeShareOfPlan") * 350;
        impact += TryGetDouble(f.Evidence, "sharedReadShareOfPlan") * 450;
        impact += TryGetDouble(f.Evidence, "subtreeSharedReadShareOfPlan") * 300;
        impact += TryGetDouble(f.Evidence, "rowEstimateLog10Error") * 120;
        impact += TryGetDouble(f.Evidence, "loops") * 0.5;

        return severityWeight + confidenceWeight + impact;
    }

    private static double TryGetDouble(IReadOnlyDictionary<string, object?> evidence, string key)
    {
        if (!evidence.TryGetValue(key, out var v) || v is null) return 0;

        return v switch
        {
            double d => d,
            float f => f,
            int i => i,
            long l => l,
            decimal m => (double)m,
            _ => 0
        };
    }

    private static string NormalizeNodeKey(IReadOnlyList<string>? nodeIds)
    {
        if (nodeIds is null || nodeIds.Count == 0) return "-";
        return string.Join(",", nodeIds.OrderBy(x => x, StringComparer.Ordinal));
    }
}

