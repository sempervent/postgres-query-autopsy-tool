using System;
using System.Globalization;
using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Parsing;

public sealed class PostgresJsonExplainParser : IPlanParser
{
    // This parser targets PostgreSQL's `EXPLAIN (FORMAT JSON)` output.
    // Top-level is typically an array of one object with { "Plan": { ... }, "Planning Time": ..., "Execution Time": ... }.
    public NormalizedPlanNode ParsePostgresExplain(JsonElement postgresExplainJson)
    {
        var planNodeElement = FindPlanNodeElement(postgresExplainJson);
        return ParseNode(planNodeElement, nodeId: "root");
    }

    private static JsonElement FindPlanNodeElement(JsonElement root)
    {
        return root.ValueKind switch
        {
            JsonValueKind.Array => root.ValueKind == JsonValueKind.Array && root.GetArrayLength() > 0
                ? FindPlanNodeElement(root[0])
                : throw new InvalidDataException("Postgres JSON explain array is empty."),
            JsonValueKind.Object => root.TryGetProperty("Plan", out var plan) ? plan : root,
            _ => throw new InvalidDataException($"Unsupported JSON root value kind: {root.ValueKind}")
        };
    }

    private static NormalizedPlanNode ParseNode(JsonElement node, string nodeId)
    {
        var nodeType = TryGetString(node, "Node Type") ?? "Unknown";

        var buffersNested = node.TryGetProperty("Buffers", out var buffersElement) && buffersElement.ValueKind == JsonValueKind.Object
            ? buffersElement
            : default;

        IReadOnlyList<NormalizedPlanNode> children = Array.Empty<NormalizedPlanNode>();
        if (node.TryGetProperty("Plans", out var plansElement) && plansElement.ValueKind == JsonValueKind.Array)
        {
            var list = new List<NormalizedPlanNode>();
            var i = 0;
            foreach (var child in plansElement.EnumerateArray())
            {
                list.Add(ParseNode(child, $"{nodeId}.{i++}"));
            }
            children = list;
        }

        // Sort/Group keys are arrays in Postgres JSON; we normalize them to comma-separated strings.
        var sortKey = TryGetStringArrayJoined(node, "Sort Key");
        var groupKey = TryGetStringArrayJoined(node, "Group Key");
        var presortedKey = TryGetStringArrayJoined(node, "Presorted Key");

        var workersParsed = ParseWorkersList(node);

        return new NormalizedPlanNode
        {
            NodeId = nodeId,
            NodeType = nodeType,

            RelationName = TryGetString(node, "Relation Name"),
            SchemaName = TryGetString(node, "Schema"),
            Alias = TryGetString(node, "Alias"),
            IndexName = TryGetString(node, "Index Name"),
            JoinType = TryGetString(node, "Join Type"),
            Strategy = TryGetString(node, "Strategy"),
            ParallelAware = TryGetBool(node, "Parallel Aware"),
            WorkersPlanned = TryGetInt(node, "Workers Planned"),
            WorkersLaunched = TryGetInt(node, "Workers Launched"),

            StartupCost = TryGetDecimal(node, "Startup Cost"),
            TotalCost = TryGetDecimal(node, "Total Cost"),
            PlanRows = TryGetDouble(node, "Plan Rows"),
            PlanWidth = TryGetInt(node, "Plan Width"),

            ActualStartupTimeMs = TryGetDouble(node, "Actual Startup Time"),
            ActualTotalTimeMs = TryGetDouble(node, "Actual Total Time"),
            ActualRows = TryGetDouble(node, "Actual Rows"),
            ActualLoops = TryGetLong(node, "Actual Loops"),

            Filter = TryGetString(node, "Filter"),
            IndexCond = TryGetString(node, "Index Cond"),
            RecheckCond = TryGetString(node, "Recheck Cond"),
            HashCond = TryGetString(node, "Hash Cond"),
            MergeCond = TryGetString(node, "Merge Cond"),
            JoinFilter = TryGetString(node, "Join Filter"),
            SortKey = sortKey,
            GroupKey = groupKey,
            TidCond = TryGetString(node, "TID Cond"),
            InnerUnique = TryGetBool(node, "Inner Unique"),
            PartialMode = TryGetString(node, "Partial Mode"),

            HeapFetches = TryGetLong(node, "Heap Fetches"),
            RowsRemovedByFilter = TryGetLong(node, "Rows Removed by Filter"),
            RowsRemovedByJoinFilter = TryGetLong(node, "Rows Removed by Join Filter"),
            RowsRemovedByIndexRecheck = TryGetLong(node, "Rows Removed by Index Recheck"),

            SortMethod = TryGetString(node, "Sort Method"),
            SortSpaceUsedKb = TryGetLong(node, "Sort Space Used"),
            SortSpaceType = TryGetString(node, "Sort Space Type"),
            PresortedKey = presortedKey,
            FullSortGroups = TryGetLong(node, "Full-sort Groups"),

            HashBuckets = TryGetLong(node, "Hash Buckets"),
            OriginalHashBuckets = TryGetLong(node, "Original Hash Buckets"),
            HashBatches = TryGetLong(node, "Hash Batches"),
            OriginalHashBatches = TryGetLong(node, "Original Hash Batches"),

            PeakMemoryUsageKb = TryGetLong(node, "Peak Memory Usage"),
            DiskUsageKb = TryGetLong(node, "Disk Usage"),

            CacheKey = TryGetStringArrayJoined(node, "Cache Key") ?? TryGetString(node, "Cache Key"),
            CacheHits = TryGetLong(node, "Cache Hits"),
            CacheMisses = TryGetLong(node, "Cache Misses"),
            CacheEvictions = TryGetLong(node, "Cache Evictions"),
            CacheOverflows = TryGetLong(node, "Cache Overflows"),

            SharedHitBlocks = ReadEffectiveBufferLong(node, buffersNested, "Shared Hit Blocks"),
            SharedReadBlocks = ReadEffectiveBufferLong(node, buffersNested, "Shared Read Blocks"),
            SharedDirtiedBlocks = ReadEffectiveBufferLong(node, buffersNested, "Shared Dirtied Blocks"),
            SharedWrittenBlocks = ReadEffectiveBufferLong(node, buffersNested, "Shared Written Blocks"),

            LocalHitBlocks = ReadEffectiveBufferLong(node, buffersNested, "Local Hit Blocks"),
            LocalReadBlocks = ReadEffectiveBufferLong(node, buffersNested, "Local Read Blocks"),
            LocalDirtiedBlocks = ReadEffectiveBufferLong(node, buffersNested, "Local Dirtied Blocks"),
            LocalWrittenBlocks = ReadEffectiveBufferLong(node, buffersNested, "Local Written Blocks"),

            TempReadBlocks = ReadEffectiveBufferLong(node, buffersNested, "Temp Read Blocks"),
            TempWrittenBlocks = ReadEffectiveBufferLong(node, buffersNested, "Temp Written Blocks"),

            Workers = workersParsed,
            Children = children,
        };
    }

