# Database Schema for Kanban MVP

## Overview

This document defines the SQLite schema for the Kanban project management application. The schema supports the MVP requirements (single board per user, fixed columns, draggable cards) while leaving room for future multi-board and multi-user features.

## Schema Design

The schema uses a fully normalized relational approach with four tables: `users`, `boards`, `columns`, and `cards`. This makes it easy to query individual entities, enforce constraints, and scale to multiple boards and users later.

### Alternative Approaches Considered

| Approach | Pros | Cons |
|----------|------|------|
| **Normalized (chosen)** | Clean queries, easy foreign-key constraints, scales to multiple boards | More tables, JOINs required to fetch full board state |
| **JSON board storage** | Single row per board, simple fetch | Hard to update individual cards/columns, no FK constraints, wasteful updates |
| **Hybrid (JSON columns)** | Balance of both | Complexity of mixing paradigms, harder to query card-level data |

We chose the normalized approach because it gives us proper relational integrity, easy partial updates (rename one column without touching the rest), and aligns with standard ORM patterns for future growth.

## Tables

### Users

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique user identifier |
| username | TEXT | NOT NULL, UNIQUE | Login username |
| password_hash | TEXT | NOT NULL | Hashed password (plaintext for MVP: "password") |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Account creation time |

### Boards

```sql
CREATE TABLE boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT 'My Board',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique board identifier |
| user_id | INTEGER | NOT NULL, FK -> users(id) | Owning user |
| name | TEXT | NOT NULL, DEFAULT 'My Board' | Board display name |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last modification time |

### Columns

```sql
CREATE TABLE columns (
    id TEXT PRIMARY KEY,
    board_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | String ID (e.g., "col-todo"), stable across renames |
| board_id | INTEGER | NOT NULL, FK -> boards(id) | Owning board |
| title | TEXT | NOT NULL | Display name (renameable) |
| position | INTEGER | NOT NULL | Sort order within the board |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |

### Cards

```sql
CREATE TABLE cards (
    id TEXT PRIMARY KEY,
    column_id TEXT NOT NULL,
    title TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | String ID (e.g., "card-1"), stable across edits |
| column_id | TEXT | NOT NULL, FK -> columns(id) | Owning column |
| title | TEXT | NOT NULL | Card title |
| details | TEXT | NOT NULL, DEFAULT '' | Card description/notes |
| position | INTEGER | NOT NULL | Sort order within the column |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last modification time |

## Relationships

```
users (1) ───< (1) boards (1) ───< (N) columns (1) ───< (N) cards
```

- Each user owns one or more boards (MVP: exactly one)
- Each board has many columns
- Each column has many cards
- CASCADE DELETE: removing a user removes their boards, which removes columns, which removes cards

## Foreign Key Enforcement

SQLite requires `PRAGMA foreign_keys = ON;` to enforce foreign key constraints. This will be set on every database connection in `db.py`.

## Example SQL Queries

### Create default user and board

```sql
INSERT INTO users (username, password_hash) VALUES ('user', 'password');
INSERT INTO boards (user_id, name) VALUES (1, 'My Board');
```

### Create default columns for a new board

```sql
INSERT INTO columns (id, board_id, title, position) VALUES
    ('col-todo',     1, 'To Do',       0),
    ('col-review',   1, 'Review',      1),
    ('col-progress', 1, 'In Progress', 2),
    ('col-testing',  1, 'Testing',     3),
    ('col-done',     1, 'Done',        4);
```

### Fetch full board state for a user

```sql
SELECT
    b.id AS board_id,
    b.name AS board_name,
    c.id AS column_id,
    c.title AS column_title,
    c.position AS column_position,
    cd.id AS card_id,
    cd.title AS card_title,
    cd.details AS card_details,
    cd.position AS card_position
FROM boards b
JOIN columns c ON c.board_id = b.id
LEFT JOIN cards cd ON cd.column_id = c.id
WHERE b.user_id = 1
ORDER BY c.position, cd.position;
```

### Rename a column

```sql
UPDATE columns SET title = 'New Name' WHERE id = 'col-todo';
UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = 1;
```

### Add a card

```sql
INSERT INTO cards (id, column_id, title, details, position)
    VALUES ('card-new', 'col-todo', 'New Card', 'Description', 0);
UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = 1;
```

### Move a card to a different column

```sql
UPDATE cards SET column_id = 'col-review', position = 0 WHERE id = 'card-1';
UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = 1;
```

### Save full board (upsert all columns and cards)

For the MVP, the frontend sends the entire board state. The backend will:
1. Delete all existing cards and columns for the board
2. Insert the new columns and cards in a single transaction

```sql
BEGIN TRANSACTION;
DELETE FROM cards WHERE column_id IN (SELECT id FROM columns WHERE board_id = 1);
DELETE FROM columns WHERE board_id = 1;
-- Then INSERT new columns and cards
COMMIT;
```

## Sample Data

### Users

| id | username | password_hash | created_at |
|----|----------|---------------|------------|
| 1 | user | password | 2026-05-03 00:00:00 |

### Boards

| id | user_id | name | created_at | updated_at |
|----|---------|------|------------|------------|
| 1 | 1 | My Board | 2026-05-03 00:00:00 | 2026-05-03 00:00:00 |

### Columns

| id | board_id | title | position | created_at |
|----|----------|-------|----------|------------|
| col-todo | 1 | To Do | 0 | 2026-05-03 00:00:00 |
| col-review | 1 | Review | 1 | 2026-05-03 00:00:00 |
| col-progress | 1 | In Progress | 2 | 2026-05-03 00:00:00 |
| col-testing | 1 | Testing | 3 | 2026-05-03 00:00:00 |
| col-done | 1 | Done | 4 | 2026-05-03 00:00:00 |

### Cards

| id | column_id | title | details | position | created_at | updated_at |
|----|-----------|-------|---------|----------|------------|------------|
| card-1 | col-todo | Research competitors | | 0 | 2026-05-03 00:00:00 | 2026-05-03 00:00:00 |
| card-2 | col-todo | Define user personas | | 1 | 2026-05-03 00:00:00 | 2026-05-03 00:00:00 |
| card-3 | col-review | Wireframe mockups | | 0 | 2026-05-03 00:00:00 | 2026-05-03 00:00:00 |

## How Board State Is Represented

The board state is stored in a **fully normalized** form:
- Each column is a row with its own position
- Each card is a row with its own column_id and position
- The frontend maps this to its `BoardData` shape (columns with nested cardIds, cards map by id)
- On save, the backend receives the full board JSON, deletes existing data, and re-inserts in a transaction
- On fetch, the backend returns the same structure the frontend expects

This approach was chosen for the MVP because:
1. The existing frontend already uses this data shape
2. It keeps the frontend-backend contract simple
3. The full-board-save approach is fine for MVP (single user, local deployment)
4. Future optimization (incremental updates) can be done in Part 7+ without schema changes
