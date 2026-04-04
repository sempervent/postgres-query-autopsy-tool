export type JsonValue = unknown

export type AnalysisFinding = {
  findingId: string
  ruleId: string
  severity: number
  confidence: number
  category: number
  title: string
  summary: string
  explanation: string
  nodeIds?: string[]
  evidence: Record<string, unknown>
  suggestion: string
  rankScore?: number | null
}

export type AnalysisNarrative = {
  whatHappened: string
  whereTimeWent: string
  whatLikelyMatters: string
  whatProbablyDoesNotMatter: string
}

/** Mirrors backend `PlanWorkerStats` (camelCase in JSON). */
export type PlanWorkerStats = {
  workerNumber?: number | null
  actualStartupTimeMs?: number | null
  actualTotalTimeMs?: number | null
  actualRows?: number | null
  actualLoops?: number | null
  sharedHitBlocks?: number | null
  sharedReadBlocks?: number | null
  sharedDirtiedBlocks?: number | null
  sharedWrittenBlocks?: number | null
  localHitBlocks?: number | null
  localReadBlocks?: number | null
  localDirtiedBlocks?: number | null
  localWrittenBlocks?: number | null
  tempReadBlocks?: number | null
  tempWrittenBlocks?: number | null
  sortMethod?: string | null
  sortSpaceUsedKb?: number | null
  sortSpaceType?: string | null
}

export type NormalizedPlanNode = Record<string, unknown> & {
  workers?: PlanWorkerStats[] | null
}

export type DerivedNodeMetrics = Record<string, unknown>

export type AnalyzedPlanNode = {
  nodeId: string
  parentNodeId?: string | null
  childNodeIds: string[]
  node: NormalizedPlanNode
  metrics: DerivedNodeMetrics
  contextEvidence?: OperatorContextEvidence | null
  /** Phase 59: human interpretive paragraph for selected-node panel. */
  operatorInterpretation?: string | null
}

/** Detected from parsed plan JSON (not declared EXPLAIN metadata). */
export type PlannerCostPresence = 'unknown' | 'present' | 'notDetected' | 'mixed'

export type ExplainOptions = {
  format?: string | null
  analyze?: boolean | null
  verbose?: boolean | null
  buffers?: boolean | null
  costs?: boolean | null
  settings?: boolean | null
  wal?: boolean | null
  timing?: boolean | null
  summary?: boolean | null
  jit?: boolean | null
}

export type ExplainCaptureMetadata = {
  options?: ExplainOptions | null
  sourceExplainCommand?: string | null
}

/** Set when the API normalized pasted text before parsing (Phase 35). */
export type PlanInputNormalizationInfo = {
  kind: 'rawJson' | 'queryPlanTable' | string
  detail?: string | null
}

/** Evidence-backed prioritized bottleneck (API camelCase). Phase 59: class + causeHint. */
export type PlanBottleneckInsight = {
  insightId: string
  rank: number
  kind: string
  /** camelCase enum e.g. cpuHotspot, ioHotspot (Phase 59+; may be absent on very old artifacts). */
  bottleneckClass?: string
  /** camelCase: primaryFocus | downstreamSymptom | ambiguous */
  causeHint?: string
  headline: string
  detail: string
  nodeIds: string[]
  relatedFindingIds: string[]
  symptomNote?: string | null
  /** Phase 60: hedged “because → likely” propagation line. */
  propagationNote?: string | null
  /** Phase 61: human anchor for “where” in the plan (not a raw path). */
  humanAnchorLabel?: string | null
}

/** Phase 61: plan story beat with optional graph focus (camelCase JSON). Legacy artifacts may use plain strings. */
export type StoryPropagationBeat = {
  text: string
  focusNodeId?: string | null
  anchorLabel: string
}

/** Phase 60: structured plan story (camelCase JSON). */
export type PlanStory = {
  planOverview: string
  workConcentration: string
  likelyExpenseDrivers: string
  executionShape: string
  inspectFirstPath: string
  propagationBeats: (string | StoryPropagationBeat)[]
  indexShapeNote: string
}

export type PlanSummary = {
  totalNodeCount: number
  maxDepth: number
  rootInclusiveActualTimeMs?: number | null
  hasActualTiming: boolean
  hasBuffers: boolean
  plannerCosts: PlannerCostPresence
  topExclusiveTimeHotspotNodeIds: string[]
  topInclusiveTimeHotspotNodeIds: string[]
  topSharedReadHotspotNodeIds: string[]
  severeFindingsCount: number
  warnings: string[]
  /** Phase 58: empty array when absent (older artifacts). */
  bottlenecks?: PlanBottleneckInsight[] | null
}

