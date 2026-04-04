namespace PostgresQueryAutopsyTool.Core.Analysis;

/// <summary>Phase 59: conservative human-meaningful bottleneck category (evidence-derived).</summary>
public enum BottleneckClass
{
    CpuHotspot,
    IoHotspot,
    SortOrSpillPressure,
    JoinAmplification,
    ScanFanout,
    AggregationPressure,
    QueryShapeBoundary,
    PlannerMisestimation,
    /// <summary>Index or bitmap path exists but reads/heap/recheck remain high.</summary>
    AccessPathMismatch,
    GeneralTime
}
