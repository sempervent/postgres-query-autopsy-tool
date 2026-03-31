namespace PostgresQueryAutopsyTool.Core.Comparison;

public enum MatchConfidence
{
    Low = 0,
    Medium = 1,
    High = 2
}

public sealed record NodeMatch(
    string NodeIdA,
    string NodeIdB,
    double MatchScore,
    MatchConfidence Confidence,
    IReadOnlyDictionary<string, double> ScoreBreakdown);

