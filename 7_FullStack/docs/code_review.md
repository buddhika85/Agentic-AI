# Code Review — Kanban Studio

**Date:** 2026-05-06  
**Reviewer:** Claude Code (claude-sonnet-4-6)  
**Scope:** Full codebase — `backend/`, `frontend/src/`, `frontend/tests/`, `Dockerfile`, `scripts/`  
**Remediation:** 2026-05-06 — all Critical, High, and Medium items addressed except M3 and M8 (see notes)

---

## Status Summary

| Severity | Total | Resolved | Remaining |
|----------|-------|----------|-----------|
| Critical | 3 | **3** | 0 |
| High | 7 | **6** | 1 (H4) |
| Medium | 9 | **7** | 2 (M3, M8) |
| Low | 9 | 1 (L7 via M9 fix) | 8 |

**Test counts after remediation:** 53 backend / 7 unit / 10 e2e — all passing.

---

## Critical

### ~~C1 — API key committed to version control~~ — WITHDRAWN
`.env` is correctly listed in `.gitignore` and `git ls-files .env` returns nothing. Finding was incorrect.

---

### ✅ C2 — Hardcoded static auth token — RESOLVED
**Was:** `VALID_TOKEN = "fake-token"` shared across all sessions.  
**Fix:** `secrets.token_hex(32)` generated per login, stored in a new `sessions` table with 8-hour TTL. `get_current_user` Depends function queries the table; expired tokens are purged on access.

---

### ✅ C3 — Plaintext password stored and compared — RESOLVED
**Was:** `password_hash` column held the literal string `"password"`; login compared hardcoded strings.  
**Fix:** `hash_password` / `verify_password` use PBKDF2-SHA256 (100k iterations, per-user 16-byte random salt). `init_db` seeds with a proper hash and auto-migrates any existing plaintext rows on startup.

---

### ✅ C4 — Auth token stored in `localStorage` — RESOLVED
**Was:** Token stored in `localStorage`, threaded as a prop through the component tree, sent as `Authorization: Bearer` header.  
**Fix:** Login sets `HttpOnly; SameSite=Lax` cookie; browser sends it automatically. Frontend removed all `localStorage` usage, `Authorization` headers, and `authToken` prop threading. Session restored on load via `GET /api/auth/verify`.

---

## High

### ✅ H1 — Untyped `dict` request bodies — RESOLVED
`LoginRequest` and `ChatRequest` Pydantic models added. `save_board_endpoint` keeps `dict` for now (validated by `validate_board`).

---

### ✅ H2 — `handle_ai_error()` result not raised — RESOLVED
`handle_ai_error` now raises `HTTPException` directly inside itself (no return value); all call sites are clean.

---

### ✅ H3 — No CORS for local dev — RESOLVED
`CORSMiddleware` added, gated on the `CORS_ORIGINS` env var (comma-separated origins). Not active unless explicitly set.

---

### H4 — Frontend doesn't validate API response shape — OPEN
**File:** `frontend/src/lib/boardApi.tsx`  
If the backend returns an unexpected structure the code throws a cryptic TypeError.  
**Remaining action:** Add `zod` and a `boardSchema` to parse/validate the `GET /api/board` response before use.

---

### ✅ H5 — User ID hardcoded to `1` — RESOLVED
All endpoints now use `user_id: int = Depends(get_current_user)` and pass the real user ID into every DB call.

---

### ✅ H6 — AI validation errors not surfaced — RESOLVED
Chat endpoint now returns both `"message"` (the AI's text) and a `"warning"` field when the AI's proposed board update fails validation, instead of dropping the message.

---

### ✅ H7 — Whitespace-only message accepted — RESOLVED
Guard changed to `not user_message or not user_message.strip()`. `test_ai_chat_whitespace_message` added.

---

## Medium

### ✅ M1 — Test fixture mutates global state — RESOLVED
`client` fixture now uses `monkeypatch.setattr(db, "DB_PATH", tmp_db_path)` — pytest restores it automatically even on failure.

---

### ✅ M2 — No indexes on foreign key columns — RESOLVED
`CREATE INDEX IF NOT EXISTS` added for `boards.user_id`, `columns.board_id`, `cards.column_id`, and `sessions.user_id` via `INDEX_SQL` run in `init_db`.

---

### M3 — No max-length constraints on text fields — OPEN
**File:** `backend/db.py`  
SQLite `TEXT` columns are unbounded.  
**Remaining action:** Add `CHECK(LENGTH(title) <= 255)` and `CHECK(LENGTH(details) <= 10000)` constraints. Note: `CREATE TABLE IF NOT EXISTS` won't modify existing tables; a migration step is needed for any live DB.

---

### ✅ M4 — Error state not cleared on successful save — RESOLVED
`setError(null)` added in the success branch of `scheduleSave` in `boardApi.tsx`.

---

### ✅ M5 — Deferred `import from db` inside function — RESOLVED
`from db import validate_board` moved to top-level import in `ai.py`.

---

### ✅ M6 — No request logging — RESOLVED
`logger.info` added to all API endpoints (login, logout, board fetch, board save, AI test, AI chat).

---

### ✅ M7 — AI test accepts 500 as passing — RESOLVED
`test_ai_test_endpoint_exists` and `test_ai_chat_endpoint_returns_expected_format` now mock `call_openrouter` and assert 200 with a specific response body.

---

### M8 — No rate limiting on AI chat endpoint — OPEN
**File:** `backend/main.py`  
Unlimited calls can exhaust the OpenRouter free quota.  
**Remaining action:** Add `slowapi` (or an in-memory dict counter) and apply a per-IP limit (e.g. 20 req/min) to `POST /api/ai/chat`.

---

### ✅ M9 — WAL mode not enabled — RESOLVED
`PRAGMA journal_mode = WAL` added to `get_connection()`, improving concurrent read/write behaviour.

---

## Low (unchanged — not addressed in this pass)

### L1 — No `.env.example`
Create `.env.example` with `OPENROUTER_API_KEY=your-key-here`.

### L2 — ~~Unused imports in test file~~ — RESOLVED
`VALID_TOKEN` and the redundant `init_db` import removed from `test_main.py` during M1/M7 fix.

### L3 — `catch (error)` without type annotation
**File:** `frontend/src/lib/auth.tsx` — ✅ fixed as part of C4 work (now uses `error: unknown`).

### L4 — `moveCard` is 79 lines of nested conditionals
Extract `handleSameColumnMove` / `handleCrossColumnMove` helpers.

### L5 — No Content Security Policy headers
Add `default-src 'self'` CSP via middleware.

### L6 — Inconsistent error message casing
Standardise to sentence-case for all user-facing error strings.

### L7 — No WAL mode — ✅ RESOLVED (part of M9 fix above)

### L8 — Docker run does not pass `--env-file`
Add `--env-file ../.env` to the `docker run` call in `scripts/start-dev.ps1`.

### L9 — Overlapping e2e test files
Consolidate `kanban-served.spec.ts` and `kanban.spec.ts`.

---

## Remaining Action List

| Priority | Item | Effort |
|----------|------|--------|
| 1 | Add Zod response validation on frontend (H4) | Hours |
| 2 | Add max-length CHECK constraints to schema + migration (M3) | Hours |
| 3 | Rate-limit AI chat endpoint (M8) | 1 hour |
| 4 | Pass `--env-file` in start script (L8) | Minutes |
| 5 | Add `.env.example` (L1) | Minutes |
| 6 | Consolidate overlapping e2e test files (L9) | 1 hour |
| 7 | Add CSP headers (L5) | 1 hour |
