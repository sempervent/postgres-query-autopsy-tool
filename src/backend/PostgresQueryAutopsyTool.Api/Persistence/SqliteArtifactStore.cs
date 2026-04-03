using System.Globalization;
using Microsoft.Data.Sqlite;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Comparison;
using System.Text.Json;

namespace PostgresQueryAutopsyTool.Api.Persistence;

public sealed class SqliteArtifactStore : IArtifactPersistenceStore
{
    private const string KindAnalysis = "analysis";
    private const string KindComparison = "comparison";

    private readonly string _connectionString;
    private readonly TimeSpan? _ttl;
    private readonly int? _maxRows;

    public SqliteArtifactStore(string databasePath, double? ttlHours, int? maxRowsTotal)
    {
        var full = Path.GetFullPath(databasePath);
        var dir = Path.GetDirectoryName(full);
        if (!string.IsNullOrEmpty(dir))
            Directory.CreateDirectory(dir);

        _connectionString = new SqliteConnectionStringBuilder { DataSource = full, Mode = SqliteOpenMode.ReadWriteCreate }.ToString();
        _ttl = ttlHours is > 0 ? TimeSpan.FromHours(ttlHours.Value) : null;
        _maxRows = maxRowsTotal is > 0 ? maxRowsTotal : null;
        InitSchema();
    }

    private void InitSchema()
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText =
            """
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS artifact_store (
                kind TEXT NOT NULL,
                id TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_utc TEXT NOT NULL,
                expires_utc TEXT,
                last_access_utc TEXT,
                PRIMARY KEY (kind, id)
            );
            CREATE INDEX IF NOT EXISTS ix_artifact_expires ON artifact_store(expires_utc);
            CREATE INDEX IF NOT EXISTS ix_artifact_created ON artifact_store(created_utc);
            """;
        cmd.ExecuteNonQuery();
    }

    private SqliteConnection Open()
    {
        var c = new SqliteConnection(_connectionString);
        c.Open();
        return c;
    }

    public void SaveAnalysis(PlanAnalysisResult analysis) =>
        Upsert(KindAnalysis, analysis.AnalysisId, JsonSerializer.Serialize(analysis, ArtifactPersistenceJson.Options));

    public void SaveComparison(PlanComparisonResultV2 comparison) =>
        Upsert(KindComparison, comparison.ComparisonId, JsonSerializer.Serialize(comparison, ArtifactPersistenceJson.Options));

    private void Upsert(string kind, string id, string json)
    {
        var now = DateTimeOffset.UtcNow;
        var exp = _ttl is { } t ? now.Add(t) : (DateTimeOffset?)null;
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText =
            """
            INSERT INTO artifact_store (kind, id, payload_json, created_utc, expires_utc, last_access_utc)
            VALUES ($k, $id, $json, $c, $e, $c)
            ON CONFLICT(kind, id) DO UPDATE SET
                payload_json = excluded.payload_json,
                expires_utc = excluded.expires_utc,
                last_access_utc = excluded.last_access_utc;
            """;
        cmd.Parameters.AddWithValue("$k", kind);
        cmd.Parameters.AddWithValue("$id", id);
        cmd.Parameters.AddWithValue("$json", json);
        cmd.Parameters.AddWithValue("$c", FormatUtc(now));
        cmd.Parameters.AddWithValue("$e", exp is { } x ? FormatUtc(x) : (object)DBNull.Value);
        cmd.ExecuteNonQuery();
    }

    public bool TryGetAnalysis(string analysisId, out PlanAnalysisResult? analysis) =>
        TryGet(KindAnalysis, analysisId, ArtifactPersistenceJson.Options, out analysis);

    public bool TryGetComparison(string comparisonId, out PlanComparisonResultV2? comparison) =>
        TryGet(KindComparison, comparisonId, ArtifactPersistenceJson.Options, out comparison);

    private bool TryGet<T>(string kind, string id, JsonSerializerOptions options, out T? value)
    {
        value = default;
        using var conn = Open();
        using var sel = conn.CreateCommand();
        sel.CommandText =
            """
            SELECT payload_json, expires_utc FROM artifact_store WHERE kind = $k AND id = $id;
            """;
        sel.Parameters.AddWithValue("$k", kind);
        sel.Parameters.AddWithValue("$id", id);
        using var reader = sel.ExecuteReader();
        if (!reader.Read())
            return false;

        var expRaw = reader.IsDBNull(1) ? null : reader.GetString(1);
        if (expRaw is not null && TryParseUtc(expRaw, out var exp) && DateTimeOffset.UtcNow > exp)
        {
            DeleteRow(conn, kind, id);
            return false;
        }

        var json = reader.GetString(0);
        try
        {
            value = JsonSerializer.Deserialize<T>(json, options);
        }
        catch (JsonException)
        {
            DeleteRow(conn, kind, id);
            return false;
        }

        var now = DateTimeOffset.UtcNow;
        using var touch = conn.CreateCommand();
        touch.CommandText = "UPDATE artifact_store SET last_access_utc = $t WHERE kind = $k AND id = $id;";
        touch.Parameters.AddWithValue("$t", FormatUtc(now));
        touch.Parameters.AddWithValue("$k", kind);
        touch.Parameters.AddWithValue("$id", id);
        touch.ExecuteNonQuery();

        return value is not null;
    }

    private static void DeleteRow(SqliteConnection conn, string kind, string id)
    {
        using var del = conn.CreateCommand();
        del.CommandText = "DELETE FROM artifact_store WHERE kind = $k AND id = $id;";
        del.Parameters.AddWithValue("$k", kind);
        del.Parameters.AddWithValue("$id", id);
        del.ExecuteNonQuery();
    }

    public IReadOnlyList<string> ListAnalysisIds()
    {
        using var conn = Open();
        PurgeExpired(conn, DateTimeOffset.UtcNow);
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT id FROM artifact_store WHERE kind = $k ORDER BY created_utc DESC;";
        cmd.Parameters.AddWithValue("$k", KindAnalysis);
        var list = new List<string>();
        using var r = cmd.ExecuteReader();
        while (r.Read())
            list.Add(r.GetString(0));
        return list;
    }

    public void ApplyRetention(DateTimeOffset utcNow)
    {
        using var conn = Open();
        PurgeExpired(conn, utcNow);
        if (_maxRows is not { } cap)
            return;

        using var countCmd = conn.CreateCommand();
        countCmd.CommandText = "SELECT COUNT(*) FROM artifact_store;";
        var total = Convert.ToInt32(countCmd.ExecuteScalar(), CultureInfo.InvariantCulture);
        if (total <= cap)
            return;

        var toDelete = total - cap;
        using var del = conn.CreateCommand();
        del.CommandText =
            """
            DELETE FROM artifact_store WHERE rowid IN (
              SELECT rowid FROM artifact_store ORDER BY created_utc ASC LIMIT $lim
            );
            """;
        del.Parameters.AddWithValue("$lim", toDelete);
        del.ExecuteNonQuery();
    }

    private static void PurgeExpired(SqliteConnection conn, DateTimeOffset utcNow)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM artifact_store WHERE expires_utc IS NOT NULL AND expires_utc < $n;";
        cmd.Parameters.AddWithValue("$n", FormatUtc(utcNow));
        cmd.ExecuteNonQuery();
    }

    private static string FormatUtc(DateTimeOffset t) => t.UtcDateTime.ToString("o", CultureInfo.InvariantCulture);

    private static bool TryParseUtc(string s, out DateTimeOffset t) =>
        DateTimeOffset.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out t);
}
