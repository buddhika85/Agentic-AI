# NEXT.md — Resumption Guide

This file tells you exactly where to pick up work. Read it before touching any code.
Full step-by-step detail lives in **PLAN.md** — this file is the briefing, not the manual.

---

## Where We Are

All 9 steps of PLAN.md are **complete**. The project is fully built and verified.

```
✅ Step 1 — Scaffold (.NET 9 + Angular 20)
✅ Step 2 — Database (EF Core 9 + MSSQL)
✅ Step 3 — Authentication (session tokens)
✅ Step 4 — Board API
✅ Step 5 — AI Chat Endpoint (OpenRouter)
✅ Step 6 — Angular Frontend (full UI)
✅ Step 7 — Docker & Docker Compose
✅ Step 8 — Tests (xUnit + Karma/Jasmine)
✅ Step 9 — Run & Verify (Docker end-to-end)
```

---

## How to Run Locally Right Now (Before Docker)

Two terminals required:

**Terminal 1 — Backend**
```powershell
cd backend
dotnet run
# Starts on http://localhost:5290
# Requires a running MSSQL instance (see below)
```

**Terminal 2 — Frontend dev server**
```powershell
cd frontend
npm start
# Starts on http://localhost:4200
# Proxies /api → http://localhost:5290 (see proxy.conf.json)
```

**MSSQL for local dev** — the easiest way without Docker is to spin up just the DB container:
```powershell
docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=YourStr0ngP@ssword!" `
           -p 1433:1433 --name kanban-db -d `
           mcr.microsoft.com/mssql/server:2022-latest
```
Then set the connection string in `backend/appsettings.Development.json`:
```json
{
  "ConnectionStrings": {
    "Default": "Server=localhost,1433;Database=KanbanDb;User Id=sa;Password=YourStr0ngP@ssword!;TrustServerCertificate=True;"
  }
}
```

**OpenRouter API key** — stored in .NET user secrets for local dev:
```powershell
cd backend
dotnet user-secrets set "OPENROUTER_API_KEY" "sk-or-v1-your-key-here"
```

Default login credentials: `user` / `password`

---

## Completed Work Summary

### Step 7 — Docker & Docker Compose ✅ Complete

- `Dockerfile` — multi-stage: Angular build → .NET build → runtime image
- `docker-compose.yml` — `api` (port 8000) + `db` (MSSQL 2022 with healthcheck) + `restart: on-failure`
- `.dockerignore` — excludes `wwwroot/`, `bin/`, `obj/`, `node_modules/`
- `scripts/start-dev.ps1` — loads `.env` then runs `docker compose up --build`
- `scripts/stop-dev.ps1` — runs `docker compose down`

**Angular output path note:** `@angular/build:application` places browser bundles in
`wwwroot/browser/` (not `wwwroot/`). The Dockerfile flattens `browser/` into `wwwroot/`
so `MapFallbackToFile("index.html")` resolves correctly.

---

### Step 8 — Tests ✅ Complete

**Backend — 16 xUnit tests across 3 files (`backend/Tests/`)**
- `AuthEndpointTests.cs` — login success/failure, verify, logout invalidation
- `BoardEndpointTests.cs` — seeding, auth guard, name update, 6-column truncation, card persistence
- `AiServiceTests.cs` — valid JSON, board update deserialization, markdown fence stripping, fallback, HTTP error

Run: `cd backend && dotnet test`

**Frontend — 5 Karma/Jasmine tests (`frontend/src/app/board/board.service.spec.ts`)**
- 800ms debounce fires exactly once for 3 rapid calls
- Single call fires after 900ms
- Signal updates synchronously
- `applyAiBoardUpdate` posts immediately (no debounce)
- `applyAiBoardUpdate` caps columns at 5

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless`

---

### Step 9 — Run & Verify ✅ Complete

Stack verified running on http://localhost:8000. All smoke tests passed:
- `GET /api/health` → `{ status: "ok" }`
- `POST /api/auth/login` → 64-char token
- `GET /api/board` → board with 3 default columns

**Post-plan fix:** `Program.cs` migration startup has a 5-attempt retry loop to handle the race
where MSSQL is still recovering an existing volume when the healthcheck passes.

To start: `.\scripts\start-dev.ps1` (from project root, requires `.env`)
To stop: `.\scripts\stop-dev.ps1`

---

## Important Things to Know Before Starting

### Deviations from the original PLAN.md

| Plan said | What was actually built |
|-----------|------------------------|
| Angular 18 | Angular **20** — same patterns, different package versions |
| JWT Bearer auth | Custom **session-token** auth — 64-char hex stored in `Sessions` DB table, 8-hour expiry |
| Tailwind v4 (`@import "tailwindcss"`) | Tailwind **v3** — requires `tailwind.config.js` + `postcss.config.js`. v4 was incompatible with Angular 20's esbuild builder |
| `cdkDropListGroup` for cards | Replaced with explicit `[cdkDropListConnectedTo]` because column-level drag was added |

### Business rules enforced in code

- **Max 5 columns** per board — enforced in `BoardService.SaveBoardAsync()` (backend, silently truncates) AND `submitColumn()` + `applyAiBoardUpdate()` (frontend). The "Add column" button is hidden at the limit.
- **Delete column** — only permitted when `cards.length === 0`. Trash icon is only visible on empty columns.
- **AI cannot bypass the column limit** — `applyAiBoardUpdate()` slices to 5 before setting state or persisting.

### Architecture reminders

- The backend token extractor reads `Authorization` header as a raw string and strips `"Bearer "` — it does **not** use ASP.NET Core's built-in JWT middleware.
- `BoardService.updateBoard()` debounces saves by **800ms** — do not reduce this; it prevents flooding during drag-drop.
- `applyAiBoardUpdate()` skips the debounce and saves immediately.
- `app.MapFallbackToFile("index.html")` in `Program.cs` **must remain the last registered route** — moving it above any API route will shadow that route.
- Angular build output goes to `backend/wwwroot/` (set in `angular.json`). The `.gitignore` excludes this folder — the production Docker build regenerates it.

### Environment variables needed

Copy `.env.example` → `.env` at the project root and fill in both values:

```
SA_PASSWORD=        # Must meet SQL Server complexity: 8+ chars, upper+lower+digit+symbol
OPENROUTER_API_KEY= # Bearer token from openrouter.ai
```

The `.env` file is gitignored. Never commit it.

### Key files quick reference

| File | What it does |
|------|-------------|
| `backend/Program.cs` | DI, middleware, auto-migrate, seed user, route registration |
| `backend/Services/BoardService.cs` | Board CRUD + 5-column cap |
| `backend/Services/AiService.cs` | OpenRouter HTTP client, model: `openai/gpt-oss-120b:free` |
| `backend/Filters/TokenAuthFilter.cs` | Extracts Bearer token, calls `AuthService.ValidateTokenAsync` |
| `frontend/src/app/board/board.service.ts` | Signal state + 800ms debounce save |
| `frontend/src/app/board/board.component.ts` | CDK drag-drop host, column management |
| `frontend/src/app/board/column/column.component.ts` | Column UI, inline rename, delete guard |
| `frontend/src/app/chat/chat-sidebar.component.ts` | AI chat UI, applies board updates |
| `frontend/proxy.conf.json` | Dev proxy: `/api` → `http://localhost:5290` |
| `frontend/tailwind.config.js` | Tailwind v3 content paths |
| `frontend/postcss.config.js` | PostCSS pipeline for Tailwind |
