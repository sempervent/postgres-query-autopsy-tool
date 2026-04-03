using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Parsing;

namespace PostgresQueryAutopsyTool.Api.Compare;

internal static class ComparePlanResolver
{
    internal abstract record Resolution
    {
        private Resolution() { }

        internal sealed record Ok(JsonElement Json, PlanInputNormalizationInfo? Normalization) : Resolution;
        internal sealed record ParseFailed(string Side, string Message, string? Hint) : Resolution;
        internal sealed record Missing(string Side) : Resolution;
    }

    /// <summary>Resolve one side: <paramref name="planText"/> wins over <paramref name="plan"/> when non-empty.</summary>
    internal static Resolution ResolveSide(string? planText, JsonElement plan, string sideLabel)
    {
        if (!string.IsNullOrWhiteSpace(planText))
        {
            var nr = PlanInputNormalizer.TryNormalizeToJson(planText);
            if (!nr.Success)
                return new Resolution.ParseFailed(sideLabel, nr.ErrorMessage ?? "Plan text could not be normalized.", nr.ErrorHint);

            using var doc = JsonDocument.Parse(nr.NormalizedJson!);
            return new Resolution.Ok(doc.RootElement.Clone(), nr.Info);
        }

        if (plan.ValueKind != JsonValueKind.Undefined)
            return new Resolution.Ok(plan.Clone(), null);

        return new Resolution.Missing(sideLabel);
    }
}