    private static IReadOnlyList<PlanWorkerStats> ParseWorkersList(JsonElement planNode)
    {
        if (!planNode.TryGetProperty("Workers", out var arr) || arr.ValueKind != JsonValueKind.Array)
            return Array.Empty<PlanWorkerStats>();

        var list = new List<PlanWorkerStats>();
        foreach (var w in arr.EnumerateArray())
        {
            if (w.ValueKind != JsonValueKind.Object) continue;
            list.Add(ParseWorkerElement(w));
        }

        return list;
    }

    private static PlanWorkerStats ParseWorkerElement(JsonElement w)
    {
        var wb = w.TryGetProperty("Buffers", out var be) && be.ValueKind == JsonValueKind.Object
            ? be
            : default;

        return new PlanWorkerStats(
            WorkerNumber: TryGetInt(w, "Worker Number"),
            ActualStartupTimeMs: TryGetDouble(w, "Actual Startup Time"),
            ActualTotalTimeMs: TryGetDouble(w, "Actual Total Time"),
            ActualRows: TryGetDouble(w, "Actual Rows"),
            ActualLoops: TryGetLong(w, "Actual Loops"),
            SharedHitBlocks: ReadBufferLong(w, wb, "Shared Hit Blocks"),
            SharedReadBlocks: ReadBufferLong(w, wb, "Shared Read Blocks"),
            SharedDirtiedBlocks: ReadBufferLong(w, wb, "Shared Dirtied Blocks"),
            SharedWrittenBlocks: ReadBufferLong(w, wb, "Shared Written Blocks"),
            LocalHitBlocks: ReadBufferLong(w, wb, "Local Hit Blocks"),
            LocalReadBlocks: ReadBufferLong(w, wb, "Local Read Blocks"),
            LocalDirtiedBlocks: ReadBufferLong(w, wb, "Local Dirtied Blocks"),
            LocalWrittenBlocks: ReadBufferLong(w, wb, "Local Written Blocks"),
            TempReadBlocks: ReadBufferLong(w, wb, "Temp Read Blocks"),
            TempWrittenBlocks: ReadBufferLong(w, wb, "Temp Written Blocks"),
            SortMethod: TryGetString(w, "Sort Method"),
            SortSpaceUsedKb: TryGetLong(w, "Sort Space Used"),
            SortSpaceType: TryGetString(w, "Sort Space Type"));
    }

