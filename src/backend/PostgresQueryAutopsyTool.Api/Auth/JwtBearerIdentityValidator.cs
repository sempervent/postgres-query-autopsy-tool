using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;

namespace PostgresQueryAutopsyTool.Api.Auth;

public static class JwtBearerIdentityValidator
{
    static JwtBearerIdentityValidator()
    {
        // Default maps short JWT claim names to long URIs; we keep issuer/audience validation but read `sub` as `sub`.
        JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();
        JwtSecurityTokenHandler.DefaultOutboundClaimTypeMap.Clear();
    }

    public static bool TryCreateIdentity(
        string rawJwt,
        JwtAuthOptions o,
        out UserIdentity? identity,
        out string? error)
    {
        identity = null;
        error = null;
        if (string.IsNullOrWhiteSpace(rawJwt))
        {
            error = "empty_token";
            return false;
        }

        var key = ResolveSigningKey(o);
        if (key is null)
        {
            error = "missing_signing_key";
            return false;
        }

        var tokenHandler = new JwtSecurityTokenHandler();
        var validationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = key,
            ValidateIssuer = true,
            ValidIssuer = o.Issuer,
            ValidateAudience = true,
            ValidAudience = o.Audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(2),
        };

        try
        {
            var principal = tokenHandler.ValidateToken(rawJwt, validationParameters, out _);
            var sub = principal.FindFirst(o.SubjectClaim)?.Value?.Trim();
            if (string.IsNullOrEmpty(sub))
            {
                error = "missing_subject";
                return false;
            }

            var groups = ExtractGroups(principal, o.GroupsClaimNames);
            identity = new UserIdentity(sub, groups, AuthIdentitySource.JwtBearer, displayName: null);
            return true;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return false;
        }
    }

    private static SymmetricSecurityKey? ResolveSigningKey(JwtAuthOptions o)
    {
        if (!string.IsNullOrEmpty(o.SigningKeyBase64))
        {
            try
            {
                var bytes = Convert.FromBase64String(o.SigningKeyBase64.Trim());
                return new SymmetricSecurityKey(bytes);
            }
            catch
            {
                return null;
            }
        }

        if (!string.IsNullOrEmpty(o.SigningKey))
            return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(o.SigningKey));

        return null;
    }

    private static IReadOnlyList<string> ExtractGroups(ClaimsPrincipal principal, string[] claimNames)
    {
        var set = new HashSet<string>(StringComparer.Ordinal);
        foreach (var name in claimNames)
        {
            foreach (var claim in principal.FindAll(name))
            {
                var v = claim.Value?.Trim();
                if (string.IsNullOrEmpty(v))
                    continue;
                if (v.StartsWith('['))
                {
                    try
                    {
                        var arr = JsonSerializer.Deserialize<string[]>(v);
                        if (arr is not null)
                        {
                            foreach (var g in arr)
                            {
                                if (!string.IsNullOrWhiteSpace(g))
                                    set.Add(g.Trim());
                            }
                        }
                    }
                    catch
                    {
                        // ignore malformed JSON array
                    }
                }
                else
                {
                    foreach (var part in v.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                        set.Add(part);
                }
            }
        }

        return set.Count == 0 ? Array.Empty<string>() : set.ToArray();
    }
}
