using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Analysis;

public sealed class PlanNodeIndex
{
    public IReadOnlyDictionary<string, NormalizedPlanNode> ById { get; }
    public IReadOnlyDictionary<string, string?> ParentById { get; }
    public IReadOnlyDictionary<string, IReadOnlyList<string>> ChildrenById { get; }

    private PlanNodeIndex(
        Dictionary<string, NormalizedPlanNode> byId,
        Dictionary<string, string?> parentById,
        Dictionary<string, IReadOnlyList<string>> childrenById)
    {
        ById = byId;
        ParentById = parentById;
        ChildrenById = childrenById;
    }

    public static PlanNodeIndex Build(NormalizedPlanNode root)
    {
        var byId = new Dictionary<string, NormalizedPlanNode>(StringComparer.Ordinal);
        var parentById = new Dictionary<string, string?>(StringComparer.Ordinal);
        var childrenById = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal);

        void Walk(NormalizedPlanNode node, string? parentId)
        {
            byId[node.NodeId] = node;
            parentById[node.NodeId] = parentId;
            childrenById[node.NodeId] = node.Children.Select(c => c.NodeId).ToArray();

            foreach (var child in node.Children)
                Walk(child, node.NodeId);
        }

        Walk(root, null);
        return new PlanNodeIndex(byId, parentById, childrenById);
    }
}