    private static string? TryGetString(JsonElement element, string propertyName)
    {
        if (element.ValueKind != JsonValueKind.Object) return null;
        if (!element.TryGetProperty(propertyName, out var prop)) return null;

        return prop.ValueKind switch
        {
            JsonValueKind.String => prop.GetString(),
            JsonValueKind.Number => prop.GetRawText(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            _ => null
        };
    }

    private static string? TryGetStringArrayJoined(JsonElement element, string propertyName)
    {
        if (element.ValueKind != JsonValueKind.Object) return null;
        if (!element.TryGetProperty(propertyName, out var prop)) return null;
        if (prop.ValueKind != JsonValueKind.Array) return null;

        var parts = new List<string>();
        foreach (var item in prop.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.String)
                parts.Add(item.GetString() ?? "");
            else
                parts.Add(item.GetRawText());
        }

        return parts.Count == 0 ? null : string.Join(", ", parts.Where(p => !string.IsNullOrWhiteSpace(p)));
    }

    private static bool? TryGetBool(JsonElement element, string propertyName)
    {
        if (element.ValueKind != JsonValueKind.Object) return null;
        if (!element.TryGetProperty(propertyName, out var prop)) return null;
        return prop.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => null
        };
    }

    private static int? TryGetInt(JsonElement element, string propertyName)
    {
        if (element.ValueKind != JsonValueKind.Object) return null;
        if (!element.TryGetProperty(propertyName, out var prop)) return null;
        return prop.ValueKind == JsonValueKind.Number ? prop.GetInt32() : null;
    }

    private static long? TryGetLong(JsonElement element, string propertyName)
    {
        if (element.ValueKind != JsonValueKind.Object) return null;
        if (!element.TryGetProperty(propertyName, out var prop)) return null;

        return prop.ValueKind switch
        {
            JsonValueKind.Number => prop.GetInt64(),
            JsonValueKind.String when long.TryParse(prop.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var v) => v,
            _ => null
        };
    }

    private static double? TryGetDouble(JsonElement element, string propertyName)
    {
        if (element.ValueKind != JsonValueKind.Object) return null;
        if (!element.TryGetProperty(propertyName, out var prop)) return null;

        if (prop.ValueKind == JsonValueKind.Number)
            return prop.GetDouble();

        if (prop.ValueKind == JsonValueKind.String && double.TryParse(prop.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var v))
            return v;

        return null;
    }

    private static decimal? TryGetDecimal(JsonElement element, string propertyName)
    {
        if (element.ValueKind != JsonValueKind.Object) return null;
        if (!element.TryGetProperty(propertyName, out var prop)) return null;

        if (prop.ValueKind == JsonValueKind.Number)
            return prop.GetDecimal();

        if (prop.ValueKind == JsonValueKind.String && decimal.TryParse(prop.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var v))
            return v;

        return null;
    }

    /// <summary>
    /// Reads a buffer counter from (1) nested <c>Buffers</c> object if present, else (2) flat keys on the plan node
    /// (PostgreSQL's default JSON shape with <c>EXPLAIN (BUFFERS)</c>), else (3) sums the same key across <c>Workers</c>
    /// when the leader node omitted aggregates.
    /// </summary>
    private static long? ReadEffectiveBufferLong(JsonElement planNode, JsonElement buffersNested, string key)
    {
        var direct = ReadBufferLong(planNode, buffersNested, key);
        if (direct is not null)
            return direct;
        return SumWorkersBufferLong(planNode, key);
    }

    private static long? ReadBufferLong(JsonElement planNode, JsonElement buffersNested, string key)
    {
        if (buffersNested.ValueKind == JsonValueKind.Object)
        {
            var fromNested = TryGetLong(buffersNested, key);
            if (fromNested is not null)
                return fromNested;
        }

        return TryGetLong(planNode, key);
    }

    private static long? SumWorkersBufferLong(JsonElement planNode, string key)
    {
        if (!planNode.TryGetProperty("Workers", out var workers) || workers.ValueKind != JsonValueKind.Array)
            return null;

        long sum = 0;
        var any = false;
        foreach (var w in workers.EnumerateArray())
        {
            if (w.ValueKind != JsonValueKind.Object) continue;
            var v = TryGetLong(w, key);
            if (v is null) continue;
            sum += v.Value;
            any = true;
        }

        return any ? sum : null;
    }
}

