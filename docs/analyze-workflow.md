# Analyze Workflow

## Input

1. Paste plan output: **plain EXPLAIN JSON** or typical **`psql` QUERY PLAN** cell text (header, separators, `(N rows)`, `+` wraps—see [Capturing EXPLAIN JSON](capturing-explain-json.md)). Prefer `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)` when you need forensic evidence; planner **`COSTS`** are optional.
2. Optionally paste the source SQL query text (saved with the analysis when provided).
3. Optionally expand **Suggested EXPLAIN command** to generate copy-paste SQL (toggles for `ANALYZE`, `VERBOSE`, `BUFFERS`, and explicit `COSTS true`/`false`) and, if **Send EXPLAIN options with analyze request** is checked, attach declared options plus an optional “recorded command” to the API payload (`explainMetadata`).
4. Click **Analyze**.

## In-product workflow guide (Phase 101)

- **Distinct help chrome:** **`help/helpSurface.css`** (dotted border, teal accent rail, “Guide — not plan analysis” kicker) is intentionally **not** the same surface family as **`pqat-panel`** findings/workspace cards.
- **Entry points:** **`How to use Analyze` / `Hide guide`** toggles the **`AnalyzeWorkflowGuide`** panel; it opens automatically on an empty page and after **Clear**, stays closed while a snapshot or share link is open, and can be reopened anytime.
- **Context hints:** **`pqat-help-inline`** callouts sit beside **Input plan** and **Graph/Text** mode (capture vs interpretation—read the guide for definitions, not the forensic panels).

## Workflow guide persistence & re-entry (Phase 102)

