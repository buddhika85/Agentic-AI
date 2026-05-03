# High level steps for project

## Part 1: Plan

Goal: Review current state, document existing frontend, and get approval to proceed with Part 2.

### Checklist

- [x] Review current workspace structure and existing frontend code
- [x] Create `frontend/AGENTS.md` documenting the current UI, component responsibilities, and existing test coverage
- [x] Verify all project requirements are understood from `AGENTS.md` (business requirements, tech stack, constraints)
- [x] Test, Show Evidence that checklist is complete and Confirm readiness to proceed to Next Part with user approval

### Success Criteria

- `frontend/AGENTS.md` exists and accurately describes the current frontend implementation
- All 10 parts in `docs/PLAN.md` have detailed checklists, test sections, and success criteria
- User has reviewed and approved the plan before moving to Part 2

## Part 2: Scaffolding

Goal: Set up Docker, FastAPI backend, and start/stop scripts. Verify hello world static page and API health endpoint work locally.

### Checklist

- [x] Create `backend/` directory with Python FastAPI project structure
- [x] Set up `pyproject.toml` or `requirements.txt` with FastAPI, uvicorn, and necessary dependencies
- [x] Create a simple `main.py` that runs the FastAPI app on port 8000
- [x] Add `GET /` endpoint that serves example static HTML ("Hello World")
- [x] Add `GET /api/health` endpoint that returns `{"status": "ok"}`
- [x] Create `Dockerfile` that builds the FastAPI backend
- [x] Create `.dockerignore` to exclude unnecessary files
- [x] Create `scripts/start-dev.sh` for Mac/Linux and `scripts/start-dev.ps1` for Windows
- [x] Create `scripts/stop-dev.sh` for Mac/Linux and `scripts/stop-dev.ps1` for Windows
- [x] Verify Docker container builds successfully
- [x] Verify container starts and serves static page at `http://localhost:8000/`
- [x] Verify API health endpoint responds at `http://localhost:8000/api/health`
- [x] Test, Show Evidence that checklist is complete and Confirm readiness to proceed to Next Part with user approval

### Tests

- Unit tests: N/A (no business logic yet)
- Integration tests:
  - Test that static HTML loads successfully at `/`
  - Test that API health endpoint returns correct response format
  - Test that container starts and is reachable within 5 seconds

### Success Criteria

- Docker container builds without errors
- `GET /` serves static HTML content
- `GET /api/health` returns `{"status": "ok"}`
- Start/stop scripts work on all three platforms (Mac, Windows, Linux)
- Container can be stopped gracefully
- All integration tests pass

## Part 3: Add in Frontend

Goal: Build Next.js frontend and integrate it into FastAPI. Verify the Kanban board displays at `/`.

### Checklist

- [x] Build Next.js frontend with `npm run build` in `frontend/`
- [x] Ensure `frontend/.next/static/` directory is created
- [x] Create a route in FastAPI to serve built Next.js assets
- [x] Configure FastAPI to serve static files from `frontend/.next/static/`
- [x] Configure FastAPI to serve the Next.js `_next/` directory
- [x] Create a catch-all route in FastAPI that serves `frontend/.next/standalone/` or the built app
- [x] Verify Kanban board renders at `http://localhost:8000/`
- [x] Verify drag and drop interactions work
- [x] Update tests for frontend components to ensure they still pass
- [x] Add integration tests for static file serving
- [x] Test, Show Evidence that checklist is complete and Confirm readiness to proceed to Next Part with user approval

### Tests

- Unit tests:
  - Existing frontend component tests should still pass (KanbanBoard, KanbanColumn, KanbanCard)
  - Target: 80% coverage of component logic and interactions
- Integration tests:
  - Static HTML and CSS load correctly
  - Kanban board renders without JavaScript errors
  - Drag and drop functionality works in browser
  - Assets are served with correct MIME types

### Success Criteria

- Kanban board is visible at `/` in a browser
- All frontend tests pass with 80%+ coverage
- Drag and drop works correctly
- No console errors or warnings
- Static assets load with appropriate cache headers

## Part 4: Add a Fake User Sign In Experience

Goal: Require login with dummy credentials (`user`/`password`) before accessing the board. Support logout.

### Checklist

- [x] Create a login page component in frontend
- [x] Add form inputs for username and password
- [x] Create a logout button on the board page
- [x] Add local state management for auth (context or custom hook)
- [x] Add `POST /api/auth/login` endpoint in FastAPI
- [x] Validate credentials (`user`/`password`)
- [x] Return a session token or cookie on successful login
- [x] Add `POST /api/auth/logout` endpoint in FastAPI
- [x] Implement session/cookie validation middleware in FastAPI
- [x] Protect `/api/board` endpoint with auth check
- [x] Redirect unauthenticated users to login page
- [x] Add tests for login/logout flow
- [x] Add tests for auth middleware
- [x] Test, Show Evidence that checklist is complete and Confirm readiness to proceed to Next Part with user approval

