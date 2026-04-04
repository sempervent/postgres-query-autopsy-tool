using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using PostgresQueryAutopsyTool.Api.Auth;
using PostgresQueryAutopsyTool.Api.Persistence;
using PostgresQueryAutopsyTool.Core.Analysis;

namespace PostgresQueryAutopsyTool.Api;

internal static class ProgramAuthHelpers
{
    /// <summary>Serialize large core payloads explicitly so TestServer avoids PipeWriter.UnflushedBytes issues with Results.Ok on some runtimes.</summary>
    public static IResult JsonArtifact<T>(T value) =>
        Results.Content(JsonSerializer.Serialize(value, ArtifactPersistenceJson.Options), "application/json");

    public static IResult JsonStatus(object value, int statusCode) =>
        Results.Content(JsonSerializer.Serialize(value, ArtifactPersistenceJson.Options), "application/json", statusCode: statusCode);

    public static ArtifactAccessWrite? ResolveAccessForWrite(HttpContext http, IOptions<AuthOptions> authOptions)
    {
        var o = authOptions.Value;
        if (!o.Enabled)
            return new ArtifactAccessWrite(null, ArtifactAccessScope.Link, Array.Empty<string>(), true);

        var user = http.GetPqatIdentity();
        if (user is null)
        {
            if (!o.RequireIdentityForWrites)
                return new ArtifactAccessWrite(null, ArtifactAccessScope.Link, Array.Empty<string>(), true);
            return null;
        }

        var scope = o.DefaultAccessScope.Trim();
        if (!ArtifactAccessScope.IsValid(scope))
            scope = ArtifactAccessScope.Private;

        var allowLink = scope == ArtifactAccessScope.Link;
        return new ArtifactAccessWrite(user.UserId, scope, Array.Empty<string>(), allowLink);
    }

    public static StoredArtifactAccess ToStoredArtifact(this ArtifactAccessWrite w) =>
        new(w.OwnerUserId, w.AccessScope, w.SharedGroupIds, w.AllowLinkAccess);

    public static IResult? RequireWriteIdentity(HttpContext http, IOptions<AuthOptions> authOptions)
    {
        var o = authOptions.Value;
        if (!o.Enabled || !o.RequireIdentityForWrites)
            return null;
        if (http.GetPqatIdentity() is not null)
            return null;
        return JsonStatus(new { error = "authentication_required", message = "Provide identity (see Auth docs)." }, 401);
    }
}