- **Dismissal:** Hiding the guide on an empty Analyze page sets **`analyzeDismissed`** in **`localStorage`** key **`pqat_workflow_guide_v1`** (`{ v: 1, analyzeDismissed?: boolean, compareDismissed?: boolean }`). The next empty visit starts with the guide **closed** until the user clicks **How to use Analyze**, presses **`?`** or **Shift+/** (when focus is **not** in **`input` / `textarea` / `select` / `contenteditable`**), or opens **`/?guide=1`** or **`/?guide=true`**.
- **Clear:** **Clear** always reopens the guide for a fresh capture pass (without clearing the stored dismissal flag for future empty visits).
- **Deep link:** **`?guide=`** is removed from the URL when the user **closes** the guide after it was opened via that param, so refresh does not keep forcing it open.
- **Plan guide rail:** **`pqat-help-inline`** under **Plan guide** reminds users the rail is interpretation layered on the plan, not raw EXPLAIN output.

## Help lifecycle, focus, and support entry (Phase 103)

- **Focus:** When the guide opens from **How to use…**, **`?`**, or **`?guide=1`**, focus moves to the guide **`h2`** (programmatic focus, **`tabIndex={0}`**). Auto-open on first empty visit and **Clear** do **not** steal focus from the plan field.
- **Close:** **Esc** closes the guide when the event target is **not** an **`input` / `textarea` / `select` / `contenteditable`** (same ignore rule as **`?`**). After an explicit close (**Hide guide** or **Esc**), focus returns to the bar toggle.
- **Support:** Guide footer **Copy merged guided link** / **Copy entry guided link**—**merged** uses **`buildCopyGuidedLinkUrlFromLocation`** (keeps query + hash); **entry** uses **`buildWorkflowGuideAbsoluteUrl(pathname)`** (**`?guide=1`** only). Both are distinct from **Copy share link** on a saved analysis.
- **E2E:** Playwright proves **`localStorage`** dismissal survives **reload** and that **`?guide=1`** still reopens; merged/entry guided clipboard + guide announcer lifecycle + **Esc** + focus return are covered in **`persisted-flows.spec.ts`**.

## Help accessibility and guided-link merge (Phase 104)

- **Screen readers:** **`data-testid="analyze-workflow-guide-announcer"`** ( **`aria-live="polite"`**, **`aria-atomic="true"`** ) announces explicit open (**“Analyze workflow guide opened”**), close (**“…closed”**), and **“Guided help opened from link”** when **`?guide=`** opens the panel. Auto-open on first empty visit does not announce. Copy is cleared after a few seconds to limit noise.
- **Tab loop:** After an **explicit** open (**How to use…**, **`?`**, **`?guide=`**), **Tab** / **Shift+Tab** wrap between the first and last focusable inside **`pqat-help-shell`** (capture listener on the section). **Clear** / empty-state auto-open does not enable the loop. **Esc** and non-modal behavior unchanged.
- **Merged guided URL:** **`buildCopyGuidedLinkUrlFromLocation`** sets **`guide=1`** on the live **`window.location`** (path + search + hash), preserving other params—distinct from **Copy share link** on a saved analysis.

## Help landmarks, dual guided links, and browser announcer proof (Phase 105)

- **Landmarks:** **`WorkflowGuideShell`** is **`role="region"`** with **`aria-labelledby`** on the guide title; the footer wrapper is **`role="group"`** **`aria-label="Guided link sharing"`**.
- **Guided links:** Footer **Copy merged guided link** + **Copy entry guided link** (see **Support** above). Playwright asserts clipboard shape for each; Vitest covers **`?guide=`** announcer via **`MemoryRouter`**.
- **E2E announcer:** **`persisted-flows.spec.ts`** asserts **`analyze-workflow-guide-announcer`** / **`compare-workflow-guide-announcer`** text for explicit open/close and **“Guided help opened from link”** after dismiss + **`?guide=1`** navigation.

## Example entry, triage-first summary, lighter copy (Phase 107)

- **Try a sample:** **`TryAnalyzeExampleChips`** (capture when no result yet + **Analyze** guide) loads bundled JSON from **`src/examples/plans/`** (kept in sync with **`e2e/fixtures`**). **`onAnalyze(overridePlanText?)`** avoids stale state when running immediately after load.
- **Triage:** **`analyzeTakeawayFromResult`** drives **`analyze-summary-takeaway`** (**Start here**): top finding → else first inspect step → else plan overview. **Plan briefing** keeps primary lanes; **flow / index shape** and long “why sections differ” text move behind **`<details>`**; **Plan source & EXPLAIN metadata** is collapsed by default.
- **Copy:** Fewer “server / artifact” phrases on the primary path; persistence lines describe **saved in this app’s database** and **share links** in user terms.
- **Tests:** Vitest (example flow, takeaway helper); Playwright **`persisted-flows`** **Try example** smoke; **`data-testid`** `*-capture` / `*-help` suffixes avoid duplicate id collisions.

## Scan-first summary, expanded samples, findings cascade (Phase 108)

- **Examples:** Three **Analyze** samples at ship (**simple seq scan**, **sort pressure**, **index + ordering**) plus two **Compare** pairs — see **`src/examples/README.md`**. Phase **109** adds a fourth Analyze sample (**join-heavy nested loop**).
- **Triage strip:** **`analyzeFollowUpScanSignals`** renders **`analyze-scan-signals`** (**Also scan**) with jump buttons; heading **`analyze-summary-heading`** (**Summary**); **Plan metrics** live under **Analysis id & plan counts** **`<details>`**; **Plan briefing** shows **Start here** inspect lane first, with **overview / work / drivers** collapsed.
- **Cascade:** **`primaryTriageFindingId`** from the takeaway highlights the matching **Findings** row (**Matches summary** cue).
- **E2E:** **`analyze-optimization-suggestions-panel`** stabilizes **Copy for ticket**; Analyze flow waits on **`analyze-summary-heading`** instead of the old longer title string.

## Virtualized findings + suggestions tied to triage (Phase 110)

- **Findings:** Long lists still scroll the **Matches summary** row into view via **`VirtualizedListColumn`** **`scrollToIndex`** (same primary finding as **Start here**).
- **Suggestions:** Evidence alignment with **Start here** (Phase **111** expands this—see below).
- **Motion:** Programmatic scroll respects **`prefers-reduced-motion`** (**`motionPreferences`**); **`scrollArtifactIntoView`** uses the same helper.
- **Narrow:** Sticky summary/triage uses **`--pqat-sticky-top-offset`** so bands sit below the app top bar.

## Guided-path cohesion + triage suggestion expansion (Phase 111)

- **Suggestions:** **`suggestionAlignsWithAnalyzeTriage`** marks cards **Aligned with Start here** when **`relatedFindingIds`** matches, **`triageFocusNodeId`** is in **`targetNodeIds`**, or suggestion targets overlap the primary finding’s **`nodeIds`**.
- **Plan guide:** **`analyze-guide-jump-primary-finding`** scrolls the **Findings** list to the **Start here** row when the takeaway is finding-driven.
- **Selected node:** When the node-scoped suggestion is the **top-ranked** experiment **and** aligns with triage, a compact cue (**`analyze-selected-node-top-next-cue`**) ties **Next steps** to **Start here**.
- **Sticky:** **`useStickyTopOffsetSync`** (in **`App`**) measures **`.topBar`** and sets **`--pqat-sticky-top-offset`** on resize so narrow sticky bands track real chrome height.

## Triage continuity, exports, calmer system surfaces (Phase 112)

- **Virtualized suggestions:** When the list is virtualized and a row aligns with **Start here**, **`AnalyzeOptimizationSuggestionsPanel`** scrolls that row into view via **`VirtualizedListColumn`** **`scrollToIndex`** (**`firstVirtualRowIndexAlignedWithAnalyzeTriage`** in **`analyzeOutputGuidance.ts`**).
- **Plan guide:** **`triagePrimaryRoute`** — finding-driven takeaways keep **Open Start here finding in list**; step-driven takeaways get **Jump to plan focus** (**`analyze-guide-jump-triage-plan`**) instead of a no-op finding jump.
- **Exports / share parity:** Client-side **`analyzeExportTriage.ts`** augments downloaded **Markdown** (preamble), **HTML** (injected block), and **JSON** (**`pqatExportTriage`** envelope) with compact **Start here** + primary finding id when known. **Copy share link** / deep-link clipboard payloads can include a **Start here** headline line (**`shareAppUrl.analyzeDeepLinkClipboardPayload`**).
- **System copy:** **`artifactErrorPresentation`** tightens error titles; capture panels use calmer reopen/loading lines; summary persistence hint is slightly less mechanical.
- **Sticky:** Narrow sticky shells add **`env(safe-area-inset-top)`** on top of **`--pqat-sticky-top-offset`** (**`workstation.css`**) for notched / inset layouts.

## Guided-flow cohesion, error next steps, virtual proof (Phase 113)

- **Plan guide echo:** **`analyze-guide-triage-echo`** no longer repeats the **Start here** headline—one line points back to the summary band; jump buttons unchanged.
- **Selected node:** Continuity strip references the summary headline without duplicating it; top-next cue shortened.
- **Errors:** **`artifactErrorBannerNextStep`** adds a single actionable line under **`ArtifactErrorBanner`** when the pattern is known (not found, corrupt, schema, plan parse, network).
- **Virtual scroller test id:** **`analyze-suggestions-virtual-scroller`** on long suggestion lists; Playwright **`persisted-flows`** pads **`/api/analyze`** responses to force virtualization, targets the **single** scroll-target row **`analyze-suggestion-card-triage-aligned`** (first triage-aligned virtual row), and asserts **viewport visibility** plus **intersection with the scroll container** (Phase **114**), not only DOM presence of **Aligned with Start here**.
- **Plan guide echo (Phase 114):** When the summary path is **overview** + **Also scan** (not a finding/step **Start here** thread), the rail uses wording that matches that path.

## Export trust, reopen parity, clearer failures (Phase 116)

- **Reopen → export:** With **`analysis=`** in the URL and an empty plan box, exports call **`POST /api/report/markdown`** (and siblings) with **`{ analysis: <PlanAnalysisResult> }`**—the same snapshot the UI already loaded. The capture panel shows **`analyze-export-snapshot-cue`** and per-format **Preparing…** busy text; success/error status lines are separate from global analyze errors. Playwright **`Analyze: reopen with empty plan input exports markdown using snapshot payload`** asserts the POST JSON and a substantive markdown body (same pattern as Compare reopen→export).
- **Guide echo:** **`filterTriageEchoScanLabels`** removes **Also scan** lines that only repeat the **Start here** headline (case/space normalized).
- **API errors:** The SPA **`formatApiErrorResponse`** helper maps structured **`4xx`** JSON (including empty bodies) to a single actionable sentence for export failures.
- **Backend:** **`ArtifactPersistenceJson.ApplyToHttpSerializerOptions`** applies persistence **`JsonSerializerOptions`** to **`ConfigureHttpJsonOptions`** so snapshot/report deserialization cannot drift from SQLite artifact JSON (converters are not registered twice if applied repeatedly).

## Clearer export failures, Compare parity, quieter guidance (Phase 117)

- **Report API errors:** Malformed or unusable bodies on **`/api/report/*`** return compact JSON (**`request_body_invalid`** or **`export_request_incomplete`**) instead of an empty **400**; **`formatApiErrorResponse`** shows the **`message`** line without prefixing technical **`error`** codes for those.
- **Export status:** **`analyze-export-status`** announces success/failure with **`aria-live="polite"`** and **`aria-atomic="true"`** (same pattern as Compare).
- **Guide echo:** When the summary path is **overview** and **Also scan** chips are present, the rail echo drops the extra headline paragraph so the list is not framed twice.

## Stable export validation, visible failure proof, trust copy (Phase 118)

- **Semantics:** **`export_request_incomplete`** for empty **`{}`** analyze report bodies is decided in **`ReportExportValidation`** (explicit **`Results.BadRequest`**). Malformed JSON still maps to **`request_body_invalid`** via **`IExceptionHandler`**.
- **Playwright:** **`Compare: reopen with empty plan inputs exports HTML using snapshot payload`**; **`Analyze: export failure shows calm status line without error-code prefix`** (mocked **400** on **`/api/report/markdown`**, assert **`analyze-export-status`**).
- **Sharing panel:** Calmer **ArtifactSharingPanel** titles and local-dev hints (**`artifact-sharing-details`** unchanged).

## Take-with-you export, format parity, quieter echo (Phase 119)

- **Capture:** Eyebrow **Take with you** (replaces **Download**); shorter snapshot vs paste hints; button **`title`**s name format role (Markdown / HTML / JSON).
- **Success:** **Export ready** / **Export started** status copy after export (outcome-focused).
- **Parity:** Playwright **`Analyze: reopen with empty plan input exports HTML using snapshot payload`** (**`POST /api/report/html`**).
- **Guide echo:** **Summary** rail headline hidden whenever **Also scan** chips exist (finding/step/overview), not only overview.
- **Failures:** **`formatApiErrorResponse`** maps ProblemDetails-style **500** JSON (**`title`** / safe **`detail`**) without echoing stack traces in **`detail`**.

## Final export parity, handoff clarity, quieter triage echo (Phase 120)

- **Parity:** Playwright **`Analyze: reopen with empty plan input exports JSON using snapshot payload`** (**`POST /api/report/json`**) — request body includes **`analysis`** snapshot; response **`analysisId`** matches **`POST`** body and includes **`nodes`**.
- **Take with you:** Compact per-format legend (**`analyze-export-format-legend`**) under the snapshot/paste hint; success status uses **Ready** / **Started** (short, download-focused).
- **Sharing:** **`artifact-sharing-effect-note`** — saving changes who can use the link next, not offline copies; post-save line **Sharing saved. New access rules apply the next time someone opens this link.**
- **Guidance:** **`filterTriageEchoScanLabels`** also drops **Also scan** chips that duplicate the headline’s opening phrase (not only exact matches); **`compareContinuityCueIsSpecific`** treats short outcome cues (**worsened** / **improved** / **Plan A**/**B**) as specific enough for the pair panel.
- **Trust:** Empty-body **400** on export — **`formatApiErrorResponse`** suggests reload and re-pasting the plan before retrying.
- **Visual follow-up:** **`analyze-export-report-row`** / **`analyze-export-format-legend`** are stable targets for a future **`e2e-visual`** crop (run Linux **`--update-snapshots`** when ready).

