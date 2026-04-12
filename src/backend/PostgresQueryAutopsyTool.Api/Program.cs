using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using PostgresQueryAutopsyTool.Api;
using PostgresQueryAutopsyTool.Api.Auth;
using PostgresQueryAutopsyTool.Api.Compare;
using PostgresQueryAutopsyTool.Api.Persistence;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Comparison;
using PostgresQueryAutopsyTool.Core.Parsing;
using PostgresQueryAutopsyTool.Core.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.Configure<AuthOptions>(builder.Configuration.GetSection("Auth"));
builder.Services.Configure<JwtAuthOptions>(builder.Configuration.GetSection("Auth:Jwt"));
builder.Services.Configure<ApiKeyAuthOptions>(builder.Configuration.GetSection("Auth:ApiKey"));
builder.Services.Configure<RateLimitingOptions>(builder.Configuration.GetSection("RateLimiting"));
builder.Services.AddSingleton<IPlanAnalysisService, PlanAnalysisService>();
builder.Services.AddSingleton<IPlanParser, PostgresJsonExplainParser>();
builder.Services.AddSingleton<IRequestIdentityAccessor, HttpRequestIdentityAccessor>();

builder.Services.ConfigureHttpJsonOptions(options =>
{
    ArtifactPersistenceJson.ApplyToHttpSerializerOptions(options.SerializerOptions);
});

// Phase 118: report-route BadHttpRequest → JSON 400; other exceptions → default ProblemDetails pipeline.
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ReportExportBadRequestExceptionHandler>();

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

builder.Services.AddSingleton<IApiKeyPrincipalLookup>(sp =>
{
    var env = sp.GetRequiredService<IWebHostEnvironment>();
    var cfg = sp.GetRequiredService<IConfiguration>();
    var path = cfg["Storage:DatabasePath"] ?? "data/autopsy.db";
    var full = Path.IsPathRooted(path) ? path : Path.Combine(env.ContentRootPath, path);
    var opts = sp.GetRequiredService<IOptions<ApiKeyAuthOptions>>();
    return new SqliteApiKeyPrincipalStore(full, opts);
});

builder.Services.AddSingleton<IUserPreferenceStore>(sp =>
{
    var env = sp.GetRequiredService<IWebHostEnvironment>();
    var cfg = sp.GetRequiredService<IConfiguration>();
    var path = cfg["Storage:DatabasePath"] ?? "data/autopsy.db";
    var full = Path.IsPathRooted(path) ? path : Path.Combine(env.ContentRootPath, path);
    return new SqliteUserPreferenceStore(full);
});

var rateLimitEnabled = builder.Configuration.GetValue("RateLimiting:Enabled", false);
if (rateLimitEnabled)
{
    var rl = builder.Configuration.GetSection("RateLimiting").Get<RateLimitingOptions>() ?? new RateLimitingOptions();
    builder.Services.AddRateLimiter(options =>
    {
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
        options.AddFixedWindowLimiter("pqatWrite", o =>
        {
            o.PermitLimit = Math.Max(1, rl.PermitLimit);
            o.Window = TimeSpan.FromSeconds(Math.Max(1, rl.WindowSeconds));
            o.QueueLimit = 0;
        });
    });
}

var app = builder.Build();

AuthConfigurationValidator.Validate(app.Services, app.Configuration);

app.UseExceptionHandler();
app.UseSwagger();
app.UseSwaggerUI();
app.UseForwardedHeaders();
if (rateLimitEnabled)
    app.UseRateLimiter();
app.UseMiddleware<AuthIdentityMiddleware>();

var persistence = app.Services.GetRequiredService<IArtifactPersistenceStore>();
persistence.ApplyRetention(DateTimeOffset.UtcNow);

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" })).WithOpenApi();

