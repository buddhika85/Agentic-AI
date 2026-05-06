# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Kanban Studio** — a single-board Kanban workspace with an AI chat assistant. Full-stack: Next.js 16 frontend + FastAPI backend, served as a unified Docker container on port 8000.

## Commands

### Development (Docker)

```powershell
# Start (Windows)
./scripts/start-dev.ps1

# Stop (Windows)
./scripts/stop-dev.ps1

# Mac/Linux equivalents
./scripts/start-dev.sh
./scripts/stop-dev.sh
```

### Frontend (from `frontend/`)

```bash
npm install
npm run build          # Next.js static export → out/
npm run lint           # ESLint
npm run test:unit      # Vitest unit tests
npm run test:unit:watch
npm run test:e2e       # Playwright e2e
npm run test:all       # Unit + e2e
```

### Backend (from `backend/`)

```bash
# Run all tests
pytest

# Run a single test file
pytest test_main.py

# Run a single test
pytest test_main.py::test_health_endpoint
```

Backend uses `uv` for package management. Dependencies are declared in `pyproject.toml`.

## Architecture

### Deployment Model

Docker multi-stage build: Next.js builds to static files (`frontend/out/`), then those assets are copied into the Python image. FastAPI serves the static files and catches all unknown paths with a SPA catch-all route (`/{path:path} → index.html`). Single container, port 8000.

### Frontend (`frontend/src/`)

Two top-level React Contexts power everything:

- **`AuthProvider`** (`lib/auth.ts`) — manages login state and Bearer token
- **`BoardProvider`** (`lib/boardApi.ts`) — fetches/saves board state; debounces saves to 800ms to reduce API calls during drag-drop

Key components: `KanbanBoard` → `KanbanColumn` → `KanbanCard`. Drag-and-drop uses `@dnd-kit`. The `ChatSidebar` sends messages to `/api/ai/chat` and merges returned `board_update` objects into board state.

### Backend (`backend/`)

- **`main.py`** — FastAPI app, all route definitions
- **`db.py`** — SQLite schema init, seed data, query helpers. Schema: `users`, `boards`, `columns`, `cards` with cascading deletes. DB is auto-created on first run.
- **`ai.py`** — OpenRouter API client (`openai/gpt-oss-120b:free`). Returns structured JSON: `{ message: string, board_update?: BoardState }`. The backend validates and parses the AI's JSON response before forwarding to the frontend.

### API Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | Auth (hardcoded credentials for MVP) |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/board` | Fetch board state |
| POST | `/api/board` | Save board state |
| POST | `/api/ai/chat` | AI chat with optional board update |
| GET | `/{path:path}` | SPA catch-all → serves `index.html` |

### Authentication

Simple MVP: hardcoded username/password, Bearer token returned on login. The token is stored in AuthContext and sent as `Authorization: Bearer <token>` on subsequent requests.

## Key Patterns

- **Debounced board saves**: Frontend waits 800ms after the last change before calling `POST /api/board`. Do not remove this — it prevents flooding during drag-drop.
- **AI board updates**: The AI can return a full `board_update` payload alongside its chat message. The frontend merges this into board state, making the AI capable of creating/moving/deleting cards.
- **Static SPA serving**: FastAPI's catch-all route must remain the *last* route registered, or it will shadow API routes.
- **Database isolation in tests**: Backend tests use pytest fixtures that create a fresh in-memory or temp SQLite DB per test — do not share state between tests.

## Environment

The `.env` file at the root contains `OPENROUTER_API_KEY`. This is required for AI chat functionality. The Docker build picks this up via the scripts.
