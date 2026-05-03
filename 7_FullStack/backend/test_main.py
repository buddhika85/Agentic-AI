import os
import sqlite3
import tempfile
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from main import app, init_db, VALID_TOKEN
import db


@pytest.fixture
def tmp_db_path():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    yield Path(path)
    os.unlink(path)


@pytest.fixture
def client(tmp_db_path):
    init_db(tmp_db_path)
    original = db.DB_PATH
    db.DB_PATH = tmp_db_path
    c = TestClient(app)
    yield c
    db.DB_PATH = original


def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_login_success(client):
    response = client.post("/api/auth/login", json={
        "username": "user",
        "password": "password",
    })
    assert response.status_code == 200
    assert "token" in response.json()


def test_login_invalid_credentials(client):
    response = client.post("/api/auth/login", json={
        "username": "user",
        "password": "wrong",
    })
    assert response.status_code == 401


def test_logout(client):
    response = client.post("/api/auth/logout")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_get_board_without_auth(client):
    response = client.get("/api/board")
    assert response.status_code == 401


def test_get_board_with_invalid_token(client):
    response = client.get("/api/board", headers={
        "Authorization": "Bearer invalid-token"
    })
    assert response.status_code == 401


def test_get_board_with_valid_token(client):
    login_resp = client.post("/api/auth/login", json={
        "username": "user",
        "password": "password",
    })
    token = login_resp.json()["token"]
    response = client.get("/api/board", headers={
        "Authorization": f"Bearer {token}"
    })
    assert response.status_code == 200
    data = response.json()
    assert "columns" in data
    assert len(data["columns"]) == 5


def test_save_board_without_auth(client):
    response = client.post("/api/board", json={"columns": []})
    assert response.status_code == 401


def test_save_board_with_valid_token(client):
    login_resp = client.post("/api/auth/login", json={
        "username": "user",
        "password": "password",
    })
    token = login_resp.json()["token"]
    board_data = {
        "columns": [
            {"id": "col-todo", "title": "To Do", "position": 0, "cards": []},
        ]
    }
    response = client.post("/api/board", json=board_data, headers={
        "Authorization": f"Bearer {token}"
    })
    assert response.status_code == 200


def test_save_board_missing_columns(client):
    login_resp = client.post("/api/auth/login", json={
        "username": "user",
        "password": "password",
    })
    token = login_resp.json()["token"]
    response = client.post("/api/board", json={"foo": "bar"}, headers={
        "Authorization": f"Bearer {token}"
    })
    assert response.status_code == 400


