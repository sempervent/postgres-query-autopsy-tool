using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Comparison;
using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Services;

public interface IPlanAnalysisService
{
    Task<PlanAnalysisResult> AnalyzeAsync(JsonElement postgresExplainJson, CancellationToken cancellationToken, string? queryText = null);
    Task<PlanComparisonResultV2> CompareAsync(JsonElement postgresExplainAJson, JsonElement postgresExplainBJson, CancellationToken cancellationToken, bool includeDiagnostics = false);
    string RenderMarkdownReport(PlanAnalysisResult analysis);
    string RenderHtmlReport(PlanAnalysisResult analysis);
    string RenderCompareMarkdownReport(PlanComparisonResultV2 comparison);
}

