using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class AuthConfigurationValidatorTests
{
    [Fact]
    public void JwtBearer_mode_without_signing_key_throws_when_host_starts()
    {
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, config) =>
            {
                config.AddInMemoryCollection(
                    new Dictionary<string, string?>
                    {
                        ["Storage:DatabasePath"] = Path.Combine(Path.GetTempPath(), $"pqat-bad-jwt-{Guid.NewGuid():n}.db"),
                        ["Storage:ArtifactTtlHours"] = "0",
                        ["Auth:Enabled"] = "true",
                        ["Auth:Mode"] = "JwtBearer",
                        ["Auth:Jwt:Issuer"] = "https://x",
                        ["Auth:Jwt:Audience"] = "y",
                    });
            });
        });

        Assert.Throws<InvalidOperationException>(() => factory.CreateClient());
    }
}
