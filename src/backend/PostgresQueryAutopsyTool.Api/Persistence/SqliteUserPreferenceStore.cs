using Microsoft.Data.Sqlite;

namespace PostgresQueryAutopsyTool.Api.Persistence;

public sealed class SqliteUserPreferenceStore : IUserPreferenceStore
{
    private readonly string _connectionString;

    public SqliteUserPreferenceStore(string databasePath)
    {
        var full = Path.GetFullPath(databasePath);
        var dir = Path.GetDirectoryName(full);
        if (!string.IsNullOrEmpty(dir))
            Directory.CreateDirectory(dir);

        _connectionString = new SqliteConnectionStringBuilder { DataSource = full, Mode = SqliteOpenMode.ReadWriteCreate }.ToString();
        InitSchema();
    }

    private void InitSchema()
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText =
            """
            CREATE TABLE IF NOT EXISTS user_preference (
                user_id TEXT NOT NULL,
                pref_key TEXT NOT NULL,
                value_json TEXT NOT NULL,
                updated_utc TEXT NOT NULL,
                PRIMARY KEY (user_id, pref_key)
            );
            """;
        cmd.ExecuteNonQuery();
    }

    private SqliteConnection Open()
    {
        var c = new SqliteConnection(_connectionString);
        c.Open();
        return c;
    }

    public Task<string?> GetJsonAsync(string userId, string key, CancellationToken ct = default)
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT value_json FROM user_preference WHERE user_id = $u AND pref_key = $k LIMIT 1;";
        cmd.Parameters.AddWithValue("$u", userId);
        cmd.Parameters.AddWithValue("$k", key);
        var r = cmd.ExecuteScalar();
        return Task.FromResult(r as string);
    }

    public Task SetJsonAsync(string userId, string key, string json, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow.ToString("O", System.Globalization.CultureInfo.InvariantCulture);
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText =
            """
            INSERT INTO user_preference (user_id, pref_key, value_json, updated_utc)
            VALUES ($u, $k, $v, $t)
            ON CONFLICT(user_id, pref_key) DO UPDATE SET
                value_json = excluded.value_json,
                updated_utc = excluded.updated_utc;
            """;
        cmd.Parameters.AddWithValue("$u", userId);
        cmd.Parameters.AddWithValue("$k", key);
        cmd.Parameters.AddWithValue("$v", json);
        cmd.Parameters.AddWithValue("$t", now);
        cmd.ExecuteNonQuery();
        return Task.CompletedTask;
    }
}