/** Plan-level rollup for access-path / index posture (camelCase from API). */
export type PlanIndexOverview = {
  seqScanCount: number
  indexScanCount: number
  indexOnlyScanCount: number
  bitmapHeapScanCount: number
  bitmapIndexScanCount: number
  hasAppendOperator: boolean
  suggestsChunkedBitmapWorkload: boolean
  chunkedWorkloadNote?: string | null
}

/** Node-level index investigation hints (camelCase from API). */
export type PlanIndexInsight = {
  nodeId: string
  accessPathFamily: string
  nodeType?: string | null
  relationName?: string | null
  indexName?: string | null
  signalKinds: string[]
  headline: string
  facts: Record<string, unknown>
}

/** Phase 32: evidence-backed next-step suggestions (investigation-oriented, not prescriptions). */
export type OptimizationSuggestion = {
  suggestionId: string
  category: string
  suggestedActionType: string
  title: string
  summary: string
  details: string
  rationale: string
  confidence: string
  priority: string
  targetNodeIds: string[]
  relatedFindingIds: string[]
  relatedIndexInsightNodeIds: string[]
  cautions: string[]
  validationSteps: string[]
  /** Phase 47: UI grouping (snake_case from API). */
  suggestionFamily?: string
  recommendedNextAction?: string
  whyItMatters?: string
  targetDisplayLabel?: string | null
  isGroupedCluster?: boolean
  /** Compare payload: stable finding diff ids (`fd_*`). */
  relatedFindingDiffIds?: string[] | null
  /** Compare payload: stable index insight diff ids (`ii_*`). */
  relatedIndexInsightDiffIds?: string[] | null
  /** Phase 59: bottleneck insight ids (`bn_*`) linked from enrichment. */
  relatedBottleneckInsightIds?: string[] | null
  /** Phase 49: alternate ids (e.g. legacy carried compare suggestion ids) for deep links. */
  alsoKnownAs?: string[] | null
}

export type PlanAnalysisResult = {
  analysisId: string
  rootNodeId: string
  queryText?: string | null
  explainMetadata?: ExplainCaptureMetadata | null
  nodes: AnalyzedPlanNode[]
  findings: AnalysisFinding[]
  narrative: AnalysisNarrative
  summary: PlanSummary
  /** Present when analyzed with Phase 29+ backend; treat as empty when absent. */
  indexOverview?: PlanIndexOverview | null
  indexInsights?: PlanIndexInsight[] | null
  /** Phase 32: ranked optimization / next-step suggestions. */
  optimizationSuggestions?: OptimizationSuggestion[] | null
  /** Phase 60: structured storytelling (backfilled on reopen when absent). */
  planStory?: PlanStory | null
  /** Phase 35: how raw plan input was interpreted when sent as `planText`. */
  planInputNormalization?: PlanInputNormalizationInfo | null
  /** Phase 37: optional ownership / sharing metadata when auth is enabled. */
  artifactAccess?: StoredArtifactAccess | null
  /** Phase 49: persisted JSON schema generation (0 = legacy implicit). */
  artifactSchemaVersion?: number
  /** Phase 49: optional persistence timestamp from server. */
  artifactPersistedUtc?: string | null
}

/** Phase 37: mirrors backend StoredArtifactAccess (camelCase JSON). */
export type StoredArtifactAccess = {
  ownerUserId?: string | null
  accessScope: 'link' | 'private' | 'group' | 'public' | string
  sharedGroupIds: string[]
  allowLinkAccess: boolean
}

export type AppConfig = {
  authEnabled: boolean
  authMode: string
  /** Phase 38: none | proxy | legacy_bearer | jwt | api_key */
  authIdentityKind: string
  /** Short server-provided hint for the active auth mode (no secrets). */
  authHelp: string
  requireIdentityForWrites: boolean
  defaultAccessScope: string
  /** Phase 38: fixed-window limiter on analyze/compare POST when enabled. */
  rateLimitingEnabled: boolean
  storage: { databasePath: string }
}

export type PlanComparisonFindingDelta = {
  findingId: string
  severityA: number
  severityB: number
  category: string
  title: string
  summary: string
}

export type NumericDelta = {
  a: number | null
  b: number | null
  delta: number | null
  deltaPct: number | null
}

export type NodeDelta = {
  nodeIdA: string
  nodeIdB: string
  matchScore: number
  matchConfidence: 'Low' | 'Medium' | 'High' | number
  nodeTypeA: string
  nodeTypeB: string
  relationName: string | null
  indexName: string | null
  inclusiveTimeMs: NumericDelta
  exclusiveTimeMsApprox: NumericDelta
  subtreeTimeShare: NumericDelta
  sharedReadBlocks: NumericDelta
  sharedReadShare: NumericDelta
  rowEstimateFactor: NumericDelta
  actualRowsTotal: NumericDelta
  loops: NumericDelta
}

