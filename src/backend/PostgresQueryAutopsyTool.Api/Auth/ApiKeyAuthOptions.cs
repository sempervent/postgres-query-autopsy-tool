namespace PostgresQueryAutopsyTool.Api.Auth;

/// <summary>Configuration for <see cref="AuthMode.ApiKey"/> and optional dev seeds.</summary>
public sealed class ApiKeyAuthOptions
{
    /// <summary>HTTP header carrying the raw API key (never logged).</summary>
    public string HeaderName { get; set; } = "X-Api-Key";

    /// <summary>Optional bootstrap rows (hashed at startup; plaintext keys only in trusted config).</summary>
    public ApiKeySeedEntry[] Seeds { get; set; } = [];
}

public sealed class ApiKeySeedEntry
{
    public string Key { get; set; } = "";
    public string UserId { get; set; } = "";
    public string[]? Groups { get; set; }
    public string? DisplayName { get; set; }
    public string? Description { get; set; }
    public bool Enabled { get; set; } = true;
}
