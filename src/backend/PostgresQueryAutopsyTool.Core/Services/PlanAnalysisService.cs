using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Comparison;
using PostgresQueryAutopsyTool.Core.Domain;
using PostgresQueryAutopsyTool.Core.Findings;
using PostgresQueryAutopsyTool.Core.Findings.Rules;
using PostgresQueryAutopsyTool.Core.Parsing;

namespace PostgresQueryAutopsyTool.Core.Services;

public sealed class PlanAnalysisService : IPlanAnalysisService
{
    private readonly IPlanParser _parser;
    private readonly DerivedMetricsEngine _metricsEngine;
    private readonly FindingsEngine _findingsEngine;
    private readonly ComparisonEngine _comparisonEngine;

    public PlanAnalysisService(IPlanParser parser)
    {
        _parser = parser;
        _metricsEngine = new DerivedMetricsEngine();
        _findingsEngine = new FindingsEngine(new IFindingRule[]
        {
            new RowMisestimationRule(),
            new ExclusiveCpuHotspotRule(),
            new SubtreeRuntimeHotspotRule(),
            new BufferReadHotspotRule(),
            new NestedLoopAmplificationRule(),
            new SequentialScanConcernRule(),
            new PotentialStatisticsIssueRule(),
            new PotentialIndexingOpportunityRule(),
            new PlanComplexityConcernRule(),
            new RepeatedExpensiveSubtreeRule(),
            new SortCostConcernRule(),
            new HashJoinPressureRule(),
            new MaterializeLoopsConcernRule(),
            new HighFanOutJoinWarningRule(),
        });
        _comparisonEngine = new ComparisonEngine();
    }

    public async Task<PlanAnalysisResult> AnalyzeAsync(JsonElement postgresExplainJson, CancellationToken cancellationToken)
    {
        NormalizedPlanNode root;
        try
        {
            root = _parser.ParsePostgresExplain(postgresExplainJson);
        }
        catch
        {
            var rootNodeType = TryGetFirstString(postgresExplainJson, "Node Type") ?? "Unknown";
            root = new NormalizedPlanNode
            {
                NodeId = "root",
                NodeType = rootNodeType,
                Children = Array.Empty<NormalizedPlanNode>()
            };
        }

        var analyzedNodes = _metricsEngine.Compute(root);
        var rankedFindings = _findingsEngine.EvaluateAndRank(root.NodeId, analyzedNodes);
        var summary = PlanSummaryBuilder.Build(root.NodeId, analyzedNodes, rankedFindings);
        var narrative = NarrativeGenerator.From(summary, rankedFindings);

        // Keep async boundary for future CPU-heavy traversal.
        await Task.Yield();

        return new PlanAnalysisResult(
            AnalysisId: Guid.NewGuid().ToString("n"),
            RootNodeId: root.NodeId,
            Nodes: analyzedNodes,
            Findings: rankedFindings,
            Narrative: narrative,
            Summary: summary
        );
    }

    public async Task<PlanComparisonResultV2> CompareAsync(JsonElement postgresExplainAJson, JsonElement postgresExplainBJson, CancellationToken cancellationToken, bool includeDiagnostics = false)
    {
        var analysisA = await AnalyzeAsync(postgresExplainAJson, cancellationToken);
        var analysisB = await AnalyzeAsync(postgresExplainBJson, cancellationToken);

        await Task.Yield();
        return _comparisonEngine.Compare(analysisA, analysisB, includeDiagnostics);
    }

