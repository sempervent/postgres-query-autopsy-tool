namespace PostgresQueryAutopsyTool.Api.Auth;

/// <summary>Outcome of resolving identity for the current request.</summary>
public sealed class AuthResolutionResult
{
    public static AuthResolutionResult Ok(UserIdentity? identity) => new() { Identity = identity };

    public static AuthResolutionResult Reject(int statusCode, object body) =>
        new() { FailureStatusCode = statusCode, FailureBody = body };

    public UserIdentity? Identity { get; private init; }
    public int? FailureStatusCode { get; private init; }
    public object? FailureBody { get; private init; }
}