app.MapGet("/api/config", (IConfiguration cfg, IOptions<AuthOptions> auth, IOptions<ApiKeyAuthOptions> apiKeyOptions) =>
{
    var a = auth.Value;
    var mode = a.EffectiveMode;
    var kind = !a.Enabled ? "none" : mode switch
    {
        AuthMode.ProxyHeaders => "proxy",
        AuthMode.BearerSubject => "legacy_bearer",
        AuthMode.JwtBearer => "jwt",
        AuthMode.ApiKey => "api_key",
        _ => "none",
    };
    var help = !a.Enabled
        ? "Auth disabled; share links are capability URLs unless you enable auth + ACLs."
        : mode switch
        {
            AuthMode.ProxyHeaders => "Identity from trusted proxy headers (see Auth:ProxyUserIdHeader).",
            AuthMode.BearerSubject => "Legacy: entire Bearer string is the stored user id (no JWT). Prefer JwtBearer or ApiKey for stable identities.",
            AuthMode.JwtBearer => "Bearer must be a valid HS256 JWT; owner id is the subject claim (default sub).",
            AuthMode.ApiKey => $"API key in header \"{apiKeyOptions.Value.HeaderName}\"; keys are stored hashed (SHA-256) in SQLite.",
            _ => "",
        };
    return Results.Ok(new
    {
        authEnabled = a.Enabled,
        authMode = mode.ToString(),
        authIdentityKind = kind,
        authHelp = help,
        requireIdentityForWrites = a.RequireIdentityForWrites,
        defaultAccessScope = a.DefaultAccessScope,
        rateLimitingEnabled = rateLimitEnabled,
        storage = new
        {
            databasePath = cfg["Storage:DatabasePath"] ?? "data/autopsy.db",
        },
    });
}).WithOpenApi();

app.MapGet("/api/version", () =>
    Results.Ok(new
    {
        service = "postgres-query-autopsy-tool",
        version = typeof(Program).Assembly.GetName().Version?.ToString() ?? "dev"
    }))
    .WithOpenApi();

var analyzeEndpoint = app.MapPost("/api/analyze", async (
    HttpContext http,
    AnalyzeRequestDto request,
    IPlanAnalysisService analysisService,
    IArtifactPersistenceStore store,
    IOptions<AuthOptions> authOptions,
    CancellationToken ct) =>
{
    var gate = ProgramAuthHelpers.RequireWriteIdentity(http, authOptions);
    if (gate is not null)
        return gate;

    var access = ProgramAuthHelpers.ResolveAccessForWrite(http, authOptions);
    if (access is null)
        return ProgramAuthHelpers.JsonStatus(new { error = "authentication_required" }, 401);

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
        analysis = PersistedArtifactNormalizer.StampNewAnalyzeResponse(analysis with { PlanInputNormalization = nr.Info });
        store.SaveAnalysis(analysis, access);
        return ProgramAuthHelpers.JsonArtifact(analysis with { ArtifactAccess = access.ToStoredArtifact() });
    }

    if (request.Plan.ValueKind == JsonValueKind.Undefined)
    {
        return Results.BadRequest(new
        {
            error = "plan_required",
            message = "Provide non-empty planText or a JSON plan body.",
        });
    }

    var legacy = PersistedArtifactNormalizer.StampNewAnalyzeResponse(
        await analysisService.AnalyzeAsync(
            request.Plan,
            ct,
            queryText: request.QueryText,
            explainMetadata: request.ExplainMetadata));
    store.SaveAnalysis(legacy, access);
    return ProgramAuthHelpers.JsonArtifact(legacy with { ArtifactAccess = access.ToStoredArtifact() });
}).WithName("AnalyzePlan").WithOpenApi();
if (rateLimitEnabled)
    analyzeEndpoint.RequireRateLimiting("pqatWrite");

