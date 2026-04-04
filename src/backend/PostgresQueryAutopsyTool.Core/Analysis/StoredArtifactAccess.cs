namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>Access metadata persisted alongside analysis/comparison artifacts (Phase 37).</summary>
public sealed record StoredArtifactAccess(
    string? OwnerUserId,
    string AccessScope,
    IReadOnlyList<string> SharedGroupIds,
    bool AllowLinkAccess);

/// <summary>Normalized scope labels for JSON and SQLite.</summary>
public static class ArtifactAccessScope
{
    public const string Link = "link";
    public const string Private = "private";
    public const string Group = "group";
    public const string Public = "public";

    public static bool IsValid(string? s) =>
        s is Link or Private or Group or Public;
}
