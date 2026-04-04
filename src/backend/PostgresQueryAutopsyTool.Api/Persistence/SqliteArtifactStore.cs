using System.Globalization;
using System.Text.Json;
using Microsoft.Data.Sqlite;
using PostgresQueryAutopsyTool.Api.Auth;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Comparison;

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
        EnsureAccessColumns(conn);
    }

    private static void EnsureAccessColumns(SqliteConnection conn)
    {
        void Add(string name, string ddl)
        {
            if (ColumnExists(conn, "artifact_store", name))
                return;
            using var a = conn.CreateCommand();
            a.CommandText = $"ALTER TABLE artifact_store ADD COLUMN {ddl};";
            a.ExecuteNonQuery();
        }

        Add("owner_user_id", "owner_user_id TEXT");
        Add("access_scope", "access_scope TEXT NOT NULL DEFAULT 'link'");
        Add("shared_group_ids_json", "shared_group_ids_json TEXT");
        Add("allow_link_access", "allow_link_access INTEGER NOT NULL DEFAULT 1");
        Add("updated_utc", "updated_utc TEXT");
    }

    private static bool ColumnExists(SqliteConnection conn, string table, string column)
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText = $"PRAGMA table_info({table});";
        using var r = cmd.ExecuteReader();
        while (r.Read())
        {
            if (string.Equals(r.GetString(1), column, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

    private SqliteConnection Open()
    {
        var c = new SqliteConnection(_connectionString);
        c.Open();
        return c;
    }

    public void SaveAnalysis(PlanAnalysisResult analysis, ArtifactAccessWrite? access = null) =>
        Upsert(KindAnalysis, analysis.AnalysisId, PrepareAnalysisForStore(analysis), access);

    public void SaveComparison(PlanComparisonResultV2 comparison, ArtifactAccessWrite? access = null) =>
        Upsert(KindComparison, comparison.ComparisonId, PrepareComparisonForStore(comparison), access);

    private static PlanAnalysisResult PrepareAnalysisForStore(PlanAnalysisResult a) =>
        a with
        {
            ArtifactAccess = null,
            ArtifactSchemaVersion = ArtifactSchema.Current,
        };

    private static PlanComparisonResultV2 PrepareComparisonForStore(PlanComparisonResultV2 c) =>
        c with
        {
            ArtifactAccess = null,
            ArtifactSchemaVersion = ArtifactSchema.Current,
            PlanA = PrepareAnalysisForStore(c.PlanA),
            PlanB = PrepareAnalysisForStore(c.PlanB),
        };

    private void Upsert(string kind, string id, object payload, ArtifactAccessWrite? access)
    {
        var json = JsonSerializer.Serialize(payload, ArtifactPersistenceJson.Options);
        var now = DateTimeOffset.UtcNow;
        var exp = _ttl is { } t ? now.Add(t) : (DateTimeOffset?)null;
        var acc = access ?? new ArtifactAccessWrite(null, ArtifactAccessScope.Link, Array.Empty<string>(), true);
        var groupsJson = JsonSerializer.Serialize(acc.SharedGroupIds.ToArray());

        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText =
            """
            INSERT INTO artifact_store (
                kind, id, payload_json, created_utc, expires_utc, last_access_utc,
                owner_user_id, access_scope, shared_group_ids_json, allow_link_access, updated_utc)
            VALUES ($k, $id, $json, $c, $e, $c, $owner, $scope, $groups, $link, $u)
            ON CONFLICT(kind, id) DO UPDATE SET
                payload_json = excluded.payload_json,
                expires_utc = excluded.expires_utc,
                last_access_utc = excluded.last_access_utc,
                owner_user_id = excluded.owner_user_id,
                access_scope = excluded.access_scope,
                shared_group_ids_json = excluded.shared_group_ids_json,
                allow_link_access = excluded.allow_link_access,
                updated_utc = excluded.updated_utc;
            """;
        cmd.Parameters.AddWithValue("$k", kind);
        cmd.Parameters.AddWithValue("$id", id);
        cmd.Parameters.AddWithValue("$json", json);
        cmd.Parameters.AddWithValue("$c", FormatUtc(now));
        cmd.Parameters.AddWithValue("$e", exp is { } x ? FormatUtc(x) : (object)DBNull.Value);
        cmd.Parameters.AddWithValue("$owner", (object?)acc.OwnerUserId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$scope", acc.AccessScope);
        cmd.Parameters.AddWithValue("$groups", groupsJson);
        cmd.Parameters.AddWithValue("$link", acc.AllowLinkAccess ? 1 : 0);
        cmd.Parameters.AddWithValue("$u", FormatUtc(now));
        cmd.ExecuteNonQuery();
    }

    /// <summary>
    /// Inserts or replaces a row with a pre-serialized JSON payload. <b>Only for E2E / controlled tests</b> when <c>E2E:Enabled</c> is true.
    /// </summary>
    public void UpsertRawJsonForE2E(string kind, string id, string payloadJson)
    {
        ArgumentException.ThrowIfNullOrEmpty(kind);
        ArgumentException.ThrowIfNullOrEmpty(id);
        ArgumentNullException.ThrowIfNull(payloadJson);
        var now = DateTimeOffset.UtcNow;
        var exp = _ttl is { } t ? now.Add(t) : (DateTimeOffset?)null;
        var acc = new ArtifactAccessWrite(null, ArtifactAccessScope.Link, Array.Empty<string>(), true);
        var groupsJson = JsonSerializer.Serialize(acc.SharedGroupIds.ToArray());

        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText =
            """
            INSERT INTO artifact_store (
                kind, id, payload_json, created_utc, expires_utc, last_access_utc,
                owner_user_id, access_scope, shared_group_ids_json, allow_link_access, updated_utc)
            VALUES ($k, $id, $json, $c, $e, $c, $owner, $scope, $groups, $link, $u)
            ON CONFLICT(kind, id) DO UPDATE SET
                payload_json = excluded.payload_json,
                expires_utc = excluded.expires_utc,
                last_access_utc = excluded.last_access_utc,
                owner_user_id = excluded.owner_user_id,
                access_scope = excluded.access_scope,
                shared_group_ids_json = excluded.shared_group_ids_json,
                allow_link_access = excluded.allow_link_access,
                updated_utc = excluded.updated_utc;
            """;
        cmd.Parameters.AddWithValue("$k", kind);
        cmd.Parameters.AddWithValue("$id", id);
        cmd.Parameters.AddWithValue("$json", payloadJson);
        cmd.Parameters.AddWithValue("$c", FormatUtc(now));
        cmd.Parameters.AddWithValue("$e", exp is { } x ? FormatUtc(x) : (object)DBNull.Value);
        cmd.Parameters.AddWithValue("$owner", (object?)acc.OwnerUserId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$scope", acc.AccessScope);
        cmd.Parameters.AddWithValue("$groups", groupsJson);
        cmd.Parameters.AddWithValue("$link", acc.AllowLinkAccess ? 1 : 0);
        cmd.Parameters.AddWithValue("$u", FormatUtc(now));
        cmd.ExecuteNonQuery();
    }

    public ArtifactReadResult<PlanAnalysisResult> ReadAnalysis(string analysisId) =>
        ReadArtifactRow<PlanAnalysisResult>(
            KindAnalysis,
            analysisId,
            PersistedArtifactNormalizer.NormalizeLoadedAnalysis,
            (a, acc) => a with { ArtifactAccess = acc });

    public ArtifactReadResult<PlanComparisonResultV2> ReadComparison(string comparisonId) =>
        ReadArtifactRow<PlanComparisonResultV2>(
            KindComparison,
            comparisonId,
            PersistedArtifactNormalizer.NormalizeLoadedComparison,
            (c, acc) => c with { ArtifactAccess = acc });

    private ArtifactReadResult<T> ReadArtifactRow<T>(
        string kind,
        string id,
        Func<T, DateTimeOffset?, T> upgrade,
        Func<T, StoredArtifactAccess, T> withAccess)
        where T : class
    {
        using var conn = Open();
        using var sel = conn.CreateCommand();
        sel.CommandText =
            """
            SELECT payload_json, expires_utc, created_utc, owner_user_id, access_scope, shared_group_ids_json, allow_link_access
            FROM artifact_store WHERE kind = $k AND id = $id;
            """;
        sel.Parameters.AddWithValue("$k", kind);
        sel.Parameters.AddWithValue("$id", id);
        using var reader = sel.ExecuteReader();
        if (!reader.Read())
            return ArtifactReadResult<T>.Missing();

        var expRaw = !reader.IsDBNull(1) ? reader.GetString(1) : null;
        if (expRaw is not null && TryParseUtc(expRaw, out var exp) && DateTimeOffset.UtcNow > exp)
        {
            DeleteRow(conn, kind, id);
            return ArtifactReadResult<T>.Missing();
        }

        var json = reader.GetString(0);
        DateTimeOffset? createdUtc = null;
        if (reader.FieldCount > 2 && !reader.IsDBNull(2) && TryParseUtc(reader.GetString(2), out var created))
            createdUtc = created;

        T? value;
        try
        {
            value = JsonSerializer.Deserialize<T>(json, ArtifactPersistenceJson.Options);
        }
        catch (JsonException)
        {
            return ArtifactReadResult<T>.Corrupt(
                "artifact_corrupt",
                "Stored artifact JSON is unreadable (corrupt or incompatible shape). The row was left in the database for recovery.");
        }

        if (value is null)
        {
            return ArtifactReadResult<T>.Corrupt(
                "artifact_corrupt",
                "Stored artifact deserialized to null.");
        }

        try
        {
            value = upgrade(value, createdUtc);
        }
        catch (UnsupportedArtifactSchemaVersionException ex)
        {
            return ArtifactReadResult<T>.Incompatible(
                ex.PayloadVersion,
                "artifact_version_unsupported",
                ex.Message);
        }

        var access = ReadAccessFromFullRow(reader);
        value = withAccess(value, access);
        var now = DateTimeOffset.UtcNow;
        using var touch = conn.CreateCommand();
        touch.CommandText = "UPDATE artifact_store SET last_access_utc = $t WHERE kind = $k AND id = $id;";
        touch.Parameters.AddWithValue("$t", FormatUtc(now));
        touch.Parameters.AddWithValue("$k", kind);
        touch.Parameters.AddWithValue("$id", id);
        touch.ExecuteNonQuery();
        return ArtifactReadResult<T>.OkResult(value);
    }

    private static StoredArtifactAccess ReadAccessFromFullRow(SqliteDataReader reader)
    {
        string? owner = reader.FieldCount > 3 && !reader.IsDBNull(3) ? reader.GetString(3) : null;
        var scope = reader.FieldCount > 4 && !reader.IsDBNull(4) ? reader.GetString(4) : ArtifactAccessScope.Link;
        if (!ArtifactAccessScope.IsValid(scope))
            scope = ArtifactAccessScope.Link;
        var groupsRaw = reader.FieldCount > 5 && !reader.IsDBNull(5) ? reader.GetString(5) : "[]";
        IReadOnlyList<string> groups = Array.Empty<string>();
        try
        {
            groups = JsonSerializer.Deserialize<string[]>(groupsRaw) ?? Array.Empty<string>();
        }
        catch
        {
            /* ignore */
        }

        var link = true;
        if (reader.FieldCount > 6 && !reader.IsDBNull(6))
            link = reader.GetInt64(6) != 0;

        return new StoredArtifactAccess(owner, scope, groups, link);
    }

    public bool TryGetAnalysisAccess(string analysisId, out StoredArtifactAccess? access)
    {
        access = null;
        using var conn = Open();
        using var sel = conn.CreateCommand();
        sel.CommandText =
            "SELECT owner_user_id, access_scope, shared_group_ids_json, allow_link_access FROM artifact_store WHERE kind = $k AND id = $id;";
        sel.Parameters.AddWithValue("$k", KindAnalysis);
        sel.Parameters.AddWithValue("$id", analysisId);
        using var reader = sel.ExecuteReader();
        if (!reader.Read())
            return false;
        access = ReadAccessShort(reader);
        return true;
    }

    public bool TryGetComparisonAccess(string comparisonId, out StoredArtifactAccess? access)
    {
        access = null;
        using var conn = Open();
        using var sel = conn.CreateCommand();
        sel.CommandText =
            "SELECT owner_user_id, access_scope, shared_group_ids_json, allow_link_access FROM artifact_store WHERE kind = $k AND id = $id;";
        sel.Parameters.AddWithValue("$k", KindComparison);
        sel.Parameters.AddWithValue("$id", comparisonId);
        using var reader = sel.ExecuteReader();
        if (!reader.Read())
            return false;
        access = ReadAccessShort(reader);
        return true;
    }

    private static StoredArtifactAccess ReadAccessShort(SqliteDataReader reader)
    {
        string? owner = reader.IsDBNull(0) ? null : reader.GetString(0);
        var scope = reader.IsDBNull(1) ? ArtifactAccessScope.Link : reader.GetString(1);
        if (!ArtifactAccessScope.IsValid(scope))
            scope = ArtifactAccessScope.Link;
        var groupsRaw = reader.IsDBNull(2) ? "[]" : reader.GetString(2);
        IReadOnlyList<string> groups = Array.Empty<string>();
        try
        {
            groups = JsonSerializer.Deserialize<string[]>(groupsRaw) ?? Array.Empty<string>();
        }
        catch
        {
            /* ignore */
        }

        var link = reader.IsDBNull(3) || reader.GetInt64(3) != 0;
        return new StoredArtifactAccess(owner, scope, groups, link);
    }

    public bool TryUpdateAnalysisAccess(string analysisId, ArtifactAccessWrite write, string ownerUserId)
    {
        using var conn = Open();
        if (!TryGetOwnerUserId(conn, KindAnalysis, analysisId, out var curOwner))
            return false;
        if (!string.Equals(curOwner, ownerUserId, StringComparison.Ordinal))
            return false;

        return UpdateAccess(conn, KindAnalysis, analysisId, write);
    }

    public bool TryUpdateComparisonAccess(string comparisonId, ArtifactAccessWrite write, string ownerUserId)
    {
        using var conn = Open();
        if (!TryGetOwnerUserId(conn, KindComparison, comparisonId, out var curOwner))
            return false;
        if (!string.Equals(curOwner, ownerUserId, StringComparison.Ordinal))
            return false;

        return UpdateAccess(conn, KindComparison, comparisonId, write);
    }

    private static bool TryGetOwnerUserId(SqliteConnection conn, string kind, string id, out string? ownerUserId)
    {
        ownerUserId = null;
        using var sel = conn.CreateCommand();
        sel.CommandText = "SELECT owner_user_id FROM artifact_store WHERE kind = $k AND id = $id;";
        sel.Parameters.AddWithValue("$k", kind);
        sel.Parameters.AddWithValue("$id", id);
        var o = sel.ExecuteScalar();
        if (o is null || o is DBNull)
            return false;
        ownerUserId = Convert.ToString(o, CultureInfo.InvariantCulture);
        return !string.IsNullOrEmpty(ownerUserId);
    }

    private static bool UpdateAccess(SqliteConnection conn, string kind, string id, ArtifactAccessWrite write)
    {
        var groupsJson = JsonSerializer.Serialize(write.SharedGroupIds.ToArray());
        var now = DateTimeOffset.UtcNow;
        using var cmd = conn.CreateCommand();
        cmd.CommandText =
            """
            UPDATE artifact_store SET
                access_scope = $s,
                shared_group_ids_json = $g,
                allow_link_access = $l,
                updated_utc = $u
            WHERE kind = $k AND id = $id;
            """;
        cmd.Parameters.AddWithValue("$s", write.AccessScope);
        cmd.Parameters.AddWithValue("$g", groupsJson);
        cmd.Parameters.AddWithValue("$l", write.AllowLinkAccess ? 1 : 0);
        cmd.Parameters.AddWithValue("$u", FormatUtc(now));
        cmd.Parameters.AddWithValue("$k", kind);
        cmd.Parameters.AddWithValue("$id", id);
        return cmd.ExecuteNonQuery() > 0;
    }

    private static void DeleteRow(SqliteConnection conn, string kind, string id)
    {
        using var del = conn.CreateCommand();
        del.CommandText = "DELETE FROM artifact_store WHERE kind = $k AND id = $id;";
        del.Parameters.AddWithValue("$k", kind);
        del.Parameters.AddWithValue("$id", id);
        del.ExecuteNonQuery();
    }

    public IReadOnlyList<string> ListAnalysisIds(UserIdentity? viewer, bool authEnabled)
    {
        using var conn = Open();
        PurgeExpired(conn, DateTimeOffset.UtcNow);
        using var cmd = conn.CreateCommand();
        if (!authEnabled)
        {
            cmd.CommandText = "SELECT id FROM artifact_store WHERE kind = $k ORDER BY created_utc DESC;";
            cmd.Parameters.AddWithValue("$k", KindAnalysis);
        }
        else
        {
            if (viewer is null)
                return Array.Empty<string>();
            cmd.CommandText =
                """
                SELECT id, owner_user_id, access_scope, shared_group_ids_json FROM artifact_store
                WHERE kind = $k
                ORDER BY created_utc DESC;
                """;
            cmd.Parameters.AddWithValue("$k", KindAnalysis);
        }

        var list = new List<string>();
        using var r = cmd.ExecuteReader();
        while (r.Read())
        {
            if (!authEnabled)
            {
                list.Add(r.GetString(0));
                continue;
            }

            var v = viewer!;
            var id = r.GetString(0);
            var owner = r.IsDBNull(1) ? null : r.GetString(1);
            var scope = r.IsDBNull(2) ? ArtifactAccessScope.Link : r.GetString(2);
            var groupsRaw = r.IsDBNull(3) ? "[]" : r.GetString(3);
            string[]? groups = Array.Empty<string>();
            try
            {
                groups = JsonSerializer.Deserialize<string[]>(groupsRaw);
            }
            catch
            {
                /* ignore */
            }

            if (string.Equals(owner, v.UserId, StringComparison.Ordinal))
            {
                list.Add(id);
                continue;
            }

            if (scope == ArtifactAccessScope.Public)
            {
                list.Add(id);
                continue;
            }

            if (scope == ArtifactAccessScope.Group && groups is not null)
            {
                foreach (var g in groups)
                {
                    if (v.GroupIds.Contains(g, StringComparer.Ordinal))
                    {
                        list.Add(id);
                        break;
                    }
                }
            }
        }

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
