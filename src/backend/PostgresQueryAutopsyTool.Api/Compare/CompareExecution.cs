using Microsoft.AspNetCore.Http;
using PostgresQueryAutopsyTool.Core.Comparison;
using PostgresQueryAutopsyTool.Core.Services;

namespace PostgresQueryAutopsyTool.Api.Compare;

internal static class CompareExecution
{
    /// <summary>
    /// Report/export path: use an embedded snapshot when provided; otherwise run compare from plan inputs.
    /// </summary>
    internal static Task<(IResult? Error, PlanComparisonResultV2? Comparison)> RunForReportAsync(
        CompareRequestDto request,
        bool diagnostics,
        IPlanAnalysisService analysisService,
        CancellationToken ct)
    {
        if (request.Comparison is not null)
        {
            var c = request.Comparison;
            if (string.IsNullOrWhiteSpace(c.ComparisonId))
            {
                return Task.FromResult<(IResult?, PlanComparisonResultV2?)>((Results.BadRequest(new
                {
                    error = "comparison_invalid",
                    message = "comparison.comparisonId is required when providing a comparison snapshot.",
                }), null));
            }

            // Diagnostics are fixed in the snapshot; ?diagnostics=1 does not re-materialize matcher diagnostics.
            return Task.FromResult<(IResult?, PlanComparisonResultV2?)>((null, c));
        }

        return RunAsync(request, diagnostics, analysisService, ct);
    }

    internal static async Task<(IResult? Error, PlanComparisonResultV2? Comparison)> RunAsync(
        CompareRequestDto request,
        bool diagnostics,
        IPlanAnalysisService analysisService,
        CancellationToken ct)
    {
        var ra = ComparePlanResolver.ResolveSide(request.PlanAText, request.PlanA, "planA");
        var rb = ComparePlanResolver.ResolveSide(request.PlanBText, request.PlanB, "planB");

        if (ra is ComparePlanResolver.Resolution.ParseFailed pfa)
        {
            return (Results.BadRequest(new
            {
                error = "plan_parse_failed",
                side = pfa.Side,
                message = pfa.Message,
                hint = pfa.Hint,
            }), null);
        }

        if (rb is ComparePlanResolver.Resolution.ParseFailed pfb)
        {
            return (Results.BadRequest(new
            {
                error = "plan_parse_failed",
                side = pfb.Side,
                message = pfb.Message,
                hint = pfb.Hint,
            }), null);
        }

        if (ra is ComparePlanResolver.Resolution.Missing ma)
        {
            return (Results.BadRequest(new
            {
                error = "plan_required",
                side = ma.Side,
                message = "Provide non-empty planAText or a JSON planA body.",
            }), null);
        }

        if (rb is ComparePlanResolver.Resolution.Missing mb)
        {
            return (Results.BadRequest(new
            {
                error = "plan_required",
                side = mb.Side,
                message = "Provide non-empty planBText or a JSON planB body.",
            }), null);
        }

        var okA = (ComparePlanResolver.Resolution.Ok)ra;
        var okB = (ComparePlanResolver.Resolution.Ok)rb;

        var comparison = await analysisService.CompareAsync(
            okA.Json,
            okB.Json,
            ct,
            includeDiagnostics: diagnostics,
            queryTextA: request.QueryTextA,
            queryTextB: request.QueryTextB,
            explainMetadataA: request.ExplainMetadataA,
            explainMetadataB: request.ExplainMetadataB,
            planInputNormalizationA: okA.Normalization,
            planInputNormalizationB: okB.Normalization);

        return (null, comparison);
    }
}
