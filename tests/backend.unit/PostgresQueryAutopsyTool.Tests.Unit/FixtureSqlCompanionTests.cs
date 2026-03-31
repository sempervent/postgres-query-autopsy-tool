using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class FixtureSqlCompanionTests
{
    [Fact]
    public void Postgres_json_fixtures_have_sql_companions()
    {
        var dir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../fixtures/postgres-json"));
        Assert.True(Directory.Exists(dir), $"Fixture dir missing: {dir}");

        var jsonFiles = Directory.GetFiles(dir, "*.json", SearchOption.TopDirectoryOnly);
        Assert.NotEmpty(jsonFiles);

        var missing = new List<string>();
        foreach (var json in jsonFiles)
        {
            var sql = Path.ChangeExtension(json, ".sql");
            if (!File.Exists(sql))
                missing.Add(Path.GetFileName(sql));
        }

        Assert.True(missing.Count == 0, "Missing .sql companions for: " + string.Join(", ", missing));
    }

    [Fact]
    public void Comparison_fixtures_have_planA_planB_sql()
    {
        var root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../fixtures/comparison"));
        Assert.True(Directory.Exists(root), $"Fixture dir missing: {root}");

        var caseDirs = Directory.GetDirectories(root);
        Assert.NotEmpty(caseDirs);

        var missing = new List<string>();
        foreach (var d in caseDirs)
        {
            var aJson = Path.Combine(d, "planA.json");
            var bJson = Path.Combine(d, "planB.json");
            if (File.Exists(aJson) && !File.Exists(Path.Combine(d, "planA.sql")))
                missing.Add(Path.GetFileName(d) + "/planA.sql");
            if (File.Exists(bJson) && !File.Exists(Path.Combine(d, "planB.sql")))
                missing.Add(Path.GetFileName(d) + "/planB.sql");
        }

        Assert.True(missing.Count == 0, "Missing comparison .sql companions for: " + string.Join(", ", missing));
    }
}