## Action handoff polish, unified export voice, continuity tests (Phase 121)

- **Take with you:** **`pqat-handoffBand`** top border separates the export block; **`analyze-export-handoff-kicker`** states the decision; **`pqat-formatLegend`** uses **Markdown** / **HTML** / **JSON** labels with roles (notes, print, tools); snapshot hint distinguishes saved-link vs plan-box rebuild.
- **Export success:** **`exportDownloadSuccessHint`** (`snapshot` \| `fromPlanText`) shared by **Analyze** and **Compare** status lines.
- **Failures:** **`formatApiErrorResponse`** — empty **401** and calmer empty **413**; **`throwFormattedHttpError`** and other **401** paths use the same formatter (no duplicate dev-token string for report posts).
- **Sharing:** **`artifact-sharing-effect-note`** + post-save line tightened; auth card title **How access is checked**.
- **Guidance:** **`compareContinuityCueIsSpecific`** adds a short **faster/slower** + plan-vocabulary path; more **`resolveComparePairFallbackDisplay`** tests; **`filterTriageEchoScanLabels`** regression test for non-echo chips.

## Readability-first flow, graph de-emphasis, graph→finding continuity (Phase 122)

- **Graph footprint:** Default graph height **`clamp(240px, 30vh, 420px)`** (Phase **137** retune; was **`clamp(260px, 34vh, 460px)`** in **122**); paired workspace grid gives the plan guide column slightly more width on medium/wide breakpoints; text-tree band min-height aligned.
- **Graph → findings:** **`jumpToNodeId(id, { scrollRelatedFindings: true })`** from graph clicks and graph search matches; **`topRankedFindingForNode`** picks the scroll target; **`graphPivotFindingId`** drives **`AnalyzeFindingsPanel`** scroll + **`pqat-listRow--graphPivot`** / **From graph** cue; auto-clear after a few seconds.
- **Selected node:** **`analyze-related-findings-bridge`** — chips (up to 4) to refocus the ranked list; calm line when no findings cite the node; **`onFocusFindingInList`** for chip clicks.
- **Text tree:** **`selectNodeFromTextTree`** clears graph pivot (no findings scroll).
- **Copy trim:** Plan workspace intro, graph/text hints, findings intro, rule-reference blurb, graph legend — shorter; duplicate finding list removed from heavy sections (use Ranked list + bridge).

## Graph-local findings, no default scroll-jump (Phase 123)

- **Local shelf:** **`AnalyzeLocalFindingsShelf`** under the graph (and under the text tree) — top **2** ranked findings with title + summary snippet, **more** `<details>` with links; explicit per-finding action → sets **`graphPivotFindingId`** and scrolls the lower **Findings** list (UI copy: **Phase 125**).
- **Graph clicks:** **`jumpToNodeId(id)`** — no automatic pivot/scroll; selection updates local shelf in the **Plan workspace** band.
- **Selected node:** Same shelf (**`analyze-detail-local-findings-shelf`**) after operator title/briefing; **`rankedFindingsForNode`** sorts citations.
- **Ranked list cue:** Header **Continues from plan** + **`pqat-listRow--graphPivot`** when opened via an explicit plan-band / detail action (sets **`graphPivotFindingId`**); row subtitle **Opened from detail** removed when the header band is present (**Phase 131**).

## Cleaner local evidence, dedupe, keyboard/a11y (Phase 124)

- **Dedupe:** When **Plan workspace** and **Selected node** are both visible, the full **`AnalyzeLocalFindingsShelf`** stays in the workspace band; the selected-node column uses **`AnalyzeLocalFindingsBridge`** (**`analyze-local-evidence-bridge`**). If workspace is hidden, the selected-node column still gets the **full shelf** (`analyze-detail-local-findings-shelf`).
- **Shelf navigator:** Two preview slots + `<details>` for additional ranked titles; `role="region"`, polite **`aria-live`** count; per-finding actions set **`graphPivotFindingId`** (visible labels refined in **Phase 125**).
- **Selected node:** Readout kicker **Operator** (was “Operator in focus”).
- **Copy trim:** Plan workspace graph/text hint; **Findings** intro.
- **E2E (Phase 137 name):** graph click shows **`analyze-graph-issue-summary`** + local shelf; **`#analyze-ranked-findings`** is not focused until an explicit open/skip; no **Continues from plan** until pivot.

## Stronger workspace band, smarter bridge, go-deeper cues (Phase 125)

- **Reading path:** Selected-node readout sits in **`pqat-investigationThread`** (one band with the **Operator** block). Workspace shelf heading **Why this operator matters**; lead card **Strongest match**; per-preview **Full write-up in list** (explicit deeper step).
- **Bridge:** **`analyze-local-evidence-bridge`** — single finding: compact severity + title + **Open full finding in list**; multiple: **Up to \<severity\>** chip + short count line + **Open top in full list** (does not outshine the shelf).
- **Truncation:** When more findings exist than the two preview slots, **`analyze-local-evidence-truncation-cue`** states **Showing 2 of N** and points to the full ranked list for complete evidence.
- **Findings column:** Intro names **Full write-up in list** as the deliberate jump from the plan band.
- **Tests / E2E:** Vitest bridge + shelf; interaction test for bridge-only pivot; Playwright **`Analyze: bridge Open full finding shows Opened from detail in ranked list`**.

## Smoother investigation flow, unified evidence language (Phase 126)

- **Navigation:** After local evidence in the plan band, **`Skip to Ranked findings`** (**`pqat-skipToRanked`**, `href="#analyze-ranked-findings"`) when the Ranked column is visible; target **`id`** on **`AnalyzeFindingsPanel`**.
- **Unified CTAs:** **`evidenceNavCopy`** + **`ariaLabelFullWriteUpInRankedList`** / **`ariaLabelOpenStrongestInRankedList`** in **`localEvidencePresentation`** — shelf + bridge use **Open in ranked list**; multi-bridge uses **Open strongest in ranked list**; **`AnalyzeFindingsPanel`** imports **`severityLabel` / `severityChipClass`** from the same module; plan guide rail uses **`severityLabel`** from there.
- **Multi-finding shelf:** Truncation + **`Other titles (N)`** disclosure; compact hint **— full rows in Ranked** when previews are capped.
- **Bridge (multi):** Copy **strongest first in the band above** (ties shelf ordering).
- **Narrow:** **`@media (max-width: 720px)`** eases **`pqat-investigationThread`**, shelf, and bridge padding.
- **E2E:** Skip link presence; bridge pivot test renamed to **Open in ranked list**.

