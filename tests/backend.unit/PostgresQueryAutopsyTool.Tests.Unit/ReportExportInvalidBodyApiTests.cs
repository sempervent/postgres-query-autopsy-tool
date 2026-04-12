using System.Net;
using System.Text;
using System.Text.Json;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

/// <summary>Phase 117: report/export routes return compact JSON on malformed bodies (not empty 400).</summary>
public sealed class ReportExportInvalidBodyApiTests : IClassFixture<PqatWebApplicationFactory>
{
    private readonly PqatWebApplicationFactory _factory;

    public ReportExportInvalidBodyApiTests(PqatWebApplicationFactory factory) => _factory = factory;

    [Fact]
    public async Task Post_report_markdown_with_truncated_json_returns_400_with_request_body_invalid()
    {
        var client = _factory.CreateClient();
        var content = new StringContent("{", Encoding.UTF8, "application/json");
        var res = await client.PostAsync("/api/report/markdown", content);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        Assert.False(string.IsNullOrWhiteSpace(body));
        using var doc = JsonDocument.Parse(body);
        Assert.Equal("request_body_invalid", doc.RootElement.GetProperty("error").GetString());
        Assert.Contains("could not be read", doc.RootElement.GetProperty("message").GetString() ?? "", StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Post_compare_report_markdown_with_truncated_json_returns_400_with_request_body_invalid()
    {
        var client = _factory.CreateClient();
        var content = new StringContent("{ not-json", Encoding.UTF8, "application/json");
        var res = await client.PostAsync("/api/compare/report/markdown", content);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal("request_body_invalid", doc.RootElement.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Post_report_markdown_with_empty_object_returns_400_with_export_request_incomplete()
    {
        var client = _factory.CreateClient();
        var content = new StringContent("{}", Encoding.UTF8, "application/json");
        var res = await client.PostAsync("/api/report/markdown", content);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        Assert.False(string.IsNullOrWhiteSpace(body));
        using var doc = JsonDocument.Parse(body);
        Assert.Equal("export_request_incomplete", doc.RootElement.GetProperty("error").GetString());
        Assert.Contains("snapshot", doc.RootElement.GetProperty("message").GetString() ?? "", StringComparison.OrdinalIgnoreCase);
    }
}
