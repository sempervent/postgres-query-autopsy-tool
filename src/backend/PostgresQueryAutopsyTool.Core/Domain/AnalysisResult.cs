using System.Collections.Generic;

namespace PostgresQueryAutopsyTool.Core.Domain;

public sealed record AnalysisNarrative(
    string WhatHappened,
    string WhereTimeWent,
    string WhatLikelyMatters,
    string WhatProbablyDoesNotMatter);

public sealed record AnalysisResult(
    string AnalysisId,
    NormalizedPlanNode Root,
    IReadOnlyList<AnalysisFinding> Findings,
    AnalysisNarrative Narrative);

