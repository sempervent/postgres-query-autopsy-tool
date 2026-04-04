namespace PostgresQueryAutopsyTool.Api.Auth;

public sealed class ApiKeyPrincipalRecord
{
    public required string UserId { get; init; }
    public IReadOnlyList<string> GroupIds { get; init; } = Array.Empty<string>();
    public string? DisplayName { get; init; }
    public bool Enabled { get; init; }
}

/// <summary>Looks up a principal by SHA256 hash of the raw API key (hex, lowercase).</summary>
public interface IApiKeyPrincipalLookup
{
    bool TryLookup(string keyHashHexLower, out ApiKeyPrincipalRecord? principal);
}
