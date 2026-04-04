namespace PostgresQueryAutopsyTool.Api.Auth;

/// <summary>How the API derived <see cref="UserIdentity"/> (for logging and /api/config).</summary>
public enum AuthIdentitySource
{
    None = 0,
    ProxyHeaders = 1,
    /// <summary>Phase 37 stopgap: entire bearer string treated as user id.</summary>
    LegacyBearerSubject = 2,
    JwtBearer = 3,
    ApiKey = 4,
}
