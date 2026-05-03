import sqlite3
import os
from pathlib import Path

DB_DIR = Path(os.environ.get("KANBAN_DB_DIR", Path(__file__).resolve().parent / "data"))
DB_PATH = DB_DIR / "kanban.db"

SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT 'My Board',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS columns (
    id TEXT PRIMARY KEY,
    board_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    column_id TEXT NOT NULL,
    title TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
);
"""

SEED_SQL = """
INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (1, 'user', 'password');

INSERT OR IGNORE INTO boards (id, user_id, name) VALUES (1, 1, 'My Board');

INSERT OR IGNORE INTO columns (id, board_id, title, position) VALUES
    ('col-todo',     1, 'To Do',       0),
    ('col-review',   1, 'Review',      1),
    ('col-progress', 1, 'In Progress', 2),
    ('col-testing',  1, 'Testing',     3),
    ('col-done',     1, 'Done',        4);

INSERT OR IGNORE INTO cards (id, column_id, title, details, position) VALUES
    ('card-1', 'col-todo',   'Research competitors',  'Analyze top 5 competitor features and pricing.', 0),
    ('card-2', 'col-todo',   'Define user personas',  'Create 3 primary personas based on market research.', 1),
    ('card-3', 'col-review', 'Wireframe mockups',     'Draft initial wireframes for core user flows.', 0);
"""


def get_connection(db_path: Path | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path or DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(db_path: Path | None = None) -> None:
    target = db_path or DB_PATH
    target.parent.mkdir(parents=True, exist_ok=True)
    conn = get_connection(target)
    try:
        conn.executescript(SCHEMA_SQL)
        conn.executescript(SEED_SQL)
        conn.commit()
    finally:
        conn.close()


def fetch_board(user_id: int = 1, db_path: Path | None = None) -> dict:
    conn = get_connection(db_path)
    try:
        board = conn.execute(
            "SELECT id, name FROM boards WHERE user_id = ?", (user_id,)
        ).fetchone()
        if not board:
            return None

        cols = conn.execute(
            "SELECT id, title, position FROM columns WHERE board_id = ? ORDER BY position",
            (board["id"],),
        ).fetchall()

        columns = []
        for col in cols:
            cards = conn.execute(
                "SELECT id, title, details, position FROM cards WHERE column_id = ? ORDER BY position",
                (col["id"],),
            ).fetchall()
            columns.append({
                "id": col["id"],
                "title": col["title"],
                "position": col["position"],
                "cards": [
                    {
                        "id": c["id"],
                        "title": c["title"],
                        "details": c["details"],
                        "position": c["position"],
                    }
                    for c in cards
                ],
            })

        return {"name": board["name"], "columns": columns}
    finally:
        conn.close()


def save_board(board_data: dict, user_id: int = 1, db_path: Path | None = None) -> None:
    conn = get_connection(db_path)
    try:
        board = conn.execute(
            "SELECT id FROM boards WHERE user_id = ?", (user_id,)
        ).fetchone()
        if not board:
            raise ValueError(f"No board found for user {user_id}")

        board_id = board["id"]

        conn.execute("DELETE FROM cards WHERE column_id IN (SELECT id FROM columns WHERE board_id = ?)", (board_id,))
        conn.execute("DELETE FROM columns WHERE board_id = ?", (board_id,))

        for col in board_data["columns"]:
            conn.execute(
                "INSERT INTO columns (id, board_id, title, position) VALUES (?, ?, ?, ?)",
                (col["id"], board_id, col["title"], col["position"]),
            )
            for card in col.get("cards", []):
                conn.execute(
                    "INSERT INTO cards (id, column_id, title, details, position) VALUES (?, ?, ?, ?, ?)",
                    (card["id"], col["id"], card["title"], card.get("details", ""), card["position"]),
                )

        conn.execute("UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (board_id,))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def validate_board(board_data: dict) -> list[str]:
    errors = []
    if "columns" not in board_data:
        return ["Missing 'columns' in board data"]
    if not isinstance(board_data["columns"], list):
        return ["'columns' must be a list"]
    if len(board_data["columns"]) == 0:
        errors.append("Board must have at least one column")

    seen_col_ids = set()
    for i, col in enumerate(board_data["columns"]):
        if "id" not in col:
            errors.append(f"Column at index {i} missing 'id'")
        elif col["id"] in seen_col_ids:
            errors.append(f"Duplicate column id: {col['id']}")
        else:
            seen_col_ids.add(col["id"])
        if "title" not in col:
            errors.append(f"Column at index {i} missing 'title'")
        if "position" not in col:
            errors.append(f"Column at index {i} missing 'position'")

        for j, card in enumerate(col.get("cards", [])):
            if "id" not in card:
                errors.append(f"Card at column {i}, index {j} missing 'id'")
            if "title" not in card:
                errors.append(f"Card at column {i}, index {j} missing 'title'")
            if "position" not in card:
                errors.append(f"Card at column {i}, index {j} missing 'position'")

    return errors
