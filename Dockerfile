# Multi-stage .NET 10 container for Render and other Linux hosts.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY NuGet.Config ./
COPY BanhangcodeX.csproj ./
RUN dotnet restore BanhangcodeX.csproj --configfile NuGet.Config
COPY . ./
RUN dotnet publish BanhangcodeX.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish ./
ENV ASPNETCORE_URLS=http://0.0.0.0:10000
EXPOSE 10000
ENTRYPOINT ["dotnet", "BanhangcodeX.dll"]
