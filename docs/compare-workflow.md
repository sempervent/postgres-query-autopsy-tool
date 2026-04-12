# Compare Workflow

## Example entry & triage (Phase 107)

- **Try a sample pair:** **`TryCompareExampleChips`** in capture (until a comparison exists) and **Compare** guide loads curated fixtures from **`src/examples/plans/`**; **`onCompare(overrideA?, overrideB?)`** passes fresh text into **`compareWithPlanTexts`**.
- **Summary:** **Start here** band surfaces **`comparisonStory.overview`** once; the long wall-clock vs structure paragraph is under **details**; **Next steps** pinning explanation is shortened with optional **details**; metric meta line uses **saved in this app’s database** instead of “server SQLite” on the user-facing string.
- **Empty state:** **`compareEmptyStateCopy`** points at samples + **?** tour.

### Phase 108 — scan-first Compare, second sample, diff strip

- **Samples:** Two pairs — **seq scan → index scan** and **bitmap heap → index scan** (see **`src/examples/README.md`**).
- **Lead:** **`compareLeadTakeaway`** headline is **Change at a glance**; **`compareFollowUpDiffSignals`** renders **`compare-scan-signals`** (**Also scan**) with **Highlight in diffs** buttons (pins **`fd_*`** via existing highlight state).
- **Disclosure:** **Walkthrough** + **structural readout** paragraphs are behind **Walkthrough and structural readout** **`<details>`** by default.

### Phase 110 — selected-pair bridge, Show row proof, calmer meta copy

- **Selected pair:** **`compareTriagePairBridgeLine`** renders a one-line bridge when the pair matches pins or **top worsened / top improved** (Phase **111** renames the label to **Context** and extends the bridge—see below).
- **Scan strip:** **Show in list** (was **Show row**) is covered by Playwright (**active** finding-diff outline **in viewport**).
- **Copy:** Summary meta and lanes hint use clearer “saved snapshot / who can open” wording.

### Phase 111 — decision rhythm, briefing → row → pair

- **Bridge:** **`compareTriagePairBridgeLine`** also matches **`comparisonStory.changeBeats`** pair focus (**Open pair** from the story) before falling back to top worsened/improved.
- **Navigator:** **`briefingHighlightPair`** adds **Same row as Change briefing** on worsened/improved rows when a finding diff is highlighted from the scan strip; finding-diff rows show **Highlighted from Change briefing** when active.
- **Selected pair:** Bridge label **Context**; follow-up block **Suggested follow-up** with **`pqat-comparePairNextStep`** visual chain from bridge to next step.
- **Navigator filter:** **Open top regression** (was **jump to hottest**).

### Phase 131 — pair thread hint (Analyze parity)

- **Handoff:** **`ComparePage`** derives **`comparePairHandoffKind`** (**`summary`** | **`briefing`** | **`pinned`** | **`navigator`**) from triage bridge, continuity fallback, URL pins, or default list selection.
- **UI:** **`CompareSelectedPairPanel`** shows **Pair** eyebrow + compact hint; **`data-testid="compare-visual-pair-continuation-contract"`** for **`e2e-visual`**. (Phase **133** refines visible copy for saved-link reopen and region **`aria-describedby`** — see below.)
- **Analyze:** Ranked header uses **Continues from plan** (no repeated operator mono); row **Opened from detail** cue removed when the header band is present; visual contract **`analyze-visual-ranked-continuation-contract`**.

### Phase 132 — responsive continuity, saved-link handoff copy, structural contracts

