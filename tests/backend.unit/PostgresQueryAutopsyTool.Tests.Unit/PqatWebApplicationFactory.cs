using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace PostgresQueryAutopsyTool.Tests.Unit;

/// <summary>Isolated SQLite path per factory instance so parallel test classes do not contend on data/autopsy.db.</summary>
public sealed class PqatWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _dbPath = Path.Combine(Path.GetTempPath(), $"pqat-test-{Guid.NewGuid():n}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("Storage:DatabasePath", _dbPath);
        builder.UseSetting("Storage:ArtifactTtlHours", "0");
    }
}
