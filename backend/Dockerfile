FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first so the package layer is cached when only code changes.
COPY src/HelpDesk.Api/HelpDesk.Api.csproj src/HelpDesk.Api/
RUN dotnet restore src/HelpDesk.Api/HelpDesk.Api.csproj

COPY src/ src/
RUN dotnet publish src/HelpDesk.Api/HelpDesk.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "HelpDesk.Api.dll"]
