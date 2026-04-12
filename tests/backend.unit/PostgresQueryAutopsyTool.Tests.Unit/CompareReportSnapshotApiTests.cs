using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using PostgresQueryAutopsyTool.Tests.Unit.Support;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

/// <summary>Phase 114: compare report endpoints accept a full comparison snapshot (reopen/export without plan text).</summary>
public sealed class CompareReportSnapshotApiTests : IClassFixture<PqatWebApplicationFactory>
{
    private readonly PqatWebApplicationFactory _factory;

    public CompareReportSnapshotApiTests(PqatWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task Post_compare_report_markdown_accepts_comparison_snapshot_without_plan_text()
    {
        var client = _factory.CreateClient();
        var dir = AnalyzeFixtureCorpus.ResolvePostgresJsonDirectory();
        var pathA = Path.Combine(dir, "compare_before_seq_scan.json");
        var pathB = Path.Combine(dir, "compare_after_index_scan.json");
        Assert.True(File.Exists(pathA) && File.Exists(pathB));

        var jsonA = await File.ReadAllTextAsync(pathA);
        var jsonB = await File.ReadAllTextAsync(pathB);
        using var docA = JsonDocument.Parse(jsonA);
        using var docB = JsonDocument.Parse(jsonB);

        var cmpRes = await client.PostAsJsonAsync("/api/compare", new { planA = docA.RootElement, planB = docB.RootElement });
        Assert.Equal(HttpStatusCode.OK, cmpRes.StatusCode);
        var cmpJson = await cmpRes.Content.ReadAsStringAsync();
        using var cmpEl = JsonDocument.Parse(cmpJson);
        var comparisonId = cmpEl.RootElement.GetProperty("comparisonId").GetString();
        Assert.False(string.IsNullOrEmpty(comparisonId));

        var payload = $"{{\"comparison\":{cmpJson}}}";
        var content = new StringContent(payload, Encoding.UTF8, "application/json");
        var reportRes = await client.PostAsync("/api/compare/report/markdown", content);
        Assert.Equal(HttpStatusCode.OK, reportRes.StatusCode);
        var reportBody = await reportRes.Content.ReadAsStringAsync();
        using var report = JsonDocument.Parse(reportBody);
        Assert.Equal(comparisonId, report.RootElement.GetProperty("comparisonId").GetString());
        var md = report.RootElement.GetProperty("markdown").GetString() ?? "";
        Assert.Contains("Postgres Query Autopsy Compare Report", md, StringComparison.Ordinal);
        Assert.Contains(comparisonId!, md, StringComparison.Ordinal);
    }
}
