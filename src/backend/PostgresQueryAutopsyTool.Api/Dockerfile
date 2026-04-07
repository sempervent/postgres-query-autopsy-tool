# Phase 79: Multi-arch index digests — bump when retargeting .NET 8 patch (`buildx imagetools inspect …:8.0`).
FROM mcr.microsoft.com/dotnet/sdk:8.0@sha256:a9330090b730c2abde8f3f43b3d1e24e4b8cba028de7bab1a7fdcd50cb7a3b7e AS build
WORKDIR /src
COPY . .
RUN dotnet publish "PostgresQueryAutopsyTool.Api/PostgresQueryAutopsyTool.Api.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0@sha256:d4d80bf500f4c8307e5c44bf61eb58aec027da07c4d1c40816846fe5eef3f34d AS runtime
WORKDIR /app
RUN mkdir -p /app/data
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
ENV Storage__DatabasePath=/app/data/autopsy.db
EXPOSE 8080
ENTRYPOINT ["dotnet", "PostgresQueryAutopsyTool.Api.dll"]

