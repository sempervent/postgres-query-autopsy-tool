namespace PostgresQueryAutopsyTool.Tests.Unit.Support;

/// <summary>
/// Phase 74: single place for analyze single-plan fixture discovery (directory layout + inclusion rules).
/// <para><b>In scope:</b> <c>*.json</c> files directly under <c>fixtures/postgres-json/</c> (no subdirectories).</para>
/// <para><b>Out of scope:</b> <c>fixtures/comparison/&lt;case&gt;/planA|B.json</c> — compare corpus; separate tests + hygiene.</para>
/// </summary>
public static class AnalyzeFixtureCorpus
{
    /// <summary>Absolute path to <c>fixtures/postgres-json</c> next to compiled test output (xUnit shadow-copy aware).</summary>
    public static string ResolvePostgresJsonDirectory() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../fixtures/postgres-json"));

    /// <summary>
    /// Sorted full paths to analyze JSON fixtures. Basenames in <paramref name="excludedBasenames"/> are skipped (case-insensitive).
    /// </summary>
    public static string[] ListJsonFixturePaths(IReadOnlySet<string>? excludedBasenames = null)
    {
        excludedBasenames ??= new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var dir = ResolvePostgresJsonDirectory();
        if (!Directory.Exists(dir))
            throw new DirectoryNotFoundException($"Missing analyze fixture directory: {dir}");

        return Directory
            .GetFiles(dir, "*.json", SearchOption.TopDirectoryOnly)
            .Where(p => !excludedBasenames.Contains(Path.GetFileName(p)))
            .OrderBy(p => p, StringComparer.Ordinal)
            .ToArray();
    }
}
