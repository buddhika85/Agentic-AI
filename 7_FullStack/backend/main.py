import logging
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Header
from fastapi.responses import FileResponse

from db import init_db, fetch_board, save_board, validate_board
from ai import call_openrouter, build_chat_messages, parse_ai_response

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Kanban Backend", version="0.1.0")

ROOT_DIR = Path(__file__).resolve().parent
FRONTEND_OUT = ROOT_DIR / "frontend" / "out"

VALID_TOKEN = "fake-token"

init_db()


def verify_auth(authorization: str | None = Header(default=None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or token != VALID_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def handle_ai_error(e: Exception):
    if isinstance(e, ValueError):
        raise HTTPException(status_code=500, detail=str(e))
    if isinstance(e, httpx.HTTPStatusError) and e.response.status_code == 401:
        raise HTTPException(status_code=500, detail="Invalid or missing OpenRouter API key. Set OPENROUTER_API_KEY in .env")
    if isinstance(e, httpx.HTTPStatusError):
        raise HTTPException(status_code=502, detail="OpenRouter service unavailable")
    if isinstance(e, httpx.ConnectError):
        raise HTTPException(status_code=502, detail="Cannot reach OpenRouter")
    raise HTTPException(status_code=502, detail="AI service error")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/auth/login")
async def login(data: dict):
    username = data.get("username")
    password = data.get("password")
    if username == "user" and password == "password":
        return {"token": VALID_TOKEN}
    raise HTTPException(status_code=401, detail="Invalid credentials")


@app.post("/api/auth/logout")
async def logout():
    return {"status": "ok"}


@app.get("/api/board")
async def get_board(authorization: str = Header(default=None)):
    verify_auth(authorization)
    board = fetch_board(user_id=1)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


@app.post("/api/board")
async def save_board_endpoint(data: dict, authorization: str = Header(default=None)):
    verify_auth(authorization)
    errors = validate_board(data)
    if errors:
        raise HTTPException(status_code=400, detail=errors)
    try:
        save_board(data, user_id=1)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"status": "ok"}


@app.post("/api/ai/test")
async def ai_test(data: dict = None, authorization: str = Header(default=None)):
    verify_auth(authorization)
    prompt = (data or {}).get("prompt", "What is 2+2?")
    try:
        response = call_openrouter([{"role": "user", "content": prompt}])
        return {"prompt": prompt, "response": response}
    except Exception as e:
        handle_ai_error(e)


@app.post("/api/ai/chat")
async def ai_chat(data: dict, authorization: str = Header(default=None)):
    verify_auth(authorization)
    user_message = data.get("message", "")
    if not user_message:
        raise HTTPException(status_code=400, detail="Missing 'message' in request")

    board_state = data.get("board")

    try:
        messages = build_chat_messages(user_message, board_state)
        raw_response = call_openrouter(messages)
        parsed = parse_ai_response(raw_response)

        result = {"message": parsed["message"]}

        if parsed.get("board_update"):
            save_board(parsed["board_update"], user_id=1)
            result["board_updated"] = True
        elif parsed.get("validation_errors"):
            result["board_updated"] = False
            result["validation_errors"] = parsed["validation_errors"]
        else:
            result["board_updated"] = False

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
