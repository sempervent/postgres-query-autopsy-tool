using Microsoft.Extensions.Options;

namespace PostgresQueryAutopsyTool.Api.Auth;

public static class AuthConfigurationValidator
{
    public static void Validate(IServiceProvider services, IConfiguration configuration)
    {
        var auth = services.GetRequiredService<IOptions<AuthOptions>>().Value;
        if (!auth.Enabled)
            return;

        if (auth.EffectiveMode == AuthMode.JwtBearer)
        {
            var jwt = configuration.GetSection("Auth:Jwt").Get<JwtAuthOptions>() ?? new JwtAuthOptions();
            if (string.IsNullOrWhiteSpace(jwt.Issuer) || string.IsNullOrWhiteSpace(jwt.Audience))
            {
                throw new InvalidOperationException(
                    "Auth:Jwt:Issuer and Auth:Jwt:Audience are required when Auth:Mode is JwtBearer.");
            }

            if (string.IsNullOrWhiteSpace(jwt.SigningKeyBase64) && string.IsNullOrWhiteSpace(jwt.SigningKey))
            {
                throw new InvalidOperationException(
                    "Auth:Jwt:SigningKeyBase64 (or Auth:Jwt:SigningKey) is required when Auth:Mode is JwtBearer.");
            }
        }
    }
}