export type FindingDiffItem = {
  changeType: 'New' | 'Resolved' | 'Worsened' | 'Improved' | 'Unchanged' | string
  ruleId: string
  nodeIdA?: string | null
  nodeIdB?: string | null
  severityA?: number | null
  severityB?: number | null
  title: string
  summary: string
  /** Stable comparison-scoped id (`fd_*`). */
  diffId?: string | null
  /** Indices into `indexComparison.insightDiffs` (legacy; prefer `relatedIndexDiffIds`). */
  relatedIndexDiffIndexes?: number[] | null
  /** Stable ids of related index insight diff rows (`ii_*`). */
  relatedIndexDiffIds?: string[] | null
}

export type FindingsDiff = {
  items: FindingDiffItem[]
}

export type MetricDeltaDetail = {
  key: string
  a: number | null
  b: number | null
  delta: number | null
  deltaPct: number | null
  direction: 'Improved' | 'Worsened' | 'Neutral' | 'NotApplicable' | 'Ambiguous' | string
}

export type NodePairIdentity = {
  nodeIdA: string
  nodeIdB: string
  nodeTypeA: string
  nodeTypeB: string
  relationNameA?: string | null
  relationNameB?: string | null
  indexNameA?: string | null
  indexNameB?: string | null
  joinTypeA?: string | null
  joinTypeB?: string | null
  depthA: number
  depthB: number
  matchConfidence: 'Low' | 'Medium' | 'High' | number
  matchScore: number
  scoreBreakdown: Record<string, number>
  /** Coarse access-path bucket for index/compare deltas (Phase 29). */
  accessPathFamilyA?: string | null
  accessPathFamilyB?: string | null
}

export type NodePairRawFields = {
  filterA?: string | null
  filterB?: string | null
  indexCondA?: string | null
  indexCondB?: string | null
  joinFilterA?: string | null
  joinFilterB?: string | null
  hashCondA?: string | null
  hashCondB?: string | null
  mergeCondA?: string | null
  mergeCondB?: string | null
  sortKeyA?: string | null
  sortKeyB?: string | null
  groupKeyA?: string | null
  groupKeyB?: string | null
  strategyA?: string | null
  strategyB?: string | null
  parallelAwareA?: boolean | null
  parallelAwareB?: boolean | null
  workersPlannedA?: number | null
  workersPlannedB?: number | null
  workersLaunchedA?: number | null
  workersLaunchedB?: number | null
  rowsRemovedByFilterA?: number | null
  rowsRemovedByFilterB?: number | null
  rowsRemovedByJoinFilterA?: number | null
  rowsRemovedByJoinFilterB?: number | null
  rowsRemovedByIndexRecheckA?: number | null
  rowsRemovedByIndexRecheckB?: number | null
  heapFetchesA?: number | null
  heapFetchesB?: number | null
  sortMethodA?: string | null
  sortMethodB?: string | null
  sortSpaceUsedKbA?: number | null
  sortSpaceUsedKbB?: number | null
  sortSpaceTypeA?: string | null
  sortSpaceTypeB?: string | null
  presortedKeyA?: string | null
  presortedKeyB?: string | null
  fullSortGroupsA?: number | null
  fullSortGroupsB?: number | null
  hashBucketsA?: number | null
  hashBucketsB?: number | null
  originalHashBucketsA?: number | null
  originalHashBucketsB?: number | null
  hashBatchesA?: number | null
  hashBatchesB?: number | null
  originalHashBatchesA?: number | null
  originalHashBatchesB?: number | null
  peakMemoryUsageKbA?: number | null
  peakMemoryUsageKbB?: number | null
  diskUsageKbA?: number | null
  diskUsageKbB?: number | null
  innerUniqueA?: boolean | null
  innerUniqueB?: boolean | null
  partialModeA?: string | null
  partialModeB?: string | null
  cacheKeyA?: string | null
  cacheKeyB?: string | null
  cacheHitsA?: number | null
  cacheHitsB?: number | null
  cacheMissesA?: number | null
  cacheMissesB?: number | null
  cacheEvictionsA?: number | null
  cacheEvictionsB?: number | null
  cacheOverflowsA?: number | null
  cacheOverflowsB?: number | null
}

export type PairFindingsView = {
  findingsA: AnalysisFinding[]
  findingsB: AnalysisFinding[]
  relatedDiffItems: FindingDiffItem[]
}

