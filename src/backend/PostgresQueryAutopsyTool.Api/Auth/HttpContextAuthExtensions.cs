namespace PostgresQueryAutopsyTool.Api.Auth;

public static class HttpContextAuthExtensions
{
    public const string IdentityItemKey = "pqat.identity";

    public static UserIdentity? GetPqatIdentity(this HttpContext? http) =>
        http?.Items.TryGetValue(IdentityItemKey, out var v) == true ? v as UserIdentity : null;

    internal static void SetPqatIdentity(this HttpContext http, UserIdentity? identity)
    {
        if (identity is null)
            http.Items.Remove(IdentityItemKey);
        else
            http.Items[IdentityItemKey] = identity;
    }
}
