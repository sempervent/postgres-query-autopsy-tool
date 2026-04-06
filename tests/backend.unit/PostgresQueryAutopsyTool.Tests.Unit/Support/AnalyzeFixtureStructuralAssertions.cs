using PostgresQueryAutopsyTool.Core.Analysis;

namespace PostgresQueryAutopsyTool.Tests.Unit.Support;

/// <summary>
/// Phase 74: shared structural checks for <see cref="PlanAnalysisResult"/> after full analyze — used by the corpus sweep and targeted fixture tests.
/// </summary>
public static class AnalyzeFixtureStructuralAssertions
{
    public static void AssertStructuralSanity(string fixtureName, PlanAnalysisResult r, string stage)
    {
        if (string.IsNullOrWhiteSpace(r.AnalysisId))
            throw new InvalidOperationException($"[{fixtureName}] {stage}: AnalysisId empty");
        if (string.IsNullOrWhiteSpace(r.RootNodeId))
            throw new InvalidOperationException($"[{fixtureName}] {stage}: RootNodeId empty");
        if (r.Nodes is not { Count: > 0 })
            throw new InvalidOperationException($"[{fixtureName}] {stage}: Nodes missing or empty");

        if (r.Findings is null)
            throw new InvalidOperationException($"[{fixtureName}] {stage}: Findings null");
        if (r.Narrative is null)
            throw new InvalidOperationException($"[{fixtureName}] {stage}: Narrative null");
        if (string.IsNullOrWhiteSpace(r.Narrative.WhatHappened))
            throw new InvalidOperationException($"[{fixtureName}] {stage}: Narrative.WhatHappened empty");

        if (r.Summary.TotalNodeCount <= 0)
            throw new InvalidOperationException($"[{fixtureName}] {stage}: Summary.TotalNodeCount invalid");
        if (r.Summary.MaxDepth < 0)
            throw new InvalidOperationException($"[{fixtureName}] {stage}: Summary.MaxDepth invalid");

        if (r.IndexOverview is null)
            throw new InvalidOperationException($"[{fixtureName}] {stage}: IndexOverview null");
        if (r.IndexInsights is null)
            throw new InvalidOperationException($"[{fixtureName}] {stage}: IndexInsights null");

        if (r.OptimizationSuggestions is null)
            throw new InvalidOperationException($"[{fixtureName}] {stage}: OptimizationSuggestions null");

        if (r.PlanStory is null)
            throw new InvalidOperationException($"[{fixtureName}] {stage}: PlanStory null");
        if (string.IsNullOrWhiteSpace(r.PlanStory.PlanOverview))
            throw new InvalidOperationException($"[{fixtureName}] {stage}: PlanStory.PlanOverview empty");
    }
}