## Focus flow, confidence parity, clearer previews (Phase 127)

- **Arrival:** Skip link uses explicit **`scrollIntoView`** + **`focus()`** on **`#analyze-ranked-findings`** (not hash-only). **`Open in ranked list`** / shelf actions still set **`graphPivotFindingId`**; **`AnalyzeFindingsPanel`** scrolls the ranked **`ClickableRow`** then retries **`focus()`** on it (interval until **`document.activeElement`** matches or cap; virtual lists get more time after **`scrollToIndex`**).
- **Scoped DOM:** Scroll/focus targets **`#analyze-ranked-findings [data-finding-id][role="button"]`** so plan-band preview **`<li data-finding-id>`** rows in **`AnalyzeLocalFindingsShelf`** do not win **`querySelector`** first. **`scrollToPrimaryFindingRow`** (Analyze) uses the same scope.
- **Ranked region:** **`aria-labelledby`** on the panel + **`h2`** **`analyze-ranked-findings-heading`**; **`pqat-rankedFindingsPanel:focus-visible`** outline.
- **Evidence language:** **`findingConfidenceLabel`** shared from **`localEvidencePresentation`**; shelf preview list **`aria-label`** clarifies **preview**; **Strongest match** **`title`** tooltip; multi-bridge **`aria-label`** ties strongest to plan band; pivot finding row **`aria-label`** includes **Opened from plan detail**.
- **Multi-finding:** Truncation **Previews N of M · +K under Other titles · Full rows stay in Ranked.**
- **Shortcuts nav:** Skip link wrapped in **`nav.pqat-planEvidenceShortcuts`**.
- **E2E:** Skip link **`focus()` + `Enter`** (avoids overlapping hit-test flakes); bridge open asserts **`document.activeElement`** matches **`.pqat-listRow--graphPivot`** (DOM focus contract).

## Preview vs ranked semantics, deterministic arrival, focus polish (Phase 128)

- **DOM:** Plan-band preview list items use **`data-pqat-preview-finding-id`** only; ranked rows keep **`data-finding-id`** on **`ClickableRow`**. Shared helper **`queryRankedFindingRow`** in **`analyzeEvidenceDom.ts`** (tests cover preview + ranked with the same logical id).
- **Arrival:** **`VirtualizedListColumn.scrollToIndex`** accepts optional **`onSettled`** (row index appears in **`getVirtualItems()`**, then rAF). Graph-pivot focus uses scroll completion + short **rAF retries** (no **`setInterval`**). Pivot cue clears **4.2s after focus lands** (**`onGraphPivotFocusArrived`**); **6s** fallback if focus never lands (Phase 129).
- **Chrome:** **`.pqat-listRow--graphPivot`** hairline ring + **`focus-visible`** outline; **`nav.pqat-planEvidenceShortcuts:focus-within`** raises stacking for skip-link pointer use; bridge actions **`z-index`** nudge.

## Ranked arrival cue, virtual settlement tests, skip proof (Phase 129)

- **Arrival:** After **open-from-plan** focus lands on the ranked row, a compact **status** line (**`pqat-rankedArrivalCue`**) confirms the landing; **`Findings`** **`h2`** uses **`aria-describedby`** while the cue is visible; panel gets **`pqat-rankedFindingsPanel--arrivalCue`** emphasis (**Phase 130** refines copy, ~**2.8s** dwell, and styling — see below).
- **Virtual list:** **`scheduleVirtualScrollSettled`** in **`virtualizedScrollSettled.ts`** backs **`VirtualizedListColumn.scrollToIndex(..., onSettled)`**; unit tests cover success, bounded fallback, and cancel.
- **Plan workspace:** Graph legend (**hot ex** / **hot reads**) sits **above** the canvas so it does not overlap **Skip to Ranked findings**; skip link has **`data-testid="analyze-skip-to-ranked-findings"`**; E2E covers keyboard (**Enter**) and **native `click()`** on the anchor (same handler path as an intentional activation).
- **Pivot fallback:** If focus never arrives, **`graphPivotFindingId`** clears after **6s** (safety net).

## Calmer ranked continuation, skip pointer E2E, Vitest SVG noise (Phase 130)

- **Thread hint:** While **`graphPivotFindingId`** is set, the Ranked band shows **Continues from plan** beside the **Ranked** eyebrow (**`pqat-rankedThreadHint`**), **`pqat-rankedFindingsPanel--pivotContinuity`** tint, and **`Findings`** **`h2`** **`aria-describedby`** includes that hint’s id (plus the transient arrival cue when active). **Phase 131** drops repeated operator mono + row **Opened from detail** when this header is shown (anchor stays in the row body).
- **Arrival cue:** Copy **“On the matching row — full write-up below.”** (~2.8s); **`pqat-rankedArrivalCue`** is a left-accent stripe (not a full card); panel emphasis uses a light **inset** shadow; **`prefers-reduced-motion`** drops the transition.
- **Pivot row:** **`.pqat-listRow--graphPivot`** keeps a faint wash after the cue fades so the row stays legible.
- **Scroll:** **`#analyze-ranked-findings`** has **`scroll-margin-top`** for skip / in-page focus.
- **Skip E2E:** **`focus()`** then **`click()`** — skip is off-screen until focus expands it, so the test uses a real pointer path on the revealed control.
- **Vitest:** **`SVGGraphicsElement.getBBox`** shim for **`.react-flow`** + narrow **`console.error`** filter for React DOM’s **“Received NaN for the \`…\` attribute”** (jsdom + React Flow); **`AnalyzePlanGraphCore`** uses **dots** background everywhere (lines were test-only before and still noisy under jsdom).

### Phase 132 — narrow lower-band order, ranked region labeling

- **Narrow:** **`AnalyzePage`** renders **`visibleLowerReadingOrder`** — **findings → suggestions → selected node** when **`layoutTier === 'narrow'`** (stacked grid), so ranked + continuation stay ahead of selected-node detail in tab order.
- **Ranked continuation:** Contract **`role="region"`** + **`aria-labelledby`** (thread hint + **Findings** **`h2`**); **`data-testid="analyze-ranked-handoff-hint"`** for structural tests.

### Phase 133 — ranked region description (pivot band)

- **Pivot continuity:** Inner **`analyze-visual-ranked-continuation-contract`** uses **`aria-labelledby`** on the **Findings** **`h2`** id and **`aria-describedby`** on the **Continues from plan** hint id so the thread line is not announced twice via both region and **`h2`** when the arrival cue is absent. **`h2`** still uses **`aria-describedby`** for the transient **arrival** status when **`showRankedArrivalCue`** is on (Phase 129–130 behavior).

### Phase 134 — reopened ranked continuity (saved `?analysis=`)

- **`analyzeRankedHandoffOrigin`:** **`link`** after persisted **`getAnalysis`** success, **`session`** when running **Analyze** from plan text or **Clear**.
- **Copy:** **`analyzeRankedContinuityCopy`** — **`Ranked — reopened`** beside **Ranked** when restored and not in graph-pivot band; pivot band **Continues from plan — reopened** when restored + **`graphPivotFindingId`** (sibling rhythm to Compare **Summary — reopened**).
- **a11y:** **`#analyze-ranked-findings`** gains **`aria-describedby`** pointing at the restored band hint id when that hint is visible.
- **Tests:** Vitest + Playwright reopen / pivot / export paths (see **`docs/compare-workflow.md`** Phase **134** for cross-route E2E notes).

