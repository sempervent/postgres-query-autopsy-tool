using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings.Rules;

public sealed class PlanComplexityConcernRule : IFindingRule
{
    public string RuleId => "H.plan-complexity";
    public string Title => "Plan complexity concern";
    public FindingCategory Category => FindingCategory.PlanComplexityConcern;

    public IEnumerable<AnalysisFinding> Evaluate(FindingEvaluationContext context)
    {
        var nodeCount = context.Nodes.Count;
        var maxDepth = context.Nodes.Count == 0 ? 0 : context.Nodes.Max(n => n.Metrics.Depth);

        var repeatedTypes = context.NodeTypeCounts
            .OrderByDescending(kv => kv.Value)
            .Take(5)
            .ToDictionary(kv => kv.Key, kv => kv.Value);

        var severe =
            nodeCount >= 300 || maxDepth >= 40 ? FindingSeverity.Critical :
            nodeCount >= 150 || maxDepth >= 25 ? FindingSeverity.High :
            nodeCount >= 80 || maxDepth >= 18 ? FindingSeverity.Medium :
            nodeCount >= 50 || maxDepth >= 14 ? FindingSeverity.Low :
            FindingSeverity.Info;

        if (severe == FindingSeverity.Info)
            yield break;

        var confidence = FindingConfidence.High;

        yield return new AnalysisFinding(
            FindingId: $"{RuleId}:{context.RootNodeId}",
            RuleId: RuleId,
            Severity: severe,
            Confidence: confidence,
            Category: Category,
            Title: "Plan tree is structurally complex",
            Summary: $"Plan has {nodeCount} nodes, max depth {maxDepth}. Complexity can hide hotspots and amplify inefficiencies.",
            Explanation:
            "Deep or broad plans increase the chance of compounding estimation errors and repeated work. They can also make it harder to reason about where time goes. " +
            "This finding does not claim the plan is wrong—only that it’s complex enough to warrant focused inspection and simplification attempts.",
            NodeIds: new[] { context.RootNodeId },
            Evidence: new Dictionary<string, object?>
            {
                ["totalNodeCount"] = nodeCount,
                ["maxDepth"] = maxDepth,
                ["topRepeatedNodeTypes"] = repeatedTypes
            },
            Suggestion:
            "If this query is generated, inspect the query builder/ORM for redundant joins or unnecessary subqueries. " +
            "Try simplifying the query shape or splitting work into stages to reduce plan complexity.",
            RankScore: null
        );
    }
}

