namespace PostgresQueryAutopsyTool.Tests.Unit.Support;

/// <summary>
/// Phase 74: guardrail so fixture discovery stays wired to an on-disk directory (shadow-copy / path regressions).
/// </summary>
public sealed class AnalyzeFixtureCorpusTests
{
    [Fact]
    public void Postgres_json_directory_exists_and_lists_at_least_one_json()
    {
        var dir = AnalyzeFixtureCorpus.ResolvePostgresJsonDirectory();
        Assert.True(Directory.Exists(dir), $"Expected fixture dir to exist: {dir}");

        var paths = AnalyzeFixtureCorpus.ListJsonFixturePaths();
        Assert.NotEmpty(paths);
        Assert.All(paths, p => Assert.EndsWith(".json", p, StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Excluded_basenames_are_omitted_from_enumeration()
    {
        var all = AnalyzeFixtureCorpus.ListJsonFixturePaths();
        var one = Path.GetFileName(all[0])!;
        var excluded = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { one };
        var filtered = AnalyzeFixtureCorpus.ListJsonFixturePaths(excluded);
        Assert.Equal(all.Length - 1, filtered.Length);
        Assert.DoesNotContain(filtered, p => string.Equals(Path.GetFileName(p), one, StringComparison.OrdinalIgnoreCase));
    }
}
