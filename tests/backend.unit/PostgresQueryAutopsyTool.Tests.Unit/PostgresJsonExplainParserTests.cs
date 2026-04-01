using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Domain;
using PostgresQueryAutopsyTool.Core.Parsing;

namespace PostgresQueryAutopsyTool.Tests.Unit;

file static class PlanTreeTestExtensions
{
    public static IEnumerable<NormalizedPlanNode> Descendants(this NormalizedPlanNode root)
    {
        yield return root;
        foreach (var c in root.Children)
            foreach (var d in c.Descendants())
                yield return d;
    }
}

public sealed class PostgresJsonExplainParserTests
{
    [Fact]
    public void Parses_simple_seq_scan_with_buffers_and_actuals()
    {
        var json = ReadFixture("simple_seq_scan.json");
        using var doc = JsonDocument.Parse(json);

        var parser = new PostgresJsonExplainParser();
        var root = parser.ParsePostgresExplain(doc.RootElement);

        Assert.Equal("root", root.NodeId);
        Assert.Equal("Seq Scan", root.NodeType);
        Assert.Equal("users", root.RelationName);
        Assert.Equal("public", root.SchemaName);
        Assert.Equal("(status = 'active')", root.Filter);
        Assert.Equal(0.0m, root.StartupCost);
        Assert.Equal(431.2m, root.TotalCost);
        Assert.Equal(100d, root.PlanRows);
        Assert.Equal(8, root.PlanWidth);
        Assert.Equal(0.012d, root.ActualStartupTimeMs);
        Assert.Equal(10.5d, root.ActualTotalTimeMs);
        Assert.Equal(5d, root.ActualRows);
        Assert.Equal(1, root.ActualLoops);
        Assert.Equal(100, root.SharedHitBlocks);
        Assert.Equal(20, root.SharedReadBlocks);
        Assert.Empty(root.Children);
    }

    [Fact]
    public void Parses_simple_index_scan_cond_and_buffers()
    {
        var json = ReadFixture("simple_index_scan.json");
        using var doc = JsonDocument.Parse(json);

        var parser = new PostgresJsonExplainParser();
        var root = parser.ParsePostgresExplain(doc.RootElement);

        Assert.Equal("Index Scan", root.NodeType);
        Assert.Equal("orders", root.RelationName);
        Assert.Equal("orders_customer_id_idx", root.IndexName);
        Assert.Equal("(customer_id = 42)", root.IndexCond);
        Assert.Equal(5, root.SharedHitBlocks);
        Assert.Equal(1, root.SharedReadBlocks);
    }

    [Fact]
    public void Parses_nested_loop_tree_children_and_loops()
    {
        var json = ReadFixture("nested_loop_misestimation.json");
        using var doc = JsonDocument.Parse(json);

        var parser = new PostgresJsonExplainParser();
        var root = parser.ParsePostgresExplain(doc.RootElement);

        Assert.Equal("Nested Loop", root.NodeType);
        Assert.Equal("Inner", root.JoinType);
        Assert.NotNull(root.Children);
        Assert.Equal(2, root.Children.Count);

        var left = root.Children[0];
        var right = root.Children[1];

        Assert.Equal("Seq Scan", left.NodeType);
        Assert.Equal("customers", left.RelationName);
        Assert.Equal("(region = 'us')", left.Filter);
        Assert.Equal(3d, left.ActualRows);

        Assert.Equal("Index Scan", right.NodeType);
        Assert.Equal("line_items", right.RelationName);
        Assert.Equal("line_items_customer_id_idx", right.IndexName);
        Assert.Equal("(customer_id = customers.id)", right.IndexCond);
        Assert.Equal(3, right.ActualLoops);
        Assert.Equal(200, right.SharedReadBlocks);
    }

    [Fact]
    public void Parses_temp_buffers_from_sort_node()
    {
        var json = ReadFixture("buffer_heavy.json");
        using var doc = JsonDocument.Parse(json);

        var parser = new PostgresJsonExplainParser();
        var root = parser.ParsePostgresExplain(doc.RootElement);

        Assert.Equal("Sort", root.NodeType);
        Assert.Equal("created_at DESC", root.SortKey);
        Assert.Equal(8000, root.SharedReadBlocks);
        Assert.Equal(120, root.TempReadBlocks);
        Assert.Equal(300, root.TempWrittenBlocks);
    }

    [Fact]
    public void Parses_group_key_and_sort_key_arrays()
    {
        var json = ReadFixture("aggregate_sort.json");
        using var doc = JsonDocument.Parse(json);

        var parser = new PostgresJsonExplainParser();
        var root = parser.ParsePostgresExplain(doc.RootElement);

        Assert.Equal("Aggregate", root.NodeType);
        Assert.Equal("region", root.GroupKey);
        Assert.Single(root.Children);

        var sort = root.Children[0];
        Assert.Equal("Sort", sort.NodeType);
        Assert.Equal("region", sort.SortKey);
        Assert.Equal(10, sort.SharedHitBlocks);
        Assert.Equal(2, sort.SharedReadBlocks);
    }

