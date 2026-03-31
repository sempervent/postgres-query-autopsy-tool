using System.Text.Json;
using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Parsing;

public interface IPlanParser
{
    NormalizedPlanNode ParsePostgresExplain(JsonElement postgresExplainJson);
}

