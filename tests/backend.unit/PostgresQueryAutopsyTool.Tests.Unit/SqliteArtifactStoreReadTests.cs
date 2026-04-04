using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Data.Sqlite;
using PostgresQueryAutopsyTool.Api.Persistence;
using PostgresQueryAutopsyTool.Core.Analysis;
namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class SqliteArtifactStoreReadTests
{
    [Fact]
    public void ReadAnalysis_corrupt_payload_is_not_deleted_and_returns_status()
    {
        var path = Path.GetTempFileName();
        try
        {
            _ = new SqliteArtifactStore(path, null, null);
            var csb = new SqliteConnectionStringBuilder { DataSource = path, Mode = SqliteOpenMode.ReadWrite };
            using (var cn = new SqliteConnection(csb.ConnectionString))
            {
                cn.Open();
                using var cmd = cn.CreateCommand();
                var now = DateTimeOffset.UtcNow.ToString("o", System.Globalization.CultureInfo.InvariantCulture);
                cmd.CommandText =
                    """
                    INSERT INTO artifact_store (
                        kind, id, payload_json, created_utc, expires_utc, last_access_utc,
                        owner_user_id, access_scope, shared_group_ids_json, allow_link_access, updated_utc)
                    VALUES ('analysis', 'bad', '{ not json', $c, NULL, $c, NULL, 'link', '[]', 1, $c);
                    """;
                cmd.Parameters.AddWithValue("$c", now);
                cmd.ExecuteNonQuery();
            }

            var store = new SqliteArtifactStore(path, null, null);
            var r = store.ReadAnalysis("bad");
            Assert.Equal(ArtifactReadStatus.CorruptPayload, r.Status);
            Assert.Equal("artifact_corrupt", r.ErrorCode);

            using (var verifyCn = new SqliteConnection(csb.ConnectionString))
            {
                verifyCn.Open();
                using var verify = verifyCn.CreateCommand();
                verify.CommandText = "SELECT COUNT(*) FROM artifact_store WHERE id = 'bad';";
                var count = Convert.ToInt32(verify.ExecuteScalar(), System.Globalization.CultureInfo.InvariantCulture);
                Assert.Equal(1, count);
            }
        }
        finally
        {
            try
            {
                File.Delete(path);
            }
            catch
            {
                /* ignore */
            }
        }
    }

    [Fact]
    public void ReadAnalysis_future_schema_returns_incompatible()
    {
        var path = Path.GetTempFileName();
        try
        {
            var analysis = AnalysisFixtureBuilder.Build("simple_seq_scan.json");
            var node = JsonNode.Parse(JsonSerializer.Serialize(analysis, ArtifactPersistenceJson.Options))!.AsObject();
            node["artifactSchemaVersion"] = ArtifactSchema.MaxSupported + 9;
            var json = node.ToJsonString();

            _ = new SqliteArtifactStore(path, null, null);
            var csb = new SqliteConnectionStringBuilder { DataSource = path, Mode = SqliteOpenMode.ReadWrite };
            using var cn = new SqliteConnection(csb.ConnectionString);
            cn.Open();
            using var cmd = cn.CreateCommand();
            var now = DateTimeOffset.UtcNow.ToString("o", System.Globalization.CultureInfo.InvariantCulture);
            cmd.CommandText =
                """
                INSERT INTO artifact_store (
                    kind, id, payload_json, created_utc, expires_utc, last_access_utc,
                    owner_user_id, access_scope, shared_group_ids_json, allow_link_access, updated_utc)
                VALUES ('analysis', 'future', $j, $c, NULL, $c, NULL, 'link', '[]', 1, $c);
                """;
            cmd.Parameters.AddWithValue("$j", json);
            cmd.Parameters.AddWithValue("$c", now);
            cmd.ExecuteNonQuery();

            var store = new SqliteArtifactStore(path, null, null);
            var r = store.ReadAnalysis("future");
            Assert.Equal(ArtifactReadStatus.IncompatibleSchema, r.Status);
            Assert.Equal("artifact_version_unsupported", r.ErrorCode);
            Assert.NotNull(r.SchemaVersion);
        }
        finally
        {
            try
            {
                File.Delete(path);
            }
            catch
            {
                /* ignore */
            }
        }
    }
}
