namespace PostgresQueryAutopsyTool.Api.Auth;

public sealed class UserIdentity
{
    public UserIdentity(
        string userId,
        IReadOnlyList<string> groupIds,
        AuthIdentitySource source = AuthIdentitySource.None,
        string? displayName = null)
    {
        UserId = userId;
        GroupIds = groupIds;
        Source = source;
        DisplayName = displayName;
    }

    public string UserId { get; }
    public IReadOnlyList<string> GroupIds { get; }
    public AuthIdentitySource Source { get; }
    public string? DisplayName { get; }
}
