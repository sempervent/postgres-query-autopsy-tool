namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>
/// Version of persisted analyze/compare JSON snapshots (Phase 49).
/// Stored in <see cref="PlanAnalysisResult.ArtifactSchemaVersion"/> / <see cref="PostgresQueryAutopsyTool.Core.Comparison.PlanComparisonResultV2.ArtifactSchemaVersion"/>.
/// </summary>
public static class ArtifactSchema
{
    /// <summary>Implicit legacy rows (property omitted from JSON).</summary>
    public const int LegacyImplicit = 0;

    /// <summary>First explicit version field (reserved; same effective shape as legacy for migration).</summary>
    public const int V1ExplicitMarker = 1;

    /// <summary>Current persisted shape: explicit version + server-side suggestion normalization + deep-link aliases.</summary>
    public const int Current = 2;

    /// <summary>Oldest version readers must still accept (inclusive).</summary>
    public const int MinSupported = LegacyImplicit;

    /// <summary>Newest version this build can read (inclusive).</summary>
    public const int MaxSupported = Current;
}
