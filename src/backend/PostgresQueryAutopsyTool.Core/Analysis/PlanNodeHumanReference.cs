namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>
/// Phase 61: structured, human-first anchor for a plan node. <see cref="NodeId"/> is canonical for focus/linking;
/// narrative surfaces should prefer <see cref="PrimaryLabel"/> and contextual fields over raw ids.
/// </summary>
public sealed record PlanNodeHumanReference(
    string NodeId,
    /// <summary>Best short label for cards, story beats, and buttons (never a raw <c>root.*</c> path).</summary>
    string PrimaryLabel,
    /// <summary>Role in parent join (outer/inner, build/probe) when inferable.</summary>
    string? RoleInPlan,
    /// <summary>Nearby boundary such as “under Hash Join (a × b)” when helpful.</summary>
    string? BoundaryUnder,
    /// <summary>Hedged tie to source SQL when query text and plan type align (never claimed as proof).</summary>
    string? QueryCorrespondenceHint);
