using System.Text.Json.Serialization;
using PostgresQueryAutopsyTool.Core.Serialization;

namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>Whether planner estimate fields (startup/total cost, plan rows/width) appear in the parsed plan JSON.</summary>
[JsonConverter(typeof(PlannerCostPresenceJsonConverter))]
public enum PlannerCostPresence
{
    /// <summary>No plan nodes to inspect (or parse failed to a degenerate tree).</summary>
    Unknown,

    /// <summary>At least one node carries planner cost/row/width fields.</summary>
    Present,

    /// <summary>Nodes exist but none carry those fields — often <c>EXPLAIN ... COSTS OFF</c> or nonstandard JSON.</summary>
    NotDetected,

    /// <summary>Some nodes have planner fields and some do not (unusual; treat as ambiguous).</summary>
    Mixed
}