var compareEndpoint = app.MapPost("/api/compare", async (
    HttpContext http,
    HttpRequest httpRequest,
    CompareRequestDto request,
    IPlanAnalysisService analysisService,
    IArtifactPersistenceStore store,
    IOptions<AuthOptions> authOptions,
    CancellationToken ct) =>
{
    var gate = ProgramAuthHelpers.RequireWriteIdentity(http, authOptions);
    if (gate is not null)
        return gate;

    var access = ProgramAuthHelpers.ResolveAccessForWrite(http, authOptions);
    if (access is null)
        return ProgramAuthHelpers.JsonStatus(new { error = "authentication_required" }, 401);

    var diagnostics = httpRequest.Query.TryGetValue("diagnostics", out var v) &&
                      (string.Equals(v.ToString(), "1", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(v.ToString(), "true", StringComparison.OrdinalIgnoreCase));

    var (err, comparison) = await CompareExecution.RunAsync(request, diagnostics, analysisService, ct);
    if (err is not null)
        return err;
    var stamped = PersistedArtifactNormalizer.StampNewCompareResponse(comparison!);
    store.SaveComparison(stamped, access);
    return ProgramAuthHelpers.JsonArtifact(stamped with { ArtifactAccess = access.ToStoredArtifact() });
}).WithName("ComparePlans").WithOpenApi();
if (rateLimitEnabled)
    compareEndpoint.RequireRateLimiting("pqatWrite");

app.MapGet("/api/analyses", (HttpContext http, IArtifactPersistenceStore store, IOptions<AuthOptions> authOptions) =>
{
    var auth = authOptions.Value;
    return Results.Ok(store.ListAnalysisIds(http.GetPqatIdentity(), auth.Enabled));
}).WithOpenApi();

app.MapGet("/api/analyses/{analysisId}", (HttpContext http, string analysisId, IArtifactPersistenceStore store, IOptions<AuthOptions> authOptions) =>
{
    var read = store.ReadAnalysis(analysisId);
    if (read.Status == ArtifactReadStatus.NotFound)
        return ProgramAuthHelpers.JsonStatus(new { error = "analysis_not_found", analysisId }, 404);
    if (read.Status == ArtifactReadStatus.CorruptPayload)
        return Results.Json(
            new
            {
                error = read.ErrorCode,
                message = read.Message,
                analysisId,
            },
            statusCode: 422);
    if (read.Status == ArtifactReadStatus.IncompatibleSchema)
        return Results.Json(
            new
            {
                error = read.ErrorCode,
                message = read.Message,
                analysisId,
                schemaVersion = read.SchemaVersion,
                maxSupported = ArtifactSchema.MaxSupported,
            },
            statusCode: 409);

    var analysis = read.Value!;
    var auth = authOptions.Value;
    if (!ArtifactAccessEvaluator.CanRead(auth.Enabled, analysis.ArtifactAccess, http.GetPqatIdentity()))
        return ProgramAuthHelpers.JsonStatus(new { error = "access_denied", analysisId }, 403);

    return ProgramAuthHelpers.JsonArtifact(analysis);
}).WithOpenApi();

app.MapGet("/api/comparisons/{comparisonId}", (HttpContext http, string comparisonId, IArtifactPersistenceStore store, IOptions<AuthOptions> authOptions) =>
{
    var read = store.ReadComparison(comparisonId);
    if (read.Status == ArtifactReadStatus.NotFound)
        return ProgramAuthHelpers.JsonStatus(new { error = "comparison_not_found", comparisonId }, 404);
    if (read.Status == ArtifactReadStatus.CorruptPayload)
        return Results.Json(
            new
            {
                error = read.ErrorCode,
                message = read.Message,
                comparisonId,
            },
            statusCode: 422);
    if (read.Status == ArtifactReadStatus.IncompatibleSchema)
        return Results.Json(
            new
            {
                error = read.ErrorCode,
                message = read.Message,
                comparisonId,
                schemaVersion = read.SchemaVersion,
                maxSupported = ArtifactSchema.MaxSupported,
            },
            statusCode: 409);

    var comparison = read.Value!;
    var auth = authOptions.Value;
    if (!ArtifactAccessEvaluator.CanRead(auth.Enabled, comparison.ArtifactAccess, http.GetPqatIdentity()))
        return ProgramAuthHelpers.JsonStatus(new { error = "access_denied", comparisonId }, 403);

    return ProgramAuthHelpers.JsonArtifact(comparison);
}).WithOpenApi();

app.MapPut("/api/analyses/{analysisId}/sharing", (
    HttpContext http,
    string analysisId,
    UpdateArtifactSharingDto body,
    IArtifactPersistenceStore store,
    IOptions<AuthOptions> authOptions) =>
{
    var auth = authOptions.Value;
    if (!auth.Enabled)
        return ProgramAuthHelpers.JsonStatus(new { error = "auth_disabled", message = "Sharing API requires Auth:Enabled." }, 400);
    return UpdateSharingCore(http, store, authOptions, analysisId, body, isComparison: false);
}).WithOpenApi();

app.MapPut("/api/comparisons/{comparisonId}/sharing", (
    HttpContext http,
    string comparisonId,
    UpdateArtifactSharingDto body,
    IArtifactPersistenceStore store,
    IOptions<AuthOptions> authOptions) =>
{
    var auth = authOptions.Value;
    if (!auth.Enabled)
        return ProgramAuthHelpers.JsonStatus(new { error = "auth_disabled", message = "Sharing API requires Auth:Enabled." }, 400);
    return UpdateSharingCore(http, store, authOptions, comparisonId, body, isComparison: true);
}).WithOpenApi();

static IResult UpdateSharingCore(
    HttpContext http,
    IArtifactPersistenceStore store,
    IOptions<AuthOptions> authOptions,
    string id,
    UpdateArtifactSharingDto body,
    bool isComparison)
{
    var user = http.GetPqatIdentity();
    if (user is null)
        return ProgramAuthHelpers.JsonStatus(new { error = "authentication_required" }, 401);

    var scope = body.AccessScope.Trim();
    if (!ArtifactAccessScope.IsValid(scope))
        return ProgramAuthHelpers.JsonStatus(new { error = "invalid_scope", scope }, 400);

    var groups = body.SharedGroupIds ?? Array.Empty<string>();
    if (scope != ArtifactAccessScope.Group)
        groups = Array.Empty<string>();

    var write = new ArtifactAccessWrite(user.UserId, scope, groups, body.AllowLinkAccess);

    if (isComparison)
    {
        if (!store.TryGetComparisonAccess(id, out var a) || a is null)
            return ProgramAuthHelpers.JsonStatus(new { error = "comparison_not_found", comparisonId = id }, 404);
        if (!ArtifactAccessEvaluator.CanManageSharing(user, a))
            return ProgramAuthHelpers.JsonStatus(new { error = "access_denied", comparisonId = id }, 403);
        if (!store.TryUpdateComparisonAccess(id, write, user.UserId))
            return ProgramAuthHelpers.JsonStatus(new { error = "update_failed", comparisonId = id }, 403);
    }
    else
    {
        if (!store.TryGetAnalysisAccess(id, out var a) || a is null)
            return ProgramAuthHelpers.JsonStatus(new { error = "analysis_not_found", analysisId = id }, 404);
        if (!ArtifactAccessEvaluator.CanManageSharing(user, a))
            return ProgramAuthHelpers.JsonStatus(new { error = "access_denied", analysisId = id }, 403);
        if (!store.TryUpdateAnalysisAccess(id, write, user.UserId))
            return ProgramAuthHelpers.JsonStatus(new { error = "update_failed", analysisId = id }, 403);
    }

    return ProgramAuthHelpers.JsonStatus(new { ok = true, artifactId = id, accessScope = scope, sharedGroupIds = groups, allowLinkAccess = body.AllowLinkAccess }, 200);
}

/// <summary>Phase 40: opaque JSON blob per user (Analyze workspace layout, etc.).</summary>
app.MapGet("/api/me/preferences/{key}", async (
    HttpContext http,
    string key,
    IUserPreferenceStore prefs,
    IOptions<AuthOptions> authOptions,
    IRequestIdentityAccessor identityAccessor,
    CancellationToken ct) =>
{
    var auth = authOptions.Value;
    if (!auth.Enabled)
        return ProgramAuthHelpers.JsonStatus(new { error = "preferences_unavailable", message = "Auth disabled; use local layout storage only." }, 404);

    var user = identityAccessor.GetIdentity(http);
    if (user is null)
        return ProgramAuthHelpers.JsonStatus(new { error = "authentication_required" }, 401);

    if (string.IsNullOrWhiteSpace(key) || key.Length > 160)
        return Results.BadRequest(new { error = "invalid_key" });

    var raw = await prefs.GetJsonAsync(user.UserId, key, ct);
    if (raw is null)
        return Results.Content("{\"value\":null}", "application/json");
    return Results.Content($"{{\"value\":{raw}}}", "application/json");
}).WithOpenApi();

app.MapPut("/api/me/preferences/{key}", async (
    HttpContext http,
    string key,
    UserPreferencePutDto body,
    IUserPreferenceStore prefs,
    IOptions<AuthOptions> authOptions,
    IRequestIdentityAccessor identityAccessor,
    CancellationToken ct) =>
{
    var auth = authOptions.Value;
    if (!auth.Enabled)
        return ProgramAuthHelpers.JsonStatus(new { error = "preferences_unavailable", message = "Auth disabled." }, 404);

    var user = identityAccessor.GetIdentity(http);
    if (user is null)
        return ProgramAuthHelpers.JsonStatus(new { error = "authentication_required" }, 401);

    if (string.IsNullOrWhiteSpace(key) || key.Length > 160)
        return Results.BadRequest(new { error = "invalid_key" });

    var json = body.Value.ValueKind == JsonValueKind.Undefined ? "null" : body.Value.GetRawText();
    await prefs.SetJsonAsync(user.UserId, key, json, ct);
    return Results.Ok(new { ok = true });
}).WithOpenApi();

app.MapPost("/api/report/markdown", async (ReportRequestDto request, IPlanAnalysisService analysisService, CancellationToken ct) =>
{
    var incomplete = ReportExportValidation.TryAnalyzeReportRequest(request);
    if (incomplete is not null)
        return incomplete;
    var analysis = request.Analysis ?? await analysisService.AnalyzeAsync(request.Plan, ct);
    var markdown = analysisService.RenderMarkdownReport(analysis);
    return Results.Ok(new { analysisId = analysis.AnalysisId, markdown });
}).WithOpenApi();

app.MapPost("/api/report/html", async (ReportRequestDto request, IPlanAnalysisService analysisService, CancellationToken ct) =>
{
    var incomplete = ReportExportValidation.TryAnalyzeReportRequest(request);
    if (incomplete is not null)
        return incomplete;
    var analysis = request.Analysis ?? await analysisService.AnalyzeAsync(request.Plan, ct);
    var html = analysisService.RenderHtmlReport(analysis);
    return Results.Ok(new { analysisId = analysis.AnalysisId, html });
}).WithOpenApi();

app.MapPost("/api/report/json", async (ReportRequestDto request, IPlanAnalysisService analysisService, CancellationToken ct) =>
{
    var incomplete = ReportExportValidation.TryAnalyzeReportRequest(request);
    if (incomplete is not null)
        return incomplete;
    var analysis = request.Analysis ?? await analysisService.AnalyzeAsync(request.Plan, ct);
    return ProgramAuthHelpers.JsonArtifact(analysis);
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

    var (err, comparison) = await CompareExecution.RunForReportAsync(request, diagnostics, analysisService, ct);
    if (err is not null)
        return err;

    var markdown = analysisService.RenderCompareMarkdownReport(comparison!);
    return Results.Ok(new { comparisonId = comparison!.ComparisonId, markdown });
}).WithOpenApi();

app.MapPost("/api/compare/report/html", async (
    HttpRequest httpRequest,
    CompareRequestDto request,
    IPlanAnalysisService analysisService,
    CancellationToken ct) =>
{
    var diagnostics = httpRequest.Query.TryGetValue("diagnostics", out var v) &&
                      (string.Equals(v.ToString(), "1", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(v.ToString(), "true", StringComparison.OrdinalIgnoreCase));

    var (err, comparison) = await CompareExecution.RunForReportAsync(request, diagnostics, analysisService, ct);
    if (err is not null)
        return err;

    var html = analysisService.RenderCompareHtmlReport(comparison!);
    return Results.Ok(new { comparisonId = comparison!.ComparisonId, html });
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

    var (err, comparison) = await CompareExecution.RunForReportAsync(request, diagnostics, analysisService, ct);
    if (err is not null)
        return err;

    return ProgramAuthHelpers.JsonArtifact(comparison);
}).WithOpenApi();

app.MapE2eSeedEndpoints(app.Configuration);

app.Run();

public partial class Program
{
    /// <summary>Phase 117: limit structured 400 JSON to report/export routes (malformed bodies).</summary>
    internal static bool IsReportExportPath(PathString path)
    {
        var v = path.Value ?? string.Empty;
        return v.StartsWith("/api/report/", StringComparison.Ordinal)
            || v.StartsWith("/api/compare/report/", StringComparison.Ordinal);
    }
}

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

public sealed class UserPreferencePutDto
{
    public JsonElement Value { get; init; }
}
