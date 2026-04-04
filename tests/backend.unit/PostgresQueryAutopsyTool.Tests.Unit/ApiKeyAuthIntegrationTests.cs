using System.Collections.Generic;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class ApiKeyAuthIntegrationTests
{
    private sealed class ApiKeyWebApplicationFactory : WebApplicationFactory<Program>
    {
        private readonly string _dbPath = Path.Combine(Path.GetTempPath(), $"pqat-apikey-{Guid.NewGuid():n}.db");

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.ConfigureAppConfiguration((_, config) =>
            {
                config.AddInMemoryCollection(
                    new Dictionary<string, string?>
                    {
                        ["Storage:DatabasePath"] = _dbPath,
                        ["Storage:ArtifactTtlHours"] = "0",
                        ["Auth:Enabled"] = "true",
                        ["Auth:Mode"] = "ApiKey",
                        ["Auth:RequireIdentityForWrites"] = "true",
                        ["Auth:DefaultAccessScope"] = "private",
                        ["Auth:ApiKey:HeaderName"] = "X-Api-Key",
                        ["Auth:ApiKey:Seeds:0:Key"] = "integration-test-secret-key",
                        ["Auth:ApiKey:Seeds:0:UserId"] = "svc-principal-99",
                        ["Auth:ApiKey:Seeds:0:DisplayName"] = "Test service",
                        ["Auth:ApiKey:Seeds:0:Groups:0"] = "g-ops",
                    });
            });
        }
    }

    private sealed class ApiKeyDisabledWebApplicationFactory : WebApplicationFactory<Program>
    {
        private readonly string _dbPath = Path.Combine(Path.GetTempPath(), $"pqat-apikey-off-{Guid.NewGuid():n}.db");

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.ConfigureAppConfiguration((_, config) =>
            {
                config.AddInMemoryCollection(
                    new Dictionary<string, string?>
                    {
                        ["Storage:DatabasePath"] = _dbPath,
                        ["Storage:ArtifactTtlHours"] = "0",
                        ["Auth:Enabled"] = "true",
                        ["Auth:Mode"] = "ApiKey",
                        ["Auth:RequireIdentityForWrites"] = "true",
                        ["Auth:ApiKey:Seeds:0:Key"] = "disabled-key",
                        ["Auth:ApiKey:Seeds:0:UserId"] = "nobody",
                        ["Auth:ApiKey:Seeds:0:Enabled"] = "false",
                    });
            });
        }
    }

    [Fact]
    public async Task Api_key_mode_POST_persists_stable_mapped_user_id()
    {
        using var factory = new ApiKeyWebApplicationFactory();
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Api-Key", "integration-test-secret-key");

        const string planText = """[{"Plan":{"Node Type":"Result","Parallel Aware":false}}]""";
        var post = await client.PostAsJsonAsync("/api/analyze", new { planText });
        Assert.Equal(HttpStatusCode.OK, post.StatusCode);
        var body = await post.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("svc-principal-99", body.GetProperty("artifactAccess").GetProperty("ownerUserId").GetString());
    }

    [Fact]
    public async Task Api_key_mode_wrong_key_returns_401()
    {
        using var factory = new ApiKeyWebApplicationFactory();
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Api-Key", "wrong-key");

        const string planText = """[{"Plan":{"Node Type":"Result","Parallel Aware":false}}]""";
        var post = await client.PostAsJsonAsync("/api/analyze", new { planText });
        Assert.Equal(HttpStatusCode.Unauthorized, post.StatusCode);
    }

    [Fact]
    public async Task Api_key_mode_disabled_key_returns_401()
    {
        using var factory = new ApiKeyDisabledWebApplicationFactory();
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Api-Key", "disabled-key");

        const string planText = """[{"Plan":{"Node Type":"Result","Parallel Aware":false}}]""";
        var post = await client.PostAsJsonAsync("/api/analyze", new { planText });
        Assert.Equal(HttpStatusCode.Unauthorized, post.StatusCode);
    }
}
