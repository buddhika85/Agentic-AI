# Developer Guide — Kanban Studio

## Running the App

### Prerequisites
- Docker Desktop (running)
- `.env` file at the project root (copy from `.env.example` and fill in values)

```
SA_PASSWORD=        # SQL Server password — 8+ chars, upper+lower+digit+symbol
OPENROUTER_API_KEY= # Bearer token from openrouter.ai
```

### Start
```powershell
# From project root
.\scripts\start-dev.ps1
```

This loads `.env`, then runs `docker compose up --build`. On first run it pulls base images and
compiles everything (~3–5 min). Subsequent starts reuse cached layers and are near-instant.

The app is ready when you see:
```
api-1  | Now listening on: http://[::]:8000
api-1  | Application started.
```

Open **http://localhost:8000** in your browser. Login with `user` / `password`.

### Stop
```powershell
.\scripts\stop-dev.ps1
```

This runs `docker compose down`. Data is preserved in the `mssql_data` named volume.

### Verify the stack is up
```powershell
Invoke-RestMethod http://localhost:8000/api/health
```

---

## Architecture

```
Browser
  └── Angular 20 SPA (signals, CDK drag-drop, Tailwind CSS)
        │  served as static files by the .NET backend
        │  HTTP/REST + Bearer token
        ▼
  ASP.NET Core 9 Minimal APIs
        │  EF Core 9 (async)
        ▼
  MSSQL 2022 (Docker)

  ASP.NET Core 9 ──► OpenRouter REST API (AI chat)
```

The backend serves both the REST API and the Angular SPA from a single process on port 8000.
There is no separate frontend server in production.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 20 — standalone components, signals, Angular CDK drag-drop |
| Styling | Tailwind CSS v3 (PostCSS pipeline) |
| Backend | ASP.NET Core 9 Minimal APIs (no MVC controllers) |
| ORM | EF Core 9 with SQL Server provider |
| Database | Microsoft SQL Server 2022 |
| AI | OpenRouter REST API (`openai/gpt-4o-mini` model) |
| Auth | Custom session tokens — 64-char hex, stored in DB, 8-hour expiry |
| Containerisation | Docker (multi-stage build) + Docker Compose |
| Backend tests | xUnit + Testcontainers (spins up real MSSQL per test class) |
| Frontend tests | Karma + Jasmine |

---

## Project Structure

```
/
├── frontend/                   Angular source
│   └── src/app/
│       ├── auth/               Login, auth guard, HTTP interceptor
│       ├── board/              Board, column, card components + BoardService
│       ├── chat/               AI chat sidebar
│       └── models/             Shared TypeScript interfaces
├── backend/
│   ├── Data/                   EF Core DbContext
│   ├── Models/                 EF entities (User, Session, Board, Column, Card)
│   ├── Services/               AuthService, BoardService, AiService
│   ├── Endpoints/              AuthEndpoints, BoardEndpoints, AiEndpoints
│   ├── DTOs/                   Wire types (string IDs on the wire, int PKs in DB)
│   ├── Filters/                TokenAuthFilter (Bearer token extraction)
│   ├── Tests/                  xUnit test project
│   └── Program.cs              DI, middleware, route registration, auto-migrate
├── scripts/
│   ├── start-dev.ps1           Load .env → docker compose up --build
│   └── stop-dev.ps1            docker compose down
├── Dockerfile                  Multi-stage: Node → .NET SDK → .NET runtime
├── docker-compose.yml          api (port 8000) + db services
└── .env.example                Template for required environment variables
```

---

## API Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | No | `{ status: "ok" }` |
| POST | `/api/auth/login` | No | Returns `{ token }` |
| POST | `/api/auth/logout` | Bearer | Deletes session |
| GET | `/api/auth/verify` | Bearer | Returns `{ username }` |
| GET | `/api/board` | Bearer | Full board state |
| POST | `/api/board` | Bearer | Save board `{ board: BoardDto }` |
| POST | `/api/ai/chat` | Bearer | Returns `{ message, board_update? }` |

---

## Running Tests

**Backend** (requires Docker for Testcontainers):
```powershell
cd backend
dotnet test
```

**Frontend**:
```powershell
cd frontend
npx ng test --watch=false --browsers=ChromeHeadless
```

---

## Key Behaviour Notes

- **800ms debounce on board saves** — prevents write floods during drag-drop. Do not reduce.
- **Max 5 columns** — enforced in both backend (`BoardService`) and frontend (`board.component`).
- **Delete column** — only allowed when the column has zero cards.
- **AI board updates** — bypass the debounce and save immediately; also capped at 5 columns.
- **SPA fallback** — `MapFallbackToFile("index.html")` must remain the last registered route.
- **Auto-migrate on startup** — `db.Database.Migrate()` runs before `app.Run()` with a 5-attempt
  retry loop to handle the race where MSSQL is still recovering a volume on container restart.