### Phase 135 — shared reopened suffix + export parity

- **`withReopenedSuffix`** (**`reopenedContinuityCopy.ts`**) backs **Ranked — reopened** / **Continues from plan — reopened** with the same convention as Compare pair handoffs.
- **Export success:** **`exportDownloadSuccessHint`** optional **`restoredFromLink`** when exporting a snapshot after **`getAnalysis`** (see **`docs/compare-workflow.md`** handoff matrix).

### Phase 136 — stable `?analysis=` for reopen + E2E

- **`AnalyzePage`:** **`buildAnalyzeDeepLinkSearchParams`** sync uses **`useLayoutEffect`** (not **`useEffect`**) so **`?analysis=`** is present in the same paint cycle as the summary shell—reduces flake when tests capture **`page.url()`** right after **Analyze** succeeds.
- **Playwright:** **`persisted-flows`** uses **`expect(page).toHaveURL(/[?&]analysis=/)`** before persisting the URL on paste→analyze→reopen and ranked-reopen paths.

### Phase 137 — graph-first issue explanation (in-band readout)

- **`AnalyzeGraphIssueSummary`** (**`analyze-graph-issue-summary`**) sits **under the graph / text tree** in **`AnalyzePlanWorkspacePanel`**, inside **`pqat-graphInvestigationStack`**: **What looks wrong here** (severity + strongest local title), **Why it matters** (first clause from the finding summary), **Inspect next** (Selected node + Ranked as optional depth).
- **Presentation:** **`graphNodeIssueSummaryPresentation.ts`** (**`buildGraphNodeIssueSummary`**, **`firstWhyClause`**) — Vitest unit tests.
- **Workspace shelf demotion:** **`AnalyzeLocalFindingsShelf`** **`compactWorkspacePreview`** — heading **More in Ranked**, no **Strongest match** badge, shorter snippets, single-finding workspace omits the duplicate summary paragraph (issue band already states it), CTA **Full write-up in Ranked**.
- **Bridge:** **`AnalyzeLocalFindingsBridge`** — fewer repeated titles; Ranked actions read as **next step**, not the primary decode path.
- **Layout:** **`pqat-graphInvestigationStack--fillsColumn`** lets the graph frame share flex height with the new readout in paired mode; default graph min-height slightly lower so the investigation band balances text vs canvas.
- **E2E:** Graph click asserts **`analyze-graph-issue-summary`** + **`#analyze-ranked-findings`** is **not** **`document.activeElement`** until an explicit open/skip.

## First-screen triage deck + downstream continuity (Phase 109)

- **Bundle:** **`buildAnalyzeTriageBundle`** feeds **`analyze-triage-deck`**: hero **Start here**, ranked **Then scan** (1–2–3), primary **Open in plan** when the takeaway names a node.
- **Narrow:** **`stickyTriageNarrow`** keeps the triage shell near the top when the workstation stacks.
- **Continuity:** **Findings** scrolls the **Matches summary** row into view when it is off-screen (skipped for virtualized long lists); **Selected node** and **Plan guide** show a short cue when the selection matches the summary’s primary focus; guide **Plain-language readout** stays collapsed by default.
- **Examples:** fourth sample — **join-heavy nested loop** (**`nl-join-inner-heavy`**) — see **`src/examples/README.md`**.

## Guided-link parity, first-frame polish, help-shell visual contract (Phase 106)

- **Shared URL open:** **`openWorkflowGuideWhenUrlRequests`** (**`workflowGuideOpenFromUrl.ts`**) runs from **`useLayoutEffect`** on **Analyze** and **Compare** so **`?guide=`** does not flash closed for one frame while preserving the false→open announcer path.
- **Compare merged E2E:** **`persisted-flows`** copies **Compare** merged guided link with a decoy query param, **`goto`** the clipboard URL, and expects the guide panel visible—parity with **Analyze** merged coverage.
- **Visual contract:** **`data-pqat-help-visual-contract="1"`** on **`WorkflowGuideShell`**; **`e2e-visual`** captures **`analyze-workflow-guide-panel`** as **`analyze-workflow-guide-shell.png`** (help chrome vs analysis).
- **Copy clarity:** Footer hint + **`title`** / **`aria-label`** spell out **merged** (full context) vs **entry** (clean route).

