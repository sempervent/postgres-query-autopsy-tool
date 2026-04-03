FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish "PostgresQueryAutopsyTool.Api/PostgresQueryAutopsyTool.Api.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
RUN mkdir -p /app/data
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
ENV Storage__DatabasePath=/app/data/autopsy.db
EXPOSE 8080
ENTRYPOINT ["dotnet", "PostgresQueryAutopsyTool.Api.dll"]

