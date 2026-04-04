namespace PostgresQueryAutopsyTool.Api.Persistence;

/// <summary>Phase 40: small key/value JSON preferences per authenticated user (same SQLite file as artifacts).</summary>
public interface IUserPreferenceStore
{
    Task<string?> GetJsonAsync(string userId, string key, CancellationToken ct = default);

    Task SetJsonAsync(string userId, string key, string json, CancellationToken ct = default);
}
