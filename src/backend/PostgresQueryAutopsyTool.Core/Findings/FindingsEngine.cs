using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings;

public sealed class FindingsEngine
{
    private readonly IReadOnlyList<IFindingRule> _rules;

    public FindingsEngine(IReadOnlyList<IFindingRule> rules)
    {
        _rules = rules;
    }

    public IReadOnlyList<AnalysisFinding> EvaluateAndRank(string rootNodeId, IReadOnlyList<AnalyzedPlanNode> analyzedNodes)
    {
        var ctx = new FindingEvaluationContext(rootNodeId, analyzedNodes);
        var all = new List<AnalysisFinding>();

        foreach (var rule in _rules)
        {
            IEnumerable<AnalysisFinding> emitted;
            try
            {
                emitted = rule.Evaluate(ctx);
            }
            catch (Exception ex)
            {
                // Keep the engine robust: a single buggy rule must not kill analysis.
                emitted = new[]
                {
                    new AnalysisFinding(
                        FindingId: $"rule-error-{rule.RuleId}",
                        RuleId: rule.RuleId,
                        Severity: FindingSeverity.Info,
                        Confidence: FindingConfidence.Low,
                        Category: FindingCategory.PlanComplexityConcern,
                        Title: $"Rule evaluation error: {rule.RuleId}",
                        Summary: "A finding rule threw an exception and was skipped.",
                        Explanation: "This is a tool bug, not a plan property. The analysis continues with other rules.",
                        NodeIds: new[] { rootNodeId },
                        Evidence: new Dictionary<string, object?>
                        {
                            ["exceptionType"] = ex.GetType().FullName,
                            ["message"] = ex.Message
                        },
                        Suggestion: "Report this error with the input plan (sanitized) so the rule can be fixed.",
                        RankScore: null
                    )
                };
            }

            all.AddRange(emitted);
        }

        return FindingRanker.RankAndDedupe(all);
    }
}

