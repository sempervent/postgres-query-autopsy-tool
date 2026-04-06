using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Comparison;

namespace PostgresQueryAutopsyTool.Tests.Unit;

public sealed class ComparisonStoryBeatJsonTests
{
    [Fact]
    public void ComparisonStory_roundtrips_beatBriefing()
    {
        var story = new ComparisonStory(
            "overview",
            new[]
            {
                new ComparisonStoryBeat("Main beat", "a", "b", "pair label", "Plan B briefing snippet"),
                new ComparisonStoryBeat("Plain", null, null, "")
            },
            "investigate",
            "structural");

        var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        var json = JsonSerializer.Serialize(story, options);
        Assert.Contains("beatBriefing", json, StringComparison.Ordinal);
        var back = JsonSerializer.Deserialize<ComparisonStory>(json, options);
        Assert.NotNull(back);
        Assert.Equal("Plan B briefing snippet", back!.ChangeBeats[0].BeatBriefing);
        Assert.Null(back.ChangeBeats[1].BeatBriefing);
    }
}
