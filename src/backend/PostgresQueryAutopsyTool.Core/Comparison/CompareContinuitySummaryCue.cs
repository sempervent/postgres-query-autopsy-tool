namespace PostgresQueryAutopsyTool.Core.Comparison;

/// <summary>Phase 69–70: compact summary-lane cue from structured continuity; falls back to hint heuristics when needed.</summary>
public static class CompareContinuitySummaryCue
{
    /// <summary>Primary path: map stable <see cref="RegionContinuityData.KindKey"/> + outcome to chip text.</summary>
    public static string? FromContinuity(RegionContinuityData? data)
    {
        if (data is null)
            return null;

        return data.KindKey switch
        {
            "ordering.strong" => "Same region · ordering now satisfied",
            "ordering.weak" => "Ordering region · strategy changed (weak JSON link)",
            "ordering.queryText" => "Ordering region · query-assisted tie-break",
            "access.seqToBitmap" => "Same relation · seq to bitmap",
            "access.seqVsBitmap.regression" => "Same relation · broader access",
            "access.bitmapToIndex" => "Same relation · bitmap to index",
            "access.indexToBitmap.regression" => "Same relation · index to bitmap · regression",
            "access.indexToIndexOnly" => "Same relation · index-only path",
            "access.indexOnlyToHeap.regression" => "Same relation · more heap work",
            "access.narrower.orderStrong" => "Same region · narrower access · ordering strong",
            "access.narrower.orderWeak" => "Same region · narrower access · ordering weak",
            "access.narrower.orderQueryText" => "Ordering region · narrower access · query-assisted",
            "access.narrower.sortParent" => "Same region · ordering via access path",
            "access.narrower" => data.Outcome == ContinuityOutcome.Regressed
                ? "Same region · broader access"
                : "Same region · narrower access",
            "access.indexToSeq.regression" => "Same relation · seq scan · regression",
            "access.generic" => "Same relation · strategy shift",
            "join.nlToHash" or "join.hashToNl" or "join.strategyShift" => "Same region · join strategy shift",
            "aggregate.partialFinal" => "Same grouped output · partial/final shift",
            "aggregate.partialFinal.queryText" => "Same grouped output · partial/final · SQL hint",
            "aggregate.queryTextGroupKeyBridge" => "Same grouped output · GROUP BY text bridge",
            "aggregate.gatherVsSingle" => "Same grouped output · gather vs single aggregate",
            "aggregate.singleVsGather" => "Same grouped output · gather stack on B",
            _ => FromHint(data.Hint)
        };
    }

    /// <summary>Legacy substring fallback when only the long hint is available.</summary>
    public static string? FromHint(string? regionContinuityHint)
    {
        if (string.IsNullOrWhiteSpace(regionContinuityHint))
            return null;

        var h = regionContinuityHint.ToLowerInvariant();

        if (h.Contains("strong ordering evidence"))
            return "Same region · ordering now satisfied";

        if (h.Contains("token-level ordering link"))
            return "Same region · ordering likely shifted";

        if (h.Contains("order by text") && h.Contains("cautious"))
            return "Same region · ordering (query-assisted)";

        if (h.Contains("index-only path") || h.Contains("index only scan"))
            return "Same relation · index-only path";

        if (h.Contains("bitmap heap stack") && h.Contains("direct index-backed"))
            return "Same relation · bitmap to index";

        if (h.Contains("bitmap heap path") || (h.Contains("bitmap heap") && h.Contains("same relation")))
            return "Same relation · bitmap access";

        if (h.Contains("index to bitmap.regression") || h.Contains("regression toward bitmap"))
            return "Same relation · index to bitmap · regression";

        if (h.Contains("same ordering region") || (h.Contains("explicit sort") && h.Contains("order")))
            return "Same region · ordering shift";

        if (h.Contains("feeding an explicit sort") || (h.Contains("explicit sort") && h.Contains("index-backed")))
            return "Same region · ordering via access path";

        if (h.Contains("nested-loop") || h.Contains("hash build"))
            return "Same region · join strategy shift";

        if (h.Contains("sequential scan") && h.Contains("index-backed"))
            return "Same region · narrower access";

        if (h.Contains("access narrowed"))
            return "Same region · narrower access · residual cost";

        if (h.Contains("partial win"))
            return "Same region · partial win · check parents";

        if (h.Contains("same relation"))
            return "Same relation · strategy shift";

        return "Same region · strategy shift";
    }
}
