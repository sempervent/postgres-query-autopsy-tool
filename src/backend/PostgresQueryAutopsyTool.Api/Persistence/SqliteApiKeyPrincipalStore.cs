using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Options;
using PostgresQueryAutopsyTool.Api.Auth;

namespace PostgresQueryAutopsyTool.Api.Persistence;

/// <summary>SQLite table of API key hashes → stable principals; optional config seeds on startup.</summary>
public sealed class SqliteApiKeyPrincipalStore : IApiKeyPrincipalLookup
{
    private readonly string _connectionString;

    public SqliteApiKeyPrincipalStore(string databasePath, IOptions<ApiKeyAuthOptions> options)
    {
        var full = Path.GetFullPath(databasePath);
        var dir = Path.GetDirectoryName(full);
        if (!string.IsNullOrEmpty(dir))
            Directory.CreateDirectory(dir);

        _connectionString = new SqliteConnectionStringBuilder { DataSource = full, Mode = SqliteOpenMode.ReadWriteCreate }.ToString();
        InitAndSeed(options.Value);
    }

    private void InitAndSeed(ApiKeyAuthOptions opts)
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText =
            """
            CREATE TABLE IF NOT EXISTS api_key_principal (
                key_hash TEXT NOT NULL PRIMARY KEY,
                user_id TEXT NOT NULL,
                display_name TEXT,
                groups_json TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                description TEXT,
                created_utc TEXT NOT NULL
            );
            """;
        cmd.ExecuteNonQuery();

        var now = DateTimeOffset.UtcNow.ToString("o", CultureInfo.InvariantCulture);
        foreach (var seed in opts.Seeds ?? Array.Empty<ApiKeySeedEntry>())
        {
            if (string.IsNullOrWhiteSpace(seed.Key) || string.IsNullOrWhiteSpace(seed.UserId))
                continue;
            var hash = HashKey(seed.Key.Trim());
            var groupsJson = JsonSerializer.Serialize(seed.Groups ?? Array.Empty<string>());
            using var up = conn.CreateCommand();
            up.CommandText =
                """
                INSERT INTO api_key_principal (key_hash, user_id, display_name, groups_json, enabled, description, created_utc)
                VALUES ($h, $u, $d, $g, $e, $desc, $c)
                ON CONFLICT(key_hash) DO UPDATE SET
                  user_id = excluded.user_id,
                  display_name = excluded.display_name,
                  groups_json = excluded.groups_json,
                  enabled = excluded.enabled,
                  description = excluded.description;
                """;
            up.Parameters.AddWithValue("$h", hash);
            up.Parameters.AddWithValue("$u", seed.UserId.Trim());
            up.Parameters.AddWithValue("$d", (object?)seed.DisplayName ?? DBNull.Value);
            up.Parameters.AddWithValue("$g", groupsJson);
            up.Parameters.AddWithValue("$e", seed.Enabled ? 1 : 0);
            up.Parameters.AddWithValue("$desc", (object?)seed.Description ?? DBNull.Value);
            up.Parameters.AddWithValue("$c", now);
            up.ExecuteNonQuery();
        }
    }

    public static string HashKey(string rawKey)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawKey));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public bool TryLookup(string keyHashHexLower, out ApiKeyPrincipalRecord? principal)
    {
        principal = null;
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText =
            """
            SELECT user_id, display_name, groups_json, enabled
            FROM api_key_principal
            WHERE key_hash = $h
            LIMIT 1;
            """;
        cmd.Parameters.AddWithValue("$h", keyHashHexLower);
        using var r = cmd.ExecuteReader();
        if (!r.Read())
            return false;

        var userId = r.GetString(0);
        var display = r.IsDBNull(1) ? null : r.GetString(1);
        var groupsJson = r.GetString(2);
        var enabled = r.GetInt64(3) != 0;
        string[] groups;
        try
        {
            groups = JsonSerializer.Deserialize<string[]>(groupsJson) ?? Array.Empty<string>();
        }
        catch
        {
            groups = Array.Empty<string>();
        }

        principal = new ApiKeyPrincipalRecord
        {
            UserId = userId,
            GroupIds = groups,
            DisplayName = display,
            Enabled = enabled,
        };
        return true;
    }

    private SqliteConnection Open()
    {
        var c = new SqliteConnection(_connectionString);
        c.Open();
        return c;
    }
}
