using System.Linq;
using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Comparison;

/// <summary>Phase 83: one evidence-bound line on whether this mapped pair likely helped, hurt, or moved work.</summary>
public static class PairRewriteVerdictBuilder
{
    public static string? Build(
        IReadOnlyList<MetricDeltaDetail> metrics,
        string? regionContinuityHint,
        string? regionContinuitySummaryCue,
        MatchConfidence matchConfidence)
    {
        var inc = metrics.FirstOrDefault(m => m.Key == "inclusiveActualTimeMs");
        var reads = metrics.FirstOrDefault(m => m.Key == "sharedReadBlocks");

        string? timeClause = inc?.Direction switch
        {
            DeltaDirection.Improved => "Pair inclusive time improved here.",
            DeltaDirection.Worsened => "Pair inclusive time worsened here.",
            DeltaDirection.Neutral => "Pair inclusive time is about flat.",
            DeltaDirection.NotApplicable => null,
            DeltaDirection.Ambiguous => inc is { A: not null, B: not null }
                ? "Inclusive time moved; direction is ambiguous from this pair alone."
                : null,
            _ => null
        };

        var readClause = reads?.Direction switch
        {
            DeltaDirection.Improved => "Shared read blocks dropped on this hop.",
            DeltaDirection.Worsened => "Shared read blocks rose on this hop.",
            DeltaDirection.Neutral => "Shared reads are similar.",
            DeltaDirection.NotApplicable or DeltaDirection.Ambiguous => null,
            _ => null
        };

        var sameRegion = !string.IsNullOrWhiteSpace(regionContinuityHint);
        var prefix = sameRegion ? "Same plan region, different strategy—" : "";

        if (matchConfidence == MatchConfidence.Low && timeClause is null && readClause is null)
            return "Low mapping confidence—treat this pair as a weak signal until confidence rises.";

        var parts = new List<string>();
        if (!string.IsNullOrEmpty(prefix))
            parts.Add(prefix.TrimEnd('—'));
        if (timeClause != null)
            parts.Add(timeClause);
        if (readClause != null)
            parts.Add(readClause);

        if (parts.Count == 0)
        {
            if (!string.IsNullOrWhiteSpace(regionContinuitySummaryCue))
            {
                var continuity = $"Continuity: {regionContinuitySummaryCue}—use metric rows below for proof.";
                return PrefixWeakMappingWhenLow(matchConfidence, continuity);
            }
            return matchConfidence == MatchConfidence.Low
                ? "Low mapping confidence—treat this pair as a weak signal until confidence rises."
                : null;
        }

        var s = string.Join(' ', parts);
        s = PrefixWeakMappingWhenLow(matchConfidence, s);
        if (s.Length > 260)
            return s[..257] + "…";
        return s;
    }

    /// <summary>When mapping is low but we still have metric/continuity clauses, prefix so users do not over-trust the numbers alone.</summary>
    private static string PrefixWeakMappingWhenLow(MatchConfidence matchConfidence, string sentence)
    {
        if (matchConfidence != MatchConfidence.Low || string.IsNullOrWhiteSpace(sentence))
            return sentence;
        if (sentence.Contains("Low mapping confidence", StringComparison.OrdinalIgnoreCase))
            return sentence;
        return "Weak mapping—" + sentence;
    }
}
