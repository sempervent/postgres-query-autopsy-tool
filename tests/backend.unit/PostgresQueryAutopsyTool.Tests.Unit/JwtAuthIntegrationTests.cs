using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class JwtAuthIntegrationTests
{
    private static readonly byte[] SymmetricKey = new byte[32];
    private const string Issuer = "https://pqat.test";
    private const string Audience = "pqat-aud";

    static JwtAuthIntegrationTests()
    {
        for (var i = 0; i < 32; i++)
            SymmetricKey[i] = (byte)(i + 3);
    }

    private sealed class JwtWebApplicationFactory : WebApplicationFactory<Program>
    {
        private readonly string _dbPath = Path.Combine(Path.GetTempPath(), $"pqat-jwt-{Guid.NewGuid():n}.db");

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
                        ["Auth:Mode"] = "JwtBearer",
                        ["Auth:RequireIdentityForWrites"] = "true",
                        ["Auth:DefaultAccessScope"] = "private",
                        ["Auth:Jwt:Issuer"] = Issuer,
                        ["Auth:Jwt:Audience"] = Audience,
                        ["Auth:Jwt:SigningKeyBase64"] = Convert.ToBase64String(SymmetricKey),
                        ["Auth:Jwt:SubjectClaim"] = "sub",
                    });
            });
        }
    }

    private static string CreateJwt(string sub, string[]? groups = null, string? issuerOverride = null)
    {
        var claims = new List<Claim> { new("sub", sub) };
        if (groups is not null)
            claims.Add(new Claim("groups", JsonSerializer.Serialize(groups)));

        var key = new SymmetricSecurityKey(SymmetricKey);
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: issuerOverride ?? Issuer,
            audience: Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(10),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    [Fact]
    public async Task Jwt_mode_POST_persists_owner_as_sub_claim_not_raw_token()
    {
        using var factory = new JwtWebApplicationFactory();
        var client = factory.CreateClient();
        var jwt = CreateJwt("user-stable-42");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", jwt);

        const string planText = """[{"Plan":{"Node Type":"Result","Parallel Aware":false}}]""";
        var post = await client.PostAsJsonAsync("/api/analyze", new { planText, queryText = "SELECT 1" });
        Assert.Equal(HttpStatusCode.OK, post.StatusCode);
        var body = await post.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("user-stable-42", body.GetProperty("artifactAccess").GetProperty("ownerUserId").GetString());

        // Raw JWT string must not equal owner id
        Assert.NotEqual(jwt, body.GetProperty("artifactAccess").GetProperty("ownerUserId").GetString());
    }

    [Fact]
    public async Task Jwt_mode_invalid_token_returns_401()
    {
        using var factory = new JwtWebApplicationFactory();
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "not-a-jwt");

        const string planText = """[{"Plan":{"Node Type":"Result","Parallel Aware":false}}]""";
        var post = await client.PostAsJsonAsync("/api/analyze", new { planText });
        Assert.Equal(HttpStatusCode.Unauthorized, post.StatusCode);
    }

    [Fact]
    public async Task Jwt_mode_wrong_issuer_returns_401()
    {
        using var factory = new JwtWebApplicationFactory();
        var client = factory.CreateClient();
        var bad = CreateJwt("u1", issuerOverride: "https://evil.test");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", bad);

        const string planText = """[{"Plan":{"Node Type":"Result","Parallel Aware":false}}]""";
        var post = await client.PostAsJsonAsync("/api/analyze", new { planText });
        Assert.Equal(HttpStatusCode.Unauthorized, post.StatusCode);
    }

    [Fact]
    public async Task Jwt_mode_groups_claim_available_for_group_scope_checks()
    {
        using var factory = new JwtWebApplicationFactory();
        var client = factory.CreateClient();
        var jwt = CreateJwt("alice", groups: ["perf-team"]);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", jwt);

        const string planText = """[{"Plan":{"Node Type":"Result","Parallel Aware":false}}]""";
        var post = await client.PostAsJsonAsync("/api/analyze", new { planText });
        Assert.Equal(HttpStatusCode.OK, post.StatusCode);
        var aid = (await post.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("analysisId").GetString();

        await client.PutAsJsonAsync(
            $"/api/analyses/{Uri.EscapeDataString(aid!)}/sharing",
            new { accessScope = "group", sharedGroupIds = new[] { "perf-team" }, allowLinkAccess = false });

        var other = factory.CreateClient();
        var otherJwt = CreateJwt("bob", groups: ["perf-team"]);
        other.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", otherJwt);
        var get = await other.GetAsync($"/api/analyses/{Uri.EscapeDataString(aid!)}");
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
    }
}
