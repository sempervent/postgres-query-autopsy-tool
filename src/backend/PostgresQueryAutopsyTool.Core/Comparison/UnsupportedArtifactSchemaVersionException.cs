namespace PostgresQueryAutopsyTool.Core.Comparison;

public sealed class UnsupportedArtifactSchemaVersionException : Exception
{
    public int PayloadVersion { get; }
    public int MaxSupported { get; }
    public bool IsAnalysis { get; }

    public UnsupportedArtifactSchemaVersionException(int payloadVersion, int maxSupported, bool isAnalysis)
        : base($"Persisted artifact schema version {payloadVersion} is newer than this server supports (max {maxSupported}).")
    {
        PayloadVersion = payloadVersion;
        MaxSupported = maxSupported;
        IsAnalysis = isAnalysis;
    }
}