    public string RenderMarkdownReport(PlanAnalysisResult analysis)
    {
        var findings = analysis.Findings.Count;

        static string ContextHint(AnalysisFinding f, IReadOnlyDictionary<string, AnalyzedPlanNode> byId)
        {
            var nodeId = f.NodeIds?.FirstOrDefault();
            if (nodeId is null) return "";
            if (!byId.TryGetValue(nodeId, out var n)) return "";

            // Keep this short: one line of “why” evidence when we have it.
            var ctx = n.ContextEvidence;
            if (ctx?.HashJoin?.ChildHash is not null && (ctx.HashJoin.ChildHash.HashBatches is > 1 || ctx.HashJoin.ChildHash.DiskUsageKb is > 0))
            {
                var b = ctx.HashJoin.ChildHash.HashBatches;
                var d = ctx.HashJoin.ChildHash.DiskUsageKb;
                return $" (context: hash batches={b?.ToString() ?? "n/a"}, disk={d?.ToString() ?? "n/a"}kB)";
            }

            if (ctx?.Sort is not null && (ctx.Sort.DiskUsageKb is > 0 || (ctx.Sort.SortMethod?.Contains("external", StringComparison.OrdinalIgnoreCase) ?? false)))
                return $" (context: sort method={ctx.Sort.SortMethod ?? "n/a"}, disk={ctx.Sort.DiskUsageKb?.ToString() ?? "n/a"}kB)";

            if (ctx?.ScanWaste is not null && (ctx.ScanWaste.RowsRemovedByFilter is > 0))
                return $" (context: rows removed by filter={ctx.ScanWaste.RowsRemovedByFilter})";

            if (ctx?.Memoize is not null && ctx.Memoize.HitRate is not null)
                return $" (context: memoize hitRate={ctx.Memoize.HitRate.Value:P0})";

            return "";
        }

        var byId = analysis.Nodes.ToDictionary(n => n.NodeId, StringComparer.Ordinal);
        return $@"# Postgres Query Autopsy Report

AnalysisId: {analysis.AnalysisId}

## Overview
{analysis.Narrative.WhatHappened}

## Where Time Went
{analysis.Narrative.WhereTimeWent}

## Summary
- Node count: {analysis.Summary.TotalNodeCount}
- Max depth: {analysis.Summary.MaxDepth}
- Has timing: {analysis.Summary.HasActualTiming}
- Has buffers: {analysis.Summary.HasBuffers}
- Root inclusive time (ms): {(analysis.Summary.RootInclusiveActualTimeMs?.ToString("F2") ?? "n/a")}

## Headline Findings ({findings})
{string.Join("\n", analysis.Findings.Take(12).Select(f => $"- **[{f.Severity}] [{f.Confidence}] {f.Category}** {f.Title}: {f.Summary}{ContextHint(f, byId)}"))}

## Limitations
{(analysis.Summary.Warnings.Count == 0 ? "- none observed" : string.Join("\n", analysis.Summary.Warnings.Select(w => $"- {w}")))}

## What Likely Matters
{analysis.Narrative.WhatLikelyMatters}

## What Probably Does Not Matter
{analysis.Narrative.WhatProbablyDoesNotMatter}

## Findings Appendix
{string.Join("\n", analysis.Findings.Select(f => $"- `{f.RuleId}` **[{f.Severity}] [{f.Confidence}]** {f.Title} (nodes: {string.Join(",", f.NodeIds ?? Array.Empty<string>())})"))}
";
    }

