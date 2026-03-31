using System.Collections.Generic;

namespace PostgresQueryAutopsyTool.Core.Domain;

public sealed class NormalizedPlanNode
{
    public string NodeId { get; init; } = default!;
    public string NodeType { get; init; } = default!;

    // Identity / access-path context
    public string? RelationName { get; init; }
    public string? SchemaName { get; init; }
    public string? Alias { get; init; }
    public string? IndexName { get; init; }
    public string? JoinType { get; init; }
    public string? Strategy { get; init; }
    public bool? ParallelAware { get; init; }
    public int? WorkersPlanned { get; init; }
    public int? WorkersLaunched { get; init; }

    // Estimated values
    public decimal? StartupCost { get; init; }
    public decimal? TotalCost { get; init; }
    public double? PlanRows { get; init; }
    public int? PlanWidth { get; init; }

    // Actual values
    public double? ActualStartupTimeMs { get; init; }
    public double? ActualTotalTimeMs { get; init; }
    public double? ActualRows { get; init; }
    public long? ActualLoops { get; init; }

    // Conditions / expressions (best-effort; depends on node type and whether VERBOSE/BUFFERS were requested)
    public string? Filter { get; init; }
    public string? IndexCond { get; init; }
    public string? RecheckCond { get; init; }
    public string? HashCond { get; init; }
    public string? MergeCond { get; init; }
    public string? JoinFilter { get; init; }
    public string? SortKey { get; init; }
    public string? GroupKey { get; init; }
    public string? TidCond { get; init; }
    public bool? InnerUnique { get; init; }
    public string? PartialMode { get; init; }

    // Row removal / scan nuance
    public long? HeapFetches { get; init; }
    public long? RowsRemovedByFilter { get; init; }
    public long? RowsRemovedByJoinFilter { get; init; }
    public long? RowsRemovedByIndexRecheck { get; init; }

    // Sort detail
    public string? SortMethod { get; init; }
    public long? SortSpaceUsedKb { get; init; }
    public string? SortSpaceType { get; init; }
    public string? PresortedKey { get; init; }
    public long? FullSortGroups { get; init; }

    // Hash detail
    public long? HashBuckets { get; init; }
    public long? OriginalHashBuckets { get; init; }
    public long? HashBatches { get; init; }
    public long? OriginalHashBatches { get; init; }

    // Memory / disk
    public long? PeakMemoryUsageKb { get; init; }
    public long? DiskUsageKb { get; init; }

    // Memoize / cache detail (best-effort; depends on node type and PG version)
    public string? CacheKey { get; init; }
    public long? CacheHits { get; init; }
    public long? CacheMisses { get; init; }
    public long? CacheEvictions { get; init; }
    public long? CacheOverflows { get; init; }

    // Buffer metrics (shared/local/temp)
    public long? SharedHitBlocks { get; init; }
    public long? SharedReadBlocks { get; init; }
    public long? SharedDirtiedBlocks { get; init; }
    public long? SharedWrittenBlocks { get; init; }

    public long? LocalHitBlocks { get; init; }
    public long? LocalReadBlocks { get; init; }
    public long? LocalDirtiedBlocks { get; init; }
    public long? LocalWrittenBlocks { get; init; }

    public long? TempReadBlocks { get; init; }
    public long? TempWrittenBlocks { get; init; }

    // Child nodes
    public IReadOnlyList<NormalizedPlanNode> Children { get; init; } = new List<NormalizedPlanNode>();

    // Derived metrics (populated by analysis engine later)
    public double? InclusiveTimeMs { get; init; }
    public double? ExclusiveTimeMsApprox { get; init; }
    public double? RowEstimateRatio { get; init; }
    public double? CostToTimeDivergenceRatio { get; init; }
    public long? BufferReadTotalBlocks { get; init; }
    public double? BufferReadShare { get; init; }
    public int? SubtreeDepth { get; init; }
}

