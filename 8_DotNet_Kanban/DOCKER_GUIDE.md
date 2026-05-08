# Docker Guide — Kanban Studio

This document explains the purpose, decisions, and inner workings of every Docker-related
file in this project.

---

## Overview

The goal is to run the entire application — Angular frontend, ASP.NET Core API, and MSSQL
database — as a single command with no local .NET SDK, Node.js, or SQL Server required on
the host machine. Docker handles everything.

The result is two running containers reachable at one address:

```
http://localhost:8000   →   ASP.NET Core API (also serves the Angular SPA)
                        →   MSSQL 2022 (internal only, not exposed to browser)
```

---

## Dockerfile

The Dockerfile uses a **multi-stage build** — three separate FROM stages that each do one
job and discard everything they don't need to pass forward. The final image contains only
the compiled, runnable application with no build tools.

### Stage 1 — Build Angular (`frontend-build`)

```dockerfile
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build -- --configuration production
```

**What it does:**
- Starts from the official Node 20 Alpine image (small Linux distro).
- Copies only `package.json` and `package-lock.json` first, then runs `npm ci`.
  Separating this from the source copy means Docker can cache the installed
  `node_modules` layer and skip re-installing packages on every build as long as
  the lock file hasn't changed — this saves several minutes on repeat builds.
- Copies the rest of the frontend source and runs the Angular production build.

**Why Alpine?**
Alpine Linux images are ~5 MB vs ~900 MB for the full Debian-based Node image. Build
tools don't need a full OS; smaller images build and pull faster.

**Why `npm ci` instead of `npm install`?**
`npm ci` installs exactly what's in `package-lock.json` with no version drift. It also
fails if the lock file is out of sync, which catches dependency problems early.

**Output path detail:**
`angular.json` sets `outputPath` to `"../backend/wwwroot"`. The Angular 20
`@angular/build:application` builder always places browser bundles in a `browser/`
subdirectory inside that path. So after this stage, the compiled frontend files are at:

```
/app/backend/wwwroot/browser/
  index.html
  main.js
  polyfills.js
  styles.css
  favicon.ico
```

---

