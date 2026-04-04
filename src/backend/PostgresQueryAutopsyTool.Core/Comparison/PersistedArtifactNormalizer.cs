using PostgresQueryAutopsyTool.Core.Analysis;

namespace PostgresQueryAutopsyTool.Core.Comparison;

/// <summary>
/// Upgrades persisted analyze/compare payloads after JSON deserialize (Phase 49).
/// </summary>
public static class PersistedArtifactNormalizer
{
    /// <summary>Stamp fresh API responses before JSON serialization (matches persisted shape).</summary>
    public static PlanAnalysisResult StampNewAnalyzeResponse(PlanAnalysisResult a) =>
        a with { ArtifactSchemaVersion = ArtifactSchema.Current };

    public static PlanComparisonResultV2 StampNewCompareResponse(PlanComparisonResultV2 c) =>
        c with
        {
            ArtifactSchemaVersion = ArtifactSchema.Current,
            PlanA = StampNewAnalyzeResponse(c.PlanA),
            PlanB = StampNewAnalyzeResponse(c.PlanB),
        };

    /// <summary>
    /// Throws <see cref="UnsupportedArtifactSchemaVersionException"/> when the payload is from a newer app than we support.
    /// </summary>
    public static PlanAnalysisResult NormalizeLoadedAnalysis(PlanAnalysisResult raw, DateTimeOffset? storeCreatedUtc)
    {
        if (raw.ArtifactSchemaVersion > ArtifactSchema.MaxSupported)
            throw new UnsupportedArtifactSchemaVersionException(raw.ArtifactSchemaVersion, ArtifactSchema.MaxSupported, isAnalysis: true);

        var suggestions = raw.OptimizationSuggestions.Select(OptimizationSuggestionCompat.NormalizeFields).ToArray();
        return raw with
        {
            OptimizationSuggestions = suggestions,
            ArtifactSchemaVersion = ArtifactSchema.Current,
            ArtifactPersistedUtc = raw.ArtifactPersistedUtc ?? storeCreatedUtc
        };
    }

    public static PlanComparisonResultV2 NormalizeLoadedComparison(PlanComparisonResultV2 raw, DateTimeOffset? storeCreatedUtc)
    {
        if (raw.ArtifactSchemaVersion > ArtifactSchema.MaxSupported)
            throw new UnsupportedArtifactSchemaVersionException(raw.ArtifactSchemaVersion, ArtifactSchema.MaxSupported, isAnalysis: false);

        var planA = NormalizeLoadedAnalysis(raw.PlanA, storeCreatedUtc);
        var planB = NormalizeLoadedAnalysis(raw.PlanB, storeCreatedUtc);
        var compareSugs = raw.CompareOptimizationSuggestions.Select(NormalizeCompareSuggestionForDeepLinks).ToArray();
        return raw with
        {
            PlanA = planA,
            PlanB = planB,
            CompareOptimizationSuggestions = compareSugs,
            ArtifactSchemaVersion = ArtifactSchema.Current,
            ArtifactPersistedUtc = raw.ArtifactPersistedUtc ?? storeCreatedUtc
        };
    }

    private static OptimizationSuggestion NormalizeCompareSuggestionForDeepLinks(OptimizationSuggestion s)
    {
        var n = OptimizationSuggestionCompat.NormalizeFields(s);
        if (!n.Title.StartsWith("After this change:", StringComparison.Ordinal))
            return n;
        var legacy = CompareOptimizationSuggestionEngine.LegacyCarriedTitleBasedSuggestionId(n);
        if (string.Equals(legacy, n.SuggestionId, StringComparison.Ordinal))
            return n;
        var merged = new HashSet<string>(StringComparer.Ordinal) { legacy };
        if (n.AlsoKnownAs is { Count: > 0 })
        {
            foreach (var x in n.AlsoKnownAs)
                merged.Add(x);
        }

        return n with { AlsoKnownAs = merged.Count == 0 ? null : merged.ToArray() };
    }
}
