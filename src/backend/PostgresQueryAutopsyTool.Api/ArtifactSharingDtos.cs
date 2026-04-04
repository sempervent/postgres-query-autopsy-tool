namespace PostgresQueryAutopsyTool.Api;

public sealed class UpdateArtifactSharingDto
{
    public string AccessScope { get; init; } = "";
    public IReadOnlyList<string>? SharedGroupIds { get; init; }
    public bool AllowLinkAccess { get; init; }
}