- **Compare handoff origin:** **`compareHandoffOrigin`** — **`link`** when the comparison is loaded via **`getComparison`** (**`/compare?comparison=…`**), **`session`** after **Compare** runs from plan text in this tab (**`onCompare`**). Drives **`comparePairHandoffDisplayText`** (session strings: **From the summary**, **From the briefing**, **Pinned focus**, **From the lists** — Phase **134** refines **`link`** + **pinned**/**navigator**; see Phase **133–134**).
- **Narrow layout:** **`layoutTier === 'narrow'`** always stacks **navigator** above **pair** in the DOM (reading + tab order), independent of **`mainColumnOrder`** (medium/wide still respect column order).
- **UI:** Continuation band **`role="region"`** + **`aria-labelledby`** on **`compare-selected-pair-heading`**; **`data-testid="compare-pair-handoff-hint"`** + **`data-pqat-handoff-origin`** (**`link`** \| **`session`**). **Phase 133** adds **`aria-describedby`** on the region (hint id) and visible **— reopened** wording for **summary**/**briefing** when **`link`**.
- **Analyze narrow:** Lower band maps in **findings → suggestions → selected node** order when stacked; ranked continuation contract **`role="region"`** + **`aria-labelledby`**, **`analyze-ranked-handoff-hint`** test id.

### Phase 133 — legible reopen provenance, narrow skip-to-pair, calmer region announcements

- **Visible handoff (saved link):** **`comparePairHandoffDisplayText`** uses **Summary — reopened** / **Briefing — reopened** when **`compareHandoffOrigin === 'link'`** and the handoff kind is **`summary`** / **`briefing`**; session paths stay **From the summary** / **From the briefing**. **Pinned** / **navigator** + **`link`** were later aligned to **Pinned — reopened** / **From the lists — reopened** (Phase **134**).
- **Narrow keyboard path:** **`SkipToPairInspectorLink`** (**Skip to pair inspector**) between **navigator** and **pair** when **`layoutTier === 'narrow'`**; target **`#compare-pair-inspector-region`** (**`tabIndex={-1}`** on **`ComparePairColumn`** root) — same pattern as Analyze **Skip to ranked findings**.
- **Continuation a11y:** Pair continuation **`role="region"`** uses **`aria-labelledby="compare-selected-pair-heading"`** + **`aria-describedby`** → thread hint id only (hint not duplicated on **`h2`**). Analyze pivot band: inner contract **`aria-describedby`** → **`analyze-ranked-handoff-hint`** id; **`h2`** does not also describe the thread hint when arrival cue is off.
- **Tests:** Playwright reopen asserts **`toContainText(/Summary — reopened/)`** on **`compare-pair-handoff-hint`** for restored **`?comparison=`** / deep link; corrupt-analysis visual seed uses **retry** on **`POST /api/e2e/seed/corrupt-analysis`**.

### Phase 134 — Analyze reopened ranked cues, narrow Compare keyboard proof, handoff matrix

- **Analyze:** **`analyzeRankedHandoffOrigin`** on **`AnalyzePage`** (**`link`** after **`getAnalysis`**, **`session`** on **`onAnalyze`** / **Clear**). **`analyzeRankedContinuityCopy`**: non-pivot band **`Ranked — reopened`** (**`analyze-ranked-restored-hint`**); graph pivot thread **Continues from plan — reopened** when **`link`**. Ranked root **`aria-describedby`** → restored hint id when the band hint is shown.
- **Compare copy:** **`link`** + **pinned** / **navigator** → **Pinned — reopened** / **From the lists — reopened** (same **— reopened** family as Analyze + summary/briefing).
- **E2E:** **`viewport` 800px** — **Tab** path **`focus()`** + **`Enter`** on **Skip to pair inspector** → **`#compare-pair-inspector-region`** focused; Analyze reopen + pivot proves **Ranked — reopened** then **Continues from plan — reopened**; reopen→export asserts **Ranked — reopened**.
- **Vitest:** **`analyzeRankedContinuityCopy.test.ts`**; **`CompareSelectedPairPanel`** matrix (**briefing** / **pinned** / **navigator** + **`link`**); **`AnalyzeFindingsPanel.virtual`** restored + pivot **`link`**.

### Phase 135 — Broader handoff proof, Tab-chain skip, shared reopened copy, matrix doc

- **Shared suffix:** **`withReopenedSuffix`** in **`reopenedContinuityCopy.ts`** — single place for **`… — reopened`** used by **`comparePairHandoffDisplayText`** and **`analyzeRankedContinuityCopy`**.
- **Export:** **`exportDownloadSuccessHint(..., { restoredFromLink })`** when snapshot export follows a saved **`?analysis=`** / **`?comparison=`** load (aligned with reopened cues).
- **Pair panel cue gate:** **`compareContinuityCueIsSpecific`** treats **join strategy shift** / **join strategy** phrases as specific so short engine cues like **Same region · join strategy shift** can drive the soft **Reading thread** panel (**`compare-selected-pair-continuity-fallback`**) and the **`briefing`** handoff thread (multi-pair compares only).
- **E2E:** **Briefing — reopened** — real compare on **`rewrite_nl_orders_lineitems`** + **`rewrite_hash_orders_lineitems`** (synced into **`e2e/fixtures`**), scan **Worsened** / **Improved** rows until the soft continuity panel is visible without the **Context** summary bridge, assert **From the briefing**, persist URL, reopen and assert **Briefing — reopened** + continuity fallback visible; narrow Compare **Tab** from first **Worsened pair** row until **`compare-skip-to-pair-inspector`** focused, then **`Enter`** → **`#compare-pair-inspector-region`** focused.

### Phase 136 — Analyze URL stability, lists handoff proof, cue rules table

- **Analyze:** deep-link query sync (**`?analysis=`** / **`node=`**) runs in **`useLayoutEffect`** so the address bar matches the committed analysis before paint; Playwright waits on **`toHaveURL(/analysis=/)`** before reading **`page.url()`** on persist/reopen flows.
- **Compare E2E:** **From the lists — reopened** on **nested loop amplification ↔ misestimation** fixtures (no per-pair continuity cues; navigator-only row, then **`?comparison=`** reopen).
- **Cue gating:** **`compareContinuityCueSpecificity.ts`** + **`COMPARE_CONTINUITY_CUE_CLASSIFICATION_FIXTURES`** golden table (**`compareContinuityCueSpecificity.test.ts`**); **`compareOutputGuidance`** re-exports **`compareContinuityCueIsSpecific`**.
- **Docs:** handoff-kind vs **Context** / **Reading thread** footnote under the pair-thread matrix (this section).

**Compare pair thread (user-visible, `compare-pair-handoff-hint`)**

| Kind | Session | Saved link (`compareHandoffOrigin === 'link'`) |
|------|---------|-----------------------------------------------|
| **summary** | From the summary | Summary — reopened |
| **briefing** | From the briefing | Briefing — reopened |
| **pinned** | Pinned focus | Pinned — reopened |
| **navigator** | From the lists | From the lists — reopened |

**Handoff kind vs pair context (Phase 136, contributor QA):**

- **`summary`**: **`compareTriagePairBridgeLine`** returned a **Context** line (top worsened/improved, story beat, or URL pin that maps to this pair) — not the soft **Reading thread** panel.
- **`briefing`**: no Context bridge, but **`regionContinuitySummaryCue`** passed **`compareContinuityCueIsSpecific`** → soft **`compare-selected-pair-continuity-fallback`** (**Reading thread** body). Needs a pair with a cue; on single-pair compares the only row is often “top worsened” → **`summary`** instead.
- **`navigator`**: no Context bridge, no qualifying cue (or cue filtered as non-specific), no URL pins → **From the lists**.
- **`pinned`**: a **`finding=`** / **`suggestion=`** / **`indexDiff=`** pin is active and the Context bridge from pins does not override (see **`comparePairHandoffKind`** in **`ComparePage`**).

**Analyze Ranked (`analyze-ranked-handoff-hint` / `analyze-ranked-restored-hint`)**

| Surface | Session | Saved link |
|---------|---------|------------|
| Graph pivot thread | Continues from plan | Continues from plan — reopened |
| Ranked band (no pivot) | _(no reopened band)_ | Ranked — reopened |

### Phase 112 — URL/summary bridge, reading-thread language, export parity

- **Summary cue:** Change briefing meta uses **Reading thread ·** (replaces **Continuity ·**) so tone matches **Context** on the pair panel.
- **Selected pair:** When **`compareTriagePairBridgeLine`** is empty but the summary still has a **`continuitySummaryCue`**, **`continuityPairFallback`** shows a soft **Reading thread** note (**`compare-selected-pair-continuity-fallback`**) so deep-link / URL-only emphasis still reads as one thread.
- **Bridge copy:** **`compareOutputGuidance`** uses **highlighted** phrasing for finding / index / suggestion URL-driven lines.
- **Clipboard:** Pinned-summary line label is **Link includes:** (**`formatComparePinnedSummaryLine`** in **`artifactLinks.ts`**).

### Phase 113 — Compare export triage, guided cohesion, continuity proof

- **Download:** With both plan texts in **Plan inputs**, **Export Markdown / HTML / JSON** calls **`/api/compare/report/*`** and prepends/injects **`compareExportTriage.ts`** (**Reading thread** block: change lead + optional pair id).

### Phase 115 — Reopen→export confidence, server reading thread, calmer trust states

- **Exports:** Server-rendered Markdown/HTML include **`## Reading thread`** / **Change at a glance** (compact lead from the change story or top finding diff). The client adds **Selection context** only when the UI has a pair bridge or primary pair id—no duplicate “full preamble” vs server.
- **Reopen→export:** Playwright proves **`?comparison=`** reopen with empty plan boxes → **Markdown** download → request body contains **`comparison`** snapshot; file contains server **Reading thread** markers.
- **Trust copy:** Compare/Analyze loading banners, artifact error titles, export success hint, Compare **Running comparison** banner.
- **Export UX:** **`compare-export-snapshot-cue`** when exports use loaded snapshot; post-export status line.

### Phase 116 — Export trust, Analyze reopen parity, clearer failures

- **Serializer alignment:** **`ArtifactPersistenceJson.ApplyToHttpSerializerOptions`** applies persistence **`JsonSerializerOptions`** to **`ConfigureHttpJsonOptions`** so report POST bodies cannot silently drift from SQLite JSON (**duplicate** custom converters are skipped if the helper runs twice).
- **Compare continuity:** **`compareContinuityCueIsSpecific`** treats very short vague tokens (**mixed**, **unclear**, **varies**, …) as non-specific so weak **Reading thread** fallback panels stay hidden.
- **Analyze parity:** Reopen→export browser proof and capture **Download** UX live in [Analyze workflow](analyze-workflow.md) (**`analyze-export-snapshot-cue`**, **`formatApiErrorResponse`** for export failures).

### Phase 117 — Clearer export failures, Compare parity, quieter guidance

- **Report API:** **`/api/compare/report/*`** shares the same **400** JSON contract as Analyze report routes (**`request_body_invalid`** / **`export_request_incomplete`**); see [API & Reports](api-and-reports.md#reports).
- **Export UX:** Compare **Download** success copy matches Analyze (**Saved result exported…** when both plan boxes are empty and a snapshot drives the export; otherwise **Download started…**). **`compare-export-status`** uses **`aria-live="polite"`** + **`aria-atomic="true"`**; capture hint text is slightly tighter.
- **Trust:** **`formatApiErrorResponse`** maps the new codes to a single product **`message`** line (no **`error:`** prefix for those codes).

### Phase 118 — Stable export contracts, browser-proven trust, calmer sharing copy

- **Backend:** Analyze report semantic validation is **`ReportExportValidation`** + **`ReportExportBadRequestExceptionHandler`** (**ProblemDetails** for other failures). See [API & Reports](api-and-reports.md#reports).
- **Playwright:** **`Compare: reopen with empty plan inputs exports HTML using snapshot payload`** proves snapshot **`POST /api/compare/report/html`** (not only markdown).
- **Sharing / auth help:** **`ArtifactSharingPanel`** titles and fine print are more product-facing.

### Phase 119 — Take-with-you export, JSON parity, calmer success

- **Capture:** Eyebrow **Take with you**; shorter snapshot vs paste hints; format button **`title`**s.
- **Parity:** Playwright **`Compare: reopen with empty plan inputs exports JSON using snapshot payload`** (**`POST /api/compare/report/json`**). **Analyze** gains reopen→**HTML** proof in [Analyze workflow](analyze-workflow.md).
- **Sharing:** Save confirmation **Sharing updated.**

### Phase 120 — Analyze JSON parity, Take-with-you legend, sharing scope note

- **Analyze parity:** Playwright **`Analyze: reopen with empty plan input exports JSON using snapshot payload`** (**`POST /api/report/json`**) — closes the reopen→export matrix alongside markdown/HTML (Phase 119) and Compare JSON.
- **Take with you:** **`compare-export-format-legend`** one-liner (Markdown / HTML / JSON roles); **`compare-export-snapshot-cue`** tightened; **Ready** / **Started** export status lines.
- **Sharing:** **`artifact-sharing-effect-note`** + **Sharing saved…** (scope applies on next open) — aligned with [Analyze workflow](analyze-workflow.md).

### Phase 121 — Handoff surface, export voice, continuity cues

- **Take with you:** Same handoff pattern as [Analyze workflow](analyze-workflow.md) — **`pqat-handoffBand`**, **`compare-export-handoff-kicker`**, **`pqat-formatLegend`**, shared **`exportDownloadSuccessHint`** for export status.
- **Continuity:** **`compareContinuityCueIsSpecific`** / **`resolveComparePairFallbackDisplay`** — see **`compareOutputGuidance.test.ts`** (Phase 121 cases).

### Phase 114 — Reopen/export cohesion, landing proof, lower-noise guidance

- **Download:** If both plan fields are filled, the server **rebuilds** the report from that text; if not (typical **reopen from link**), the client sends **`{ comparison }`** to **`/api/compare/report/*`** so exports stay coherent without re-pasting plans. Per-format buttons show **Preparing…** only on the active download.
- **Pair fallback:** Short non-specific continuity cues no longer show a filler **Briefing link** panel—**Reading thread** still appears when the cue is structurally specific (**`compareContinuityCueIsSpecific`**).
- **Analyze guide echo:** **Overview** + **Also scan** path uses copy that does not pretend the rail is always the same **Start here** finding/step thread.
- **Playwright:** Long virtualized suggestions assert **viewport** + **scroller intersection** for the triage-aligned card (**`analyze-suggestion-card-triage-aligned`**), not only DOM presence.
- **Sharing / auth help:** Calmer titles (**Who can load this**, link checkbox wording).

### Phase 109 — compare triage deck, reliable scan actions, narrow stickiness

- **`compare-triage-deck`**: bounded **Change at a glance** + **Also scan** with **Show row** actions that scroll and highlight the target artifact (**`scrollArtifactIntoView`** centers the row).
- **Narrow:** **`summaryStickyNarrow`** keeps the summary triage block visible early when columns stack.
- **Density:** extra operator/lanes/index keyboard nuance remains behind **`<details>`** so the default path stays scannable.

## Input (Phase 36)

1. Paste **Plan A** and **Plan B** as **raw text** (plain JSON or `psql` **`QUERY PLAN`** output—same **`PlanInputNormalizer`** path as Analyze).
2. Optionally expand **Optional: source SQL + EXPLAIN metadata** to attach **`queryTextA` / `queryTextB`**, shared EXPLAIN toggles, per-side **recorded EXPLAIN** commands, and **suggested EXPLAIN** snippets (mirrors Analyze ergonomics). Metadata is **optional** and **client-declared**.
3. Click **Compare** — the API runs analyze twice (with per-side context), then the comparison engine. The full **`PlanComparisonResultV2`** is stored in **SQLite** with **`artifactSchemaVersion`** (Phase 49); the UI syncs **`?comparison=<comparisonId>`** with existing **`pair=`**, **`finding=`**, **`indexDiff=`**, **`suggestion=`** params.
4. **Reopen:** `GET /api/comparisons/{id}` powers **`?comparison=`** loads (same durability rules as analyses). Legacy **`suggestion=`** values may still match via **`alsoKnownAs`** on compare suggestion rows after server normalization—canonical **`suggestionId`** is written back into the URL when the UI syncs.
5. **Copy share link** / **Copy artifact link** in the summary header copies the current URL (includes **`comparison=`** when synced), labeled from **`/api/config`** in auth deployments. **Copy link** on the selected pair builds a **multi-line clipboard block** (URL + **`PQAT compare:`** + optional **`Pair ref:`** + optional **`Highlighted finding:`** / **`Highlighted index change:`** / **`Highlighted next step:`** when those URL highlights are active — **Phase 112** renames from older **Pinned …** wording) so tickets get stable ids without hunting the query string (**Phase 86**). When a pin is active, **Copy pin context** (**Phase 96**) copies the same ids **without the URL line** for short chat/ticket pastes (**Phase 112:** compact line uses **Link includes:**) — use **Copy link** when the recipient needs the **reopenable URL**; use **Copy pin context** when you only need **PQAT ids + pinned readout** (**Phase 97** clarifies the split). Optional **Sharing** panel when auth is enabled (owner can change scope / groups / link access). **Phase 38:** same identity modes as Analyze (**JWT** / **API key** / legacy bearer / proxy); **`authHelp`** from **`/api/config`** summarizes the active mode.

### Compare URL parameters (quick reference)

| Param | Role | When active (what to expect) |
|-------|------|------------------------------|
| **`comparison`** | Persisted snapshot id (**required** for reopen). | Workspace loads that comparison; other params apply on top. |
| **`pair`** | Selected **pair artifact** id (`pair_*`). | **Selected node pair** matches that artifact; **Copy link** includes **`Pair ref:`**. Removing **`pair=`** from the URL drops that explicit selection; the UI falls back to the current navigator choice or a default pair, and the sync effect rewrites the query string without **`pair=`** until you pin a pair again from the URL or UI. |
| **`finding`** | Highlights a **findings diff** row (`fd_*`). | Navigator finding row shows **active** outline; **Copy link** adds **`Highlighted finding:`**; scroll targets the row. |
| **`indexDiff`** | Highlights an **index insight diff** (`ii_*`). | **Index changes** row is **active**; click row in UI also pins (**Phase 95**); **Copy link** adds **`Highlighted index change:`**. |
| **`suggestion`** | Highlights a **compare next step** (`sg_*`). Values matching **`suggestionId`** or **`alsoKnownAs`** resolve to the same row; after hydrate the UI typically syncs the query string to the **canonical** `suggestionId`. The **settled** `sg_*` in the URL is the durable handle for reopen tests (**Phase 93–94**). | Next-step row highlighted; **Pin** or **Focus plan B** sets pins; **Copy link** adds **`Highlighted next step:`**. |

### URL params × first load vs in-place edit (Phase 101)

| Situation | `comparison` | `pair` / pins |
|-----------|--------------|----------------|
| **First open / paste URL** | Hydrates snapshot from server; guide may stay collapsed if **`comparison=`** present. | Parsed into selection + highlights; hydrate line in **`compare-pin-live`** when pins present. |
| **In-place URL edit (same snapshot)** | Unchanged id keeps data; **`useLayoutEffect`** reapplies **`parseCompareUrlPinAndPairState`**. | **`pair=`** removed → no valid URL pair → falls back to **`selectedPair`** or effective default; sync writes canonical params back. |
| **Clear / new Compare** | Param stripped; empty workspace. | All pair/pin params cleared. |

## In-product workflow guide (Phase 101)

- **Replaces** the old **`CompareIntroPanel`** (**`pqat-panel--capture`**) with **`CompareWorkflowGuide`** inside the same **guide** visual language as Analyze (teal rail, dotted border, instructional tone).
- **Toggle:** **`How to use Compare` / `Hide guide`** (always available). Default open when the page is empty depends on workspace **`intro`** visibility (**“Empty page: open workflow guide by default”** in the customizer).
- **Context hints:** **`pqat-help-inline`** near **Plan inputs** and **Copy reference / Copy link / Copy pin context** explains capture vs diff output vs clipboard shapes.
- **Pin live region:** **`compare-pin-live`** uses **`aria-relevant="additions text"`** so screen readers treat hydrate/transition lines as supplemental (**Phase 101** a11y pass).

## Workflow guide persistence & re-entry (Phase 102)

- **Dismissal:** **`compareDismissed`** in the same **`pqat_workflow_guide_v1`** object. Empty-page default is **`layout.visibility.intro && !compareDismissed`**; hiding the guide persists dismissal. **Clear** reopens the guide (same skip-sync ref pattern as Analyze so workspace **intro** off does not immediately collapse it). **`?guide=`** is applied in a **`useEffect`** (aligned with Analyze) so open-from-link transitions and announcers stay consistent—**not** read in the initial **`useState`**.
- **Keyboard / URL:** **`?`** / **Shift+/** and **`/compare?guide=1`** match Analyze semantics; **`?guide=`** strips on **close** after an explicit open→close transition (not on first paint).
- **Summary column:** One **`pqat-help-inline`** at the top of the summary shell distinguishes **Change briefing** vs **Index changes** vs **Next steps** relative to **Copy link**.
- **Empty state:** Compare empty hint text was shortened so the workflow guide carries primary onboarding copy.

## Help lifecycle, focus, and support entry (Phase 103)

- **Focus / Esc / guided links:** Same model as [Analyze workflow](analyze-workflow.md#help-lifecycle-focus-and-support-entry-phase-103): explicit open targets the guide title; **Esc** closes when not typing in a field; footer **Copy merged guided link** / **Copy entry guided link** are onboarding-only (**`?guide=1`**), not persisted comparison URLs.
- **Copy trio clarity:** **Selected node pair** **`pqat-help-inline`** distinguishes **Copy link** (shareable snapshot + pins), **Copy pin context** (no URL), and the guide’s **merged** / **entry** guided links.
- **E2E:** Dismissal persistence across reload is asserted against **`pqat_workflow_guide_v1`**. If persisted **`pqat.compareWorkspaceLayout.v1`** exists, the test **sets `visibility.intro` to true** instead of deleting the whole layout—closer to real “re-enable intro” usage.

## Help accessibility and guided-link merge (Phase 104)

- **Announcer:** **`compare-workflow-guide-announcer`** mirrors Analyze (**open / close / from link**).
- **Tab loop & merged guided URL:** Same as [Analyze workflow](analyze-workflow.md#help-accessibility-and-guided-link-merge-phase-104).
- **Copy trio:** **Selected node pair** buttons use **`aria-label`** + **`title`** to separate **Copy link** (shareable snapshot) vs **Copy pin context** (no URL) vs the guide’s **merged** / **entry** guided links.

## Help landmarks and announcer E2E (Phase 105)

- **Landmarks & dual links:** Same shell **`role="region"`**, footer **`role="group"`**, and two guided copy actions as documented in [Analyze workflow](analyze-workflow.md) (Phase 105).
- **Playwright:** Compare announcer lifecycle + **Copy entry guided link** behavior are asserted alongside Analyze in **`persisted-flows.spec.ts`**.

## Guided-link parity and first-frame polish (Phase 106)

- **`?guide=`** open uses the same **`useLayoutEffect`** + **`openWorkflowGuideWhenUrlRequests`** path as **Analyze** (see [Analyze workflow](analyze-workflow.md), Phase 106) — no one-frame closed flash; announcer unchanged.
- **Merged guided link:** **`persisted-flows`** asserts **Compare** merged clipboard retains decoy params and that **`goto`** reopens the guide.

After a run, open **Plan capture / EXPLAIN context (A vs B)** for a compact two-column view: source query present/absent, **planner costs** (from JSON), **input normalization** line, declared options, and recorded command per side.

**Phase 58:** each side’s analyze pass builds **`PlanSummary.bottlenecks`** and the expanded narrative/suggestion cohesion described in [Analyze workflow](analyze-workflow.md). **Phase 59:** the compare API adds **`bottleneckBrief`** — a short list of lines describing **bottleneck posture (A vs B)**. **Phase 60:** **`comparisonStory`** adds a compact change narrative (runtime/structure/findings beats, investigation walkthrough, structural vs superficial heuristic) rendered in the summary meta column **before** bottleneck posture; persisted comparisons missing the field get it **backfilled on read**. **Phase 61:** change beats are structured **`ComparisonStoryBeat`** rows (`text`, optional **`focusNodeIdA`/`focusNodeIdB`**, **`pairAnchorLabel`**) so the summary can offer **Open pair** for the primary regression without naming internal ids; compare **narrative** lines for findings use the same human-reference builder as Analyze. **Phase 62:** UI labels this block **Change briefing** with section lanes (runtime posture, structural beats, walkthrough, engineering read); **Focus plan B** on compare suggestions uses **`humanNodeAnchorFromPlan`** when **`targetDisplayLabel`** is absent; selected pair readout adds collapsed **Technical pair ids**. **Phase 63:** change story consumes **`BottleneckComparisonBrief`** for posture-aware beats (e.g. runtime regression vs unchanged bottleneck class), adds severe-finding-count deltas, and rewrites pair-evidence / linked-narrative / findings lines to read more like an engineer walkthrough (fewer rule-id-first fragments). Selected pair shows per-side **`operatorBriefingLine`** when the analyze payload included it. Markdown/HTML reports use **Change briefing** / **Plan briefing** headings with pair labels when present.

**Phase 64:** primary regression **`ComparisonStoryBeat`** rows may include **`beatBriefing`** (plan B **`operatorBriefingLine`**) rendered as a compact strip under the beat text. **`FindingIndexDiffLinker`** and **`CompareOptimizationSuggestionEngine`** tie-ins lean on finding **titles** and human anchors instead of raw **`ruleId`** tokens in primary copy. Hash **probe/build** references improve when **`Hash`** sits under **`Materialize`** or when **both** join children are **`Hash`** (row-magnitude tie-break).

**Phase 67:** **`NodePairDetail.regionContinuityHint`** (JSON **`regionContinuityHint`**) carries a **medium+-confidence** sentence when the mapper ties the same **relation** (seq ↔ index scan rewrites) or the **same join tables** with a **join-strategy change** (e.g. nested loop ↔ hash). **`ComparisonStoryBuilder`** and **`PairHumanLabel`** use continuity for improved/regression beats; **`CompareOptimizationSuggestionEngine`** may add **“Rewrite changed operator shape — track where the work moved”** when such a hint exists. The **selected pair** panel and **What changed most** rows show continuity + the hint so users can tell *problem region* continuity from *operator rename* alone. Fixtures **`nl_inner_seq_heavy`**, **`rewrite_nl_orders_lineitems`** / **`rewrite_hash_orders_lineitems`** back tests.

**Phase 68:** **`PairRegionContinuityHint`** distinguishes **broad seq → narrower index** (same relation) from **sort-over-seq → order-supported index** when the mapped scan pair sits under a **Sort** on A and **sort key tokens** overlap **index cond** / **presorted key** on B (conservative token match). A **Sort → index scan** direct mapping (same relation + ordering evidence) gets its own continuity line when the mapper pairs those nodes. **`NodeMappingEngine`** adds a small **access-rewrite bonus** for **same-relation Seq Scan ↔ index-backed scan** so those pairs more often reach **Medium+** confidence (enabling hints). **`ComparisonStoryBuilder`** appends continuity to the **largest regression** beat when present; **`CompareOptimizationSuggestionEngine`** tail sentences vary for **access** vs **ordering** vs **join** continuity. UI **`pairContinuitySectionTitle`** (**`compareContinuityPresentation`**) picks **Access path · same relation**, **Ordering · same region**, or **Join · same tables** for kickers on the **selected pair** and **What changed most**. Fixtures **`rewrite_access_seq_shipments`** / **`rewrite_access_idx_shipments`**, **`rewrite_sort_seq_shipments`** / **`rewrite_index_ordered_shipments`** (+ `.sql`) back tests.

**Phase 69:** Ordering continuity prefers **structured sort-column ↔ index cond / presorted key** alignment when the JSON exposes parseable column names; **token overlap** remains a **weak**, explicitly hedged fallback. Same-relation hints cover **seq ↔ bitmap heap**, **bitmap ↔ index / index-only**, and **index ↔ index-only**, with copy that stresses **residual cost** (recheck, heap volume, parents). **`NodePairDetail.regionContinuitySummaryCue`** (JSON **`regionContinuitySummaryCue`**) is a short chip string from **`CompareContinuitySummaryCue.FromHint`**; the **Change briefing** summary lane shows it when the **selected pair** (or first anchored story beat with a mapped pair) has a cue. Fixtures **`rewrite_access_bitmap_shipments`**, **`rewrite_access_idxonly_shipments`** (+ `.sql`) extend the rewrite set.

**Phase 70:** Continuity is **`TryPairRegionContinuity`** → **`RegionContinuityData`** (**`KindKey`** + **`ContinuityOutcome`**) with human **`Hint`**; the summary chip uses **`CompareContinuitySummaryCue.FromContinuity`** (substring **`FromHint`** only as fallback). **Regression-style** access paths (e.g. **index → bitmap heap**, **index → seq**, **index-only → heap-backed index**) get **non-optimistic** chips. **Query text** supplies a **bounded ORDER BY tie-breaker** when JSON ordering evidence is thin. **Partial vs finalize** aggregates can emit **output-shaping continuity** when **GROUP BY** keys match and **Partial Mode** differs. **`continuityKindKey`** is exposed for debugging/telemetry; the UI prefixes the chip with **Continuity ·** for context. Playwright **`persisted-flows`** covers a real Compare run asserting the cue.

**Phase 71:** **Fixture-backed** query-assisted ordering when **sort keys** do not appear in **index cond** but captured **ORDER BY** aligns (**`rewrite_queryassist_sort_priority_shipments`** vs **`rewrite_access_idx_shipments`**). **Gather Merge** ↔ **single-node aggregate** continuity (**`aggregate.gatherVsSingle`** / **`aggregate.singleVsGather`**) with a **`NodeMappingEngine`** **gather↔aggregate** score bonus. **Partial/final** aggregate hints gain **GROUP BY text bridging** when planner **Group Key** strings differ but a **GROUP BY** clause references overlapping column identifiers; optional **time_bucket** wording when SQL and group-key labels suggest bucketing (bounded, hedged). **Compare story** and **compare suggestion** follow-ups add **grouped-output / residual feed** framing; chips distinguish **ordering region**, **grouped output**, **gather vs single**, and **SQL bridge** kinds. Playwright adds **index → bitmap heap** regression continuity. New fixtures: **`rewrite_aggregate_*_shipments`**, **`rewrite_aggregate_*_bucket_shipments`**.

**Phase 72:** Compare **Copy reference** / **Copy link** / navigator copy use the same **`copyToClipboard`** + **`useCopyFeedback`** stack as Analyze; pair copy text is human-first, then **Pair artifact** (when present) and **`Plan A node` / `Plan B node`** lines (**Phase 86** replaces the terse **`A:`/`B:`**-only tail).

**Phase 86:** **`pairReferenceText`** / navigator / top-changes / selected-pair **Copy reference** prepend **`PQAT compare: <comparisonId>`** when known. **Copy link** on the selected pair copies **`compareDeepLinkClipboardPayload`** (URL + **`PQAT compare:`** + optional **`Pair ref:`**). **Next steps after this change** in the summary column includes **Copy for ticket** on each compare suggestion (**`suggestionReferenceText`** with **`comparisonId`** and optional **pinned pair ref** when the highlighted suggestion matches the selected pair). HTML compare export gains the same **Next steps** section as markdown when suggestions exist.

**Phase 87:** Compare **markdown** uses the same **Next steps after this change** heading as **HTML** (no “(compare)” suffix). **`POST /api/compare/report/json`** parity is covered by unit tests (**`compareOptimizationSuggestions`**, **`rewriteVerdictOneLiner`** on pairs). Playwright **`persisted-flows`** asserts **Copy for ticket** on a real compare suggestion (**`PQAT compare:`** + structured suggestion lines). **Analyze Copy share link** E2E asserts **URL + `PQAT analysis:`**.

**Phase 88:** Compare is tuned as a **rewrite decision** surface: **continuity** precedes **Rewrite outcome** in the selected pair; **region continuity** uses a labeled **`role="region"`**; **Copy reference** appends **`Rewrite outcome:`** when a verdict exists. Summary **Next steps** uses an **`h2`** and chips (**Same pair as sidebar** / **Other region**) when a pair is selected; **Copy for ticket** may include **`Pair scope: aligns with selected pair (Plan B node …)`** when the suggestion’s focus matches Plan B. **HTML compare export** gains **plan capture (per side)**, **change briefing** with **Story beats** when present, **bottleneck posture**, **narrative**, then top pairs — closer to markdown flow; top pair lines use **Rewrite outcome** (not “readout”). **Auth API key** Playwright asserts **Copy artifact link** captures **URL + `PQAT analysis:`** (clipboard hook). **`useCopyFeedback`** clears timeouts and skips **`setState`** after unmount so heavy graph tests do not trip Vitest **unhandled errors**.

**Phase 89:** **Graph layout:** **`buildAnalyzeGraph`** / **`layoutTopDown`** coerce **dagre** coordinates to **finite** **`x`/`y`**; **`AnalyzePlanGraphCore`** clamps node positions before **`ReactFlow`**; **`fitView`** runs after **`requestAnimationFrame`** when the viewport is finite. **Vitest:** **`AnalyzePage.interaction.test.tsx`** alone filters the known transient React **NaN-attribute** **`console.error`** pair (other suites stay noisy-clean). **Playwright:** **`Compare: deep link from Copy link restores pair param and rewrite outcome`** (clipboard URL + **`Pair ref:`** → reopen → **`pair=`** + **Rewrite outcome**); **`Compare: Copy for ticket on same-pair suggestion includes Pair scope line`**. **`useCopyFeedback`** Vitest regression: unmount before success timer / late **`copyToClipboard`** resolve. **Compare a11y:** **Next steps** block is a **`section`** **`role="region"`** with **`aria-labelledby`** the **`h2`**; **Selected node pair** heading has **`id="compare-selected-pair-heading"`**. **Copy:** change-briefing subtitle avoids “verdict” next to **Rewrite outcome** (**headline judgment** wording).

**Phase 90:** **Compare collaboration parity:** **Phase 101** moved first-run orientation into **`CompareWorkflowGuide`** (**`h2` “Compare plans”** inside the guide shell); **Summary**, **Navigator** / **Findings diff**, **What changed most**, **Selected node pair** use a coherent heading ladder (summary shell **`aria-labelledby="compare-summary-heading"`**). **Next steps** rows: each suggestion title is an **`h3`**; **Focus plan B** / **Copy for ticket** precede **Pin** in **Tab** order (DOM order), with **Pin** as a compact top-right control. **Playwright:** **`Compare: suggestion= deep link highlight survives reopen in fresh tab`** ( **`suggestion=`** **highlight** beyond `pair=` round-trip); **`jwt-auth-smoke.spec.ts`** — **Compare Copy link** clipboard (**URL** + **`PQAT compare:`** + **`Pair ref:`**) in **JWT** mode. **`AnalyzePlanGraphCore`** sets **`defaultViewport`** to reduce transient viewport edge cases; **NaN** console noise remains **file-scoped** in **`AnalyzePage.interaction.test.tsx`** if jsdom still logs one frame. **Vitest:** next-step **button order** regression.

**Phase 91:** **Frontend CI:** **`ci.yml`** **`frontend`** job runs **`./scripts/verify-frontend-docker.sh`** (digest-pinned **Node** container) so **Vitest** / **Rolldown** no longer depends on **GitHub-hosted** **`npm ci`** optional native bindings. **Contributing** documents the Docker path as canonical for CI parity. **Compare:** **proxy** Playwright (**`proxy-auth-smoke.spec.ts`**) **Compare Copy link** clipboard parity with **JWT**; **Next steps** **Pin** uses **`aria-describedby`** the suggestion **`h3`**; **Summary** “share” vs selected-pair **Copy link** **`title`** tooltips clarify URL-only vs ticket-sized payload. **Visual** baselines: still a follow-up when refreshing **e2e-visual** PNGs.

**Phase 92:** **`e2e-visual`** Analyze first PNG targets **`data-testid="analyze-visual-summary-contract"`** (metric deck + **Plan briefing** only), not the full summary card (share/metadata/footer). **Playwright** **`persisted-flows`**: **`Compare: finding= deep link highlight survives reopen in fresh tab`** (findings diff row **`pqat-artifactOutline--active`** after **`goto`** in a second tab).

**Phase 93:** **`persisted-flows`**: **`Compare: indexDiff= deep link highlight survives reopen in fresh tab`** (seq↔index fixtures — **`Index changes`** callout **`data-testid="compare-index-changes-callout"`**, **`pqat-indexInsightItem--active`**) + **URL bar** asserts **`comparison=`** / **`finding=`** / **`indexDiff=`** / settled **`suggestion=`** after reload. **`suggestion=`** reopen: URL may normalize to a different stable id than the seed’s `canonicalSuggestionId`; tests assert **reopen preserves the settled** `suggestion=` value. **Vitest:** **`getBoundingClientRect`** stub for **`.react-flow`** zero-size rects (with existing offset stubs) **reduces** transient React **NaN-attribute** noise; **`AnalyzePage.interaction.test.tsx`** no longer file-scopes **`console.error`** filtering. **`compareDeepLinkClipboardPayload`** ( **`shareAppUrl.ts`** ) adds optional pinned lines.

**Phase 94:** **`persisted-flows`**: **`Compare: Copy link with pinned index insight includes ticket lines and round-trips URL`** — clipboard **`Pinned index insight:`** + **`PQAT compare:`** + **`Pair ref:`**; first URL line **`goto`** in a fresh tab restores highlight. **`indexDiff=`** test adds **`toBeInViewport`** on **`compare-index-changes-callout`**. **`jwt-auth-smoke.spec.ts`**: pinned **index insight** copy in **JWT** mode. Compare **HTML** export gains **Index changes**; markdown **## Index changes** (replaces “Index comparison” heading). **`resolveCompareSuggestionParamToCanonicalId`** JSDoc + E2E seed comment clarify **`suggestion=`** / **`alsoKnownAs`**. **Docs:** URL parameter table (above); **`api-and-reports.md`**.

**Phase 95:** **Index changes** insight rows are **keyboard-focusable** and **click-to-pin** (clears other pin types); **`Highlight finding`** uses **`stopPropagation`**. **Selected pair** shows **`compare-pinned-summary`** when any pin is active. **`aria-current`** on pinned finding / index / suggestion rows. **`persisted-flows`**: click index row → URL + summary; **Copy link** with pinned **finding** / **suggestion**; **`finding=`** deep link asserts row **`toBeInViewport`**. **`jwt-auth-smoke`**: pinned finding + suggestion **Copy link** lines in JWT mode. URL table adds **When active** column.

**Phase 96:** **Index changes** list (**`CompareIndexInsightRows`**) uses **roving `tabIndex`** — only one row is tab-stopping at a time; **Arrow Up/Down** moves between rows, **Enter**/**Space** pins. **Next steps** (**`CompareNextStepsList`**) **Pin** controls chain with **Arrow Up/Down** for faster keyboard traversal. Hint copy states **one primary pin at a time** for **Copy link** (pinning replaces the previous). **Selected pair** adds **Copy pin context** (**`compare-copy-pin-context`**) — short clipboard via **`compareCompactPinContextPayload`** (no URL line; **`PQAT compare:`**, **`Pair ref:`**, **`Link includes:`** readout, optional **Rewrite outcome**). **`suggestion=`** Playwright flows assert **`toBeInViewport`** on the highlighted next-step row. Vitest: **`comparePinning`**, **`CompareIndexInsightRows`**, **`shareAppUrl`** compact payload. CSS **`focus-within`** on active finding / suggestion outlines.

**Phase 97:** **`indexDiff=`** (URL) updates move **roving focus** to the matching **Index changes** row with **`focus({ preventScroll: true })`** so the viewport does not jump when the highlight syncs. **Next steps** **Pin** row supports **Home** / **End** (Vitest **`CompareNextStepsList`**). Analyze **Plan workspace** + **Plan guide** **paired** layout: **`companionRailSurfaceStyle`**, **`pqat-analyzeWorkspaceRow--paired`**, **`graphFillColumn`** — see [Analyze workflow](analyze-workflow.md) (**Plan workspace** section).

**Phase 98 — Keyboard, pins, and assistive feedback**

- **One primary pin** for **Copy link** / deep-link params: at most one of **`finding=`**, **`indexDiff=`**, **`suggestion=`** is active as the pinned highlight; changing pins replaces the previous.
- **`aria-live="polite"`** (**`data-testid="compare-pin-live"`**, visually hidden): transition copy when the user **changes** the pin after load (**`comparePinAnnouncementForFingerprint`**). **Phase 99** adds a distinct **hydrate** line when a comparison **first opens** with a valid deep-link pin (**`comparePinHydrateAnnouncementForFingerprint`**). **Phase 100** auto-clears hydrate copy after **`COMPARE_PIN_HYDRATE_CLEAR_MS`**. A short **defer** before transition lines (**`PIN_LIVE_ANNOUNCE_DEFER_MS`**) reduces overlap with **copy success** feedback (**`COPY_FEEDBACK_SUCCESS_CLEAR_MS`**).
- **Keyboard (summary column):** **Index changes** — roving **`listitem`**, **Arrow Up/Down**, **Enter**/**Space** to pin (**Phase 95–96**). **Next steps** — **Pin** buttons: **Arrow Up/Down**, **Home**, **End** (**Phase 97**). **Phase 99:** compact **`aria-describedby`** target (**`COMPARE_WORKSPACE_KEYBOARD_HINTS_ID`**, **`COMPARE_WORKSPACE_KEYBOARD_HINTS_TEXT`**) shared by **Index changes** and **Next steps** lists; **Arrow** roving uses **`preventScroll: true`** on **Index** rows and **Next steps** **Pin** focus moves.
- **Focus affordance:** shared **`focus-within`** / outline treatment on **findings diff** shells (**`pqat-artifactOutline`**), **index insight** rows, and **next-step** rows so keyboard focus matches the workstation chrome. **Phase 99:** **`focus-within`** is suppressed when the same surface is already **active** / **highlight** so pinned + focused states do not double-outline.

**Phase 99 — Pinning completeness + paired text polish**

- **Playwright** **`persisted-flows`**: **Index changes** keyboard test uses **`rewrite_sort_seq_shipments`** vs **`rewrite_index_ordered_shipments`** so **two+** insight rows always exist; asserts **ArrowDown** roving then **Enter** pin + live region. **E2E fixtures** sync includes those JSON files (**`scripts/sync-e2e-fixtures.sh`** / **`check-e2e-fixtures.mjs`**). Backend **`IndexComparisonAnalyzerTests`** already guards ≥2 non-unchanged insight diffs on that pair.

**Phase 100 — Deep-link resync + pin lifecycle**

- **URL → state on every `location.search` change** (same **`comparisonId`**): **`parseCompareUrlPinAndPairState`** (**`compareDeepLinkSync.ts`**) reapplies **`finding=`** / **`indexDiff=`** / **`suggestion=`** with **one-primary-pin** precedence (**finding** > **index** > **suggestion**); valid **`pair=`** updates **`selectedPair`** so bookmark edits and shared links stay aligned with an already-open comparison.
- **Hydrate vs transition:** **Hydrate** “Opened with …” runs only when **`comparisonId`** first loads in layout; a **`useEffect`** on **`comparePinLiveMessage`** auto-clears lines matching **`/^opened with /i`** after **`COMPARE_PIN_HYDRATE_CLEAR_MS`** (or sooner if the message changes). **`suppressNextPinTransitionForFpRef`** drops one redundant **transition** right after hydrate when React would otherwise echo the same fingerprint. User-driven pin changes still use **`comparePinAnnouncementForFingerprint`** + **`PIN_LIVE_ANNOUNCE_DEFER_MS`**.
- **Playwright:** hydrate announcement + empty live region after clear; **same snapshot** navigates **`indexDiff=`** from row A to row B; **Space** pins an index row (roving + **Space**). **Fixtures:** **`rewrite_access_*`** JSON included in **check/sync** (continuity regression path).

**Phase 82:** **Change briefing** lead (**wall-clock & rewrite result**) can append a second sentence when net faster root coexists with ranked **worsened** pairs, or net slower with **improved** pairs—surfacing “pain moved” vs “uniform win/loss.” **Grouped-output** continuity tails stress scans/joins feeding **buckets or partial aggregates**. UI adds a short subtitle under **Change briefing** explaining how to read lead line vs beats; section eyebrows are plainer (**what moved**, **how to read this comparison**). Continuity section title **Grouped / bucket output · same region** clarifies analytical workloads.

**Phase 83:** **Selected pair** shows a **Rewrite outcome** one-liner (**`rewriteVerdictOneLiner`**) from inclusive-time / shared-read deltas plus continuity hints; **low** mapping confidence prefixes **Weak mapping—** when metrics are still quoted so users do not over-trust the line. **Related compare next step** for the pair remains the compact compare-scoped suggestion block when present.

**Phase 84:** Copy actions use the same **`copyToClipboard`** stack as Analyze (sync **`execCommand`** first). **`POST /api/compare/report/html`** returns a compact HTML report whose **Top worsened/improved** lines include **Rewrite outcome** when present (parity with markdown). Playwright can assert **Rewrite outcome for this pair** on the seq↔index fixture path.

## Visual hierarchy (Phase 43) + Phase 55 polish

Compare uses the same **`pqat-*`** styling as Analyze: capture card, summary **metric tiles**, navigator and pair **workspace** panels, and a dashed **customizer** well. **Phase 55** adds the same **state banners** for reopen/load/errors, a **comparing** info banner during POST, and **summary shell** glow/border tuning. **Phase 101** replaces the old intro **metric-tile** card with the shared **guide** shell at the top of the page (see **In-product workflow guide** above). Behavior, URL params, and layout persistence are unchanged aside from **`intro`** controlling default guide visibility when empty. **Phase 65–66:** the shared **Theme appearance** control and **`data-theme`** / **`data-effective-theme`** tokens apply here too (**Change briefing**, selected-pair panel, **What changed most** row tints, meta/customizer panels). Optional server **`appearance_theme_v1`** sync matches Analyze when auth + credentials are configured.

## Patterns & delivery (Phase 44)

**Optional: source SQL + EXPLAIN metadata** and **Advanced** (matcher diagnostics) use the same **`pqat-textarea`**, **`pqat-fieldLabel`**, and **`pqat-details`** patterns as Analyze. Navigator pair rows, findings-diff cards, and summary **index / suggestions** callouts use shared **`workstation-patterns.css`** classes (instead of ad hoc inline layout). The **Compare** route is **lazy-loaded** with a **Loading Compare…** shell; **Customize workspace** loads **DnD** reorder UI on first open, matching Analyze.

## List performance (Phase 45)

When **findings diff** has many rows, **`CompareNavigatorPanel`** wraps the list in **`VirtualizedListColumn`** (same helper as Analyze) so scrolling stays light. Small diffs keep a non-virtual list; **ClickableRow** selection, copy, and index-cross-link buttons behave the same.

## Selected-pair progressive detail (Phase 46)

See **Selected pair panel** below: **`CompareSelectedPairHeavySections`** is code-split and loaded after the eager header/actions so the pair column stays responsive on large comparisons.

## Pair heavy prefetch (Phase 48)

**`prefetchCompareSelectedPairHeavySections()`** warms the same lazy chunk as **`CompareSelectedPairPanel`**’s **`Suspense`** boundary. It is **coalesced** (one in-flight dynamic `import`) and triggered when:

- the user **hovers** or **focuses** primary pair-selection **`ClickableRow`** targets (navigator worsened/improved, findings diff rows, **What changed most**, **Branch context** mapped rows),
- the user hovers/focuses **Focus plan B** on a compare suggestion in the summary column,
- the browser is **idle** shortly after a comparison result is shown (**`requestIdleCallback`**, **`setTimeout`** fallback)—same pattern as Analyze graph prefetch.

This reduces perceived delay when moving quickly between pairs without blocking the first paint of the pair column header.

## Compare workspace layout (Phase 41 + Phase 42)

The Compare page mirrors Analyze’s **workstation** model:

- **Customize workspace** (inside the capture card): presets (**Balanced**, **Wide pair** / wide-graph emphasis, **Review**, **Diff-heavy**, **Compact**), per-panel visibility toggles, **drag handle + Up/Down** reorder for **summary-column sections** and **navigator blocks** (worsened/improved, findings diff, unmatched), and **Swap main columns** (navigator vs pair detail). **Reset to defaults** restores the balanced preset.
- **Responsive layout**: same **three tiers** as Analyze (**narrow** &lt;900px, **medium** 900–1319px, **wide** ≥1320px). **Medium** and **wide** keep the **summary + “what changed most”** row and **navigator | pair** main grid **side-by-side** with tuned **`minmax`/`fr` ratios**; only **narrow** stacks to a single column. Summary **metric cards** use an **`auto-fit`** grid so five cards wrap on mid-width screens instead of forcing one cramped row.
- **Persistence**: layout is stored under **`pqat.compareWorkspaceLayout.v1`** in **localStorage**. When auth is enabled and the SPA has credentials (**`VITE_AUTH_*`**), the same JSON syncs to **`PUT /api/me/preferences/compare_workspace_v1`** (debounced), matching the Analyze preference pattern.
- **Hidden inputs**: if **Plan inputs** is toggled off, a dashed **recovery strip** offers **Show plan inputs** so Compare remains usable.
- **Semantics**: hiding a panel does not clear **selection** or **URL params**—restore panels from Customize to see branch strip, findings diff, or pair detail again. Reordering uses stable region ids; **`coerceCompare*`** merge helpers reject corrupted orders.

## What compare does (and does not)

- **Does**: heuristically maps nodes between Plan A and Plan B, computes deltas, summarizes context diffs, and highlights findings changes.
- **Does not**: prove mathematical identity of nodes. Low-confidence matches are leads, not guarantees.

## Confidence

Mapping confidence is emitted per pair. Treat low-confidence pairs as “suspects” until validated by nearby structure and evidence.

## Reading the compare UI

### At the top: summary + “what changed most”

After a compare run, start at the top:

- **Summary cards**: total runtime, shared reads, severe findings, node count, max depth (Plan B value + delta vs Plan A).
- **Index changes** (Phase 30+31, Phase 33 ids): plan-level scan-mix deltas, chunked-bitmap posture lines when applicable, and a short list of **bounded index insight diffs**. Each insight row can show **Supported by N finding change(s)** with rule tails and a **Highlight finding** control. Cross-links use **stable ids** (`fd_*` / `ii_*`) in **`relatedFindingDiffIds`** / **`relatedIndexDiffIds`**; legacy **`relatedFindingDiffIndexes`** / **`relatedIndexDiffIndexes`** remain for backward compatibility but are not the primary reference.
- **Next steps after this change** (Phase 32 + Phase 47): compact **`compareOptimizationSuggestions`** list (not a verbatim copy of plan B’s analyze suggestions). Suggestions use the same **human-readable fields** as analyze (**`suggestionFamily`**, **`recommendedNextAction`**, **`whyItMatters`**, **`targetDisplayLabel`**) and compare-specific wording (“after this change”, plan B + diff context). Suggestion ids use the **`sg_`** prefix (content-hash style). **Phase 48:** suggestions **carried** from plan B’s high-priority analyze list use ids derived from **structured fields + source `sg_*` id** (not the prefixed display title). **Phase 49:** persisted rows may include **`alsoKnownAs`** (e.g. legacy carried-id forms) so **`suggestion=`** deep links keep working; the SPA resolves aliases to the canonical id for highlight + URL sync. Rows may include **`relatedFindingDiffIds`** / **`relatedIndexInsightDiffIds`** when the engine ties a suggestion to specific diff rows. Rows may offer **Focus plan B · …** when a mapped match exists (label prefers **`targetDisplayLabel`**). Server read path normalizes older suggestion JSON; the client keeps a thin display fallback.
- **Findings ↔ index deltas** (Phase 31+33): finding diff rows can show **Related index change** with **stable id** buttons (and legacy **Index Δ #k** when needed). Outlining uses **`ii_*`** targets so highlights survive reordering. The selected pair panel adds **Finding ↔ index corroboration** when structured links exist on that mapped pair. Links are **heuristic** (node ids, relation evidence, rule id ↔ `signalKinds` alignment)—not proof of causality.
- **What changed most**: quick-jump to the top worsened and top improved mapped pairs; when **`regionContinuityHint`** is present on that pair, a short continuity line appears under the title (same as selected-pair treatment). **Phase 69:** **`regionContinuitySummaryCue`** also drives a compact **continuity chip** in the **Change briefing** block (selected pair first, else story-beat focus).

### Navigator: improved / worsened lists + “what changed most”

These surfaces share the same interaction model as Analyze hotspots/findings and the findings diff:

- Each row is a **`ClickableRow`** (role=`button`, `Enter`/`Space` activates selection). Inner **Copy** is a real `<button>` with `stopPropagation`, so copy never toggles selection.
- **`aria-pressed`** reflects whether the row’s mapped pair is the **currently selected** pair. Selected rows get a restrained accent treatment (tint in the navigator; a left accent bar on tinted “what changed most” callouts so severity coloring stays readable).
- **Copy pair reference** on navigator and top-change rows copies the same style of human-readable pair reference as the selected-pair panel (via `pairReferenceText`), with local “Copied …” feedback in the navigator column.

Each row uses human-readable pair labels and may include badges:

- generic context badges (hash pressure, scan waste, sort spill, memoize, nested loop)
- **side-aware join badges** when the evidence is explicitly side-scoped (build side / inner side)
- optional **`index Δ`** chip when the mapped pair has non-empty **index delta cues** (access-path family change and/or pair-scoped index insight diff summaries)

### Branch context (twin path strip)

Above **Selected node pair**, the **Branch context** section is the visual counterpart to the navigator:

- Two columns (**Plan A** / **Plan B**) show the **path from root to the selected node** on each side, using the same `nodeShortLabel` system as the rest of the app (no raw internal ids in primary labels).
- The **focal** row (current selection) uses **`aria-pressed`** and the same selected styling as other `ClickableRow` targets.
- **Mapped** ancestors and children are **clickable**: choosing a row selects the **mapped pair** `(nodeIdA, nodeIdB)` from the compare `matches` table, so the navigator, findings diff, detail panel, and branch strip stay aligned.
- Rows without a mapping partner render as static rows tagged **unmapped**; nodes that appear in the unmatched id lists show a small **A-only** / **B-only** chip.
- **Compact cues** under the heading summarize the focal pair (e.g. confidence, time/read deltas from `nodeDeltas`, operator-family shift, first context-diff highlight, severe finding hits on that pair, join-side hints when present).
- **Downstream**: immediate children of the focal node on each side (capped for density), with the same mapping / unmatched semantics.

### Selected pair panel

**Phase 46 — staged hydration:** the panel paints **immediately** with the pair heading, **Copy reference** / **Copy link**, optional subtitle, **Related compare next step** (when present), and the **confidence · score · depth** line. Denser blocks load in a **second lazy chunk** behind a calm skeleton (**`pqat-pairHeavySkeleton`**) so selection still feels instant while metrics and evidence hydrate.

The selected pair shows (after load):

- readable pair heading + join branch subtitle (when applicable) — **eager**
- **Related compare next step** (Phase 32 + Phase 47) — **eager** when a `compareOptimizationSuggestion` targets this pair’s plan B `nodeIdB` (title, summary, **Next ·**, **Why ·** when present)
- **Copy reference** and **Copy link** (full URL with **`comparison=`**, `?pair=`, optional `finding=`, `indexDiff=`, `suggestion=`) — **eager**
- **Access path / index delta** (Phase 30): bullets from `pairDetails[].indexDeltaCues` when present; fallback line when families differ — **deferred**
- **Finding ↔ index corroboration** cues — **deferred**
- **Join side change summary** when supported (hash build / inner waste) — **deferred**
- context change summary highlights — **deferred**
- raw operator fields and evidence side-by-side, **Key metric deltas**, **Findings for this pair**, optional matcher diagnostics — **deferred**

### Findings diff

Diff finding rows include a subtle **Copy** action that copies a concise human-readable reference for the anchored node (optionally annotated with the change type / rule id).

**Interaction model:** the row is a single keyboard-accessible target to select a pair. When both `nodeIdA` and `nodeIdB` are present, that pair is used; when only one side is anchored, the UI **resolves the partner** from the compare `matches` list (`resolveFindingDiffPair`) so diff rows still drive selection and branch context when a mapping exists. **Copy** is a separate button (aligned with Analyze hotspots/findings). When the resolved or explicit pair matches the selected pair, **`aria-pressed`** is true so the navigator, branch strip, and diff stay visually in sync.

Notes:
- Compare is **heuristic**: mapping confidence is shown because some rewrites change structure and labels. Treat low-confidence pairs as leads to validate, not guarantees.

## Stable artifact ids & deep links (Phase 33 + 36)

- **Comparison**: **`comparisonId`** identifies the **persisted** snapshot; URL key **`comparison`** (with **`pair`**, **`finding`**, **`indexDiff`**, **`suggestion`**).
- **Pair**: each **`pairDetails[]`** row has **`pairArtifactId`** (`pair_` + short hash) scoped to **`comparisonId`** and the mapped node ids.
- **Finding diff**: **`findingsDiff.items[].diffId`** (`fd_*`).
- **Index insight diff**: **`indexComparison.insightDiffs[].insightDiffId`** (`ii_*`).

**Limits:** artifact ids are **deterministic from structured fields** for a given comparison payload; they are **not** stable across different plan JSON or a different **`comparisonId`**. If query params reference ids that are not in the current result, the UI ignores them for selection. **`comparison=`** must match a row still present in SQLite (TTL / pruning / DB deletion ⇒ 404-style error in the UI).

## Guardrails

Side attribution is intentionally conservative. If evidence is ambiguous, the UI falls back to non-side-specific badges.

