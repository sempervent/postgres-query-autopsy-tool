using System.Collections.Concurrent;
using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Domain;
using PostgresQueryAutopsyTool.Core.Parsing;
using PostgresQueryAutopsyTool.Core.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSingleton<IPlanAnalysisService, PlanAnalysisService>();
builder.Services.AddSingleton<IPlanParser, PostgresJsonExplainParser>();

// Keep API responses camelCased to match typical JS consumers.
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
});

var analysesStore = new ConcurrentDictionary<string, PlanAnalysisResult>();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

// Forwarded headers matter when deployed behind a reverse proxy in Docker.
app.UseForwardedHeaders();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" })).WithOpenApi();

app.MapGet("/api/version", () =>
    Results.Ok(new
    {
        service = "postgres-query-autopsy-tool",
        version = typeof(Program).Assembly.GetName().Version?.ToString() ?? "dev"
    }))
    .WithOpenApi();

app.MapPost("/api/analyze", async (AnalyzeRequestDto request, IPlanAnalysisService analysisService, CancellationToken ct) =>
{
    var analysis = await analysisService.AnalyzeAsync(request.Plan, ct, queryText: request.QueryText);
    analysesStore[analysis.AnalysisId] = analysis;
    return Results.Ok(analysis);
}).WithName("AnalyzePlan").WithOpenApi();

app.MapPost("/api/compare", async (HttpRequest httpRequest, CompareRequestDto request, IPlanAnalysisService analysisService, CancellationToken ct) =>
{
    var diagnostics = httpRequest.Query.TryGetValue("diagnostics", out var v) &&
                      (string.Equals(v.ToString(), "1", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(v.ToString(), "true", StringComparison.OrdinalIgnoreCase));

    var comparison = await analysisService.CompareAsync(request.PlanA, request.PlanB, ct, includeDiagnostics: diagnostics);
    return Results.Ok(comparison);
}).WithName("ComparePlans").WithOpenApi();

app.MapGet("/api/analyses", () => analysesStore.Keys.OrderByDescending(x => x).ToArray()).WithOpenApi();

app.MapGet("/api/analyses/{analysisId}", (string analysisId) =>
{
    if (analysesStore.TryGetValue(analysisId, out var analysis))
        return Results.Ok(analysis);

    return Results.NotFound(new { error = "analysis_not_found", analysisId });
}).WithOpenApi();

app.MapPost("/api/report/markdown", async (ReportRequestDto request, IPlanAnalysisService analysisService, CancellationToken ct) =>
{
    PlanAnalysisResult analysis = request.Analysis ?? (request.Plan.ValueKind != JsonValueKind.Undefined
        ? await analysisService.AnalyzeAsync(request.Plan, ct)
        : throw new BadHttpRequestException("Either `analysis` or `plan` must be provided."));

    var markdown = analysisService.RenderMarkdownReport(analysis);
    return Results.Ok(new { analysisId = analysis.AnalysisId, markdown });
}).WithOpenApi();

app.MapPost("/api/report/html", async (ReportRequestDto request, IPlanAnalysisService analysisService, CancellationToken ct) =>
{
    PlanAnalysisResult analysis = request.Analysis ?? (request.Plan.ValueKind != JsonValueKind.Undefined
        ? await analysisService.AnalyzeAsync(request.Plan, ct)
        : throw new BadHttpRequestException("Either `analysis` or `plan` must be provided."));

    var html = analysisService.RenderHtmlReport(analysis);
    return Results.Ok(new { analysisId = analysis.AnalysisId, html });
}).WithOpenApi();

app.MapPost("/api/report/json", async (ReportRequestDto request, IPlanAnalysisService analysisService, CancellationToken ct) =>
{
    PlanAnalysisResult analysis = request.Analysis ?? (request.Plan.ValueKind != JsonValueKind.Undefined
        ? await analysisService.AnalyzeAsync(request.Plan, ct)
        : throw new BadHttpRequestException("Either `analysis` or `plan` must be provided."));

    // JSON export is simply the structured analysis object.
    return Results.Ok(analysis);
}).WithOpenApi();

app.MapPost("/api/compare/report/markdown", async (HttpRequest httpRequest, CompareRequestDto request, IPlanAnalysisService analysisService, CancellationToken ct) =>
{
    var diagnostics = httpRequest.Query.TryGetValue("diagnostics", out var v) &&
                      (string.Equals(v.ToString(), "1", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(v.ToString(), "true", StringComparison.OrdinalIgnoreCase));

    var comparison = await analysisService.CompareAsync(request.PlanA, request.PlanB, ct, includeDiagnostics: diagnostics);
    var markdown = analysisService.RenderCompareMarkdownReport(comparison);
    return Results.Ok(new { comparisonId = comparison.ComparisonId, markdown });
}).WithOpenApi();

app.MapPost("/api/compare/report/json", async (HttpRequest httpRequest, CompareRequestDto request, IPlanAnalysisService analysisService, CancellationToken ct) =>
{
    var diagnostics = httpRequest.Query.TryGetValue("diagnostics", out var v) &&
                      (string.Equals(v.ToString(), "1", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(v.ToString(), "true", StringComparison.OrdinalIgnoreCase));

    var comparison = await analysisService.CompareAsync(request.PlanA, request.PlanB, ct, includeDiagnostics: diagnostics);
    return Results.Ok(comparison);
}).WithOpenApi();

app.Run();

public sealed class AnalyzeRequestDto
{
    public JsonElement Plan { get; init; }
    public string? QueryText { get; init; }
}

public sealed class CompareRequestDto
{
    public JsonElement PlanA { get; init; }
    public JsonElement PlanB { get; init; }
}

public sealed class ReportRequestDto
{
    public PlanAnalysisResult? Analysis { get; init; }
    public JsonElement Plan { get; init; }
}
