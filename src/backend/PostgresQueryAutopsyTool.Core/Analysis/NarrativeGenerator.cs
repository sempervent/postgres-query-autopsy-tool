using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Analysis;

public static class NarrativeGenerator
{
    public static AnalysisNarrative From(
        PlanSummary summary,
        IReadOnlyList<AnalyzedPlanNode> nodes,
        IReadOnlyList<AnalysisFinding> rankedFindings)
    {
        var byId = nodes.ToDictionary(n => n.NodeId, StringComparer.Ordinal);
        string Label(string nodeId)
            => byId.TryGetValue(nodeId, out var n) ? NodeLabelFormatter.ShortLabel(n, byId) : nodeId;

        var headline = rankedFindings.Take(3).ToArray();
        var headlineText = headline.Length == 0
            ? "No findings were emitted."
            : string.Join(" ", headline.Select(f => $"[{f.Severity}] {f.Title}."));

        var whatHappened = summary.RootInclusiveActualTimeMs is not null
            ? $"Root inclusive runtime ≈ {summary.RootInclusiveActualTimeMs.Value:F2}ms. {headlineText}"
            : $"No actual runtime fields were observed. {headlineText}";

        var whereTimeWent = summary.TopExclusiveTimeHotspotNodeIds.Count > 0
            ? $"Top exclusive-time hotspots: {string.Join("; ", summary.TopExclusiveTimeHotspotNodeIds.Take(5).Select(Label))}."
            : "Exclusive-time hotspots unavailable (missing timing fields).";

        var whatMatters = summary.HasBuffers && summary.TopSharedReadHotspotNodeIds.Count > 0
            ? $"Top shared-read hotspots: {string.Join("; ", summary.TopSharedReadHotspotNodeIds.Take(5).Select(Label))}."
            : "Buffer hotspots unavailable (missing BUFFERS fields).";

        var whatDoesNot = summary.Warnings.Count > 0
            ? $"Limitations: {string.Join(" ", summary.Warnings)}"
            : "No major limitations detected in the input plan fields.";

        return new AnalysisNarrative(
            WhatHappened: whatHappened,
            WhereTimeWent: whereTimeWent,
            WhatLikelyMatters: whatMatters,
            WhatProbablyDoesNotMatter: whatDoesNot
        );
    }
}

