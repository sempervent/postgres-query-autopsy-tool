namespace PostgresQueryAutopsyTool.Core.Domain;

/// <summary>
/// PostgreSQL <c>EXPLAIN (BUFFERS)</c> in JSON typically exposes counters as <b>flat</b> properties on each plan node
/// (e.g. <c>"Shared Read Blocks"</c>), not only under a nested <c>Buffers</c> object. This helper keeps detection consistent.
/// </summary>
public static class PlanBufferStats
{
    /// <summary>
    /// True when any buffer counter was parsed (including explicit zeros). Absent fields remain null and do not count.
    /// </summary>
    public static bool NodeHasAnyBufferCounter(NormalizedPlanNode n) =>
        n.SharedHitBlocks is not null
        || n.SharedReadBlocks is not null
        || n.SharedDirtiedBlocks is not null
        || n.SharedWrittenBlocks is not null
        || n.LocalHitBlocks is not null
        || n.LocalReadBlocks is not null
        || n.LocalDirtiedBlocks is not null
        || n.LocalWrittenBlocks is not null
        || n.TempReadBlocks is not null
        || n.TempWrittenBlocks is not null;
}
