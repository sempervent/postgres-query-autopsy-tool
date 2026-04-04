using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

internal sealed class AuthBearerWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _dbPath = Path.Combine(Path.GetTempPath(), $"pqat-auth-{Guid.NewGuid():n}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("Storage:DatabasePath", _dbPath);
        builder.UseSetting("Storage:ArtifactTtlHours", "0");
        builder.UseSetting("Auth:Enabled", "true");
        builder.UseSetting("Auth:Mode", "BearerSubject");
        builder.UseSetting("Auth:RequireIdentityForWrites", "true");
        builder.UseSetting("Auth:DefaultAccessScope", "private");
    }
}

public sealed class ArtifactAuthIntegrationTests
{
    [Fact]
    public async Task Auth_mode_POST_analyze_without_identity_returns_401()
    {
        using var factory = new AuthBearerWebApplicationFactory();
        var client = factory.CreateClient();
        const string planText = """[{"Plan":{"Node Type":"Result","Parallel Aware":false}}]""";
        var res = await client.PostAsJsonAsync("/api/analyze", new { planText, queryText = "SELECT 1" });
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Auth_mode_POST_and_GET_round_trip_with_bearer()
    {
        using var factory = new AuthBearerWebApplicationFactory();
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "alice");
        const string planText = """[{"Plan":{"Node Type":"Result","Parallel Aware":false}}]""";
        var post = await client.PostAsJsonAsync("/api/analyze", new { planText, queryText = "SELECT auth" });
        Assert.Equal(HttpStatusCode.OK, post.StatusCode);
        var body = await post.Content.ReadFromJsonAsync<JsonElement>();
        var aid = body.GetProperty("analysisId").GetString();
        Assert.Equal("private", body.GetProperty("artifactAccess").GetProperty("accessScope").GetString());

        var anon = factory.CreateClient();
        var denied = await anon.GetAsync($"/api/analyses/{Uri.EscapeDataString(aid!)}");
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);

        var ok = await client.GetAsync($"/api/analyses/{Uri.EscapeDataString(aid!)}");
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
    }

    [Fact]
    public async Task Auth_mode_owner_can_PATCH_sharing_to_link_and_anon_can_GET()
    {
        using var factory = new AuthBearerWebApplicationFactory();
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "bob");
        const string planText = """[{"Plan":{"Node Type":"Result","Parallel Aware":false}}]""";
        var post = await client.PostAsJsonAsync("/api/analyze", new { planText, queryText = "SELECT x" });
        var body = await post.Content.ReadFromJsonAsync<JsonElement>();
        var aid = body.GetProperty("analysisId").GetString();

        var put = await client.PutAsJsonAsync(
            $"/api/analyses/{Uri.EscapeDataString(aid!)}/sharing",
            new { accessScope = "link", sharedGroupIds = Array.Empty<string>(), allowLinkAccess = true });
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);

        var anon = factory.CreateClient();
        var get = await anon.GetAsync($"/api/analyses/{Uri.EscapeDataString(aid!)}");
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
    }

    [Fact]
    public async Task Non_auth_config_still_allows_capability_GET()
    {
        using var factory = new PqatWebApplicationFactory();
        var client = factory.CreateClient();
        const string planText = """[{"Plan":{"Node Type":"Result","Parallel Aware":false}}]""";
        var post = await client.PostAsJsonAsync("/api/analyze", new { planText, queryText = "SELECT 1" });
        Assert.Equal(HttpStatusCode.OK, post.StatusCode);
        var aid = (await post.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("analysisId").GetString();

        var anon = factory.CreateClient();
        var get = await anon.GetAsync($"/api/analyses/{Uri.EscapeDataString(aid!)}");
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
    }
}
