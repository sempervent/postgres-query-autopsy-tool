using System.Collections.Generic;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class UserPreferencesApiTests
{
    private sealed class PrefApiKeyFactory : WebApplicationFactory<Program>
    {
        private readonly string _dbPath = Path.Combine(Path.GetTempPath(), $"pqat-pref-{Guid.NewGuid():n}.db");

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
                        ["Auth:ApiKey:Seeds:0:Key"] = "pref-test-key",
                        ["Auth:ApiKey:Seeds:0:UserId"] = "user-pref-1",
                    });
            });
        }
    }

    [Fact]
    public async Task Me_preferences_GET_returns_null_then_PUT_round_trips_JSON()
    {
        using var factory = new PrefApiKeyFactory();
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Api-Key", "pref-test-key");

        var get1 = await client.GetAsync("/api/me/preferences/analyze_workspace_v1");
        Assert.Equal(HttpStatusCode.OK, get1.StatusCode);
        var body1 = await get1.Content.ReadAsStringAsync();
        Assert.Contains("\"value\":null", body1, StringComparison.Ordinal);

        var put = await client.PutAsJsonAsync(
            "/api/me/preferences/analyze_workspace_v1",
            new { value = new { v = 1, preset = "balanced" } });
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);

        var get2 = await client.GetAsync("/api/me/preferences/analyze_workspace_v1");
        Assert.Equal(HttpStatusCode.OK, get2.StatusCode);
        var doc = JsonDocument.Parse(await get2.Content.ReadAsStringAsync());
        Assert.True(doc.RootElement.TryGetProperty("value", out var val));
        Assert.Equal(JsonValueKind.Object, val.ValueKind);
        Assert.Equal(1, val.GetProperty("v").GetInt32());
    }

    [Fact]
    public async Task Me_preferences_without_identity_returns_401()
    {
        using var factory = new PrefApiKeyFactory();
        var client = factory.CreateClient();

        var get = await client.GetAsync("/api/me/preferences/analyze_workspace_v1");
        Assert.Equal(HttpStatusCode.Unauthorized, get.StatusCode);
    }
}
