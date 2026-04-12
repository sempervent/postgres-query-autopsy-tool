using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;

namespace PostgresQueryAutopsyTool.Api;

/// <summary>Phase 118: malformed JSON on report routes — stable <c>request_body_invalid</c> without a catch-all 500 in custom middleware.</summary>
internal sealed class ReportExportBadRequestExceptionHandler : IExceptionHandler
{
    private readonly IHostEnvironment _env;

    public ReportExportBadRequestExceptionHandler(IHostEnvironment env) => _env = env;

    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception ex, CancellationToken cancellationToken)
    {
        if (ex is not BadHttpRequestException bad)
            return false;
        if (!Program.IsReportExportPath(context.Request.Path))
            return false;

        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        context.Response.ContentType = "application/json; charset=utf-8";
        await context.Response.WriteAsJsonAsync(
            new
            {
                error = "request_body_invalid",
                message =
                    "This export request could not be read. Reload the page and try again, or paste the plan text again before exporting.",
                detail = _env.IsDevelopment() ? bad.Message : null,
            },
            cancellationToken);
        return true;
    }
}
