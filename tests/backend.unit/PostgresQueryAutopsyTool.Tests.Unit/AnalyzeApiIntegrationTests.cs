using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class AnalyzeApiIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public AnalyzeApiIntegrationTests(WebApplicationFactory<Program> factory) => _factory = factory;

    [Fact]
    public async Task Post_analyze_planText_persists_and_get_returns_same_payload_with_query_text()
    {
        var client = _factory.CreateClient();
        const string planText = """[{"Plan":{"Node Type":"Result","Parallel Aware":false}}]""";
        var res = await client.PostAsJsonAsync("/api/analyze", new { planText, queryText = "SELECT 1" });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        var aid = body.GetProperty("analysisId").GetString();
        Assert.False(string.IsNullOrEmpty(aid));
        Assert.Equal("rawJson", body.GetProperty("planInputNormalization").GetProperty("kind").GetString());

        var get = await client.GetAsync($"/api/analyses/{Uri.EscapeDataString(aid!)}");
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
        var roundTrip = await get.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(aid, roundTrip.GetProperty("analysisId").GetString());
        Assert.Equal("SELECT 1", roundTrip.GetProperty("queryText").GetString());
    }

    [Fact]
    public async Task Get_unknown_analysis_returns_404()
    {
        var client = _factory.CreateClient();
        var g = await client.GetAsync("/api/analyses/00000000000000000000000000000000");
        Assert.Equal(HttpStatusCode.NotFound, g.StatusCode);
    }

    [Fact]
    public async Task Post_analyze_query_plan_table_planText_persists_query_plan_table_normalization()
    {
        var client = _factory.CreateClient();
        const string inner = """[{"Plan":{"Node Type":"Result","Parallel Aware":false}}]""";
        var pasted =
            "QUERY PLAN\n" +
            "----------\n" +
            inner[..22] + "+\n" +
            inner[22..] + "\n" +
            "(1 row)\n";
        var res = await client.PostAsJsonAsync("/api/analyze", new { planText = pasted, queryText = "SELECT 1" });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("queryPlanTable", body.GetProperty("planInputNormalization").GetProperty("kind").GetString());
        var aid = body.GetProperty("analysisId").GetString();
        var get = await client.GetAsync($"/api/analyses/{aid}");
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
        var again = await get.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("queryPlanTable", again.GetProperty("planInputNormalization").GetProperty("kind").GetString());
        Assert.Equal("SELECT 1", again.GetProperty("queryText").GetString());
    }
}