**Local vs reopened analysis:** Pasting and analyzing keeps the raw text in the browser until you clear it. After success, the address bar gains **`?analysis=<opaqueId>`** (and **`node=`** when a node is selected) so the same result can be fetched again from **SQLite-backed** storage. Opening a URL with **`analysis=`** loads the snapshot from the server (`GET /api/analyses/{id}`) and clears the textarea; running **Analyze** again on new paste strips the old `analysis` query param and replaces it after the new response. Responses include **`artifactSchemaVersion`** (Phase 49); the server normalizes older stored JSON on read. If the snapshot is **missing**, **access denied**, **corrupt** (**422**), or from an **unsupported newer schema** (**409**), the page shows a specific message instead of a generic failure. **Copy share link** (non-auth) or **Copy artifact link** (auth deployments) reflects server policy—see [Deployment & auth](deployment-auth.md). Links remain valid across API restarts if the database file is kept (see [API & Reports](api-and-reports.md#storage-phase-36-access-control-phase-37)).

**Phase 72 + 84 + 86 (copy reliability + ticket payloads):** **`copyToClipboard`** tries **`document.execCommand('copy')` on a hidden textarea first** (same synchronous turn as the click, so Safari / strict Chromium user-gesture rules still work), then falls back to **`navigator.clipboard.writeText`**. **`useCopyFeedback`** shows success or an honest **copy-failed** hint; status lines use **`role="status"`** + **`aria-live="polite"`** + **`aria-atomic="true"`** on copy feedback, with a slightly longer success dwell time for assistive tech (**Phase 86**). **`ClickableRow`** ignores clicks that originate on nested **`button`** / **`a`** / **`[data-pqat-row-no-activate]`** so copy does not flip navigator selection. **`nodeReferenceText`** / **finding** / **hotspot** copies prepend **`PQAT analysis: <id>`** when scope is known; **share link** copy uses a **multi-line** block (**URL** + **`PQAT analysis:`** + optional **`Node:`**) via **`analyzeDeepLinkClipboardPayload`**. **Optimization suggestions** use **`suggestionReferenceText`** (legacy string **`analysisId`** or structured context). Playwright smoke records payloads from **`writeText`** and **`execCommand('copy')`** and asserts **node reference**, **suggestion ticket copy**, **Analyze share link** (**`PQAT analysis:`**), **suggested EXPLAIN**, **Compare pair reference**, **Compare deep link**, and **Compare suggestion Copy for ticket** blocks (**Phase 87**). Backend **`PostgresJsonAnalyzeFixtureSweepTests`** exercises the full **`PlanAnalysisService`** pipeline over every top-level **`fixtures/postgres-json/*.json`** (see [Fixtures](fixtures.md)).

See [Capturing EXPLAIN JSON](capturing-explain-json.md) for recommended commands, share-link behavior, and normalizer caveats.

## Analyze workspace (Phase 39 + Phase 42)

After **Analyze** succeeds, the page is organized as an **investigation workstation** instead of one long vertical stack:

1. **Input / actions** — paste, suggested EXPLAIN, **Analyze**, exports, optional **Sharing** when auth is enabled.
2. **Summary + metadata** — compact summary line, **Plan briefing** (Phase 60–64 + **82** + **83**: story lanes use human-first labels—**what the plan is doing**, **where work piles up**, **what is driving cost**, **Start here** as an **ordered list** when **`inspectFirstSteps`** is present, else the legacy single paragraph). Step 1 may include **Focus in plan** when the backend attached **`focusNodeId`**. The path still points at ranked **Optimization suggestions** in the guide instead of pasting the top card (**Phase 82** dedup). **Markdown/HTML exports** mirror the structured list when steps exist (**Phase 83**). When source SQL mentions **`time_bucket`**, the index/shape lane may append a bounded analytical hint (feeds/scans vs finalize hop). **Plan source / EXPLAIN metadata** and share/artifact copy when applicable. **Phase 92:** canonical **`e2e-visual`** PNG for this story surface uses **`data-testid="analyze-visual-summary-contract"`** (metrics + **Plan briefing** block only), not the full card—see **`e2e/visual/README.md`**.
3. **Plan workspace** — the graph (or text tree) is the visual center. **Responsive tiers** (`useWorkspaceLayoutTier`): **narrow** (&lt;900px) stacks the guide **below** the graph; **medium** (900–1319px) keeps **graph + Plan guide** side-by-side with slightly different column weighting than **wide** (≥1320px), which gives the graph and investigation surface more horizontal room. **Phase 97:** on **medium/wide** when the guide is visible, the workspace grid row uses **`pqat-analyzeWorkspaceRow--paired`** so the **Plan workspace** panel and **Plan guide** share the **same row height** (no short capped rail beside a tall graph). The guide uses **`besideWorkspace`** chrome: fixed **Companion / Plan guide** header, **`overflow-y: auto`** on the body; the graph can **`flex`** to fill the remaining column height (`**graphFillColumn**` on **`AnalyzePlanGraphCore`**). **Narrow** keeps **`stacked`** rail behavior with a bounded **`max-height`** scroll on the whole aside. The **left** column holds plan mode toggles, search boxes, fit/focus/reset, and the tree or graph; the **right** column (when visible) is the **Plan guide** rail with:
   - **Focused operator** readout when a node is selected: human-readable title, **Phase 63–64** backend **`operatorBriefingLine`**, **Phase 82** **Bottleneck posture** strip when this node appears on a ranked bottleneck (primary vs stacked rank + class chip + headline), join/branch subtitle when applicable, metrics, longer **What this operator is doing** interpretation, findings cue, and a collapsed **Technical id** for the canonical planner path
   - **Plan narrative** — **Orientation** lane: **`planStory.planOverview`**; **What happened** lane: clamped `narrative.whatHappened`; **Propagation & flow** lane: propagation beats with **Focus** (human **`anchorLabel`**, not a raw path)
   - **Main bottlenecks** (Phase 58–62) — triage-style cards: rank + class + kind + cause chips, headline/detail, optional symptom (nested-loop inner **or** hash-build side when inferable) and propagation line; **`humanAnchorLabel`** drives **Focus**. **Phase 67:** **`OperatorNarrativeHelper`** enriches **nested-loop** bottleneck copy when the **inner child** shows high **`Actual Loops`** (especially **Seq Scan** on the inner relation), and inner-side symptom notes call out **repeated inner execution** with measured loop counts. **Phase 68–71 (Compare-facing):** when you compare **before/after** plans, the same **Sort** / **Seq Scan** / **Index Scan** / **bitmap** / **index-only** / **aggregate** / **gather-merge** anchors feed **`regionContinuityHint`**, **`regionContinuitySummaryCue`**, and optional **`continuityKindKey`** on mapped pairs—Analyze copy is unchanged, but saved comparisons benefit from the richer **access-path**, **ordering** (including **query-text ORDER BY** tie-breaks), **GROUP BY / time_bucket**-bounded SQL hints for grouping continuity, and **output-shaping** continuity described in [Compare workflow](compare-workflow.md).
   - **Where to inspect next** — **Phase 82:** short pointer to **Snapshot → Plan briefing → Start here** (full numbered text is not duplicated here), then **hotspot** rows (click/keyboard selects the node; **Copy** stays separate)
   - **Top findings** — a compact preview (not a replacement for the full list below)
   - **Next steps** — a short preview of the top **optimization suggestions**; full ranked cards (priority → confidence, **Try first** styling, **Strongest next experiment** callout) live in the lower workspace (**Phase 82**). Cards linked to a bottleneck show a **Bottleneck #N** chip that jumps to the bottleneck anchor in the plan (**Phase 83**), plus the **Because of bottleneck** line when it resolves.
   - **Source query** — optional, folded in a `<details>` block in the rail when query text exists

   On **narrow** viewports the rail **stacks under** the graph so the flow remains a single column.

   **Phase 98:** In **`besideWorkspace`** mode, when **Selection snapshot** is part of the guide (**`selection`** in **`guideSectionOrder`**), the **Focused operator** block is rendered in **`pqat-planGuideRail__stickyBand`** between the **Plan guide** title and the scrollable body so the live selection readout stays visible while narrative, bottlenecks, and lower sections scroll.

   **Phase 99:** **Text** plan mode uses **`pqat-planTextTreeBand`** when the workspace is **paired** with the guide—a bounded-height, bordered scroll surface so the tree occupies the shared row like the graph canvas. The scrollable guide body is named **`Plan guide — scrollable sections`** for assistive tech when **`besideWorkspace`**. **Phase 100:** **`flex: 1 1 0`** on the text band improves flex sizing inside the shared paired row.

4. **Findings, suggestions, and selected node** — below the plan workspace, a second band keeps the **full findings** list on one side and the **full optimization suggestions** plus **selected node** detail on the other. The **Selected node** panel shows the primary label, **Phase 63–64** **`operatorBriefingLine`** when present, then an operator-level **What this operator is doing** readout when `operatorInterpretation` is present (Phase 59, derived from `OperatorNarrativeHelper`), then cues and actions; the heaviest blocks load as a **lazy sub-chunk** (Phase 45). **Plan guide · Main bottlenecks** cards (**Phase 64**) repeat the same **`operatorBriefingLine`** under a **Briefing** kicker when the backend attached it. **Optimization suggestions** may show a **Because of bottleneck** line when `relatedBottleneckInsightIds` resolves to a ranked bottleneck. Within the lazy chunk, **`<details>`** still progressive-discloses **operator context**, **workers**, raw JSON, and metrics.

The graph panel uses a **viewport-relative height** when the guide is hidden or on **narrow** (clamped min/max) so small plans do not leave a huge empty band under the canvas; when **paired** with the guide, the canvas **grows with the shared row** instead of stopping short while the rail was previously **`max-height`**-capped (**Phase 97**). Graph behavior (search highlight, collapse, fit, focus, URL **`?node=`** sync, copy reference/link) is unchanged in intent.

## Workstation presentation (Phase 55)

- **Empty capture:** “Ready to analyze” lead-in plus short guidance before the first run.
- **Errors / reopen:** Banners classify **access denied**, **artifact corrupt / schema mismatch** (422/409), and generic failures; persisted loads use a dashed **loading** banner.
- **Summary deck:** The snapshot card uses a top **signal strip** (accent gradient), **`Outfit`** + **IBM Plex Sans** typography (see `index.html`), and the same metric grid rhythm as before.
- **Findings:** Selected rows prefer a **left accent bar** (`ClickableRow` **`accent-bar`**) instead of only a flat fill.
- **Suggestions:** **Try next** is the primary signal line when it adds information beyond the summary; chips emphasize **priority** and **confidence**, with a scan-friendly **action lane** (experiment / validate / shape). The top high-priority card is visually highlighted (**Phase 82**).
- **Sharing (auth):** **Sharing & access** is a framed **`<details>`** with **`pqat-*`** form controls and an inline **info** strip summarizing **`authHelp`** + Vite env hints.

Motion: light **fade-in** on heavy panels and banners; **`prefers-reduced-motion: reduce`** disables shimmer/fade loops globally (`index.css`).

## Appearance / theme (Phase 65–66)

- **Top bar → Theme appearance:** **System** (default), **Dark**, or **Light**. **System** shows a compact **→ Dark** / **→ Light** hint for the **resolved** skin and exposes screen-reader text via **`aria-describedby`**. **System** tracks **`prefers-color-scheme`** live (not frozen at first load).
- **Persistence:** **localStorage** key **`pqat_theme_v1`**. When the API reports **`authEnabled: true`** and the SPA is built with **`VITE_AUTH_*`** credentials, the same preference string is also stored under **`/api/me/preferences/appearance_theme_v1`** (debounced **PUT** after changes, **GET** hydrate on load — same mechanism as workspace layout keys). Non-auth deployments stay local-only.
- **Rendering:** **`html[data-theme]`** is the skin selector for CSS; **`html[data-effective-theme]`** duplicates the resolved value as a stable test/debug hook. The **`index.html`** boot script sets both before React hydrates.
- **Readouts:** Plan briefing, bottlenecks, selected-node **Briefing**, story lanes, join badges, and banners use shared **`--pqat-*`** tokens so hierarchy stays clear in both skins.
- **Testing:** Playwright **`e2e/theme-appearance.spec.ts`** runs under **`e2e-smoke`** and checks **`data-theme-preference`**, **`data-effective-theme`**, reload persistence, and **`emulateMedia`** behavior for **System**.

## Visual hierarchy (Phase 43)

Regions use a shared workstation style: **capture** and **summary** panels read as lighter “chrome”; **plan workspace** is the elevated investigation surface; **findings** and **selected node** use detail panels with clearer typography rungs; severity and confidence appear as **chips**; the **Plan guide** rail is visually distinct from the graph column. This does not change analysis behavior or layout persistence.

## Delivery & patterns (Phase 44)

The **Analyze** route is **code-split** (`React.lazy` + `Suspense`); the shell shows a short **Loading Analyze…** placeholder while the page chunk loads. **`workstation-patterns.css`** groups dense layout utilities (form grids, capture stack, route fallback) so **`workstation.css`** stays focused on core controls. **Customize workspace** loads the **drag-and-drop** reorder lists only after you first open the **`<details>`** (further shrinking the initial Analyze chunk until customization is needed).

## Progressive loading & performance (Phase 45)

After the route chunk loads, the page still **stages** heavy UI:

1. **Graph vs text** — In **Text** mode, the **React Flow** bundle is not required; switching to **Graph** loads **`AnalyzePlanGraphCore`** behind **`PlanGraphSkeleton`**. The tool **prefetches** that chunk on **Graph** hover/focus and on **idle** when you are already in graph mode so the first paint of the canvas is usually quick.
2. **Lower band** — **Findings**, **optimization suggestions**, and **selected node** are separate **lazy** modules with a shared **`LowerBandPanelSkeleton`** (**`HeavyPanelShell`**) so capture + summary + plan workspace can appear before those panels’ JS parses.
3. **Long lists** — Findings and optimization suggestions use **`VirtualizedListColumn`** (**`@tanstack/react-virtual`**) when the filtered list is long (short lists stay a simple column; row heights can grow when **Evidence** `<details>` expand). **Phase 48:** when optimization suggestions are **grouped by family**, long lists **flatten** into virtual rows (**section header** + **card**) so family subheadings are not skipped; **`getItemSize`** supplies shorter estimates for header rows than cards.
4. **Selected node** — The panel header (label, worker cue, index insight, copy actions) renders first; **operator context**, **buffer I/O**, **workers** grid, **raw JSON**, **metrics JSON**, and the **findings-for-node** bullet list live in **`AnalyzeSelectedNodeHeavySections`**, loaded lazily with an inline skeleton.

URL sync (**`?node=`**), selection, and copy behavior are unchanged; tests preload graph and lower-band modules in **`setup.ts`** so jsdom does not stick on **Suspense** fallbacks.

## Customize workspace (Phase 40 + Phase 42)

The Analyze UI is split into **typed panels** (capture, summary, plan workspace, plan guide, findings, optimization suggestions, selected node). Use **Customize workspace** (under **Plan workspace**) to:

- **Presets:** **Balanced** (default), **Wide graph** (hides plan guide rail), **Reviewer** (findings → selected node → suggestions in the lower band), **Focus** (hides suggestions region), **Detail** (suggestions before findings), **Compact** (hides summary, guide, and suggestions for a denser tree-first view).
- **Visibility:** show or hide each major panel. If **plan capture** is hidden, a **Show input** strip appears so you can recover it.
- **Plan guide section order:** **drag** the handle or use **Up/Down** to reorder blocks (selection snapshot, what happened, **main bottlenecks**, hotspots, top findings, next steps, source query).
- **Lower band column order:** same **drag** + **Up/Down** pattern for **findings**, **optimization suggestions**, and **selected node**; wide screens show columns side-by-side, medium/narrow wrap or stack by tier.

**Persistence:** layout is stored in **`localStorage`** under **`pqat.analyzeWorkspaceLayout.v1`** (versioned JSON). When the API reports **`authEnabled`** and the SPA is built with **`VITE_AUTH_API_KEY`** or **`VITE_AUTH_BEARER_TOKEN`**, the same layout is **loaded from and saved to** **`GET`/`PUT /api/me/preferences/analyze_workspace_v1`** after hydrate (debounced saves). If auth is off or the request fails, **local layout still applies**.

Implementation reference: `src/frontend/web/src/analyzeWorkspace/*`, `src/frontend/web/src/components/analyze/*`, slim **`AnalyzePage.tsx`** orchestration.

## Reading the results

### Hotspots (“Where to inspect next”)

Hotspots are rendered as clickable items that select the corresponding node. On desktop they also appear in the **Plan guide** rail beside the graph (see above) so guidance stays next to the plan view.

- **exclusive runtime**: local operator work dominating time
- **subtree runtime**: work dominated by descendants
- **shared reads**: I/O hotspots (requires `BUFFERS` in the input JSON)

PostgreSQL includes buffer counters as **flat** properties on each plan node in JSON (for example `"Shared Read Blocks"`, `"Temp Written Blocks"`), not only under a nested `"Buffers"` object. The parser accepts both shapes. Per-worker buffer lines under a `"Workers"` array are merged onto the parent node when the leader omits those totals, so `summary.hasBuffers` and read hotspots can still light up for parallel plans. The same `Workers` entries are also preserved as a typed `workers` list on that node in the API response (per-worker timing, rows, loops, and buffer counters), separate from the parent’s aggregate fields when PostgreSQL provides both.

Each hotspot row also includes a subtle **Copy** action that copies a concise, human-readable node reference (optionally annotated as a hotspot).

**Interaction model:** the row is one keyboard-focusable target (click or Enter/Space) to select the node. **Copy** is a separate button so the row is not nested invalid markup.

### Findings

Findings are ranked by severity/confidence and tied to nodes. Use the node anchor label to jump into the plan tree.

Finding rows also include a subtle **Copy** action that copies a concise human-readable reference for the anchored node (optionally suffixed with the finding title).

**Interaction model:** same as hotspots—the row selects the anchor node; **Copy** is a separate control.

**Index tuning:** findings and structured `indexInsights` distinguish (a) **likely missing / worth-investigating index** on selective seq scans (F, J), (b) **index or bitmap path still heavy** (R), (c) **bitmap recheck** review (S), (d) **chunked bitmap + Append** workloads where indexes likely exist but aggregate I/O stays large (P), (e) **nested-loop inner** index alignment (Q, and E for high amplification), and (f) **sort** hotspots with optional order/index hints (K). None of these assert a specific DDL.

### Optimization suggestions (Phase 32 + Phase 47)

**Findings** explain *what looks wrong* and attach evidence. **`optimizationSuggestions`** are a separate, ranked list of *investigation-oriented next steps*: index experiments, query-shape or ordering ideas, statistics maintenance, join/hash/sort volume reductions, parallelism skew checks, Timescale/chunk workload guidance, and explicit “observe before change” validation.

- Suggestions are **evidence-linked** (`relatedFindingIds`, `relatedIndexInsightNodeIds`, `targetNodeIds`) and include **`suggestionId`** values with the **`sg_`** prefix (deterministic content hash). Compare-only payloads may also include **`relatedFindingDiffIds`** / **`relatedIndexInsightDiffIds`** on suggestions. Fields include **confidence**, **priority**, **cautions**, and **validation steps**.
- **Phase 47 — human-readable payload:** each suggestion also carries **`suggestionFamily`** (UI grouping: index experiments, query shape & ordering, statistics & planner accuracy, schema & workload shape, operational tuning & validation), **`recommendedNextAction`** (short imperative), **`whyItMatters`** (plain impact), optional **`targetDisplayLabel`** (human operator/relation phrasing—avoid raw node paths in primary copy), and **`isGroupedCluster`** when multiple overlapping statistics-style findings were **consolidated** into one card. **Title** and **summary** stay user-facing; **details** / **rationale** hold denser evidence.
- They are **not prescriptions**: the tool does not emit guaranteed `CREATE INDEX` DDL. Language stays conservative (especially for **P** chunked-bitmap plans, where naive “add another index” advice is suppressed in favor of window pruning, ordering, aggregates, and retention-style investigation).
- The **Plan guide** rail shows a **preview** of top suggestions (family · confidence · priority, summary, **Next ·** line when present, **Focus …** using **`targetDisplayLabel`** when the API provides it). The **full** list in the lower band uses **separate metadata chips** (readable phrases like “High confidence”, not `Confidence: high` jammed into titles). Long lists may show **family subheadings** when that improves scanability; validation lines are phrased as experiments, not boilerplate. **Phase 48:** **`normalizeOptimizationSuggestionsForDisplay`** backfills missing Phase 47 fields when reopening **older stored** analyses (family inferred from category, **Next** / **Why** from validation/rationale, **`targetDisplayLabel`** from the first target node id when absent)—no forced re-analyze.
- The **Selected node** panel may show the **strongest related suggestion** when any suggestion lists that `nodeId` in `targetNodeIds` (title, summary, and **Next ·** when present).

### Plan index posture (summary card)

After analyze, the summary card can show an **Index posture** line from `indexOverview`: scan mix (seq vs index vs bitmap counts) or, for Append + many bitmap heaps, an explicit note that **per-chunk index use may already be happening** while total reads/temp work can still dominate.

### Selected node

The **selection snapshot** in the Plan guide rail gives an immediate, compact readout when you click the graph, hotspots, findings, or suggestions. The **full** selected node panel (lower section) shows:

- human-readable label
- join/branch subtitle when applicable
- optional side-aware context line when supported by evidence
- **Copy reference** (human-readable node text) and **Copy link** (full URL with `?node=<nodeId>` for the current selection). **Phase 34:** the address bar stays in sync: selecting a node updates `?node=` (replace history, deduped), loading a URL with a valid `node=` restores selection after analyze, and browser back/forward updates the selected node when the id still exists in the current result.
- **Related optimization suggestion** (when a ranked `optimizationSuggestions` entry targets this `nodeId`): title, summary, and optional **Next ·** line, to avoid duplicating the full suggestions list
- **Access path / index insight** (when `indexInsights` entries target this `nodeId`): compact headline, access-path family, and signal kinds (investigation-oriented, not prescriptions)
- **Buffer I/O**: when this node has any shared/local/temp buffer counters in the API payload (including explicit zeros), a short labeled list is shown above the raw JSON dump; if the plan has buffers elsewhere but this operator has none, a one-line hint explains that
- **Workers** (parallel plans): when the node has a non-empty `workers` array, a one-line **worker summary** (count and conservative read/time/temp cues when applicable) plus a compact per-worker grid (worker id, total time, rows, shared hit/read, temp read/write). Parent row buffer/timing fields remain the leader aggregate when PostgreSQL reports them; worker rows are the explicit slice from `EXPLAIN` JSON, not double-counted into summaries.
- key raw fields and derived metrics

## Limits and honesty

- Missing timing reduces time-based hotspot fidelity; missing buffer counters reduce read-based hotspots. `summary.hasBuffers` is true when **any** parsed shared/local/temp buffer field is present on **any** node (null means absent; zero still counts as present).
- Query text is passed through and displayed; the tool does not claim exact SQL-to-plan mapping.

After **Analyze**, the compact **summary** line under the input includes node count, max depth, **severe findings count** (from the backend summary), whether actual timing and buffers were present, **`summary.plannerCosts`** (detected from JSON: `present` / `notDetected` / `mixed` / `unknown`), and any **warnings** when the engine reports limitations. When the request used **`planText`**, the API may include **`planInputNormalization`**; the UI shows a one-line note (**Parsed raw JSON directly** vs **Normalized pasted QUERY PLAN output**). Copy actions use **share-link** wording in non-auth mode and **artifact link** wording when the server reports auth enabled; invalid or missing **`analysis=`** links show a clear error (including **access denied** in auth mode). When auth is enabled, an optional **Sharing** panel can adjust scope and link access (owner-only). **Phase 38:** production deployments should use **`JwtBearer`** (owner = JWT **`sub`**) or **`ApiKey`** (mapped user id); legacy **`BearerSubject`** stores the entire bearer string as owner—see [Deployment & auth](deployment-auth.md).

### Plan source / EXPLAIN metadata (Phase 34)

Below the summary line, a short **Plan source / EXPLAIN metadata** block lists:

- whether **source query** text was provided
- **planner costs** detection (independent of declared EXPLAIN options)
- **declared options** from `explainMetadata.options` when the client sent them
- optional **recorded EXPLAIN command** text when provided

This is separate from findings: it documents *how the plan was captured*, not *what the plan did wrong*.

## Graphical tree view

Use the **Graph** toggle under “Plan tree” to view the execution plan as a readable, pan/zoom-able tree in the **left** column of the plan workspace (full width on small screens). Nodes are clickable and stay in sync with:

- hotspot clicks
- findings list clicks
- selected node detail panel

### Graph controls

- **Fit**: fit the whole plan into view
- **Focus**: center on the currently selected node
- **Reset**: reset viewport to default

### Graph search (highlight, not filter)

Use “Graph search” to highlight nodes by operator/relation/index text:

- matches are highlighted
- non-matches are dimmed
- use **prev/next** to jump between matches (updates selection + focus)
- a **match list** appears under the search box; click an entry to quick-jump
- if a match is hidden under a collapsed branch, the graph auto-expands the necessary ancestors

### Subtree collapse/expand

Click the `▾` control on a node to collapse its descendants. Collapsed nodes remain visible and marked; descendants are hidden until expanded.
