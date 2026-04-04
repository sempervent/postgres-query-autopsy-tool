namespace PostgresQueryAutopsyTool.Api.Auth;

/// <summary>
/// Phase 38: single abstraction for reading the resolved principal after <see cref="AuthIdentityMiddleware"/>.
/// Prefer this over reading Authorization headers directly in endpoints.
/// </summary>
public interface IRequestIdentityAccessor
{
    UserIdentity? GetIdentity(HttpContext http);
}

public sealed class HttpRequestIdentityAccessor : IRequestIdentityAccessor
{
    public UserIdentity? GetIdentity(HttpContext http) => http.GetPqatIdentity();
}
