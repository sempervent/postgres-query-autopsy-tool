using PostgresQueryAutopsyTool.Core.OperatorEvidence;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class ContextEvidenceDiffSummarizerTests
{
    [Fact]
    public void Hash_build_diff_reports_batches_and_disk_appearance()
    {
        var a = new OperatorContextEvidence(
            HashJoin: new HashJoinContextEvidence(
                ChildHash: new HashChildEvidence("hA", null, null, 1, 1, null, 0),
                HashCond: null,
                BuildSideActualRowsTotal: null,
                ProbeSideActualRowsTotal: null));

        var b = new OperatorContextEvidence(
            HashJoin: new HashJoinContextEvidence(
                ChildHash: new HashChildEvidence("hB", null, null, 8, 1, null, 65536),
                HashCond: null,
                BuildSideActualRowsTotal: null,
                ProbeSideActualRowsTotal: null));

        var d = ContextEvidenceDiffSummarizer.Diff(a, b);
        Assert.NotNull(d);
        Assert.NotNull(d!.HashBuild);
        Assert.Contains("batches 1→8", string.Join(" ", d.Highlights));
        Assert.Contains("disk 0→65536", string.Join(" ", d.Highlights));
        Assert.Equal(EvidenceChangeDirection.Worsened, d.HashBuild!.PressureDirection);
    }

    [Fact]
    public void Scan_waste_diff_reports_removed_by_filter_drop()
    {
        var a = new OperatorContextEvidence(ScanWaste: new ScanWasteContextEvidence("s", "Seq Scan", "t", 900000, null, null, null, 0.90));
        var b = new OperatorContextEvidence(ScanWaste: new ScanWasteContextEvidence("s", "Index Scan", "t", 10000, null, null, null, 0.02));

        var d = ContextEvidenceDiffSummarizer.Diff(a, b);
        Assert.NotNull(d?.ScanWaste);
        Assert.Contains("removedByFilter 900000→10000", string.Join(" ", d!.Highlights));
        Assert.Equal(EvidenceChangeDirection.Improved, d.ScanWaste!.WasteDirection);
    }

    [Fact]
    public void Sort_diff_reports_in_memory_to_disk_backed()
    {
        var a = new OperatorContextEvidence(Sort: new SortContextEvidence("quicksort", 0, "Memory", null, 0, null));
        var b = new OperatorContextEvidence(Sort: new SortContextEvidence("external merge", 204800, "Disk", null, 204800, null));

        var d = ContextEvidenceDiffSummarizer.Diff(a, b);
        Assert.NotNull(d?.Sort);
        Assert.Contains("in-memory→disk-backed", string.Join(" ", d!.Highlights));
        Assert.Equal(EvidenceChangeDirection.Worsened, d.Sort!.SortSpillDirection);
    }

    [Fact]
    public void Memoize_diff_reports_hit_rate_change()
    {
        var a = new OperatorContextEvidence(Memoize: new MemoizeContextEvidence("k", 50, 50, null, null, 0.50));
        var b = new OperatorContextEvidence(Memoize: new MemoizeContextEvidence("k", 90, 10, null, null, 0.90));

        var d = ContextEvidenceDiffSummarizer.Diff(a, b);
        Assert.NotNull(d?.Memoize);
        Assert.Contains("hitRate", string.Join(" ", d!.Highlights));
        Assert.Equal(EvidenceChangeDirection.Improved, d.Memoize!.EffectivenessDirection);
    }
}