### Stage 2 — Build .NET (`backend-build`)

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS backend-build
WORKDIR /app/backend
COPY backend/*.csproj ./
RUN dotnet restore
COPY backend/ .
COPY --from=frontend-build /app/backend/wwwroot/browser ./wwwroot
RUN dotnet publish -c Release -o /publish
```

**What it does:**
- Starts fresh from the official .NET 9 SDK image. This image has the full compiler,
  EF CLI, and all build tools — it is large (~800 MB) but is discarded after this stage.
- Copies only the `.csproj` file first and runs `dotnet restore`. Same caching trick as
  npm: NuGet packages are cached in a layer that only re-runs when the project file
  changes, not every time a source file changes.
- Copies the rest of the backend source.
- **Copies the Angular output from Stage 1** into `./wwwroot`.

**Why flatten `browser/` into `wwwroot/`?**
The .NET app uses:
```csharp
app.UseStaticFiles();          // serves files from wwwroot/
app.MapFallbackToFile("index.html");  // serves wwwroot/index.html for all non-API routes
```
`MapFallbackToFile("index.html")` looks for the file at `wwwroot/index.html`. If we
copied the Angular output as-is, `index.html` would land at `wwwroot/browser/index.html`
and the fallback would return a 404. Flattening the `browser/` layer one level up means
`wwwroot/index.html` exists exactly where .NET expects it.

- Runs `dotnet publish -c Release -o /publish` — compiles the project in Release mode
  and copies the self-contained output (DLLs, assets, `wwwroot/`) to `/publish`.

---

### Stage 3 — Runtime (`runtime`)

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=backend-build /publish .
EXPOSE 8000
ENV ASPNETCORE_URLS=http://+:8000
ENTRYPOINT ["dotnet", "KanbanApi.dll"]
```

**What it does:**
- Starts from the ASP.NET Core 9 **runtime** image — not the SDK. The runtime image is
  ~220 MB vs ~800 MB for the SDK. It has everything needed to *run* a .NET app but none
  of the build tools.
- Copies only the published output from Stage 2. Everything else (Node, npm, the .NET
  SDK, intermediate build files) is discarded.
- `EXPOSE 8000` documents that the container listens on port 8000 (Docker Compose maps
  this to the host).
- `ENV ASPNETCORE_URLS=http://+:8000` tells Kestrel (the .NET web server) to listen on
  all network interfaces on port 8000, not just localhost.
- `ENTRYPOINT` runs the application when the container starts.

**Why not use `dotnet run`?**
`dotnet run` compiles on startup. `dotnet KanbanApi.dll` runs the pre-compiled output
directly — faster startup and no SDK required.

---

## docker-compose.yml

Docker Compose defines and wires together the two services the application needs.

```yaml
services:
  db:
    ...
  api:
    ...
volumes:
  mssql_data:
```

### `db` service

```yaml
db:
  image: mcr.microsoft.com/mssql/server:2022-latest
  environment:
    SA_PASSWORD: ${SA_PASSWORD}
    ACCEPT_EULA: "Y"
  ports:
    - "1433:1433"
  volumes:
    - mssql_data:/var/opt/mssql
  healthcheck:
    test: ["CMD", "/opt/mssql-tools18/bin/sqlcmd",
           "-S", "localhost", "-U", "sa", "-P", "${SA_PASSWORD}",
           "-Q", "SELECT 1", "-b", "-No"]
    interval: 10s
    timeout: 3s
    retries: 10
    start_period: 30s
```

**`image`** — Uses the official Microsoft SQL Server 2022 Linux image. No custom
Dockerfile needed for the database.

**`SA_PASSWORD` and `ACCEPT_EULA`** — Required by the MSSQL image to start. `SA_PASSWORD`
is the system administrator password. `${SA_PASSWORD}` is a Docker Compose variable that
reads from the `.env` file at startup. `ACCEPT_EULA: "Y"` is Microsoft's licence
acceptance mechanism; without it the container refuses to start.

**`ports: "1433:1433"`** — Maps the container's SQL Server port to the host. This lets
you connect to the database from a local SQL client (e.g. Azure Data Studio) during
development. In production you would remove this and keep the DB on an internal network
only.

**`volumes: mssql_data`** — Mounts a named Docker volume at `/var/opt/mssql`, which is
where SQL Server stores its data files. Without this, every time you stop the container
all your data is lost. The named volume persists across container restarts and rebuilds.

**`healthcheck`** — This is critical. SQL Server takes 10–30 seconds to fully start after
the container is "running". Without a healthcheck, the `api` container would start
immediately and try to connect to the database before it's ready, causing a crash.
The healthcheck runs `sqlcmd -Q "SELECT 1"` every 10 seconds. Until it succeeds, the
`db` service is not considered healthy.

- `/opt/mssql-tools18/bin/sqlcmd` — The correct path in the MSSQL 2022 image. The 2019
  and earlier images used `/opt/mssql-tools/bin/sqlcmd`; 2022 moved to `tools18`.
- `-b` — Exit with error code on SQL failure (makes the healthcheck fail properly).
- `-No` — Skip TLS certificate validation (needed for the newer sqlcmd tool which
  enforces TLS by default against a local self-signed cert).

### `api` service

```yaml
api:
  build: .
  ports:
    - "8000:8000"
  environment:
    ConnectionStrings__Default: "Server=db;..."
    OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
    ASPNETCORE_URLS: http://+:8000
  depends_on:
    db:
      condition: service_healthy
```

**`build: .`** — Tells Compose to build the image using the `Dockerfile` in the current
directory (the project root), rather than pulling a pre-built image.

**`ports: "8000:8000"`** — Maps the container's port 8000 to the host's port 8000.
This is the single entry point for the entire application — both the API and the Angular
SPA are served from here.

**`ConnectionStrings__Default`** — Passes the MSSQL connection string to the .NET app as
an environment variable. The double underscore `__` is ASP.NET Core's convention for
nested config keys, equivalent to `ConnectionStrings:Default` in `appsettings.json`.
Notice `Server=db` — `db` is the service name defined above, which Docker Compose
resolves to the database container's internal IP address automatically via its built-in
DNS.

**`OPENROUTER_API_KEY`** — Passed through from the `.env` file to the container so the
AI service can authenticate with OpenRouter.

**`ASPNETCORE_URLS: http://+:8000`** — Tells the .NET Kestrel server to listen on all
interfaces on port 8000 (also set in the Dockerfile as ENV, but setting it here too makes
it explicit and overrideable per environment).

**`depends_on: condition: service_healthy`** — Compose will not start the `api` container
until the `db` healthcheck passes. This is the key coordination mechanism — it replaces
the need for retry logic in the application startup code.

### Named volume

```yaml
volumes:
  mssql_data:
```

Declares the `mssql_data` volume at the top level so Compose manages its lifecycle.
Run `docker volume ls` to see it. Run `docker volume rm kanban_mssql_data` to wipe the
database entirely (useful when you need to reset all data).

---

## scripts/start-dev.ps1

```powershell
$ErrorActionPreference = "Stop"

$envFile = Join-Path $PSScriptRoot ".." ".env"
if (-not (Test-Path $envFile)) {
    Write-Error ".env not found. Copy .env.example to .env and fill in values."
}

Get-Content $envFile | ForEach-Object {
    if ($_ -match "^([^#][^=]*)=(.*)$") {
        [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}

Set-Location (Join-Path $PSScriptRoot "..")
docker compose up --build
```

**Line by line:**

`$ErrorActionPreference = "Stop"` — Makes the script abort on the first error rather than
silently continuing. Without this, PowerShell swallows non-terminating errors and carries
on, which can produce confusing half-started states.

`$PSScriptRoot` — A PowerShell automatic variable that always resolves to the directory
containing the script file (`scripts/`). Using it instead of a relative path like `../`
means the script works correctly no matter which directory you run it from.

`.env` check — Detects early if the file is missing and prints a clear message instead of
letting `docker compose` fail with a cryptic "variable not set" error.

`Get-Content .env | ForEach-Object` — Reads the `.env` file line by line.

`if ($_ -match "^([^#][^=]*)=(.*)$")` — The regex matches lines of the form `KEY=VALUE`
and skips blank lines and comments (lines starting with `#`). `$matches[1]` captures the
key, `$matches[2]` captures the value.

`[System.Environment]::SetEnvironmentVariable(...)` — Sets each key-value pair as a
process-level environment variable. Docker Compose reads these when it encounters
`${SA_PASSWORD}` or `${OPENROUTER_API_KEY}` in `docker-compose.yml`.

**Why not just use `docker compose --env-file .env up`?**
That flag also works, but the script approach makes the intent explicit, validates the
file exists before handing off to Docker, and could be extended to do pre-flight checks
(e.g. verify Docker is running) without changing the compose file itself.

`Set-Location (Join-Path $PSScriptRoot "..")` — Changes the working directory to the
project root so `docker compose` finds `docker-compose.yml` and the `Dockerfile` in `.`.

`docker compose up --build` — Starts all services. `--build` forces Docker to rebuild
the `api` image every time, so your latest code changes are always included. Without
`--build`, Docker would reuse the cached image from the last run.

---

## .dockerignore

The `.dockerignore` file tells Docker which files to exclude from the **build context** —
the set of files sent to the Docker daemon when building the image.

```
**/bin
**/obj
**/wwwroot
**/node_modules
frontend/dist
.env
*.env.*
.git
```

**Why this matters:** Without `.dockerignore`, Docker sends the entire project directory
to the daemon, including `node_modules` (can be hundreds of MB) and `bin/obj` (compiled
output). This makes every build slow even if source code hasn't changed.

**`**/wwwroot`** — Excludes any locally-built Angular output. The Dockerfile always
builds Angular from source inside the container, so a local `wwwroot/` would just be
stale noise if it were included. More importantly, if it were included and `COPY backend/ .`
ran before the Angular stage completed, the local dev build (unoptimised) would be used
instead of the production build.

**`.env`** — Never include secrets in a Docker image. Environment variables are injected
at runtime by Docker Compose, not baked into the image at build time.

---

## First-run checklist

```
1. Copy .env.example → .env and fill in SA_PASSWORD and OPENROUTER_API_KEY
2. Run:  ./scripts/start-dev.ps1
3. Wait for "Now listening on: http://[::]:8000" in the logs
4. Open http://localhost:8000
5. Log in with user / password
```

To stop: `./scripts/stop-dev.ps1` or `Ctrl+C` then `docker compose down`.

To wipe the database and start fresh:
```powershell
docker compose down -v   # -v removes the named volume
```
