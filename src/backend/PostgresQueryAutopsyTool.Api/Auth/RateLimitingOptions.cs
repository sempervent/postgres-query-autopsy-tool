namespace PostgresQueryAutopsyTool.Api.Auth;

/// <summary>Optional fixed-window rate limiting for expensive POST endpoints.</summary>
public sealed class RateLimitingOptions
{
    public bool Enabled { get; set; }

    /// <summary>Max requests per window per partition (remote IP when available).</summary>
    public int PermitLimit { get; set; } = 120;

    public int WindowSeconds { get; set; } = 60;
}
