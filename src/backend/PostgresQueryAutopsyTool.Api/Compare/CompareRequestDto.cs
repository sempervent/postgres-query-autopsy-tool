using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Comparison;

namespace PostgresQueryAutopsyTool.Api;

public sealed class CompareRequestDto
{
    /// <summary>Raw pasted text for plan A (optional if <see cref="PlanA"/> is set).</summary>
    public string? PlanAText { get; init; }

    /// <summary>Raw pasted text for plan B (optional if <see cref="PlanB"/> is set).</summary>
    public string? PlanBText { get; init; }

    public JsonElement PlanA { get; init; }
    public JsonElement PlanB { get; init; }

    public string? QueryTextA { get; init; }
    public string? QueryTextB { get; init; }

    public ExplainCaptureMetadata? ExplainMetadataA { get; init; }
    public ExplainCaptureMetadata? ExplainMetadataB { get; init; }

    /// <summary>
    /// Optional full comparison snapshot for report/export endpoints. When set, the server renders from this
    /// snapshot instead of re-running compare (reopen-from-link export parity).
    /// </summary>
    public PlanComparisonResultV2? Comparison { get; init; }
}