    [Fact]
    public void Parses_sort_detail_fields_when_present()
    {
        var json = ReadFixture("operator_sort_external.json");
        using var doc = JsonDocument.Parse(json);

        var parser = new PostgresJsonExplainParser();
        var root = parser.ParsePostgresExplain(doc.RootElement);

        Assert.Equal("Sort", root.NodeType);
        Assert.Equal("external merge", root.SortMethod);
        Assert.Equal(204800, root.SortSpaceUsedKb);
        Assert.Equal("Disk", root.SortSpaceType);
        Assert.Equal(4096, root.PeakMemoryUsageKb);
        Assert.Equal(204800, root.DiskUsageKb);
        Assert.Contains("created_at", root.SortKey ?? "");
    }

    [Fact]
    public void Parses_hash_detail_fields_when_present()
    {
        var json = ReadFixture("operator_hash_batches_disk.json");
        using var doc = JsonDocument.Parse(json);

        var parser = new PostgresJsonExplainParser();
        var root = parser.ParsePostgresExplain(doc.RootElement);

        Assert.Equal("Hash Join", root.NodeType);
        Assert.NotEmpty(root.Children);

        // Hash node appears as a child under hash join in typical plans.
        var hash = root.Children
            .SelectMany(c => c.Children.Append(c))
            .FirstOrDefault(n => string.Equals(n.NodeType, "Hash", StringComparison.OrdinalIgnoreCase));

        Assert.NotNull(hash);
        Assert.Equal(65536, hash!.HashBuckets);
        Assert.Equal(16384, hash.OriginalHashBuckets);
        Assert.Equal(8, hash.HashBatches);
        Assert.Equal(1, hash.OriginalHashBatches);
        Assert.Equal(8192, hash.PeakMemoryUsageKb);
        Assert.Equal(65536, hash.DiskUsageKb);
    }

    [Fact]
    public void Parses_parallel_worker_fields_when_present()
    {
        var json = ReadFixture("operator_parallel_workers.json");
        using var doc = JsonDocument.Parse(json);

        var parser = new PostgresJsonExplainParser();
        var root = parser.ParsePostgresExplain(doc.RootElement);

        Assert.Equal("Gather", root.NodeType);
        Assert.Equal(4, root.WorkersPlanned);
        Assert.Equal(2, root.WorkersLaunched);
        Assert.True(root.ParallelAware);
        Assert.NotEmpty(root.Children);
        Assert.Equal("Parallel Seq Scan", root.Children[0].NodeType);
        Assert.Equal(900000, root.Children[0].RowsRemovedByFilter);
    }

    [Fact]
    public void Parses_flat_postgres_buffer_keys_on_plan_node_without_nested_Buffers_object()
    {
        var json = ReadFixture("pg_flat_buffers_seq_scan.json");
        using var doc = JsonDocument.Parse(json);

        var parser = new PostgresJsonExplainParser();
        var root = parser.ParsePostgresExplain(doc.RootElement);

        Assert.Equal("Seq Scan", root.NodeType);
        Assert.Equal("probe_data", root.RelationName);
        Assert.Equal(125000, root.SharedHitBlocks);
        Assert.Equal(980000, root.SharedReadBlocks);
        Assert.Equal(0, root.SharedDirtiedBlocks);
        Assert.Equal(0, root.SharedWrittenBlocks);
        Assert.Equal(0, root.LocalHitBlocks);
        Assert.Equal(0, root.LocalReadBlocks);
        Assert.Equal(2048, root.TempReadBlocks);
        Assert.Equal(512, root.TempWrittenBlocks);
    }

    [Fact]
    public void Parses_top_level_explain_json_array_wrapper()
    {
        var json = ReadFixture("pg_flat_buffers_seq_scan.json");
        using var doc = JsonDocument.Parse(json);

        var parser = new PostgresJsonExplainParser();
        var root = parser.ParsePostgresExplain(doc.RootElement);

        Assert.Equal("root", root.NodeId);
        Assert.NotNull(root.SharedReadBlocks);
    }

    [Fact]
    public void Sums_worker_buffer_counters_when_leader_node_omits_them()
    {
        var json = ReadFixture("pg_workers_flat_buffers.json");
        using var doc = JsonDocument.Parse(json);

        var parser = new PostgresJsonExplainParser();
        var root = parser.ParsePostgresExplain(doc.RootElement);

        Assert.Equal("Gather", root.NodeType);
        Assert.Equal(1000000, root.SharedReadBlocks);
        Assert.Equal(110, root.SharedHitBlocks);
        Assert.Equal(22, root.TempReadBlocks);
        Assert.Equal(5, root.TempWrittenBlocks);
    }

