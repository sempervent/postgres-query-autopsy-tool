using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Findings;

public interface IFindingRule
{
    string RuleId { get; }
    string Title { get; }
    FindingCategory Category { get; }
    IEnumerable<AnalysisFinding> Evaluate(FindingEvaluationContext context);
}

