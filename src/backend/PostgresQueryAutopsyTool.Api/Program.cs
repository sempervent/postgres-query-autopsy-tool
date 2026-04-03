using System.Text.Json;
using PostgresQueryAutopsyTool.Api;
using PostgresQueryAutopsyTool.Api.Compare;
using PostgresQueryAutopsyTool.Api.Persistence;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Parsing;
using PostgresQueryAutopsyTool.Core.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSingleton<IPlanAnalysisService, PlanAnalysisService>();
builder.Services.AddSingleton<IPlanParser, PostgresJsonExplainParser>();

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
});

builder.Services.AddSingleton<IArtifactPersistenceStore>(sp =>
{
    var env = sp.GetRequiredService<IWebHostEnvironment>();
    var cfg = sp.GetRequiredService<IConfiguration>();
    var path = cfg["Storage:DatabasePath"] ?? "data/autopsy.db";
    var full = Path.IsPathRooted(path) ? path : Path.Combine(env.ContentRootPath, path);
    var ttlHours = cfg.GetValue<double?>("Storage:ArtifactTtlHours");
    var maxRows = cfg.GetValue<int?>("Storage:MaxArtifactRows");
    return new SqliteArtifactStore(full, ttlHours, maxRows);
});

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();
app.UseForwardedHeaders();

var persistence = app.Services.GetRequiredService<IArtifactPersistenceStore>();
persistence.ApplyRetention(DateTimeOffset.UtcNow);

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" })).WithOpenApi();

app.MapGet("/api/version", () =>
    Results.Ok(new
    {
        service = "postgres-query-autopsy-tool",
        version = typeof(Program).Assembly.GetName().Version?.ToString() ?? "dev"
    }))
    .WithOpenApi();

app.MapPost("/api/analyze", async (
    AnalyzeRequestDto request,
    IPlanAnalysisService analysisService,
    IArtifactPersistenceStore store,
    CancellationToken ct) =>
{
    if (!string.IsNullOrWhiteSpace(request.PlanText))
    {
        var nr = PlanInputNormalizer.TryNormalizeToJson(request.PlanText!);
        if (!nr.Success)
        {
            return Results.BadRequest(new
            {
                error = "plan_parse_failed",
                message = nr.ErrorMessage,
                hint = nr.ErrorHint,
            });
        }

        using var doc = JsonDocument.Parse(nr.NormalizedJson!);
        var analysis = await analysisService.AnalyzeAsync(
            doc.RootElement,
            ct,
            queryText: request.QueryText,
            explainMetadata: request.ExplainMetadata);
        analysis = analysis with { PlanInputNormalization = nr.Info };
        store.SaveAnalysis(analysis);
        return Results.Ok(analysis);
    }

    if (request.Plan.ValueKind == JsonValueKind.Undefined)
    {
        return Results.BadRequest(new
        {
            error = "plan_required",
            message = "Provide non-empty planText or a JSON plan body.",
        });
    }

    var legacy = await analysisService.AnalyzeAsync(
        request.Plan,
        ct,
        queryText: request.QueryText,
        explainMetadata: request.ExplainMetadata);
    store.SaveAnalysis(legacy);
    return Results.Ok(legacy);
}).WithName("AnalyzePlan").WithOpenApi();

app.MapPost("/api/compare", async (
    HttpRequest httpRequest,
    CompareRequestDto request,
    IPlanAnalysisService analysisService,
    IArtifactPersistenceStore store,
    CancellationToken ct) =>
{
    var diagnostics = httpRequest.Query.TryGetValue("diagnostics", out var v) &&
                      (string.Equals(v.ToString(), "1", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(v.ToString(), "true", StringComparison.OrdinalIgnoreCase));

    var (err, comparison) = await CompareExecution.RunAsync(request, diagnostics, analysisService, ct);
    if (err is not null)
        return err;
    store.SaveComparison(comparison!);
    return Results.Ok(comparison);
}).WithName("ComparePlans").WithOpenApi();

app.MapGet("/api/analyses", (IArtifactPersistenceStore store) => store.ListAnalysisIds()).WithOpenApi();

app.MapGet("/api/analyses/{analysisId}", (string analysisId, IArtifactPersistenceStore store) =>
{
    if (store.TryGetAnalysis(analysisId, out var analysis) && analysis is not null)
        return Results.Ok(analysis);

    return Results.NotFound(new { error = "analysis_not_found", analysisId });
}).WithOpenApi();

app.MapGet("/api/comparisons/{comparisonId}", (string comparisonId, IArtifactPersistenceStore store) =>
{
    if (store.TryGetComparison(comparisonId, out var comparison) && comparison is not null)
        return Results.Ok(comparison);

    return Results.NotFound(new { error = "comparison_not_found", comparisonId });
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

    return Results.Ok(analysis);
}).WithOpenApi();

app.MapPost("/api/compare/report/markdown", async (
    HttpRequest httpRequest,
    CompareRequestDto request,
    IPlanAnalysisService analysisService,
    CancellationToken ct) =>
{
    var diagnostics = httpRequest.Query.TryGetValue("diagnostics", out var v) &&
                      (string.Equals(v.ToString(), "1", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(v.ToString(), "true", StringComparison.OrdinalIgnoreCase));

    var (err, comparison) = await CompareExecution.RunAsync(request, diagnostics, analysisService, ct);
    if (err is not null)
        return err;

    var markdown = analysisService.RenderCompareMarkdownReport(comparison!);
    return Results.Ok(new { comparisonId = comparison!.ComparisonId, markdown });
}).WithOpenApi();

app.MapPost("/api/compare/report/json", async (
    HttpRequest httpRequest,
    CompareRequestDto request,
    IPlanAnalysisService analysisService,
    CancellationToken ct) =>
{
    var diagnostics = httpRequest.Query.TryGetValue("diagnostics", out var v) &&
                      (string.Equals(v.ToString(), "1", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(v.ToString(), "true", StringComparison.OrdinalIgnoreCase));

    var (err, comparison) = await CompareExecution.RunAsync(request, diagnostics, analysisService, ct);
    if (err is not null)
        return err;

    return Results.Ok(comparison);
}).WithOpenApi();

app.Run();

public partial class Program;

public sealed class AnalyzeRequestDto
{
    public string? PlanText { get; init; }
    public JsonElement Plan { get; init; }
    public string? QueryText { get; init; }
    public ExplainCaptureMetadata? ExplainMetadata { get; init; }
}

public sealed class ReportRequestDto
{
    public PlanAnalysisResult? Analysis { get; init; }
    public JsonElement Plan { get; init; }
}