export type IndexInsightDiffItem = {
  /** Lowercase string from API (`new`, `resolved`, …) or legacy numeric enum. */
  kind: string | number
  summary: string
  insightA?: PlanIndexInsight | null
  insightB?: PlanIndexInsight | null
  nodeIdA?: string | null
  nodeIdB?: string | null
  accessPathFamilyA?: string | null
  accessPathFamilyB?: string | null
  /** Indices into `findingsDiff.items` (legacy; prefer `relatedFindingDiffIds`). */
  relatedFindingDiffIndexes?: number[] | null
  /** Stable id (`ii_*`). */
  insightDiffId?: string | null
  /** Stable ids of related finding diff rows (`fd_*`). */
  relatedFindingDiffIds?: string[] | null
}

export type IndexComparisonSummary = {
  overviewLines: string[]
  insightDiffs: IndexInsightDiffItem[]
  narrativeBullets: string[]
  eitherPlanSuggestsChunkedBitmapWorkload: boolean
}

export type NodePairDetail = {
  /** Stable comparison-scoped pair id (`pair_*`). */
  pairArtifactId?: string | null
  identity: NodePairIdentity
  rawFields: NodePairRawFields
  contextEvidenceA?: OperatorContextEvidence | null
  contextEvidenceB?: OperatorContextEvidence | null
  contextDiff?: OperatorContextEvidenceDiff | null
  metrics: MetricDeltaDetail[]
  findings: PairFindingsView
  /** Compare index/access-path cues for this pair (Phase 30). */
  indexDeltaCues?: string[] | null
  /** Finding ↔ index-delta corroboration for this pair (Phase 31). */
  corroborationCues?: string[] | null
}

export type EvidenceChangeDirection =
  | 'Improved'
  | 'Worsened'
  | 'Mixed'
  | 'Changed'
  | 'Neutral'
  | 'NotApplicable'
  | 'Unknown'
  | string

export type OperatorContextEvidenceDiff = {
  highlights: string[]
  overallDirection: EvidenceChangeDirection
  hashBuild?: {
    pressureDirection: EvidenceChangeDirection
    summary?: string | null
    hashBatches: { a: number | null; b: number | null }
    diskUsageKb: { a: number | null; b: number | null }
    peakMemoryUsageKb: { a: number | null; b: number | null }
  } | null
  scanWaste?: {
    wasteDirection: EvidenceChangeDirection
    summary?: string | null
    rowsRemovedByFilter: { a: number | null; b: number | null }
    removedRowsShareApprox: { a: number | null; b: number | null }
    rowsRemovedByIndexRecheck: { a: number | null; b: number | null }
    heapFetches: { a: number | null; b: number | null }
  } | null
  sort?: {
    sortSpillDirection: EvidenceChangeDirection
    summary?: string | null
    sortMethod: { a?: string | null; b?: string | null; direction: EvidenceChangeDirection }
    diskUsageKb: { a: number | null; b: number | null }
    sortSpaceUsedKb: { a: number | null; b: number | null }
  } | null
  memoize?: {
    effectivenessDirection: EvidenceChangeDirection
    summary?: string | null
    cacheHits: { a: number | null; b: number | null }
    cacheMisses: { a: number | null; b: number | null }
    hitRate: { a: number | null; b: number | null }
  } | null
  nestedLoop?: {
    amplificationDirection: EvidenceChangeDirection
    summary?: string | null
    innerLoopsApprox?: { a: number | null; b: number | null; delta?: number | null; deltaPct?: number | null; direction: EvidenceChangeDirection } | null
    innerSubtreeTimeShareOfPlan?: { a: number | null; b: number | null; delta?: number | null; deltaPct?: number | null; direction: EvidenceChangeDirection } | null
    innerSideWaste?: {
      wasteDirection: EvidenceChangeDirection
      summary?: string | null
      rowsRemovedByFilter: { a: number | null; b: number | null }
      removedRowsShareApprox: { a: number | null; b: number | null }
      rowsRemovedByIndexRecheck: { a: number | null; b: number | null }
      heapFetches: { a: number | null; b: number | null }
    } | null
  } | null
}

