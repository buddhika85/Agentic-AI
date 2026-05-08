# ── Stage 1: Build Angular ─────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
# outputPath in angular.json is "../backend/wwwroot"; the application builder
# places browser bundles in a browser/ subdirectory → /app/backend/wwwroot/browser/
RUN npm run build -- --configuration production

# ── Stage 2: Build .NET ────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS backend-build
WORKDIR /app/backend
COPY backend/*.csproj ./
RUN dotnet restore
COPY backend/ .
# Flatten browser/ into wwwroot/ so MapFallbackToFile("index.html") resolves correctly
COPY --from=frontend-build /app/backend/wwwroot/browser ./wwwroot
RUN dotnet publish -c Release -o /publish

# ── Stage 3: Runtime ───────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=backend-build /publish .
EXPOSE 8000
ENV ASPNETCORE_URLS=http://+:8000
ENTRYPOINT ["dotnet", "KanbanApi.dll"]
