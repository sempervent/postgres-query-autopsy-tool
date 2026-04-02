using System.Collections.Generic;
using PostgresQueryAutopsyTool.Core.Comparison;
using PostgresQueryAutopsyTool.Core.Domain;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class CompareArtifactIdsTests
{
    private const string Cmp = "comparison-test-id";

    [Fact]
    public void FindingDiff_id_is_deterministic_for_same_semantic_content()
    {
        var f = new FindingDiffItem(
            RuleId: "P.seq-scan",
            ChangeType: FindingChangeType.Resolved,
            NodeIdA: "n1",
            NodeIdB: "n2",
            SeverityA: FindingSeverity.Medium,
            SeverityB: null,
            ConfidenceA: FindingConfidence.High,
            ConfidenceB: null,
            Title: "t",
            Summary: "s",
            EvidenceA: new Dictionary<string, object?>(),
            EvidenceB: new Dictionary<string, object?>(),
            RelatedIndexDiffIndexes: Array.Empty<int>());

        var id1 = CompareArtifactIds.FindingDiff(Cmp, f);
        var id2 = CompareArtifactIds.FindingDiff(Cmp, f);
        Assert.Equal(id1, id2);
        Assert.StartsWith("fd_", id1);
        Assert.Equal(15, id1.Length); // fd_ + 12 hex
    }

    [Fact]
    public void AssignFindingDiffIds_order_independent_per_row()
    {
        var a = SampleFinding("rule-a", FindingChangeType.New, "na", "nb");
        var b = SampleFinding("rule-b", FindingChangeType.Resolved, "x", "y");
        var forward = CompareArtifactIds.AssignFindingDiffIds(Cmp, new FindingsDiff(new[] { a, b }));
        var reversed = CompareArtifactIds.AssignFindingDiffIds(Cmp, new FindingsDiff(new[] { b, a }));

        Assert.Equal(
            forward.Items[0].DiffId,
            reversed.Items[1].DiffId);
        Assert.Equal(
            forward.Items[1].DiffId,
            reversed.Items[0].DiffId);
    }

    [Fact]
    public void PairId_stable_for_same_comparison_and_nodes()
    {
        var p1 = CompareArtifactIds.PairId(Cmp, "a", "b");
        var p2 = CompareArtifactIds.PairId(Cmp, "a", "b");
        Assert.Equal(p1, p2);
        Assert.StartsWith("pair_", p1);
    }

    private static FindingDiffItem SampleFinding(
        string rule,
        FindingChangeType change,
        string? na,
        string? nb) =>
        new(
            RuleId: rule,
            ChangeType: change,
            NodeIdA: na,
            NodeIdB: nb,
            SeverityA: null,
            SeverityB: null,
            ConfidenceA: null,
            ConfidenceB: null,
            Title: "t",
            Summary: "s",
            EvidenceA: new Dictionary<string, object?>(),
            EvidenceB: new Dictionary<string, object?>(),
            RelatedIndexDiffIndexes: Array.Empty<int>());
}
