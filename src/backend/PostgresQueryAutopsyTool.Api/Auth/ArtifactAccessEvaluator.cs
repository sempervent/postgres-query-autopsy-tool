using PostgresQueryAutopsyTool.Core.Analysis;

namespace PostgresQueryAutopsyTool.Api.Auth;

public static class ArtifactAccessEvaluator
{
    /// <summary>Whether the viewer may read the artifact payload.</summary>
    public static bool CanRead(bool authEnabled, StoredArtifactAccess? access, UserIdentity? viewer)
    {
        if (!authEnabled)
            return true;

        if (access is null)
            return true;

        // Legacy rows (pre–Phase 37) or non-auth saves: no owner → treat as link capability if allowed.
        if (string.IsNullOrEmpty(access.OwnerUserId))
        {
            return access.AccessScope == ArtifactAccessScope.Link && access.AllowLinkAccess;
        }

        if (access.AccessScope == ArtifactAccessScope.Link && access.AllowLinkAccess)
            return true;

        if (viewer is null)
            return false;

        if (string.Equals(access.OwnerUserId, viewer.UserId, StringComparison.Ordinal))
            return true;

        if (access.AccessScope == ArtifactAccessScope.Public)
            return true;

        if (access.AccessScope == ArtifactAccessScope.Group)
        {
            foreach (var g in access.SharedGroupIds)
            {
                if (viewer.GroupIds.Contains(g, StringComparer.Ordinal))
                    return true;
            }
        }

        return false;
    }

    public static bool CanManageSharing(UserIdentity? viewer, StoredArtifactAccess? access)
    {
        if (viewer is null || access is null || string.IsNullOrEmpty(access.OwnerUserId))
            return false;
        return string.Equals(access.OwnerUserId, viewer.UserId, StringComparison.Ordinal);
    }
}
