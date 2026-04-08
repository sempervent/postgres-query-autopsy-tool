using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Comparison;
using PostgresQueryAutopsyTool.Core.Domain;
using PostgresQueryAutopsyTool.Core.Parsing;

namespace PostgresQueryAutopsyTool.Core.Services;

public interface IPlanAnalysisService
{
    Task<PlanAnalysisResult> AnalyzeAsync(
        JsonElement postgresExplainJson,
        CancellationToken cancellationToken,
        string? queryText = null,
        ExplainCaptureMetadata? explainMetadata = null);
    Task<PlanComparisonResultV2> CompareAsync(
        JsonElement postgresExplainAJson,
        JsonElement postgresExplainBJson,
        CancellationToken cancellationToken,
        bool includeDiagnostics = false,
        string? queryTextA = null,
        string? queryTextB = null,
        ExplainCaptureMetadata? explainMetadataA = null,
        ExplainCaptureMetadata? explainMetadataB = null,
        PlanInputNormalizationInfo? planInputNormalizationA = null,
        PlanInputNormalizationInfo? planInputNormalizationB = null);
    string RenderMarkdownReport(PlanAnalysisResult analysis);
    string RenderHtmlReport(PlanAnalysisResult analysis);
    string RenderCompareMarkdownReport(PlanComparisonResultV2 comparison);
    string RenderCompareHtmlReport(PlanComparisonResultV2 comparison);
}

