namespace PostgresQueryAutopsyTool.Core.Comparison;

public sealed record NumericDelta(
    double? A,
    double? B,
    double? Delta,
    double? DeltaPct);

public sealed record NodeDelta(
    string NodeIdA,
    string NodeIdB,
    double MatchScore,
    MatchConfidence MatchConfidence,
    string NodeTypeA,
    string NodeTypeB,
    string? RelationName,
    string? IndexName,
    NumericDelta InclusiveTimeMs,
    NumericDelta ExclusiveTimeMsApprox,
    NumericDelta SubtreeTimeShare,
    NumericDelta SharedReadBlocks,
    NumericDelta SharedReadShare,
    NumericDelta RowEstimateFactor,
    NumericDelta ActualRowsTotal,
    NumericDelta Loops);

