using PostgresQueryAutopsyTool.Core.Domain;

namespace PostgresQueryAutopsyTool.Core.Analysis;

public static class PlanTraversal
{
    public static IReadOnlyList<NormalizedPlanNode> Preorder(NormalizedPlanNode root)
    {
        var list = new List<NormalizedPlanNode>();
        VisitPreorder(root, list);
        return list;
    }

    public static IReadOnlyList<NormalizedPlanNode> Postorder(NormalizedPlanNode root)
    {
        var list = new List<NormalizedPlanNode>();
        VisitPostorder(root, list);
        return list;
    }

    private static void VisitPreorder(NormalizedPlanNode node, List<NormalizedPlanNode> output)
    {
        output.Add(node);
        foreach (var child in node.Children)
            VisitPreorder(child, output);
    }

    private static void VisitPostorder(NormalizedPlanNode node, List<NormalizedPlanNode> output)
    {
        foreach (var child in node.Children)
            VisitPostorder(child, output);
        output.Add(node);
    }
}

