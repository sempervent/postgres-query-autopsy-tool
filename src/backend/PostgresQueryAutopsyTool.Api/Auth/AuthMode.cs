namespace PostgresQueryAutopsyTool.Api.Auth;

public enum AuthMode
{
    None = 0,
    /// <summary>Trusted reverse proxy sets user id / groups via configurable headers.</summary>
    ProxyHeaders = 1,
    /// <summary>Authorization: Bearer &lt;token&gt; where the entire token string is the opaque user id (Phase 37 legacy).</summary>
    BearerSubject = 2,
    /// <summary>Authorization: Bearer &lt;jwt&gt; validated (HS256); owner id from configured subject claim (default sub).</summary>
    JwtBearer = 3,
    /// <summary>API key in a dedicated header; maps to stable user id via SQLite (hashed at rest).</summary>
    ApiKey = 4,
}