### Tests

- Unit tests:
  - Login form validation (empty fields, valid input)
  - Auth context/hook behavior
  - Session state persistence
  - Target: 80%+ coverage
- Integration tests:
  - Login with correct credentials redirects to board
  - Login with incorrect credentials shows error message
  - Logout clears session and redirects to login
  - Visiting `/` without auth redirects to login
  - Auth token is sent with API requests
  - Invalid/expired token returns 401

### Success Criteria

- Unauthenticated users see login page at `/`
- Login with `user`/`password` succeeds and shows board
- Login with wrong credentials fails with error message
- Logout clears session and returns to login page
- Protected API endpoints require valid auth
- All auth tests pass

## Part 5: Database Modeling

Goal: Propose and document the SQLite schema for Kanban boards. Get user sign-off.

### Checklist

- [x] Design database schema in `docs/DATABASE.md`:
  - Users table: `id, username, created_at`
  - Boards table: `id, user_id, created_at, updated_at`
  - Columns table: `id, board_id, title, position, created_at`
  - Cards table: `id, column_id, title, details, position, created_at, updated_at`
- [x] Document schema rationale and alternative approaches
- [x] Include example SQL queries for common operations
- [x] Define relationships and constraints (foreign keys, cascades)
- [x] Document how board state is represented (normalized vs JSON)
- [x] Include sample data/rows in documentation
- [x] Obtain explicit user approval of schema before implementation
- [x] Test, Show Evidence that checklist is complete and Confirm readiness to proceed to Next Part with user approval

### Tests

- N/A (design phase only)

### Success Criteria

- Database schema is documented in `docs/DATABASE.md`
- Schema supports all MVP features
- Relationships are clearly defined
- User has reviewed and approved the schema

## Part 6: Backend

Goal: Implement API routes to read/write Kanban boards. Ensure database is created if missing. Add unit tests.

### Checklist

- [x] Create `backend/db.py` for database initialization and helpers
- [x] Create SQLite database file if it doesn't exist on startup
- [x] Implement schema migrations or one-time initialization
- [x] Add `GET /api/board` endpoint to fetch user board
- [x] Add `POST /api/board` endpoint to save user board
- [x] Add request/response models for board data (Pydantic models)
- [x] Validate board structure before saving
- [x] Add error handling for missing boards or invalid data
- [x] Add unit tests for board read/write functions
- [x] Add unit tests for database initialization
- [x] Add unit tests for error cases (invalid data, missing records)
- [x] Achieve 80%+ unit test coverage for backend API logic
- [x] Test, Show Evidence that checklist is complete and Confirm readiness to proceed to Next Part with user approval

### Tests

- Unit tests:
  - Test `GET /api/board` returns correct board structure
  - Test `POST /api/board` saves board data to database
  - Test database initialization creates schema
  - Test error handling (invalid board data, missing user, corrupted data)
  - Test that board data persists across restarts
  - Target: 80%+ coverage of all backend functions
- Integration tests:
  - End-to-end test of login -> fetch board -> update board -> verify data persists

### Success Criteria

- Database is created automatically on first run
- Board data is fetched and returned in correct format
- Board updates are persisted to database
- Invalid data is rejected with appropriate error messages
- 80%+ unit test coverage achieved
- All tests pass

## Part 7: Frontend + Backend

Goal: Wire frontend to backend API. Verify persistent Kanban board.

### Checklist

- [x] Update frontend to fetch board from `GET /api/board` on component mount
- [x] Update frontend to POST board changes to `POST /api/board` when columns/cards change
- [x] Add loading state while fetching board
- [x] Add error handling for API failures
- [x] Implement debouncing or batch updates to reduce API calls
- [x] Ensure board state is re-fetched on login
- [x] Add tests for API integration in frontend
- [x] Verify column titles persist after refresh
- [x] Verify card data persists after refresh
- [ ] Test with multiple browser tabs (concurrent updates)
- [ ] Add error recovery (retry logic)
- [x] Test, Show Evidence that checklist is complete and Confirm readiness to proceed to Next Part with user approval

### Tests

- Unit tests:
  - Mock API calls and test component behavior
  - Test loading and error states
  - Test board data updates
  - Target: 80%+ coverage
- Integration tests:
  - Login -> board loads from API
  - Add card -> verify it persists on refresh
  - Rename column -> verify it persists on refresh
  - Delete card -> verify it persists on refresh
  - Move card -> verify position persists on refresh
  - Network error handling -> appropriate error message shown
  - Concurrent edits in multiple tabs

### Success Criteria

