using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Comparison;

namespace PostgresQueryAutopsyTool.Api.Persistence;

public interface IArtifactPersistenceStore
{
    void SaveAnalysis(PlanAnalysisResult analysis);
    bool TryGetAnalysis(string analysisId, out PlanAnalysisResult? analysis);
    IReadOnlyList<string> ListAnalysisIds();

    void SaveComparison(PlanComparisonResultV2 comparison);
    bool TryGetComparison(string comparisonId, out PlanComparisonResultV2? comparison);

    /// <summary>Delete rows past <paramref name="utcNow"/> and enforce optional row-count cap (oldest first).</summary>
    void ApplyRetention(DateTimeOffset utcNow);
}