def test_full_auth_flow(client):
    login_resp = client.post("/api/auth/login", json={
        "username": "user",
        "password": "password",
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["token"]

    board_resp = client.get("/api/board", headers={
        "Authorization": f"Bearer {token}"
    })
    assert board_resp.status_code == 200

    save_resp = client.post("/api/board", json=board_resp.json(), headers={
        "Authorization": f"Bearer {token}"
    })
    assert save_resp.status_code == 200


def test_board_persists_after_save(client):
    login_resp = client.post("/api/auth/login", json={
        "username": "user",
        "password": "password",
    })
    token = login_resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

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
    save_resp = client.post("/api/board", json=new_board, headers=headers)
    assert save_resp.status_code == 200

    fetch_resp = client.get("/api/board", headers=headers)
    assert fetch_resp.status_code == 200
    data = fetch_resp.json()
    assert data["columns"][0]["title"] == "Custom Column"
    assert len(data["columns"][0]["cards"]) == 1
    assert data["columns"][0]["cards"][0]["title"] == "New Card"


def test_board_columns_are_replaced_on_save(client):
    login_resp = client.post("/api/auth/login", json={
        "username": "user",
        "password": "password",
    })
    token = login_resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    single_col = {
        "columns": [
            {"id": "col-only", "title": "Only Column", "position": 0, "cards": []},
        ]
    }
    client.post("/api/board", json=single_col, headers=headers)

    fetch_resp = client.get("/api/board", headers=headers)
    data = fetch_resp.json()
    assert len(data["columns"]) == 1
    assert data["columns"][0]["id"] == "col-only"


def test_db_init_creates_tables(tmp_db_path):
    db.init_db(tmp_db_path)
    conn = sqlite3.connect(str(tmp_db_path))
    tables = [row[0] for row in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()]
    conn.close()
    assert "users" in tables
    assert "boards" in tables
    assert "columns" in tables
    assert "cards" in tables


def test_db_init_seeds_default_data(tmp_db_path):
    db.init_db(tmp_db_path)
    conn = db.get_connection(tmp_db_path)
    user = conn.execute("SELECT * FROM users WHERE username = 'user'").fetchone()
    board = conn.execute("SELECT * FROM boards WHERE user_id = 1").fetchone()
    cols = conn.execute("SELECT * FROM columns WHERE board_id = 1").fetchall()
    cards = conn.execute("SELECT * FROM cards").fetchall()
    conn.close()
    assert user is not None
    assert board is not None
    assert len(cols) == 5
    assert len(cards) == 3


def test_fetch_board_returns_none_for_missing_user(tmp_db_path):
    db.init_db(tmp_db_path)
    board = db.fetch_board(user_id=999, db_path=tmp_db_path)
    assert board is None


def test_validate_board_missing_columns():
    errors = db.validate_board({})
    assert "Missing 'columns' in board data" in errors


def test_validate_board_columns_not_list():
    errors = db.validate_board({"columns": "not a list"})
    assert "'columns' must be a list" in errors


def test_validate_board_empty_columns():
    errors = db.validate_board({"columns": []})
    assert "Board must have at least one column" in errors


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
        {
            "id": "c1",
            "title": "To Do",
            "position": 0,
            "cards": [
                {"id": "card-1", "title": "Task", "details": "info", "position": 0}
            ]
        }
    ]})
    assert errors == []


def test_save_board_invalid_raises_value_error(tmp_db_path):
    db.init_db(tmp_db_path)
    with pytest.raises(ValueError, match="No board found"):
        db.save_board({"columns": []}, user_id=999, db_path=tmp_db_path)


def test_ai_test_without_auth(client):
    response = client.post("/api/ai/test", json={"prompt": "hello"})
    assert response.status_code == 401


def test_ai_test_with_invalid_token(client):
    response = client.post("/api/ai/test", json={"prompt": "hello"}, headers={
        "Authorization": "Bearer invalid-token"
    })
    assert response.status_code == 401


def test_ai_test_endpoint_exists(client):
    login_resp = client.post("/api/auth/login", json={
        "username": "user",
        "password": "password",
    })
    token = login_resp.json()["token"]
    response = client.post("/api/ai/test", json={"prompt": "hello"}, headers={
        "Authorization": f"Bearer {token}"
    })
    assert response.status_code in (200, 500, 502)
    data = response.json()
    if response.status_code == 500:
        assert "OPENROUTER_API_KEY" in data.get("detail", "")
    elif response.status_code == 502:
        assert data.get("detail", "")


def test_ai_chat_without_auth(client):
    response = client.post("/api/ai/chat", json={"message": "hello"})
    assert response.status_code == 401


def test_ai_chat_missing_message(client):
    login_resp = client.post("/api/auth/login", json={
        "username": "user",
        "password": "password",
    })
    token = login_resp.json()["token"]
    response = client.post("/api/ai/chat", json={}, headers={
        "Authorization": f"Bearer {token}"
    })
    assert response.status_code == 400


def test_ai_chat_endpoint_returns_expected_format(client):
    login_resp = client.post("/api/auth/login", json={
        "username": "user",
        "password": "password",
    })
    token = login_resp.json()["token"]
    response = client.post("/api/ai/chat", json={"message": "hello"}, headers={
        "Authorization": f"Bearer {token}"
    })
    assert response.status_code in (200, 500, 502)
    data = response.json()
    if response.status_code == 200:
        assert "message" in data
        assert "board_updated" in data
    elif response.status_code == 500:
        assert "OPENROUTER_API_KEY" in data.get("detail", "")
    elif response.status_code == 502:
        assert "OpenRouter" in data.get("detail", "")
