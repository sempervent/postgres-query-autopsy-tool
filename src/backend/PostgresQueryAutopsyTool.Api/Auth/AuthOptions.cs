using PostgresQueryAutopsyTool.Core.Analysis;

namespace PostgresQueryAutopsyTool.Api.Auth;

public sealed class AuthOptions
{
    /// <summary>When false (default), deployment behaves like Phase 36: capability URLs, no identity.</summary>
    public bool Enabled { get; set; }

    /// <summary>One of: None, ProxyHeaders, BearerSubject, JwtBearer, ApiKey (case-insensitive).</summary>
    public string Mode { get; set; } = "None";

    /// <summary>When auth is enabled, POST /api/analyze and /api/compare require a resolved identity.</summary>
    public bool RequireIdentityForWrites { get; set; } = true;

    /// <summary>Default scope for newly persisted artifacts when the creator is authenticated.</summary>
    public string DefaultAccessScope { get; set; } = ArtifactAccessScope.Private;

    public string ProxyUserIdHeader { get; set; } = "X-PQAT-User";
    public string ProxyUserGroupsHeader { get; set; } = "X-PQAT-Groups";
    public string GroupsDelimiter { get; set; } = ",";

    public AuthMode EffectiveMode =>
        !Enabled ? AuthMode.None :
        Enum.TryParse<AuthMode>(Mode, true, out var m) ? m : AuthMode.None;
}
