import os
import sqlite3
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from main import app
import db


@pytest.fixture
def tmp_db_path():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    yield Path(path)
    os.unlink(path)


@pytest.fixture
def client(tmp_db_path, monkeypatch):
    db.init_db(tmp_db_path)
    monkeypatch.setattr(db, "DB_PATH", tmp_db_path)
    return TestClient(app)


def _login(client) -> str:
    resp = client.post("/api/auth/login", json={"username": "user", "password": "password"})
    assert resp.status_code == 200
    return resp.json()["token"]


def _auth(client) -> dict:
    return {"Authorization": f"Bearer {_login(client)}"}


# --- Health ---

def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# --- Auth ---

def test_login_success(client):
    response = client.post("/api/auth/login", json={"username": "user", "password": "password"})
    assert response.status_code == 200
    assert "token" in response.json()


def test_login_invalid_credentials(client):
    response = client.post("/api/auth/login", json={"username": "user", "password": "wrong"})
    assert response.status_code == 401


def test_logout(client):
    response = client.post("/api/auth/logout")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_verify_without_auth(client):
    response = client.get("/api/auth/verify")
    assert response.status_code == 401


def test_verify_with_valid_token(client):
    headers = _auth(client)
    response = client.get("/api/auth/verify", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "authenticated"


# --- Board ---

def test_get_board_without_auth(client):
    response = client.get("/api/board")
    assert response.status_code == 401


def test_get_board_with_invalid_token(client):
    response = client.get("/api/board", headers={"Authorization": "Bearer invalid-token"})
    assert response.status_code == 401


def test_get_board_with_valid_token(client):
    response = client.get("/api/board", headers=_auth(client))
    assert response.status_code == 200
    data = response.json()
    assert "columns" in data
    assert len(data["columns"]) == 5


def test_save_board_without_auth(client):
    response = client.post("/api/board", json={"columns": []})
    assert response.status_code == 401


def test_save_board_with_valid_token(client):
    board_data = {
        "columns": [
            {"id": "col-todo", "title": "To Do", "position": 0, "cards": []},
        ]
    }
    response = client.post("/api/board", json=board_data, headers=_auth(client))
    assert response.status_code == 200


def test_save_board_missing_columns(client):
    response = client.post("/api/board", json={"foo": "bar"}, headers=_auth(client))
    assert response.status_code == 400


def test_full_auth_flow(client):
    headers = _auth(client)
    board_resp = client.get("/api/board", headers=headers)
    assert board_resp.status_code == 200
    save_resp = client.post("/api/board", json=board_resp.json(), headers=headers)
    assert save_resp.status_code == 200


def test_board_persists_after_save(client):
    headers = _auth(client)
    new_board = {
        "columns": [
            {
                "id": "col-todo",
                "title": "Custom Column",
                "position": 0,
                "cards": [
                    {"id": "card-new", "title": "New Card", "details": "Test details", "position": 0},
                ],
            },
        ]
    }
    assert client.post("/api/board", json=new_board, headers=headers).status_code == 200
    data = client.get("/api/board", headers=headers).json()
    assert data["columns"][0]["title"] == "Custom Column"
    assert data["columns"][0]["cards"][0]["title"] == "New Card"


def test_board_columns_are_replaced_on_save(client):
    headers = _auth(client)
    single_col = {
        "columns": [{"id": "col-only", "title": "Only Column", "position": 0, "cards": []}]
    }
    client.post("/api/board", json=single_col, headers=headers)
    data = client.get("/api/board", headers=headers).json()
    assert len(data["columns"]) == 1
    assert data["columns"][0]["id"] == "col-only"


# --- DB helpers ---

def test_db_init_creates_tables(tmp_db_path):
    db.init_db(tmp_db_path)
    conn = sqlite3.connect(str(tmp_db_path))
    tables = {row[0] for row in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()}
    conn.close()
    assert {"users", "boards", "columns", "cards", "sessions"}.issubset(tables)


def test_db_init_seeds_default_data(tmp_db_path):
    db.init_db(tmp_db_path)
    conn = db.get_connection(tmp_db_path)
    user = conn.execute("SELECT * FROM users WHERE username = 'user'").fetchone()
    board = conn.execute("SELECT * FROM boards WHERE user_id = 1").fetchone()
    cols = conn.execute("SELECT * FROM columns WHERE board_id = 1").fetchall()
    cards = conn.execute("SELECT * FROM cards").fetchall()
    conn.close()
    assert user is not None
    assert ":" in user["password_hash"], "Password should be hashed (salt:hash format)"
    assert board is not None
    assert len(cols) == 5
    assert len(cards) == 3


def test_fetch_board_returns_none_for_missing_user(tmp_db_path):
    db.init_db(tmp_db_path)
    assert db.fetch_board(user_id=999, db_path=tmp_db_path) is None


def test_session_lifecycle(tmp_db_path):
    db.init_db(tmp_db_path)
    token = db.create_session(1, tmp_db_path)
    assert db.get_session_user(token, tmp_db_path) == 1
    db.delete_session(token, tmp_db_path)
    assert db.get_session_user(token, tmp_db_path) is None


def test_invalid_session_returns_none(tmp_db_path):
    db.init_db(tmp_db_path)
    assert db.get_session_user("nonexistent-token", tmp_db_path) is None


# --- validate_board ---

def test_validate_board_missing_columns():
    assert "Missing 'columns' in board data" in db.validate_board({})


def test_validate_board_columns_not_list():
    assert "'columns' must be a list" in db.validate_board({"columns": "not a list"})


def test_validate_board_empty_columns():
    assert "Board must have at least one column" in db.validate_board({"columns": []})


def test_validate_board_missing_column_id():
    errors = db.validate_board({"columns": [{"title": "Test", "position": 0}]})
    assert any("missing 'id'" in e for e in errors)


def test_validate_board_missing_column_title():
    errors = db.validate_board({"columns": [{"id": "c1", "position": 0}]})
    assert any("missing 'title'" in e for e in errors)


def test_validate_board_duplicate_column_ids():
    errors = db.validate_board({"columns": [
        {"id": "c1", "title": "A", "position": 0},
        {"id": "c1", "title": "B", "position": 1},
    ]})
    assert any("Duplicate column id" in e for e in errors)


def test_validate_board_missing_card_fields():
    errors = db.validate_board({"columns": [
        {"id": "c1", "title": "A", "position": 0, "cards": [{"position": 0}]}
    ]})
    assert any("missing 'id'" in e for e in errors)
    assert any("missing 'title'" in e for e in errors)


def test_validate_board_valid_data():
    errors = db.validate_board({"columns": [
        {"id": "c1", "title": "To Do", "position": 0,
         "cards": [{"id": "card-1", "title": "Task", "details": "info", "position": 0}]}
    ]})
    assert errors == []


def test_save_board_invalid_raises_value_error(tmp_db_path):
    db.init_db(tmp_db_path)
    with pytest.raises(ValueError, match="No board found"):
        db.save_board({"columns": []}, user_id=999, db_path=tmp_db_path)


# --- AI endpoints ---

def test_ai_test_without_auth(client):
    response = client.post("/api/ai/test", json={"prompt": "hello"})
    assert response.status_code == 401


def test_ai_test_with_invalid_token(client):
    response = client.post("/api/ai/test", json={"prompt": "hello"},
                           headers={"Authorization": "Bearer invalid-token"})
    assert response.status_code == 401


def test_ai_test_endpoint_returns_response(client):
    headers = _auth(client)
    with patch("main.call_openrouter", return_value="4"):
        response = client.post("/api/ai/test", json={"prompt": "2+2"}, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["prompt"] == "2+2"
    assert data["response"] == "4"


def test_ai_chat_without_auth(client):
    response = client.post("/api/ai/chat", json={"message": "hello"})
    assert response.status_code == 401


def test_ai_chat_missing_message(client):
    response = client.post("/api/ai/chat", json={}, headers=_auth(client))
    assert response.status_code == 400


def test_ai_chat_whitespace_message(client):
    response = client.post("/api/ai/chat", json={"message": "   "}, headers=_auth(client))
    assert response.status_code == 400


def test_ai_chat_returns_message_and_board_updated(client):
    headers = _auth(client)
    ai_payload = '{"message": "Sure, here is the board.", "board_update": null}'
    with patch("main.call_openrouter", return_value=ai_payload):
        response = client.post("/api/ai/chat", json={"message": "hello"}, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "board_updated" in data
    assert data["board_updated"] is False
