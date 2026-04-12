using System.Text.Json;
using PostgresQueryAutopsyTool.Api;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class ReportExportValidationTests
{
    [Fact]
    public void TryAnalyzeReportRequest_empty_body_returns_export_request_incomplete()
    {
        var r = new ReportRequestDto { Analysis = null, Plan = default };
        var r0 = ReportExportValidation.TryAnalyzeReportRequest(r);
        Assert.NotNull(r0);
    }

    [Fact]
    public void TryAnalyzeReportRequest_with_plan_returns_null()
    {
        using var doc = JsonDocument.Parse("[]");
        var r = new ReportRequestDto { Analysis = null, Plan = doc.RootElement.Clone() };
        Assert.Null(ReportExportValidation.TryAnalyzeReportRequest(r));
    }
}
