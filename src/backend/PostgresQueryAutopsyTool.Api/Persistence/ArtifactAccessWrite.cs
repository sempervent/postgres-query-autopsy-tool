namespace PostgresQueryAutopsyTool.Api.Persistence;

/// <summary>Row metadata written with SQLite artifact rows (Phase 37).</summary>
public sealed record ArtifactAccessWrite(
    string? OwnerUserId,
    string AccessScope,
    IReadOnlyList<string> SharedGroupIds,
    bool AllowLinkAccess);