export type OperatorContextEvidence = {
  hashJoin?: {
    childHash?: {
      hashNodeId?: string | null
      hashBuckets?: number | null
      originalHashBuckets?: number | null
      hashBatches?: number | null
      originalHashBatches?: number | null
      peakMemoryUsageKb?: number | null
      diskUsageKb?: number | null
    } | null
    hashCond?: string | null
    buildSideActualRowsTotal?: number | null
    probeSideActualRowsTotal?: number | null
  } | null
  sort?: {
    sortMethod?: string | null
    sortSpaceUsedKb?: number | null
    sortSpaceType?: string | null
    peakMemoryUsageKb?: number | null
    diskUsageKb?: number | null
    inputActualRowsTotal?: number | null
  } | null
  nestedLoop?: {
    innerNodeId?: string | null
    innerLoopsApprox?: number | null
    innerSubtreeTimeShareOfPlan?: number | null
    innerSideScanWaste?: ScanWasteContextEvidence | null
  } | null
  scanWaste?: ScanWasteContextEvidence | null
  materialize?: {
    loops?: number | null
    subtreeTimeShareOfPlan?: number | null
    subtreeSharedReadShareOfPlan?: number | null
  } | null
  memoize?: {
    cacheKey?: string | null
    cacheHits?: number | null
    cacheMisses?: number | null
    cacheEvictions?: number | null
    cacheOverflows?: number | null
    hitRate?: number | null
  } | null
}

export type ScanWasteContextEvidence = {
  primaryScanNodeId?: string | null
  primaryScanNodeType?: string | null
  relationName?: string | null
  rowsRemovedByFilter?: number | null
  rowsRemovedByJoinFilter?: number | null
  rowsRemovedByIndexRecheck?: number | null
  heapFetches?: number | null
  removedRowsShareApprox?: number | null
}

export type KeyFactor = { key: string; value: number }
export type CandidateMatch = {
  nodeIdA: string
  nodeIdB: string
  score: number
  scoreBreakdown: Record<string, number>
}
export type RejectedCandidate = {
  candidate: CandidateMatch
  whyLost: string[]
}
export type MatchDecisionDiagnostics = {
  nodeIdA: string
  winner: CandidateMatch | null
  winningFactors: KeyFactor[]
  rejectedCandidates: RejectedCandidate[]
}
export type NodeDiagnostics = {
  nodeId: string
  topCandidates: CandidateMatch[]
  decision: MatchDecisionDiagnostics | null
}
export type DiagnosticsPayload = {
  maxCandidatesPerNode: number
  nodesA: NodeDiagnostics[]
}

/** Phase 60: Compare change story (camelCase JSON). */
/** Phase 61: compare change beat with optional pair focus. Legacy: plain string. */
export type ComparisonStoryBeat = {
  text: string
  focusNodeIdA?: string | null
  focusNodeIdB?: string | null
  pairAnchorLabel: string
}

export type ComparisonStory = {
  overview: string
  changeBeats: (string | ComparisonStoryBeat)[]
  investigationPath: string
  structuralReading: string
}

export type PlanComparisonResult = {
  comparisonId: string
  planA: PlanAnalysisResult
  planB: PlanAnalysisResult
  summary: {
    runtimeMsA?: number | null
    runtimeMsB?: number | null
    runtimeDeltaMs?: number | null
    runtimeDeltaPct?: number | null
    sharedReadBlocksA: number
    sharedReadBlocksB: number
    sharedReadDeltaBlocks: number
    sharedReadDeltaPct?: number | null
    nodeCountA: number
    nodeCountB: number
    nodeCountDelta: number
    maxDepthA: number
    maxDepthB: number
    maxDepthDelta: number
    severeFindingsCountA: number
    severeFindingsCountB: number
    severeFindingsDelta: number
  }
  matches: Array<{
    nodeIdA: string
    nodeIdB: string
    matchScore: number
    confidence: 'Low' | 'Medium' | 'High' | number
    scoreBreakdown: Record<string, number>
  }>
  unmatchedNodeIdsA: string[]
  unmatchedNodeIdsB: string[]
  nodeDeltas: NodeDelta[]
  topImprovedNodes: NodeDelta[]
  topWorsenedNodes: NodeDelta[]
  pairDetails: NodePairDetail[]
  findingsDiff: FindingsDiff
  indexComparison?: IndexComparisonSummary | null
  narrative: string
  /** Phase 32: compare-scoped next steps (not identical to plan B analyze list). */
  compareOptimizationSuggestions?: OptimizationSuggestion[] | null
  /** Phase 59: compact bottleneck posture lines (A vs B). */
  bottleneckBrief?: { lines: string[] } | null
  /** Phase 60: before/after change story (backfilled on reopen when absent). */
  comparisonStory?: ComparisonStory | null
  diagnostics?: DiagnosticsPayload | null
  artifactAccess?: StoredArtifactAccess | null
  /** Phase 49: persisted JSON schema generation. */
  artifactSchemaVersion?: number
  artifactPersistedUtc?: string | null
}

