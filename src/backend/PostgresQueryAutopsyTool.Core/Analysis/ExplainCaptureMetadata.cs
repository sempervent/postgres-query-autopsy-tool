namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>Optional EXPLAIN options the client believes were used when capturing the plan (user-declared; may be null/unknown per field).</summary>
public sealed record ExplainOptions(
    string? Format = null,
    bool? Analyze = null,
    bool? Verbose = null,
    bool? Buffers = null,
    /// <summary>Whether <c>COSTS</c> was enabled in EXPLAIN; null when unknown.</summary>
    bool? Costs = null,
    bool? Settings = null,
    bool? Wal = null,
    bool? Timing = null,
    bool? Summary = null,
    bool? Jit = null);

/// <summary>Declared capture context echoed from the analyze request (optional).</summary>
public sealed record ExplainCaptureMetadata(
    ExplainOptions? Options = null,
    string? SourceExplainCommand = null);
