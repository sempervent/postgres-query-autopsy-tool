namespace PostgresQueryAutopsyTool.Core.Parsing;

public sealed record PlanInputNormalizeResult(
    bool Success,
    string? NormalizedJson,
    PlanInputNormalizationInfo? Info,
    string? ErrorMessage,
    string? ErrorHint)
{
    public static PlanInputNormalizeResult Ok(string json, PlanInputNormalizationInfo info) =>
        new(true, json, info, null, null);

    public static PlanInputNormalizeResult Fail(string message, string? hint = null) =>
        new(false, null, null, message, hint);
}
