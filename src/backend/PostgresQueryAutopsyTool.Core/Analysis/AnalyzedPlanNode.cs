using PostgresQueryAutopsyTool.Core.Domain;
using PostgresQueryAutopsyTool.Core.OperatorEvidence;

namespace PostgresQueryAutopsyTool.Core.Analysis;

public sealed record AnalyzedPlanNode(
    string NodeId,
    string? ParentNodeId,
    IReadOnlyList<string> ChildNodeIds,
    NormalizedPlanNode Node,
    DerivedNodeMetrics Metrics,
    OperatorContextEvidence? ContextEvidence = null,
    /// <summary>Phase 59: human interpretive paragraph for selected-node UI; null when not computed.</summary>
    string? OperatorInterpretation = null);

