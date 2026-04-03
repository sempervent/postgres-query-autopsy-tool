using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Parsing;
using Xunit;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class PlanInputNormalizerTests
{
    [Fact]
    public void Raw_json_array_unchanged()
    {
        var j = """[{"Plan":{"Node Type":"Result"}}]""";
        var r = PlanInputNormalizer.TryNormalizeToJson(j);
        Assert.True(r.Success);
        Assert.Equal("rawJson", r.Info!.Kind);
        Assert.Equal(j, r.NormalizedJson);
    }

    [Fact]
    public void Query_plan_table_with_separator_footer_and_plus_wraps()
    {
        var inner = """[{"Plan":{"Node Type":"Result","Parallel Aware":false}}]""";
        var split = 22;
        var pasted = $"""
QUERY PLAN
--------------------------------------------------------------------------------
| {inner[..split]}+
| {inner[split..]}
(1 row)
""";
        var r = PlanInputNormalizer.TryNormalizeToJson(pasted);
        Assert.True(r.Success);
        Assert.Equal("queryPlanTable", r.Info!.Kind);
        Assert.Equal(inner, r.NormalizedJson);
    }

    [Fact]
    public void Query_plan_without_pipes_still_works()
    {
        var inner = """[{"x":1}]""";
        var pasted =
            "QUERY PLAN\n" +
            "----------\n" +
            inner[..6] + "+\n" +
            inner[6..] + "\n" +
            "(1 row)\n";
        var r = PlanInputNormalizer.TryNormalizeToJson(pasted);
        Assert.True(r.Success);
        Assert.Equal(inner, r.NormalizedJson);
    }

    [Fact]
    public void Malformed_json_after_wrapper_fails_with_hint()
    {
        var pasted =
            """
            QUERY PLAN
            ------------
            [ not json
            (1 row)
            """;
        var r = PlanInputNormalizer.TryNormalizeToJson(pasted);
        Assert.False(r.Success);
        Assert.Contains("tabular", r.ErrorMessage!, StringComparison.OrdinalIgnoreCase);
        Assert.NotNull(r.ErrorHint);
    }

    [Fact]
    public void Non_json_without_query_plan_fails()
    {
        var r = PlanInputNormalizer.TryNormalizeToJson("hello world");
        Assert.False(r.Success);
    }

    [Fact]
    public void Normalized_plan_parses_with_Postgres_fixture_shape()
    {
        var path = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "../../../fixtures/postgres-json", "simple_seq_scan.json"));
        var inner = File.ReadAllText(path).Trim();
        var pasted =
            "QUERY PLAN\n" +
            "----------\n" +
            inner[..Math.Min(40, inner.Length)] +
            (inner.Length > 40 ? "+\n" + inner[40..] : "") +
            "\n(1 row)\n";
        var r = PlanInputNormalizer.TryNormalizeToJson(pasted);
        Assert.True(r.Success);
        using var doc = JsonDocument.Parse(r.NormalizedJson!);
        Assert.Equal(JsonValueKind.Array, doc.RootElement.ValueKind);
    }
}