- Board data persists across page refreshes
- Column titles are saved and restored
- Cards are saved and restored with correct positions
- API errors are handled gracefully
- Loading states are shown appropriately
- All integration tests pass with 80%+ coverage

## Part 8: AI Connectivity

Goal: Add backend support for OpenRouter API calls. Test with simple request.

### Checklist

- [x] Add `OPENROUTER_API_KEY` environment variable handling in backend
- [x] Create `backend/ai.py` for AI interaction logic
- [x] Implement basic OpenRouter API call with `openai/gpt-oss-120b:free` model
- [x] Add `POST /api/ai/test` endpoint for simple test (e.g., "2+2")
- [x] Handle OpenRouter API errors gracefully
- [x] Add logging for AI requests and responses
- [x] Add unit tests for AI call logic
- [x] Add integration test to verify API connectivity
- [x] Verify response format and parsing
- [x] Test, Show Evidence that checklist is complete and Confirm readiness to proceed to Next Part with user approval

### Tests

- Unit tests:
  - Test request construction (headers, auth, payload)
  - Test response parsing
  - Test error handling (API errors, timeouts, invalid responses)
  - Target: 80%+ coverage
- Integration tests:
  - Verify actual connection to OpenRouter (with test API key)
  - Verify response format matches expectations
  - Test timeout handling

### Success Criteria

- OpenRouter API connectivity is verified
- Test request ("2+2") returns valid response
- Response is parsed and logged correctly
- Errors are handled gracefully
- All tests pass

## Part 9: Structured AI Output

Goal: Extend AI integration to include board JSON and handle structured output with optional board updates.

### Checklist

- [x] Create structured output Pydantic model (message + optional board update)
- [x] Update `POST /api/ai/chat` endpoint to accept user message and board state
- [x] Include board JSON in AI prompt context
- [x] Parse AI response as structured output (message + optional board changes)
- [x] Validate board updates for correctness
- [x] Apply board updates only if valid
- [x] Return both message and updated board to frontend
- [x] Add unit tests for structured output parsing
- [x] Add tests for board update validation
- [x] Add integration tests for end-to-end flow
- [x] Test, Show Evidence that checklist is complete and Confirm readiness to proceed to Next Part with user approval

### Tests

- Unit tests:
  - Test structured output parsing (valid and invalid formats)
  - Test board update validation (valid and invalid updates)
  - Test rejection of invalid board modifications
  - Test edge cases (empty message, no changes, malformed JSON)
  - Target: 80%+ coverage
- Integration tests:
  - Send board state to AI
  - Verify AI response includes message
  - Verify optional board update is applied correctly
  - Verify invalid updates are rejected

### Success Criteria

- AI receives board context and user message
- Structured output is parsed correctly
- Board updates from AI are validated and applied
- Frontend receives both message and updated board
- Error cases are handled gracefully
- All tests pass with 80%+ coverage

## Part 10: AI Chat UI

Goal: Add sidebar chat widget with full AI integration and automatic board refresh.

### Checklist

- [x] Create ChatSidebar component
- [x] Add chat message history display
- [x] Add user message input field
- [x] Add submit button for sending messages
- [x] Implement API call to `POST /api/ai/chat` on message submit
- [x] Display AI responses in chat history
- [x] Implement auto-refresh of board when AI updates it
- [x] Show loading state while AI is responding
- [x] Add error handling and display for chat errors
- [x] Style sidebar to match color scheme
- [x] Add tests for chat component interactions
- [ ] Add integration tests for chat + board updates
- [x] Test, Show Evidence that checklist is complete and Confirm readiness to proceed to Next Part with user approval

### Tests

- Unit tests:
  - Test message input and submission
  - Test chat history rendering
  - Test loading and error states
  - Test board update trigger on AI response
  - Target: 80%+ coverage
- Integration tests:
  - Send chat message -> AI responds -> board updates -> UI refreshes
  - Chat history persists during session
  - Multiple messages in sequence work correctly
  - Error in AI response shows appropriate message
  - Chat works with various board states
  - Drag and drop still works while chat is visible

### Success Criteria

- Chat sidebar is visible and functional
- User can send messages and receive AI responses
- Chat history is displayed correctly
- Board refreshes automatically when AI updates it
- Sidebar styling matches design system
- No conflicts with drag and drop
- All tests pass with 80%+ coverage

---

## Testing Summary

### Coverage Requirements

- Minimum 80% unit test coverage across all parts
- Robust integration testing for each part
- End-to-end tests for critical user flows

### Test Organization

- Unit tests: Component/function-level tests with mocks
- Integration tests: API + UI interaction tests
- E2E tests: Full user workflows (login -> board -> AI chat -> updates)

### Tools

- Frontend: Vitest + React Testing Library + Playwright
- Backend: pytest with appropriate fixtures and mocks
- Coverage reporting: nyc (frontend), pytest-cov (backend)
