using System.Text.Json;
using Microsoft.AspNetCore.Http;

namespace PostgresQueryAutopsyTool.Api;

/// <summary>Phase 118: explicit semantic validation for analyze report POSTs — no reliance on framework exception wording.</summary>
internal static class ReportExportValidation
{
    internal const string ExportRequestIncompleteMessage =
        "Include either the saved analysis snapshot or raw plan JSON, then try exporting again.";

    /// <returns><see langword="null"/> when the request can proceed; otherwise a <see cref="Results.BadRequest"/> payload.</returns>
    internal static IResult? TryAnalyzeReportRequest(global::ReportRequestDto request)
    {
        if (request.Analysis is not null)
            return null;
        if (request.Plan.ValueKind != JsonValueKind.Undefined)
            return null;
        return Results.BadRequest(new
        {
            error = "export_request_incomplete",
            message = ExportRequestIncompleteMessage,
        });
    }
}
