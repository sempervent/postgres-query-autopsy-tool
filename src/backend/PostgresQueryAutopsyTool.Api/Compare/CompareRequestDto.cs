using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Analysis;

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
}
