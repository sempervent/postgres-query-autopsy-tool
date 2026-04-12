using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using PostgresQueryAutopsyTool.Core.Analysis;
using PostgresQueryAutopsyTool.Core.Comparison;
using PostgresQueryAutopsyTool.Core.Domain;
using PostgresQueryAutopsyTool.Core.Findings;
using PostgresQueryAutopsyTool.Core.Findings.Rules;
using PostgresQueryAutopsyTool.Core.Parsing;
using PostgresQueryAutopsyTool.Core.Reporting;

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
            new NestedLoopInnerIndexSupportRule(),
            new SequentialScanConcernRule(),
            new PotentialStatisticsIssueRule(),
            new PotentialIndexingOpportunityRule(),
            new IndexAccessStillHeavyRule(),
            new BitmapRecheckAttentionRule(),
            new AppendChunkedBitmapWorkloadRule(),
            new PlanComplexityConcernRule(),
            new RepeatedExpensiveSubtreeRule(),
            new SortCostConcernRule(),
            new HashJoinPressureRule(),
            new MaterializeLoopsConcernRule(),
            new HighFanOutJoinWarningRule(),
            new QueryShapeBoundaryConcernRule(),
        });
        _comparisonEngine = new ComparisonEngine();
    }

    public async Task<PlanAnalysisResult> AnalyzeAsync(
        JsonElement postgresExplainJson,
        CancellationToken cancellationToken,
        string? queryText = null,
        ExplainCaptureMetadata? explainMetadata = null)
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
        var summary = PlanSummaryBuilder.Build(root.NodeId, analyzedNodes, rankedFindings, queryText: queryText);
        analyzedNodes = PlanNodeInterpretationAugmentor.Augment(analyzedNodes, root.NodeId, summary, queryText);
        var byIdAug = analyzedNodes.ToDictionary(n => n.NodeId, StringComparer.Ordinal);
        summary = summary with
        {
            Bottlenecks = PlanBottleneckBriefingOverlay.AttachOperatorBriefings(summary.Bottlenecks, byIdAug)
        };
        var narrative = NarrativeGenerator.From(summary, analyzedNodes, rankedFindings);
        var findingCtx = new FindingEvaluationContext(root.NodeId, analyzedNodes);
        var indexOverview = IndexSignalAnalyzer.BuildOverview(analyzedNodes, findingCtx);
        var indexInsights = IndexSignalAnalyzer.BuildInsights(analyzedNodes, findingCtx, indexOverview);

        // Keep async boundary for future CPU-heavy traversal.
        await Task.Yield();

        var analysisCore = new PlanAnalysisResult(
            AnalysisId: Guid.NewGuid().ToString("n"),
            RootNodeId: root.NodeId,
            QueryText: string.IsNullOrWhiteSpace(queryText) ? null : queryText,
            ExplainMetadata: NormalizeExplainMetadata(explainMetadata),
            Nodes: analyzedNodes,
            Findings: rankedFindings,
            Narrative: narrative,
            Summary: summary,
            IndexOverview: indexOverview,
            IndexInsights: indexInsights,
            OptimizationSuggestions: Array.Empty<OptimizationSuggestion>(),
            PlanStory: null);

        var withSuggestions = analysisCore with
        {
            OptimizationSuggestions = OptimizationSuggestionEngine.Build(analysisCore)
        };

        var story = PlanStoryBuilder.Build(
            root.NodeId,
            summary,
            analyzedNodes,
            rankedFindings,
            narrative,
            indexOverview,
            indexInsights,
            withSuggestions.OptimizationSuggestions,
            queryText);

        return withSuggestions with { PlanStory = story };
    }

    public async Task<PlanComparisonResultV2> CompareAsync(
        JsonElement postgresExplainAJson,
        JsonElement postgresExplainBJson,
        CancellationToken cancellationToken,
        bool includeDiagnostics = false,
        string? queryTextA = null,
        string? queryTextB = null,
        ExplainCaptureMetadata? explainMetadataA = null,
        ExplainCaptureMetadata? explainMetadataB = null,
        PlanInputNormalizationInfo? planInputNormalizationA = null,
        PlanInputNormalizationInfo? planInputNormalizationB = null)
    {
        var analysisA = await AnalyzeAsync(postgresExplainAJson, cancellationToken, queryTextA, explainMetadataA);
        var analysisB = await AnalyzeAsync(postgresExplainBJson, cancellationToken, queryTextB, explainMetadataB);
        if (planInputNormalizationA is not null)
            analysisA = analysisA with { PlanInputNormalization = planInputNormalizationA };
        if (planInputNormalizationB is not null)
            analysisB = analysisB with { PlanInputNormalization = planInputNormalizationB };

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
        string NodeLabel(string nodeId)
        {
            if (!byId.TryGetValue(nodeId, out var n)) return nodeId;
            return NodeLabelFormatter.ShortLabel(n, byId);
        }

        string NodeListLabels(IEnumerable<string> ids)
            => string.Join(", ", ids.Select(NodeLabel));

        var querySection = string.IsNullOrWhiteSpace(analysis.QueryText)
            ? ""
            : $@"
## Source Query
```sql
{analysis.QueryText}
```";

        var captureSection = PlanCaptureMarkdownFormatter.FormatCaptureSectionMarkdown(analysis);

        var bottleneckMarkdown = analysis.Summary.Bottlenecks.Count == 0
            ? "- None identified from this snapshot (often missing timing or sparse buffer data)."
            : string.Join("\n", analysis.Summary.Bottlenecks.Select(b =>
            {
                var note = string.IsNullOrWhiteSpace(b.SymptomNote) ? "" : $" _(Note: {b.SymptomNote})_";
                var prop = string.IsNullOrWhiteSpace(b.PropagationNote) ? "" : $" _(Flow: {b.PropagationNote})_";
                var hum = string.IsNullOrWhiteSpace(b.HumanAnchorLabel) ? "" : $" _(Where: {b.HumanAnchorLabel})_";
                var br = string.IsNullOrWhiteSpace(b.OperatorBriefingLine) ? "" : $" _(Briefing: {b.OperatorBriefingLine})_";
                return $"- **({b.Rank}) [{b.Kind}]** {b.Headline}: {b.Detail}{hum}{br}{note}{prop}";
            }));

        var planStoryMd = analysis.PlanStory is null
            ? ""
            : $@"
## Plan briefing (structured)
- **Plan overview:** {analysis.PlanStory.PlanOverview}
- **Where work piles up:** {analysis.PlanStory.WorkConcentration}
- **What is driving cost:** {analysis.PlanStory.LikelyExpenseDrivers}
- **Execution shape:** {analysis.PlanStory.ExecutionShape}
{FormatInspectFirstMarkdown(analysis.PlanStory)}
{(analysis.PlanStory.PropagationBeats.Count == 0
    ? ""
    : "- **Flow hints:**\n" + string.Join("\n", analysis.PlanStory.PropagationBeats.Select(x =>
        string.IsNullOrWhiteSpace(x.AnchorLabel)
            ? $"  - {x.Text}"
            : $"  - {x.Text} _(focus: {x.AnchorLabel})_")))}
{(string.IsNullOrWhiteSpace(analysis.PlanStory.IndexShapeNote)
    ? ""
    : $"- **Index / shape angle:** {analysis.PlanStory.IndexShapeNote}")}
";

        return $@"# Postgres Query Autopsy Report

AnalysisId: {analysis.AnalysisId}

## Overview
{analysis.Narrative.WhatHappened}
{planStoryMd}
## Where Time Went
{analysis.Narrative.WhereTimeWent}
{querySection}

## Plan capture & EXPLAIN context
{captureSection}

## Summary
- Node count: {analysis.Summary.TotalNodeCount}
- Max depth: {analysis.Summary.MaxDepth}
- Has timing: {analysis.Summary.HasActualTiming}
- Has buffers: {analysis.Summary.HasBuffers}
- Planner costs (detected from JSON): {PlanCaptureMarkdownFormatter.PlannerCostsShortLabel(analysis.Summary.PlannerCosts)}
- Root inclusive time (ms): {(analysis.Summary.RootInclusiveActualTimeMs?.ToString("F2") ?? "n/a")}

## Prioritized bottlenecks
{bottleneckMarkdown}

## Headline Findings ({findings})
{string.Join("\n", analysis.Findings.Take(12).Select(f => $"- `[{f.FindingId}]` **[{f.Severity}] [{f.Confidence}] {f.Category}** {f.Title}: {f.Summary}{ContextHint(f, byId)}"))}

## Optimization suggestions (investigation-oriented)
{(analysis.OptimizationSuggestions.Count == 0 ? "- none generated for this plan snapshot" : string.Join("\n", analysis.OptimizationSuggestions.Take(8).Select(s =>
    $"- `[{s.SuggestionId}]` **{s.Title}** ({s.SuggestionFamily}, priority {s.Priority}, confidence {s.Confidence})\n  - Summary: {s.Summary}\n  - Next: {s.RecommendedNextAction}\n  - Why: {s.WhyItMatters}\n  - Validate: {string.Join("; ", s.ValidationSteps.Take(2))}")))}
{(analysis.OptimizationSuggestions.Count > 0 ? "\nThese are evidence-linked next steps, not guaranteed fixes. Use validation steps and EXPLAIN (ANALYZE, BUFFERS) before production changes." : "")}

## Limitations
{(analysis.Summary.Warnings.Count == 0 ? "- none observed" : string.Join("\n", analysis.Summary.Warnings.Select(w => $"- {w}")))}

## What Likely Matters
{analysis.Narrative.WhatLikelyMatters}

## What Probably Does Not Matter
{analysis.Narrative.WhatProbablyDoesNotMatter}

## Findings Appendix
{string.Join("\n", analysis.Findings.Select(f => $"- `[{f.FindingId}]` `{f.RuleId}` **[{f.Severity}] [{f.Confidence}]** {f.Title} (nodes: {NodeListLabels(f.NodeIds ?? Array.Empty<string>())})"))}
";
    }

    public string RenderHtmlReport(PlanAnalysisResult analysis)
    {
        // MVP: simple HTML; later phases can style and add node appendices.
        var findingsHtml = string.Join("", analysis.Findings.Select(f =>
            $@"<div class=""finding""><b>[{f.Severity}] [{f.Confidence}] {f.Category}</b> {System.Net.WebUtility.HtmlEncode(f.Title)}<br/>{System.Net.WebUtility.HtmlEncode(f.Summary)}<div class=""rule"">{System.Net.WebUtility.HtmlEncode(f.RuleId)}</div></div>"
        ));

        var bottleneckHtml = analysis.Summary.Bottlenecks.Count == 0
            ? "<li>None identified from this snapshot.</li>"
            : string.Join("", analysis.Summary.Bottlenecks.Select(b =>
            {
                var note = string.IsNullOrWhiteSpace(b.SymptomNote)
                    ? ""
                    : $" <i>Note:</i> {System.Net.WebUtility.HtmlEncode(b.SymptomNote!)}";
                var prop = string.IsNullOrWhiteSpace(b.PropagationNote)
                    ? ""
                    : $" <i>Flow:</i> {System.Net.WebUtility.HtmlEncode(b.PropagationNote!)}";
                var hum = string.IsNullOrWhiteSpace(b.HumanAnchorLabel)
                    ? ""
                    : $" <i>Where:</i> {System.Net.WebUtility.HtmlEncode(b.HumanAnchorLabel!)}";
                var br = string.IsNullOrWhiteSpace(b.OperatorBriefingLine)
                    ? ""
                    : $" <i>Briefing:</i> {System.Net.WebUtility.HtmlEncode(b.OperatorBriefingLine!)}";
                return
                    $"<li><b>({b.Rank}) [{System.Net.WebUtility.HtmlEncode(b.Kind)}]</b> {System.Net.WebUtility.HtmlEncode(b.Headline)}: {System.Net.WebUtility.HtmlEncode(b.Detail)}{hum}{br}{note}{prop}</li>";
            }));

        var flowHtml = analysis.PlanStory is null || analysis.PlanStory.PropagationBeats.Count == 0
            ? ""
            : "<li><b>Flow hints:</b><ul>" + string.Join("", analysis.PlanStory.PropagationBeats.Select(x =>
            {
                var line = System.Net.WebUtility.HtmlEncode(x.Text);
                var a = string.IsNullOrWhiteSpace(x.AnchorLabel)
                    ? ""
                    : $" <span style=\"opacity:.85\">(focus: {System.Net.WebUtility.HtmlEncode(x.AnchorLabel)})</span>";
                return $"<li>{line}{a}</li>";
            })) + "</ul></li>";

        var indexShapeHtml = analysis.PlanStory is null || string.IsNullOrWhiteSpace(analysis.PlanStory.IndexShapeNote)
            ? ""
            : $"<li><b>Index / shape angle:</b> {System.Net.WebUtility.HtmlEncode(analysis.PlanStory.IndexShapeNote)}</li>";

        var planStoryHtml = analysis.PlanStory is null
            ? ""
            : $@"<h2>Plan briefing</h2>
<p>{System.Net.WebUtility.HtmlEncode(analysis.PlanStory.PlanOverview)}</p>
<ul>
<li><b>Where work piles up:</b> {System.Net.WebUtility.HtmlEncode(analysis.PlanStory.WorkConcentration)}</li>
<li><b>What is driving cost:</b> {System.Net.WebUtility.HtmlEncode(analysis.PlanStory.LikelyExpenseDrivers)}</li>
<li><b>Execution shape:</b> {System.Net.WebUtility.HtmlEncode(analysis.PlanStory.ExecutionShape)}</li>
{FormatInspectFirstHtml(analysis.PlanStory)}
{flowHtml}
{indexShapeHtml}
</ul>";

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
      <li><b>Planner costs (from JSON):</b> {System.Net.WebUtility.HtmlEncode(PlanCaptureMarkdownFormatter.PlannerCostsShortLabel(analysis.Summary.PlannerCosts))}</li>
    </ul>
    <h2>Prioritized bottlenecks</h2>
    <ul>
      {bottleneckHtml}
    </ul>
    {PlanCaptureMarkdownFormatter.FormatCaptureSectionHtml(analysis)}
    {planStoryHtml}
    <h2>Overview</h2>
    <p>{System.Net.WebUtility.HtmlEncode(analysis.Narrative.WhatHappened)}</p>
    <h2>Where Time Went</h2>
    <p>{System.Net.WebUtility.HtmlEncode(analysis.Narrative.WhereTimeWent)}</p>
    <h2>Headline Findings ({analysis.Findings.Count})</h2>
    {findingsHtml}
    <h2>Optimization suggestions</h2>
    <p style=""opacity:.85"">Investigation-oriented next steps—same shape as Markdown export. Not prescriptions.</p>
    <ul>
      {(analysis.OptimizationSuggestions.Count == 0
        ? "<li>none for this snapshot</li>"
        : string.Join("", analysis.OptimizationSuggestions.Take(8).Select(s =>
        {
            var whyRaw = string.IsNullOrWhiteSpace(s.WhyItMatters) ? s.Rationale : s.WhyItMatters;
            var why = string.IsNullOrWhiteSpace(whyRaw)
                ? ""
                : $"<div style=\"margin-top:.35rem\"><i>Why:</i> {System.Net.WebUtility.HtmlEncode(whyRaw)}</div>";
            var val = s.ValidationSteps.Count == 0
                ? ""
                : string.Join("; ", s.ValidationSteps.Take(2).Select(x => x));
            var valBlock = string.IsNullOrWhiteSpace(val)
                ? ""
                : $"<div style=\"margin-top:.25rem\"><i>Validate:</i> {System.Net.WebUtility.HtmlEncode(val)}</div>";
            var fam = s.SuggestionFamily.ToString();
            return
                $"<li><code style=\"opacity:.9\">{System.Net.WebUtility.HtmlEncode(s.SuggestionId)}</code> <b>{System.Net.WebUtility.HtmlEncode(s.Title)}</b> <span style=\"opacity:.75\">({System.Net.WebUtility.HtmlEncode(fam)}, priority {s.Priority}, confidence {s.Confidence})</span><br/>{System.Net.WebUtility.HtmlEncode(s.Summary)}<br/><i>Next:</i> {System.Net.WebUtility.HtmlEncode(s.RecommendedNextAction)}{why}{valBlock}</li>";
        })))}
    </ul>
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

    /// <summary>Phase 115: compact guided lead for exports (mirrors in-app “Change at a glance” intent).</summary>
    private static string? BuildCompareReadingThreadLead(PlanComparisonResultV2 comparison)
    {
        var overview = comparison.ComparisonStory?.Overview?.Trim();
        if (!string.IsNullOrEmpty(overview))
            return ClipCompareExportLine(overview, 360);

        var hot = comparison.FindingsDiff.Items
            .Where(i => i.ChangeType is FindingChangeType.New or FindingChangeType.Worsened)
            .OrderByDescending(i => i.ChangeType == FindingChangeType.New ? 2 : 1)
            .ThenByDescending(i => (int)(i.SeverityB ?? FindingSeverity.Info))
            .FirstOrDefault();
        if (hot is null) return null;
        var line = $"{hot.Title}: {hot.Summary}".Trim();
        return ClipCompareExportLine(line, 360);
    }

    private static string ClipCompareExportLine(string s, int max)
    {
        var collapsed = Regex.Replace(s, @"\s+", " ").Trim();
        if (collapsed.Length <= max) return collapsed;
        return collapsed[..(max - 1)] + "…";
    }

    private static string FormatCompareReadingThreadMarkdown(PlanComparisonResultV2 comparison)
    {
        var lead = BuildCompareReadingThreadLead(comparison);
        if (lead is null) return "";
        return $@"## Reading thread

**Change at a glance** — {lead}

";
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

            var pairRef = pair is not null && !string.IsNullOrEmpty(pair.PairArtifactId)
                ? $" `[{pair.PairArtifactId}]`"
                : "";

            var verdict = pair is { RewriteVerdictOneLiner: { Length: > 0 } rv }
                ? $" · Rewrite outcome: {rv}"
                : "";

            return $"- **{d.NodeTypeA} → {d.NodeTypeB}{rel}**{pairRef} (conf {d.MatchConfidence}, score {d.MatchScore:F2}): time Δ {time}, reads Δ {reads}{ctxHint}{verdict}";
        }

        var s = comparison.Summary;
        var worst = comparison.TopWorsenedNodes.FirstOrDefault();
        var best = comparison.TopImprovedNodes.FirstOrDefault();

        var newOrWorse = comparison.FindingsDiff.Items.Where(i => i.ChangeType is FindingChangeType.New or FindingChangeType.Worsened).Take(6).ToArray();
        var resolved = comparison.FindingsDiff.Items.Where(i => i.ChangeType == FindingChangeType.Resolved).Take(6).ToArray();

        var sideA = PlanCaptureMarkdownFormatter.FormatSideHeaderMarkdown("Plan A (baseline)", comparison.PlanA);
        var sideB = PlanCaptureMarkdownFormatter.FormatSideHeaderMarkdown("Plan B (changed)", comparison.PlanB);

        var readingThreadMd = FormatCompareReadingThreadMarkdown(comparison);

        return $@"# Postgres Query Autopsy Compare Report

{readingThreadMd}ComparisonId: {comparison.ComparisonId}

## Plan capture & EXPLAIN context (per side)
{sideA}

{sideB}

## Summary
- Runtime Δ: {(s.RuntimeDeltaMs?.ToString("F2") ?? "n/a")}ms ({(s.RuntimeDeltaPct?.ToString("P1") ?? "n/a")})
- Shared reads Δ: {s.SharedReadDeltaBlocks} blocks ({(s.SharedReadDeltaPct?.ToString("P1") ?? "n/a")})
- Node count Δ: {s.NodeCountDelta}
- Max depth Δ: {s.MaxDepthDelta}
- Severe findings Δ: {s.SevereFindingsDelta}

## Change briefing
{(comparison.ComparisonStory is null
    ? "- No structured change story (legacy payload)."
    : $@"{comparison.ComparisonStory.Overview}

**Investigation path:** {comparison.ComparisonStory.InvestigationPath}

**Structural read:** {comparison.ComparisonStory.StructuralReading}

{(comparison.ComparisonStory.ChangeBeats.Count == 0
    ? ""
    : string.Join("\n", comparison.ComparisonStory.ChangeBeats.Select(b =>
        string.IsNullOrWhiteSpace(b.PairAnchorLabel)
            ? $"- {b.Text}"
            : $"- {b.Text} _(pair: {b.PairAnchorLabel})_")))}")}

## Bottleneck posture (A vs B)
{(comparison.BottleneckBrief is null || comparison.BottleneckBrief.Lines.Count == 0
    ? "- No compact bottleneck delta lines (often both plans lack ranked bottlenecks)."
    : string.Join("\n", comparison.BottleneckBrief.Lines.Select(l => $"- {l}")))}

## Narrative
{comparison.Narrative}

## Index changes
{(comparison.IndexComparison.OverviewLines.Count == 0 ? "- No plan-level index posture deltas surfaced." : string.Join("\n", comparison.IndexComparison.OverviewLines.Select(l => $"- {l}")))}
{(comparison.IndexComparison.InsightDiffs.Count == 0 ? "\n- No index insight diffs (lists may be empty or unchanged)." : string.Join("", comparison.IndexComparison.InsightDiffs.Take(12).Select(d =>
{
    var byId = d.RelatedFindingDiffIds is { Count: > 0 }
        ? string.Join(", ", d.RelatedFindingDiffIds.Select(id => $"[{id}]"))
        : d.RelatedFindingDiffIndexes.Count > 0
            ? string.Join(", ", d.RelatedFindingDiffIndexes.Select(i => $"#{i}"))
            : "";
    var link = byId.Length > 0 ? $" _(related findings: {byId})_" : "";
    var idPart = string.IsNullOrEmpty(d.InsightDiffId) ? "" : $" `[{d.InsightDiffId}]`";
    return $"\n- **{d.Kind}**{idPart}{link}: {d.Summary}";
})))}
{(comparison.IndexComparison.EitherPlanSuggestsChunkedBitmapWorkload ? "\n- Note: at least one plan matches the chunked Append+bitmap-heuristic; treat heavy I/O as potentially a pruning/shape problem, not only missing indexes." : "")}

## Top worsened pair
{(worst is null ? "- n/a" : FormatTop(worst))}

## Top improved pair
{(best is null ? "- n/a" : FormatTop(best))}

## Key findings changes
### New / worsened
{(newOrWorse.Length == 0 ? "- none" : string.Join("\n", newOrWorse.Select(i =>
{
    var byId = i.RelatedIndexDiffIds is { Count: > 0 }
        ? string.Join(", ", i.RelatedIndexDiffIds.Select(id => $"[{id}]"))
        : i.RelatedIndexDiffIndexes.Count > 0
            ? string.Join(", ", i.RelatedIndexDiffIndexes.Select(x => $"#{x}"))
            : "";
    var ix = byId.Length > 0 ? $" _(related index changes: {byId})_" : "";
    var idPart = string.IsNullOrEmpty(i.DiffId) ? "" : $" `[{i.DiffId}]`";
    return $"- **{i.ChangeType}**{idPart} `{i.RuleId}`{ix}: {i.Summary}";
})))}

### Resolved
{(resolved.Length == 0 ? "- none" : string.Join("\n", resolved.Select(i =>
{
    var byId = i.RelatedIndexDiffIds is { Count: > 0 }
        ? string.Join(", ", i.RelatedIndexDiffIds.Select(id => $"[{id}]"))
        : i.RelatedIndexDiffIndexes.Count > 0
            ? string.Join(", ", i.RelatedIndexDiffIndexes.Select(x => $"#{x}"))
            : "";
    var ix = byId.Length > 0 ? $" _(related index changes: {byId})_" : "";
    var idPart = string.IsNullOrEmpty(i.DiffId) ? "" : $" `[{i.DiffId}]`";
    return $"- **Resolved**{idPart} `{i.RuleId}`{ix}: {i.Summary}";
})))}

## Next steps after this change
{(comparison.CompareOptimizationSuggestions.Count == 0
    ? "- No compare-scoped suggestions (or plans are very similar)."
    : string.Join("\n", comparison.CompareOptimizationSuggestions.Take(6).Select(s =>
        $"- `[{s.SuggestionId}]` **{s.Title}** ({s.SuggestionFamily}, priority {s.Priority}, confidence {s.Confidence})\n  - {s.Summary}\n  - Next: {s.RecommendedNextAction}{(string.IsNullOrWhiteSpace(s.WhyItMatters) ? "" : $"\n  - Why: {s.WhyItMatters}")}")))}
{(comparison.CompareOptimizationSuggestions.Count > 0
    ? "\nCompare suggestions emphasize what to try on plan B given the diff—not a repeat of the full analyze list."
    : "")}

## Uncertainty / limitations
- Node-to-node correspondence is heuristic (greedy matching); treat low-confidence matches as investigative leads.
- If the plans differ substantially, unmatched nodes may represent real structural changes.
";
    }

    /// <summary>Phase 88: compare HTML export aligned with markdown story sections; top pairs use <b>Rewrite outcome</b> label.</summary>
    public string RenderCompareHtmlReport(PlanComparisonResultV2 comparison)
    {
        string TopPairLi(NodeDelta? d)
        {
            if (d is null)
                return "<li>n/a</li>";

            var rel = d.RelationName is not null ? $" on {d.RelationName}" : "";
            var time = d.InclusiveTimeMs.Delta is not null ? $"{d.InclusiveTimeMs.Delta.Value:F2}ms" : "n/a";
            var reads = d.SharedReadBlocks.Delta is not null ? $"{d.SharedReadBlocks.Delta.Value:F0} blocks" : "n/a";
            var pair = comparison.PairDetails.FirstOrDefault(p =>
                p.Identity.NodeIdA == d.NodeIdA && p.Identity.NodeIdB == d.NodeIdB);

            var ctx = "";
            if (pair?.ContextDiff is { Highlights.Count: > 0 })
                ctx = " (ctx: " + string.Join("; ", pair.ContextDiff.Highlights.Take(2)) + ")";

            var pairRef = pair is not null && !string.IsNullOrEmpty(pair.PairArtifactId)
                ? $" [{pair.PairArtifactId}]"
                : "";

            var verdict = pair is { RewriteVerdictOneLiner: { Length: > 0 } rv }
                ? " · Rewrite outcome: " + rv
                : "";

            var line =
                $"{d.NodeTypeA} → {d.NodeTypeB}{rel}{pairRef} (conf {d.MatchConfidence}, score {d.MatchScore:F2}): time Δ {time}, reads Δ {reads}{ctx}{verdict}";
            return "<li>" + System.Net.WebUtility.HtmlEncode(line) + "</li>";
        }

        var s = comparison.Summary;
        var worst = comparison.TopWorsenedNodes.FirstOrDefault();
        var best = comparison.TopImprovedNodes.FirstOrDefault();
        var story = comparison.ComparisonStory;

        var beatsSection = "";
        if (story is { ChangeBeats.Count: > 0 })
        {
            beatsSection = "<p><b>Story beats</b></p><ul>" + string.Join("", story.ChangeBeats.Select(b =>
            {
                var anchor = string.IsNullOrWhiteSpace(b.PairAnchorLabel)
                    ? ""
                    : $" <span style=\"opacity:.85\">(pair: {System.Net.WebUtility.HtmlEncode(b.PairAnchorLabel)})</span>";
                return "<li>" + System.Net.WebUtility.HtmlEncode(b.Text) + anchor + "</li>";
            })) + "</ul>";
        }

        var briefing = story is null
            ? "<p><i>No structured change story (legacy payload).</i></p>"
            : $@"<p>{System.Net.WebUtility.HtmlEncode(story.Overview)}</p>
<p><b>Investigation path:</b> {System.Net.WebUtility.HtmlEncode(story.InvestigationPath)}</p>
<p><b>Structural read:</b> {System.Net.WebUtility.HtmlEncode(story.StructuralReading)}</p>{beatsSection}";

        var readingThreadLead = BuildCompareReadingThreadLead(comparison);
        var readingThreadHtml = readingThreadLead is null
            ? ""
            : "<h2>Reading thread</h2>\n<p><b>Change at a glance</b> — " +
              System.Net.WebUtility.HtmlEncode(readingThreadLead) + "</p>\n";

        var planCaptureHtml =
            "<h2>Plan capture &amp; EXPLAIN context (per side)</h2>\n" +
            PlanCaptureMarkdownFormatter.FormatSideHeaderHtml("Plan A (baseline)", comparison.PlanA) +
            PlanCaptureMarkdownFormatter.FormatSideHeaderHtml("Plan B (changed)", comparison.PlanB);

        var bottleneckHtml = comparison.BottleneckBrief is null || comparison.BottleneckBrief.Lines.Count == 0
            ? "<p><i>No compact bottleneck delta lines (often both plans lack ranked bottlenecks).</i></p>"
            : "<ul>" + string.Join("", comparison.BottleneckBrief.Lines.Select(l =>
                "<li>" + System.Net.WebUtility.HtmlEncode(l) + "</li>")) + "</ul>";

        var narrativeHtml = string.IsNullOrWhiteSpace(comparison.Narrative)
            ? "<p><i>No narrative line.</i></p>"
            : "<p>" + System.Net.WebUtility.HtmlEncode(comparison.Narrative) + "</p>";

        var indexChangesHtml = FormatCompareIndexChangesHtml(comparison.IndexComparison);

        string CompareSuggestionLi(OptimizationSuggestion sug)
        {
            var fam = sug.SuggestionFamily.ToString();
            var why = string.IsNullOrWhiteSpace(sug.WhyItMatters)
                ? ""
                : "<div style=\"margin-top:.35rem\"><i>Why:</i> " + System.Net.WebUtility.HtmlEncode(sug.WhyItMatters) + "</div>";
            return "<li><code style=\"opacity:.9\">" + System.Net.WebUtility.HtmlEncode(sug.SuggestionId) + "</code> <b>" +
                   System.Net.WebUtility.HtmlEncode(sug.Title) + "</b> <span style=\"opacity:.75\">(" +
                   System.Net.WebUtility.HtmlEncode(fam) + ", priority " + sug.Priority + ", confidence " + sug.Confidence +
                   ")</span><br/>" + System.Net.WebUtility.HtmlEncode(sug.Summary) + "<br/><i>Next:</i> " +
                   System.Net.WebUtility.HtmlEncode(sug.RecommendedNextAction) + why + "</li>";
        }

        var compareSugHtml = comparison.CompareOptimizationSuggestions.Count == 0
            ? ""
            : "<h2>Next steps after this change</h2>\n<ul>\n" +
              string.Join("", comparison.CompareOptimizationSuggestions.Take(6).Select(CompareSuggestionLi)) +
              "\n</ul>\n<p style=\"opacity:.85;font-size:0.9rem\">Compare suggestions mirror the Markdown export—what to try on plan B given the diff.</p>";

        return $@"<!doctype html>
<html lang=""en"">
<head>
  <meta charset=""utf-8"" />
  <title>Postgres Query Autopsy — Compare</title>
  <style>
    body {{ font-family: ui-sans-serif, system-ui, sans-serif; margin: 2rem; line-height: 1.45; }}
    ul {{ padding-left: 1.25rem; }}
  </style>
</head>
<body>
  <h1>Postgres Query Autopsy — Compare</h1>
  {readingThreadHtml}
  <p><b>ComparisonId:</b> {System.Net.WebUtility.HtmlEncode(comparison.ComparisonId)}</p>
  {planCaptureHtml}
  <h2>Summary</h2>
  <ul>
    <li>Runtime Δ: {(s.RuntimeDeltaMs?.ToString("F2") ?? "n/a")} ms ({(s.RuntimeDeltaPct?.ToString("P1") ?? "n/a")})</li>
    <li>Shared reads Δ: {s.SharedReadDeltaBlocks} blocks ({(s.SharedReadDeltaPct?.ToString("P1") ?? "n/a")})</li>
    <li>Node count Δ: {s.NodeCountDelta}</li>
    <li>Max depth Δ: {s.MaxDepthDelta}</li>
    <li>Severe findings Δ: {s.SevereFindingsDelta}</li>
  </ul>
  <h2>Change briefing</h2>
  {briefing}
  <h2>Bottleneck posture (A vs B)</h2>
  {bottleneckHtml}
  <h2>Narrative</h2>
  {narrativeHtml}
  <h2>Index changes</h2>
  {indexChangesHtml}
  <h2>Top worsened pair</h2>
  <ul>{TopPairLi(worst)}</ul>
  <h2>Top improved pair</h2>
  <ul>{TopPairLi(best)}</ul>
  {compareSugHtml}
  <p style=""opacity:.85;font-size:0.9rem"">Node mapping is heuristic. For full detail use JSON export or the in-app Compare workspace.</p>
</body>
</html>";
    }

    /// <summary>Phase 94: HTML parity with markdown — index posture + insight diffs (same content as “Index changes” in the app).</summary>
    private static string FormatCompareIndexChangesHtml(IndexComparisonSummary ix)
    {
        if (ix.OverviewLines.Count == 0 && ix.InsightDiffs.Count == 0)
            return "<p><i>No plan-level index posture deltas surfaced.</i></p>";

        var overview = ix.OverviewLines.Count == 0
            ? ""
            : "<ul>" + string.Join("", ix.OverviewLines.Select(l =>
                "<li>" + System.Net.WebUtility.HtmlEncode(l) + "</li>")) + "</ul>";

        string insights;
        if (ix.InsightDiffs.Count == 0)
        {
            insights = "<p><i>No index insight diffs (lists may be empty or unchanged).</i></p>";
        }
        else
        {
            insights = "<ul>" + string.Join("", ix.InsightDiffs.Take(12).Select(d =>
            {
                var byId = d.RelatedFindingDiffIds is { Count: > 0 }
                    ? string.Join(", ", d.RelatedFindingDiffIds.Select(id => $"[{id}]"))
                    : d.RelatedFindingDiffIndexes.Count > 0
                        ? string.Join(", ", d.RelatedFindingDiffIndexes.Select(i => $"#{i}"))
                        : "";
                var link = byId.Length > 0
                    ? " <span style=\"opacity:.85\"><i>(related findings: " + System.Net.WebUtility.HtmlEncode(byId) +
                      ")</i></span>"
                    : "";
                var idPart = string.IsNullOrEmpty(d.InsightDiffId)
                    ? ""
                    : " <code style=\"opacity:.9\">" + System.Net.WebUtility.HtmlEncode(d.InsightDiffId) + "</code>";
                return "<li><b>" + System.Net.WebUtility.HtmlEncode(d.Kind.ToString()) + "</b>" + idPart + link + ": " +
                       System.Net.WebUtility.HtmlEncode(d.Summary) + "</li>";
            })) + "</ul>";
        }

        var note = ix.EitherPlanSuggestsChunkedBitmapWorkload
            ? "<p style=\"opacity:.85;font-size:0.9rem\">Note: at least one plan matches the chunked Append+bitmap-heuristic; treat heavy I/O as potentially a pruning/shape problem, not only missing indexes.</p>"
            : "";

        return overview + insights + note;
    }

    private static ExplainCaptureMetadata? NormalizeExplainMetadata(ExplainCaptureMetadata? m)
    {
        if (m is null) return null;
        var cmd = string.IsNullOrWhiteSpace(m.SourceExplainCommand) ? null : m.SourceExplainCommand.Trim();
        var opts = m.Options;
        if (opts is not null && ExplainOptionsAllNull(opts))
            opts = null;
        if (cmd is null && opts is null) return null;
        return new ExplainCaptureMetadata(opts, cmd);
    }

    private static bool ExplainOptionsAllNull(ExplainOptions o)
        => string.IsNullOrWhiteSpace(o.Format)
           && o.Analyze is null && o.Verbose is null && o.Buffers is null && o.Costs is null
           && o.Settings is null && o.Wal is null && o.Timing is null && o.Summary is null && o.Jit is null;

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

    private static string FormatInspectFirstMarkdown(PlanStory s)
    {
        if (s.InspectFirstSteps is { Count: > 0 })
        {
            var lines = s.InspectFirstSteps.Select(x => $"  {x.StepNumber}. **{x.Title}:** {x.Body}");
            return "- **Start here (steps):**\n" + string.Join("\n", lines);
        }

        return $"- **Start here:** {s.InspectFirstPath}";
    }

    private static string FormatInspectFirstHtml(PlanStory s)
    {
        if (s.InspectFirstSteps is { Count: > 0 })
        {
            var items = string.Join(
                "",
                s.InspectFirstSteps.Select(x =>
                    $"<li><b>{System.Net.WebUtility.HtmlEncode(x.Title)}</b>: {System.Net.WebUtility.HtmlEncode(x.Body)}</li>"));
            return $"<li><b>Start here</b><ol style=\"margin:0.25rem 0 0 1.25rem;padding-left:0\">{items}</ol></li>";
        }

        return $"<li><b>Start here:</b> {System.Net.WebUtility.HtmlEncode(s.InspectFirstPath)}</li>";
    }
}

