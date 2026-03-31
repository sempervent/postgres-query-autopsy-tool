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

        var buffers = node.TryGetProperty("Buffers", out var buffersElement) && buffersElement.ValueKind == JsonValueKind.Object
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

            SharedHitBlocks = buffers.ValueKind == JsonValueKind.Object ? TryGetLong(buffers, "Shared Hit Blocks") : null,
            SharedReadBlocks = buffers.ValueKind == JsonValueKind.Object ? TryGetLong(buffers, "Shared Read Blocks") : null,
            SharedDirtiedBlocks = buffers.ValueKind == JsonValueKind.Object ? TryGetLong(buffers, "Shared Dirtied Blocks") : null,
            SharedWrittenBlocks = buffers.ValueKind == JsonValueKind.Object ? TryGetLong(buffers, "Shared Written Blocks") : null,

            LocalHitBlocks = buffers.ValueKind == JsonValueKind.Object ? TryGetLong(buffers, "Local Hit Blocks") : null,
            LocalReadBlocks = buffers.ValueKind == JsonValueKind.Object ? TryGetLong(buffers, "Local Read Blocks") : null,
            LocalDirtiedBlocks = buffers.ValueKind == JsonValueKind.Object ? TryGetLong(buffers, "Local Dirtied Blocks") : null,
            LocalWrittenBlocks = buffers.ValueKind == JsonValueKind.Object ? TryGetLong(buffers, "Local Written Blocks") : null,

            TempReadBlocks = buffers.ValueKind == JsonValueKind.Object ? TryGetLong(buffers, "Temp Read Blocks") : null,
            TempWrittenBlocks = buffers.ValueKind == JsonValueKind.Object ? TryGetLong(buffers, "Temp Written Blocks") : null,

            Children = children,
        };
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
}

