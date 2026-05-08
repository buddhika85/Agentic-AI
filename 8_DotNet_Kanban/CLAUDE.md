# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kanban Studio — a single-board Kanban workspace with an AI chat assistant. Full-stack app with ASP.NET Core Minimal APIs backend, Angular 18 frontend, MSSQL database, all served from one Docker Compose stack on port 8000. The complete implementation plan is in `PLAN.md`.

## Commands

### Backend (.NET 9)
```powershell
cd backend
dotnet restore
dotnet build
dotnet run
dotnet test                                    # runs all xUnit tests (spins up Testcontainers)
dotnet test --filter "FullyQualifiedName~Auth" # run a single test class
dotnet ef migrations add <Name>
dotnet ef database update                      # local dev only; Docker auto-migrates on startup
```

### Frontend (Angular 18)
```powershell
cd frontend
npm install
npm start          # dev server
npm run build -- --configuration production
npm test           # Jest unit tests
npx playwright test # e2e (requires app running)
```

### Docker
```powershell
./scripts/start-dev.ps1   # loads .env, runs docker compose up --build
./scripts/stop-dev.ps1    # docker compose down
```

### Verify running stack
```powershell
Invoke-RestMethod http://localhost:8000/api/health
$res = Invoke-RestMethod -Method POST http://localhost:8000/api/auth/login `
       -ContentType "application/json" -Body '{"username":"user","password":"password"}'
Invoke-RestMethod http://localhost:8000/api/board -Headers @{ Authorization = "Bearer $($res.token)" }
```

## Architecture

```
Angular 18 SPA (signals, CDK drag-drop, Tailwind)
        ↓ HTTP/REST + Bearer token
ASP.NET Core Minimal APIs  (no controllers — route groups in Endpoints/)
        ↓ EF Core 9 async
MSSQL 2022 (Docker)
        ↑ HTTP
OpenRouter REST API (AI, model: openai/gpt-4o-mini)
```

**Backend layers:**
- `Models/` — EF entities (User, Session, Board, Column, Card)
- `Data/AppDbContext.cs` — DbContext, cascade deletes, seeded default user
- `Services/` — AuthService (BCrypt + session tokens), BoardService (CRUD + DTO mapping), AiService (OpenRouter HTTP client)
- `Endpoints/` — AuthEndpoints, BoardEndpoints, AiEndpoints — registered in `Program.cs`
- `DTOs/` — wire types; string IDs on the wire, int PKs in DB

**Frontend layers:**
- `auth/` — AuthService (signal-based token), auth guard, HTTP interceptor (attaches Bearer token)
- `board/` — BoardService (signal state + 800ms debounced save), BoardComponent (CDK drag-drop host), Column/Card components
- `chat/` — ChatSidebarComponent (calls `/api/ai/chat`, applies board updates immediately)

**Angular build output goes to `backend/wwwroot/`** — the API serves the SPA via `UseStaticFiles` + `MapFallbackToFile("index.html")`.

## Authentication

Custom session-token auth (not JWT). Tokens are 64-char hex strings stored in the `Sessions` DB table with 8-hour expiry. The backend extracts the token via `ctx.Request.Headers.Authorization.ToString().Replace("Bearer ", "")`. Frontend stores the token in `localStorage`.

Default seeded credentials: `user` / `password`.

## Critical Implementation Rules

1. **800ms debounce on board saves** — `BoardService.updateBoard()` pipes through `debounceTime(800)`. Never reduce; it prevents write floods during drag-drop.
2. **AI board updates bypass debounce** — `applyAiBoardUpdate()` calls `persistBoard()` directly.
3. **SPA catch-all must be last** — `app.MapFallbackToFile("index.html")` must be registered after all API routes or it shadows them.
4. **Test isolation** — each backend test class spins up its own Testcontainers MSSQL instance via `IAsyncLifetime`; never share state.
5. **Auto-migrate on startup** — `db.Database.Migrate()` runs inside a scoped service before `app.Run()`.
6. **Cascade deletes** — Board → Columns → Cards configured in `OnModelCreating`.

## Environment Variables

| Variable | Required | Notes |
|----------|----------|-------|
| `SA_PASSWORD` | Yes | Must meet SQL Server complexity (8+ chars, upper+lower+digit+symbol) |
| `OPENROUTER_API_KEY` | Yes | Bearer token for OpenRouter AI API |
| `ConnectionStrings__Default` | Docker | Set by docker-compose; uses `Server=db` hostname |
| `ASPNETCORE_URLS` | Docker | `http://+:8000` |

Place in `.env` at project root (never commit).

## API Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | No | `{ status: "ok" }` |
| POST | `/api/auth/login` | No | Returns `{ token }` |
| POST | `/api/auth/logout` | Bearer | Deletes session |
| GET | `/api/auth/verify` | Bearer | Returns `{ username }` |
| GET | `/api/board` | Bearer | Full board state |
| POST | `/api/board` | Bearer | Save board `{ board: BoardDto }` |
| POST | `/api/ai/chat` | Bearer | Returns `{ message, board_update? }` |
| GET | `/{**path}` | No | SPA fallback (must be last route) |