    public string RenderHtmlReport(PlanAnalysisResult analysis)
    {
        // MVP: simple HTML; later phases can style and add node appendices.
        var findingsHtml = string.Join("", analysis.Findings.Select(f =>
            $@"<div class=""finding""><b>[{f.Severity}] [{f.Confidence}] {f.Category}</b> {System.Net.WebUtility.HtmlEncode(f.Title)}<br/>{System.Net.WebUtility.HtmlEncode(f.Summary)}<div class=""rule"">{System.Net.WebUtility.HtmlEncode(f.RuleId)}</div></div>"
        ));

        return $@"<!doctype html>
<html>
  <head>
    <meta charset=""utf-8"" />
    <title>Postgres Query Autopsy Report</title>
    <style>
      body {{ font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin: 2rem; }}
      .finding {{ margin: .75rem 0; padding: .75rem; border: 1px solid #ddd; border-radius: 8px; }}
      .rule {{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; opacity: .7; margin-top: .25rem; }}
    </style>
  </head>
  <body>
    <h1>Postgres Query Autopsy Report</h1>
    <div><b>AnalysisId:</b> {analysis.AnalysisId}</div>
    <h2>Summary</h2>
    <ul>
      <li><b>Node count:</b> {analysis.Summary.TotalNodeCount}</li>
      <li><b>Max depth:</b> {analysis.Summary.MaxDepth}</li>
      <li><b>Has timing:</b> {analysis.Summary.HasActualTiming}</li>
      <li><b>Has buffers:</b> {analysis.Summary.HasBuffers}</li>
    </ul>
    <h2>Overview</h2>
    <p>{System.Net.WebUtility.HtmlEncode(analysis.Narrative.WhatHappened)}</p>
    <h2>Where Time Went</h2>
    <p>{System.Net.WebUtility.HtmlEncode(analysis.Narrative.WhereTimeWent)}</p>
    <h2>Headine Findings ({analysis.Findings.Count})</h2>
    {findingsHtml}
    <h2>Limitations</h2>
    <ul>
      {(analysis.Summary.Warnings.Count == 0 ? "<li>none observed</li>" : string.Join("", analysis.Summary.Warnings.Select(w => $"<li>{System.Net.WebUtility.HtmlEncode(w)}</li>")))}
    </ul>
    <h2>What Likely Matters</h2>
    <p>{System.Net.WebUtility.HtmlEncode(analysis.Narrative.WhatLikelyMatters)}</p>
    <h2>What Probably Does Not Matter</h2>
    <p>{System.Net.WebUtility.HtmlEncode(analysis.Narrative.WhatProbablyDoesNotMatter)}</p>
  </body>
</html>";
    }

    public string RenderCompareMarkdownReport(PlanComparisonResultV2 comparison)
    {
        string FormatTop(NodeDelta d)
        {
            var rel = d.RelationName is not null ? $" on `{d.RelationName}`" : "";
            var time = d.InclusiveTimeMs.Delta is not null ? $"{d.InclusiveTimeMs.Delta.Value:F2}ms" : "n/a";
            var reads = d.SharedReadBlocks.Delta is not null ? $"{d.SharedReadBlocks.Delta.Value:F0} blocks" : "n/a";
            var pair = comparison.PairDetails.FirstOrDefault(p => p.Identity.NodeIdA == d.NodeIdA && p.Identity.NodeIdB == d.NodeIdB);

            var cd = pair?.ContextDiff;
            string ctxHint = "";
            if (cd?.Highlights.Count > 0)
                ctxHint = $" (ctx: {string.Join("; ", cd.Highlights.Take(2))})";

            return $"- **{d.NodeTypeA} → {d.NodeTypeB}{rel}** (conf {d.MatchConfidence}, score {d.MatchScore:F2}): time Δ {time}, reads Δ {reads}{ctxHint}";
        }

        var s = comparison.Summary;
        var worst = comparison.TopWorsenedNodes.FirstOrDefault();
        var best = comparison.TopImprovedNodes.FirstOrDefault();

        var newOrWorse = comparison.FindingsDiff.Items.Where(i => i.ChangeType is FindingChangeType.New or FindingChangeType.Worsened).Take(6).ToArray();
        var resolved = comparison.FindingsDiff.Items.Where(i => i.ChangeType == FindingChangeType.Resolved).Take(6).ToArray();

        return $@"# Postgres Query Autopsy Compare Report

ComparisonId: {comparison.ComparisonId}

## Summary
- Runtime Δ: {(s.RuntimeDeltaMs?.ToString("F2") ?? "n/a")}ms ({(s.RuntimeDeltaPct?.ToString("P1") ?? "n/a")})
- Shared reads Δ: {s.SharedReadDeltaBlocks} blocks ({(s.SharedReadDeltaPct?.ToString("P1") ?? "n/a")})
- Node count Δ: {s.NodeCountDelta}
- Max depth Δ: {s.MaxDepthDelta}
- Severe findings Δ: {s.SevereFindingsDelta}

## Narrative
{comparison.Narrative}

## Top worsened pair
{(worst is null ? "- n/a" : FormatTop(worst))}

## Top improved pair
{(best is null ? "- n/a" : FormatTop(best))}

## Key findings changes
### New / worsened
{(newOrWorse.Length == 0 ? "- none" : string.Join("\n", newOrWorse.Select(i => $"- **{i.ChangeType}** `{i.RuleId}`: {i.Summary}")))}

### Resolved
{(resolved.Length == 0 ? "- none" : string.Join("\n", resolved.Select(i => $"- **Resolved** `{i.RuleId}`: {i.Summary}")))}

## Uncertainty / limitations
- Node-to-node correspondence is heuristic (greedy matching); treat low-confidence matches as investigative leads.
- If the plans differ substantially, unmatched nodes may represent real structural changes.
";
    }

    private static string? TryGetFirstString(JsonElement element, string propertyName)
    {
        // Best-effort traversal: find the first string property matching the key anywhere in the JSON tree.
        // (The full parser will later perform structurally correct navigation.)
        if (element.ValueKind == JsonValueKind.Object)
        {
            if (element.TryGetProperty(propertyName, out var direct) &&
                direct.ValueKind is JsonValueKind.String)
            {
                return direct.GetString();
            }

            foreach (var prop in element.EnumerateObject())
            {
                var found = TryGetFirstString(prop.Value, propertyName);
                if (!string.IsNullOrWhiteSpace(found))
                    return found;
            }
        }
        else if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in element.EnumerateArray())
            {
                var found = TryGetFirstString(item, propertyName);
                if (!string.IsNullOrWhiteSpace(found))
                    return found;
            }
        }

        return null;
    }
}

