using PostgresQueryAutopsyTool.Api.Auth;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Comparison;

namespace PostgresQueryAutopsyTool.Api.Persistence;

public interface IArtifactPersistenceStore
{
    void SaveAnalysis(PlanAnalysisResult analysis, ArtifactAccessWrite? access = null);
    /// <summary>Phase 49: typed load outcome (corrupt / incompatible vs missing).</summary>
    ArtifactReadResult<PlanAnalysisResult> ReadAnalysis(string analysisId);
    IReadOnlyList<string> ListAnalysisIds(UserIdentity? viewer, bool authEnabled);

    void SaveComparison(PlanComparisonResultV2 comparison, ArtifactAccessWrite? access = null);
    ArtifactReadResult<PlanComparisonResultV2> ReadComparison(string comparisonId);

    bool TryGetAnalysisAccess(string analysisId, out StoredArtifactAccess? access);
    bool TryGetComparisonAccess(string comparisonId, out StoredArtifactAccess? access);

    bool TryUpdateAnalysisAccess(string analysisId, ArtifactAccessWrite write, string ownerUserId);
    bool TryUpdateComparisonAccess(string comparisonId, ArtifactAccessWrite write, string ownerUserId);

    /// <summary>Delete rows past <paramref name="utcNow"/> and enforce optional row-count cap (oldest first).</summary>
    void ApplyRetention(DateTimeOffset utcNow);
}
