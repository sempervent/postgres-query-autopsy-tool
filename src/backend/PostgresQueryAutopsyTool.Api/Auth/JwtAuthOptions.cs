namespace PostgresQueryAutopsyTool.Api.Auth;

/// <summary>HS256 JWT validation when <see cref="AuthMode.JwtBearer"/> is selected.</summary>
public sealed class JwtAuthOptions
{
    /// <summary>Expected iss claim.</summary>
    public string Issuer { get; set; } = "";

    /// <summary>Expected aud claim (single audience).</summary>
    public string Audience { get; set; } = "";

    /// <summary>Symmetric signing key, base64-encoded (recommended; decodes to 32+ bytes for HS256).</summary>
    public string SigningKeyBase64 { get; set; } = "";

    /// <summary>Alternative to SigningKeyBase64: raw UTF-8 secret (dev only).</summary>
    public string? SigningKey { get; set; }

    /// <summary>Subject claim name (default sub).</summary>
    public string SubjectClaim { get; set; } = "sub";

    /// <summary>Claim names to scan for group membership (first match wins per claim; values can be comma-separated or JSON array string).</summary>
    public string[] GroupsClaimNames { get; set; } = ["groups", "roles"];
}
