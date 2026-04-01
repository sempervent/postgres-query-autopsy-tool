using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Comparison;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class FindingIndexDiffLinkerTests
{
    [Fact]
    public void Apply_links_resolved_scan_finding_to_index_insight_on_same_mapped_pair()
    {
        var a = IndexComparisonAnalyzerTests.AnalyzePostgresJson("compare_before_seq_scan.json");
        var b = IndexComparisonAnalyzerTests.AnalyzePostgresJson("compare_after_index_scan.json");
        var cmp = new ComparisonEngine().Compare(a, b);

        var withLinks = cmp.FindingsDiff.Items.Where(f => f.RelatedIndexDiffIndexes.Count > 0).ToArray();
        Assert.NotEmpty(withLinks);

        foreach (var f in withLinks)
        {
            foreach (var ii in f.RelatedIndexDiffIndexes)
            {
                Assert.InRange(ii, 0, cmp.IndexComparison.InsightDiffs.Count);
                var idx = cmp.IndexComparison.InsightDiffs[ii];
                Assert.Contains(ii, idx.RelatedFindingDiffIndexes);
            }
        }

        var seqResolved = cmp.FindingsDiff.Items.FirstOrDefault(f =>
            f.ChangeType == FindingChangeType.Resolved &&
            f.RuleId.Contains("seq-scan", StringComparison.OrdinalIgnoreCase));
        if (seqResolved is not null && seqResolved.RelatedIndexDiffIndexes.Count > 0)
        {
            var linked = cmp.IndexComparison.InsightDiffs[seqResolved.RelatedIndexDiffIndexes[0]];
            Assert.NotEqual(IndexInsightDiffKind.Unchanged, linked.Kind);
        }
    }

    [Fact]
    public void LinkedNarrativeLines_non_empty_when_structured_overlap_exists()
    {
        var a = IndexComparisonAnalyzerTests.AnalyzePostgresJson("compare_before_seq_scan.json");
        var b = IndexComparisonAnalyzerTests.AnalyzePostgresJson("compare_after_index_scan.json");
        var cmp = new ComparisonEngine().Compare(a, b);

        var lines = FindingIndexDiffLinker.LinkedNarrativeLines(cmp.FindingsDiff, cmp.IndexComparison, maxLines: 3);
        if (cmp.FindingsDiff.Items.Any(f => f.RelatedIndexDiffIndexes.Count > 0))
            Assert.NotEmpty(lines);
    }

    [Fact]
    public void IndexInsightDiffKind_serializes_as_lowercase_json_string()
    {
        var item = new IndexInsightDiffItem(
            Kind: IndexInsightDiffKind.Resolved,
            Summary: "test",
            InsightA: null,
            InsightB: null,
            NodeIdA: null,
            NodeIdB: null,
            AccessPathFamilyA: null,
            AccessPathFamilyB: null,
            RelatedFindingDiffIndexes: new[] { 1 });

        var json = JsonSerializer.Serialize(item, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        Assert.Contains("\"kind\":\"resolved\"", json);
        Assert.Contains("\"relatedFindingDiffIndexes\":[1]", json);
    }
}
