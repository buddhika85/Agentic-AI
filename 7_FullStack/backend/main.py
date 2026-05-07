import logging
import os
from pathlib import Path

import httpx
from fastapi import Cookie, Depends, FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ai import build_chat_messages, call_openrouter, parse_ai_response
from db import (
    create_session,
    delete_session,
    fetch_board,
    get_session_user,
    get_user,
    init_db,
    save_board,
    validate_board,
    verify_password,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Kanban Backend", version="0.1.0")

ROOT_DIR = Path(__file__).resolve().parent
FRONTEND_OUT = ROOT_DIR / "frontend" / "out"

# Enable CORS for cross-origin dev (e.g. Next.js on :3000 → API on :8000).
# Set CORS_ORIGINS=http://localhost:3000 in .env to activate.
_cors_origins = os.getenv("CORS_ORIGINS", "")
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins.split(","),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

init_db()


# --- Request models ---

class LoginRequest(BaseModel):
    username: str
    password: str


class ChatRequest(BaseModel):
    message: str = ""
    board: dict | None = None


# --- Auth dependency ---

async def get_current_user(
    session: str | None = Cookie(default=None),
    authorization: str | None = Header(default=None),
) -> int:
    """Accepts an HttpOnly session cookie or a Bearer token (for backward compat)."""
    token: str | None = session
    if not token and authorization:
        scheme, _, bearer = authorization.partition(" ")
        if scheme.lower() == "bearer":
            token = bearer
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = get_session_user(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user_id


def handle_ai_error(e: Exception) -> None:
    if isinstance(e, ValueError):
        raise HTTPException(status_code=500, detail=str(e))
    if isinstance(e, httpx.HTTPStatusError) and e.response.status_code == 401:
        raise HTTPException(
            status_code=500,
            detail="Invalid or missing OpenRouter API key. Set OPENROUTER_API_KEY in .env",
        )
    if isinstance(e, httpx.HTTPStatusError):
        raise HTTPException(status_code=502, detail="OpenRouter service unavailable")
    if isinstance(e, httpx.ConnectError):
        raise HTTPException(status_code=502, detail="Cannot reach OpenRouter")
    raise HTTPException(status_code=502, detail="AI service error")


# --- Routes ---

@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/auth/verify")
async def verify_session(user_id: int = Depends(get_current_user)):
    return {"status": "authenticated", "user_id": user_id}


@app.post("/api/auth/login")
async def login(data: LoginRequest, response: Response):
    logger.info("Login attempt: %s", data.username)
    user = get_user(data.username)
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_session(user["id"])
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=8 * 3600,
        path="/",
        secure=False,
    )
    logger.info("Login successful: %s", data.username)
    return {"token": token}


@app.post("/api/auth/logout")
async def logout(response: Response, session: str | None = Cookie(default=None)):
    if session:
        delete_session(session)
    response.delete_cookie(key="session", path="/")
    return {"status": "ok"}


@app.get("/api/board")
async def get_board(user_id: int = Depends(get_current_user)):
    logger.info("Fetch board: user=%d", user_id)
    board = fetch_board(user_id=user_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


@app.post("/api/board")
async def save_board_endpoint(data: dict, user_id: int = Depends(get_current_user)):
    logger.info("Save board: user=%d", user_id)
    errors = validate_board(data)
    if errors:
        raise HTTPException(status_code=400, detail=errors)
    try:
        save_board(data, user_id=user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"status": "ok"}


@app.post("/api/ai/test")
async def ai_test(data: dict | None = None, user_id: int = Depends(get_current_user)):
    prompt = (data or {}).get("prompt", "What is 2+2?")
    logger.info("AI test: user=%d prompt=%s", user_id, prompt)
    try:
        result = call_openrouter([{"role": "user", "content": prompt}])
        return {"prompt": prompt, "response": result}
    except Exception as e:
        handle_ai_error(e)


@app.post("/api/ai/chat")
async def ai_chat(data: ChatRequest, user_id: int = Depends(get_current_user)):
    user_message = data.message
    if not user_message or not user_message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    logger.info("AI chat: user=%d", user_id)

    try:
        messages = build_chat_messages(user_message, data.board)
        raw_response = call_openrouter(messages)
        parsed = parse_ai_response(raw_response)

        result: dict = {"message": parsed["message"], "board_updated": False}

        if parsed.get("board_update"):
            save_board(parsed["board_update"], user_id=user_id)
            result["board_updated"] = True
        elif parsed.get("validation_errors"):
            result["warning"] = "AI suggested a board update but it failed validation"

        return result
    except Exception as e:
        handle_ai_error(e)


@app.get("/{path:path}")
async def serve_frontend(path: str):
    if path.startswith("api/"):
        return {"detail": "Not Found"}
    file_path = FRONTEND_OUT / path
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)
    index_path = FRONTEND_OUT / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"detail": "Not Found"}
