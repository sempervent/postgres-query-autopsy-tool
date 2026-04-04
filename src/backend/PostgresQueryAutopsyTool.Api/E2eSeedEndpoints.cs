using System.Text.Json;
using PostgresQueryAutopsyTool.Api.Auth;
using PostgresQueryAutopsyTool.Api.Persistence;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Comparison;
using PostgresQueryAutopsyTool.Core.Services;

namespace PostgresQueryAutopsyTool.Api;

/// <summary>
/// Phase 50: deterministic persistence seeds for browser E2E. Registered only when <c>E2E:Enabled</c> is true — never enable in production.
/// </summary>
public static class E2eSeedEndpoints
{
    private const string KindAnalysis = "analysis";
    private const string KindComparison = "comparison";

    public static void MapE2eSeedEndpoints(this WebApplication app, IConfiguration configuration)
    {
        if (!configuration.GetValue("E2E:Enabled", false))
            return;

        app.MapPost(
                "/api/e2e/seed/corrupt-analysis",
                (E2eCorruptAnalysisRequest? body, IArtifactPersistenceStore store) =>
                {
                    if (store is not SqliteArtifactStore sqlite)
                        return Results.StatusCode(StatusCodes.Status501NotImplemented);
                    var id = string.IsNullOrWhiteSpace(body?.AnalysisId) ? "e2e-corrupt-analysis" : body!.AnalysisId.Trim();
                    sqlite.UpsertRawJsonForE2E(KindAnalysis, id, "{not valid json");
                    return Results.Ok(new { analysisId = id });
                })
            .WithTags("E2E")
            .WithOpenApi();

        app.MapPost(
                "/api/e2e/seed/future-schema-analysis",
                async (
                    E2eFutureSchemaAnalysisRequest? body,
                    IPlanAnalysisService analysisService,
                    IArtifactPersistenceStore store,
                    IWebHostEnvironment env,
                    CancellationToken ct) =>
                {
                    if (store is not SqliteArtifactStore sqlite)
                        return Results.StatusCode(StatusCodes.Status501NotImplemented);
                    var id = string.IsNullOrWhiteSpace(body?.AnalysisId) ? "e2e-future-schema-analysis" : body!.AnalysisId.Trim();
                    var fixture = string.IsNullOrWhiteSpace(body?.FixtureFile) ? "simple_seq_scan.json" : body!.FixtureFile.Trim();
                    var path = Path.Combine(env.ContentRootPath, "e2e-fixtures", fixture);
                    if (!File.Exists(path))
                        return Results.BadRequest(new { error = "e2e_fixture_missing", path });

                    using var doc = JsonDocument.Parse(await File.ReadAllTextAsync(path, ct));
                    var analyzed = await analysisService.AnalyzeAsync(doc.RootElement, ct);
                    var future = analyzed with
                    {
                        AnalysisId = id,
                        ArtifactSchemaVersion = ArtifactSchema.MaxSupported + 1,
                    };
                    var json = JsonSerializer.Serialize(future, ArtifactPersistenceJson.Options);
                    sqlite.UpsertRawJsonForE2E(KindAnalysis, id, json);
                    return Results.Ok(new { analysisId = id });
                })
            .WithTags("E2E")
            .WithOpenApi();

        app.MapPost(
                "/api/e2e/seed/comparison-suggestion-alias",
                async (
                    IPlanAnalysisService analysisService,
                    IArtifactPersistenceStore store,
                    IWebHostEnvironment env,
                    CancellationToken ct) =>
                {
                    if (store is not SqliteArtifactStore sqlite)
                        return Results.StatusCode(StatusCodes.Status501NotImplemented);

                    var pairs = new[]
                    {
                        ("compare_before_seq_scan.json", "compare_after_index_scan.json"),
                        ("simple_seq_scan.json", "hash_join.json"),
                    };

                    PlanComparisonResultV2? cmp = null;
                    OptimizationSuggestion? carried = null;
                    foreach (var (fa, fb) in pairs)
                    {
                        var pa = Path.Combine(env.ContentRootPath, "e2e-fixtures", fa);
                        var pb = Path.Combine(env.ContentRootPath, "e2e-fixtures", fb);
                        if (!File.Exists(pa) || !File.Exists(pb))
                            continue;
                        using var da = JsonDocument.Parse(await File.ReadAllTextAsync(pa, ct));
                        using var db = JsonDocument.Parse(await File.ReadAllTextAsync(pb, ct));
                        var c = await analysisService.CompareAsync(da.RootElement, db.RootElement, ct);
                        foreach (var s in c.CompareOptimizationSuggestions)
                        {
                            if (!s.Title.StartsWith("After this change:", StringComparison.Ordinal))
                                continue;
                            var legacy = CompareOptimizationSuggestionEngine.LegacyCarriedTitleBasedSuggestionId(s);
                            if (string.Equals(legacy, s.SuggestionId, StringComparison.Ordinal))
                                continue;
                            cmp = c;
                            carried = s;
                            break;
                        }

                        if (cmp is not null)
                            break;
                    }

                    if (cmp is null || carried is null)
                    {
                        return Results.Json(
                            new
                            {
                                error = "e2e_no_carried_alias",
                                message = "No compare suggestion with distinct legacy id found for E2E fixture pairs.",
                            },
                            statusCode: StatusCodes.Status500InternalServerError);
                    }

                    var legacyId = CompareOptimizationSuggestionEngine.LegacyCarriedTitleBasedSuggestionId(carried);
                    var stamped = PersistedArtifactNormalizer.StampNewCompareResponse(cmp);
                    var access = new ArtifactAccessWrite(null, ArtifactAccessScope.Link, Array.Empty<string>(), true);
                    sqlite.SaveComparison(stamped, access);
                    return Results.Ok(new
                    {
                        comparisonId = cmp.ComparisonId,
                        canonicalSuggestionId = carried.SuggestionId,
                        legacySuggestionId = legacyId,
                    });
                })
            .WithTags("E2E")
            .WithOpenApi();
    }
}

public sealed record E2eCorruptAnalysisRequest(string? AnalysisId = null);

public sealed record E2eFutureSchemaAnalysisRequest(string? AnalysisId = null, string? FixtureFile = null);
