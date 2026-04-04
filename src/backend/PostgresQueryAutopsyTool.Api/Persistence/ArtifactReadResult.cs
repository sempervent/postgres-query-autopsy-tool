namespace PostgresQueryAutopsyTool.Api.Persistence;

public enum ArtifactReadStatus
{
    Ok,
    NotFound,
    CorruptPayload,
    IncompatibleSchema
}

/// <summary>Outcome of loading a persisted analyze/compare row (Phase 49).</summary>
public readonly record struct ArtifactReadResult<T>(ArtifactReadStatus Status, T? Value = default, string? ErrorCode = null, string? Message = null, int? SchemaVersion = null)
{
    public static ArtifactReadResult<T> OkResult(T value) => new(ArtifactReadStatus.Ok, value);

    public static ArtifactReadResult<T> Missing() => new(ArtifactReadStatus.NotFound);

    public static ArtifactReadResult<T> Corrupt(string code, string message) =>
        new(ArtifactReadStatus.CorruptPayload, default, code, message);

    public static ArtifactReadResult<T> Incompatible(int schemaVersion, string code, string message) =>
        new(ArtifactReadStatus.IncompatibleSchema, default, code, message, schemaVersion);
}
