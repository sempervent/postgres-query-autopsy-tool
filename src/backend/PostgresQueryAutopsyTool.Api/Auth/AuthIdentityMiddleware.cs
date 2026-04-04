using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.Options;
using PostgresQueryAutopsyTool.Api.Persistence;

namespace PostgresQueryAutopsyTool.Api.Auth;

public sealed class AuthIdentityMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(
        HttpContext ctx,
        IOptions<AuthOptions> authOptions,
        IOptions<JwtAuthOptions> jwtOptions,
        IOptions<ApiKeyAuthOptions> apiKeyOptions,
        IApiKeyPrincipalLookup apiKeyLookup)
    {
        var o = authOptions.Value;
        var mode = o.EffectiveMode;
        if (mode == AuthMode.None)
        {
            await next(ctx);
            return;
        }

        var result = mode switch
        {
            AuthMode.ProxyHeaders => AuthResolutionResult.Ok(FromProxy(ctx, o)),
            AuthMode.BearerSubject => AuthResolutionResult.Ok(FromLegacyBearer(ctx)),
            AuthMode.JwtBearer => ResolveJwt(ctx, jwtOptions.Value),
            AuthMode.ApiKey => ResolveApiKey(ctx, apiKeyOptions.Value, apiKeyLookup),
            _ => AuthResolutionResult.Ok(null),
        };

        if (result.FailureStatusCode is { } code)
        {
            ctx.Response.StatusCode = code;
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsync(
                JsonSerializer.Serialize(result.FailureBody, ArtifactPersistenceJson.Options));
            return;
        }

        ctx.SetPqatIdentity(result.Identity);
        await next(ctx);
    }

    private static UserIdentity? FromProxy(HttpContext ctx, AuthOptions o)
    {
        if (!ctx.Request.Headers.TryGetValue(o.ProxyUserIdHeader, out var uid))
            return null;
        var userId = uid.ToString().Trim();
        if (string.IsNullOrEmpty(userId))
            return null;

        var groups = Array.Empty<string>();
        if (ctx.Request.Headers.TryGetValue(o.ProxyUserGroupsHeader, out var gh))
        {
            var raw = gh.ToString();
            groups = raw.Split(o.GroupsDelimiter, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        }

        return new UserIdentity(userId, groups, AuthIdentitySource.ProxyHeaders);
    }

    private static UserIdentity? FromLegacyBearer(HttpContext ctx)
    {
        if (!ctx.Request.Headers.TryGetValue("Authorization", out var auth))
            return null;
        if (!AuthenticationHeaderValue.TryParse(auth.ToString(), out var parsed))
            return null;
        if (!string.Equals(parsed.Scheme, "Bearer", StringComparison.OrdinalIgnoreCase))
            return null;
        var sub = parsed.Parameter?.Trim();
        if (string.IsNullOrEmpty(sub))
            return null;

        var groups = Array.Empty<string>();
        if (ctx.Request.Headers.TryGetValue("X-PQAT-Groups", out var gh))
            groups = gh.ToString().Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return new UserIdentity(sub, groups, AuthIdentitySource.LegacyBearerSubject);
    }

    private static AuthResolutionResult ResolveJwt(HttpContext ctx, JwtAuthOptions jwtOpts)
    {
        if (!ctx.Request.Headers.TryGetValue("Authorization", out var auth))
            return AuthResolutionResult.Ok(null);
        if (!AuthenticationHeaderValue.TryParse(auth.ToString(), out var parsed))
            return AuthResolutionResult.Ok(null);
        if (!string.Equals(parsed.Scheme, "Bearer", StringComparison.OrdinalIgnoreCase))
            return AuthResolutionResult.Ok(null);
        var token = parsed.Parameter?.Trim();
        if (string.IsNullOrEmpty(token))
            return AuthResolutionResult.Ok(null);

        if (!JwtBearerIdentityValidator.TryCreateIdentity(token, jwtOpts, out var identity, out _))
        {
            return AuthResolutionResult.Reject(
                StatusCodes.Status401Unauthorized,
                new { error = "invalid_token", message = "JWT validation failed." });
        }

        return AuthResolutionResult.Ok(identity);
    }

    private static AuthResolutionResult ResolveApiKey(
        HttpContext ctx,
        ApiKeyAuthOptions opts,
        IApiKeyPrincipalLookup lookup)
    {
        if (!ctx.Request.Headers.TryGetValue(opts.HeaderName, out var hv))
            return AuthResolutionResult.Ok(null);
        var key = hv.ToString().Trim();
        if (string.IsNullOrEmpty(key))
            return AuthResolutionResult.Ok(null);

        var hash = SqliteApiKeyPrincipalStore.HashKey(key);
        if (!lookup.TryLookup(hash, out var rec) || rec is null)
        {
            return AuthResolutionResult.Reject(
                StatusCodes.Status401Unauthorized,
                new { error = "invalid_api_key", message = "Unknown API key." });
        }

        if (!rec.Enabled)
        {
            return AuthResolutionResult.Reject(
                StatusCodes.Status401Unauthorized,
                new { error = "api_key_disabled", message = "API key is disabled." });
        }

        var id = new UserIdentity(rec.UserId, rec.GroupIds, AuthIdentitySource.ApiKey, rec.DisplayName);
        return AuthResolutionResult.Ok(id);
    }
}
