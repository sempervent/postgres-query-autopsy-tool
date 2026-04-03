using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

/// <summary>SQLite-backed persistence: survives a new host (restart simulation).</summary>
internal sealed class SqlitePathWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _dbPath;

    public SqlitePathWebApplicationFactory(string dbPath) => _dbPath = dbPath;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("Storage:DatabasePath", _dbPath);
        builder.UseSetting("Storage:ArtifactTtlHours", "0");
    }
}

public sealed class DurableStorageIntegrationTests
{
    [Fact]
    public async Task Stored_analysis_survives_new_host_using_same_sqlite_file()
    {
        var db = Path.Combine(Path.GetTempPath(), $"pqat-autopsy-{Guid.NewGuid():n}.db");
        try
        {
            string? analysisId;
            using (var factory1 = new SqlitePathWebApplicationFactory(db))
            {
                var client = factory1.CreateClient();
                const string planText = """[{"Plan":{"Node Type":"Result","Parallel Aware":false}}]""";
                var res = await client.PostAsJsonAsync("/api/analyze", new
                {
                    planText,
                    queryText = "SELECT durable",
                    explainMetadata = new
                    {
                        options = new { format = "json", analyze = true, verbose = true },
                        sourceExplainCommand = "EXPLAIN (ANALYZE, VERBOSE, FORMAT JSON) SELECT durable",
                    },
                });
                Assert.Equal(HttpStatusCode.OK, res.StatusCode);
                var body = await res.Content.ReadFromJsonAsync<JsonElement>();
                analysisId = body.GetProperty("analysisId").GetString();
                Assert.False(string.IsNullOrEmpty(analysisId));
                Assert.Equal("rawJson", body.GetProperty("planInputNormalization").GetProperty("kind").GetString());
                Assert.False(string.IsNullOrEmpty(body.GetProperty("summary").GetProperty("plannerCosts").GetString()));
            }

            using var factory2 = new SqlitePathWebApplicationFactory(db);
            var client2 = factory2.CreateClient();
            var get = await client2.GetAsync($"/api/analyses/{Uri.EscapeDataString(analysisId!)}");
            Assert.Equal(HttpStatusCode.OK, get.StatusCode);
            var again = await get.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(analysisId, again.GetProperty("analysisId").GetString());
            Assert.Equal("SELECT durable", again.GetProperty("queryText").GetString());
            Assert.Equal("rawJson", again.GetProperty("planInputNormalization").GetProperty("kind").GetString());
            Assert.Contains("EXPLAIN", again.GetProperty("explainMetadata").GetProperty("sourceExplainCommand").GetString());
        }
        finally
        {
            TryDelete(db);
            TryDelete(db + "-shm");
            TryDelete(db + "-wal");
        }
    }

    [Fact]
    public async Task Compare_persists_explain_metadata_per_side_and_get_round_trips()
    {
        var db = Path.Combine(Path.GetTempPath(), $"pqat-compare-{Guid.NewGuid():n}.db");
        try
        {
            using var factory = new SqlitePathWebApplicationFactory(db);
            var client = factory.CreateClient();
            const string plan = """[{"Plan":{"Node Type":"Result"}}]""";
            var res = await client.PostAsJsonAsync("/api/compare", new
            {
                planAText = plan,
                planBText = plan,
                queryTextA = "SELECT a",
                queryTextB = "SELECT b",
                explainMetadataA = new { options = new { format = "json", analyze = true }, sourceExplainCommand = "cmd-a" },
                explainMetadataB = new { options = new { format = "json", costs = false }, sourceExplainCommand = "cmd-b" },
            });
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            var doc = await res.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("SELECT a", doc.GetProperty("planA").GetProperty("queryText").GetString());
            Assert.Equal("SELECT b", doc.GetProperty("planB").GetProperty("queryText").GetString());
            Assert.Equal("cmd-a", doc.GetProperty("planA").GetProperty("explainMetadata").GetProperty("sourceExplainCommand").GetString());
            Assert.Equal("cmd-b", doc.GetProperty("planB").GetProperty("explainMetadata").GetProperty("sourceExplainCommand").GetString());

            var cid = doc.GetProperty("comparisonId").GetString();
            var get = await client.GetAsync($"/api/comparisons/{Uri.EscapeDataString(cid!)}");
            Assert.Equal(HttpStatusCode.OK, get.StatusCode);
            var round = await get.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(cid, round.GetProperty("comparisonId").GetString());
            Assert.Equal("SELECT a", round.GetProperty("planA").GetProperty("queryText").GetString());
        }
        finally
        {
            TryDelete(db);
            TryDelete(db + "-shm");
            TryDelete(db + "-wal");
        }
    }

    private static void TryDelete(string path)
    {
        try
        {
            if (File.Exists(path))
                File.Delete(path);
        }
        catch
        {
            /* best-effort temp cleanup */
        }
    }
}
