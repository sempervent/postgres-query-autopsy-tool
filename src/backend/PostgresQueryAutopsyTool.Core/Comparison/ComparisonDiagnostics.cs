namespace PostgresQueryAutopsyTool.Core.Comparison;

public sealed record CandidateMatch(
    string NodeIdA,
    string NodeIdB,
    double Score,
    IReadOnlyDictionary<string, double> ScoreBreakdown);

public sealed record KeyFactor(string Key, double Value);

public sealed record RejectedCandidate(
    CandidateMatch Candidate,
    IReadOnlyList<string> WhyLost);

public sealed record MatchDecisionDiagnostics(
    string NodeIdA,
    CandidateMatch? Winner,
    IReadOnlyList<KeyFactor> WinningFactors,
    IReadOnlyList<RejectedCandidate> RejectedCandidates);

public sealed record NodeDiagnostics(
    string NodeId,
    IReadOnlyList<CandidateMatch> TopCandidates,
    MatchDecisionDiagnostics? Decision);

public sealed record ComparisonDiagnostics(
    int MaxCandidatesPerNode,
    IReadOnlyList<NodeDiagnostics> NodesA);