    [Fact]
    public void Parses_workers_array_into_typed_plan_worker_stats()
    {
        var json = ReadFixture("pg_workers_flat_buffers.json");
        using var doc = JsonDocument.Parse(json);

        var parser = new PostgresJsonExplainParser();
        var root = parser.ParsePostgresExplain(doc.RootElement);

        Assert.Equal(2, root.Workers.Count);
        Assert.Equal(400000, root.Workers[0].SharedReadBlocks);
        Assert.Equal(600000, root.Workers[1].SharedReadBlocks);
        Assert.Equal(580.5, root.Workers[0].ActualTotalTimeMs);
        Assert.Equal(610.2, root.Workers[1].ActualTotalTimeMs);
    }

    [Fact]
    public void Parses_memoize_cache_fields_when_present()
    {
        var json = ReadFixture("operator_memoize_cache.json");
        using var doc = JsonDocument.Parse(json);

        var parser = new PostgresJsonExplainParser();
        var root = parser.ParsePostgresExplain(doc.RootElement);

        Assert.Equal("Memoize", root.NodeType);
        Assert.Contains("t.id", root.CacheKey ?? "");
        Assert.Equal(9000, root.CacheHits);
        Assert.Equal(1000, root.CacheMisses);
        Assert.Equal(12, root.CacheEvictions);
        Assert.Equal(0, root.CacheOverflows);
    }

    /// <summary>
    /// Regression: TimescaleDB-style plan with flat buffer keys, temp I/O, Gather Merge, nested
    /// <c>Workers</c>, external merge sort (disk), Append + bitmap scans over chunks.
    /// </summary>
    [Fact]
    public void Complex_timescaledb_query_fixture_parses_buffers_workers_sort_append_and_bitmaps()
    {
        var json = ReadFixture("complex_timescaledb_query.json");
        using var doc = JsonDocument.Parse(json);

        var parser = new PostgresJsonExplainParser();
        var root = parser.ParsePostgresExplain(doc.RootElement);

        Assert.Equal("root", root.NodeId);
        Assert.Equal("Aggregate", root.NodeType);
        Assert.Equal("Sorted", root.Strategy);
        Assert.Equal("Finalize", root.PartialMode);
        Assert.Equal(89917, root.SharedReadBlocks);
        Assert.Equal(43506, root.TempReadBlocks);
        Assert.Equal(43576, root.TempWrittenBlocks);

        var all = root.Descendants().ToArray();
        var gatherMerge = Assert.Single(all.Where(n => n.NodeType == "Gather Merge"));
        Assert.Equal(2, gatherMerge.WorkersPlanned);
        Assert.Equal(2, gatherMerge.WorkersLaunched);
        Assert.Equal(89917, gatherMerge.SharedReadBlocks);

        var partialAggWithWorkers = all.First(n =>
            n.NodeType == "Aggregate" &&
            string.Equals(n.PartialMode, "Partial", StringComparison.Ordinal) &&
            n.Workers.Count == 2);
        Assert.Equal(89917, partialAggWithWorkers.SharedReadBlocks);
        Assert.Equal(39860, partialAggWithWorkers.Workers[0].SharedReadBlocks);
        Assert.Equal(40225, partialAggWithWorkers.Workers[1].SharedReadBlocks);
        Assert.Equal(20443, partialAggWithWorkers.Workers[0].TempReadBlocks);
        Assert.Equal(20481, partialAggWithWorkers.Workers[1].TempReadBlocks);
        // Leader totals stay PostgreSQL’s aggregate; worker rows are a slice (not forced to sum to parent).
        Assert.NotEqual(
            partialAggWithWorkers.Workers[0].SharedReadBlocks + partialAggWithWorkers.Workers[1].SharedReadBlocks,
            partialAggWithWorkers.SharedReadBlocks);

        var sortWithWorkers = all.First(n =>
            n.NodeType == "Sort" &&
            string.Equals(n.SortMethod, "external merge", StringComparison.Ordinal) &&
            n.Workers.Count == 2);
        Assert.Equal("Disk", sortWithWorkers.SortSpaceType);
        Assert.Equal("external merge", sortWithWorkers.SortMethod);
        Assert.Equal("external merge", sortWithWorkers.Workers[0].SortMethod);
        Assert.Equal(81784, sortWithWorkers.Workers[0].SortSpaceUsedKb);
        Assert.Equal(81952, sortWithWorkers.Workers[1].SortSpaceUsedKb);

        Assert.Contains(all, n => n.NodeType == "Append");
        var bitmapHeapCount = all.Count(n => n.NodeType == "Bitmap Heap Scan");
        var bitmapIndexCount = all.Count(n => n.NodeType == "Bitmap Index Scan");
        Assert.True(bitmapHeapCount >= 8, $"expected several chunk bitmap heap scans, got {bitmapHeapCount}");
        Assert.True(bitmapIndexCount >= 8, $"expected several chunk bitmap index scans, got {bitmapIndexCount}");
    }

    private static string ReadFixture(string fileName)
    {
        // AppContext.BaseDirectory ends in: .../bin/Release/net8.0/
        var fixturePath = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "../../../fixtures/postgres-json", fileName)
        );
        return File.ReadAllText(fixturePath);
    }
}

