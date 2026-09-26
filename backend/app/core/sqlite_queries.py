"""
sqlite_queries.py — DDL statements for the METIS SQLite schema.

These mirror the MySQL schema in ``dashboard.sql`` with the following
SQLite-compatible adaptations:

  • AUTO_INCREMENT  → INTEGER PRIMARY KEY AUTOINCREMENT
  • BIGINT / INT    → INTEGER
  • VARCHAR(n)      → TEXT
  • DECIMAL(p,q)    → REAL
  • TINYINT         → INTEGER
  • BOOLEAN         → INTEGER  (SQLite stores booleans as 0/1)
  • DATETIME        → TEXT     (stored as ISO-8601 string)
  • ENUM(...)       → TEXT     (CHECK constraint enforces allowed values)
  • ON DUPLICATE KEY UPDATE → INSERT OR REPLACE / INSERT OR IGNORE
  • INDEX ...       → CREATE INDEX IF NOT EXISTS (separate statement)

All statements are idempotent (CREATE TABLE IF NOT EXISTS).
"""

# ─────────────────────────────────────────────────────────────────────────────
# Core application tables  (matches dashboard.sql)
# ─────────────────────────────────────────────────────────────────────────────

CREATE_USERS = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    UNIQUE NOT NULL,
    password_hash TEXT,
    created_at    TEXT    DEFAULT (datetime('now'))
)
"""

CREATE_LEARNING_SESSIONS = """
CREATE TABLE IF NOT EXISTS learning_sessions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER,
    session_code TEXT    UNIQUE NOT NULL,
    started_at   TEXT    DEFAULT (datetime('now')),
    ended_at     TEXT,
    status       TEXT    NOT NULL DEFAULT 'ACTIVE'
                         CHECK (status IN ('ACTIVE','COMPLETED','CANCELLED')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
)
"""

CREATE_TELEMETRY = """
CREATE TABLE IF NOT EXISTS telemetry (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id         INTEGER NOT NULL,
    ear                REAL,
    head_pitch         REAL,
    head_yaw           REAL,
    voice_hesitation   REAL,
    speech_duration_ms INTEGER DEFAULT 0,
    motor_fatigue      REAL,
    cfi                REAL,
    created_at         TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES learning_sessions(id) ON DELETE CASCADE
)
"""

CREATE_ADAPTIVE_EVENTS = """
CREATE TABLE IF NOT EXISTS adaptive_events (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id          INTEGER NOT NULL,
    cfi                 REAL    NOT NULL,
    mode                TEXT    NOT NULL
                                CHECK (mode IN ('NORMAL','FOCUS','SCRATCHPAD','BREAK')),
    timer_paused        INTEGER DEFAULT 0,
    scratchpad_enabled  INTEGER DEFAULT 0,
    voice_first_enabled INTEGER DEFAULT 0,
    font_scale          REAL    DEFAULT 1.00,
    created_at          TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES learning_sessions(id) ON DELETE CASCADE
)
"""

CREATE_QUESTIONS = """
CREATE TABLE IF NOT EXISTS questions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    question_text TEXT    NOT NULL,
    subject       TEXT,
    topic         TEXT,
    difficulty    TEXT    DEFAULT 'MEDIUM'
                          CHECK (difficulty IN ('EASY','MEDIUM','HARD')),
    created_at    TEXT    DEFAULT (datetime('now'))
)
"""

CREATE_ANSWERS = """
CREATE TABLE IF NOT EXISTS answers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      INTEGER NOT NULL,
    question_id     INTEGER NOT NULL,
    answer_text     TEXT,
    is_correct      INTEGER DEFAULT 0,
    quality         INTEGER CHECK (quality IS NULL OR (quality >= 0 AND quality <= 5)),
    response_time_ms INTEGER,
    answered_at     TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (session_id)  REFERENCES learning_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id)         ON DELETE CASCADE
)
"""

CREATE_REVIEW_CARDS = """
CREATE TABLE IF NOT EXISTS review_cards (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL,
    question_id     INTEGER NOT NULL,
    repetitions     INTEGER DEFAULT 0,
    review_interval INTEGER DEFAULT 1,
    ease_factor     REAL    DEFAULT 2.50,
    next_review     TEXT,
    last_reviewed   TEXT,
    created_at      TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    UNIQUE (user_id, question_id)
)
"""

CREATE_VOICE_EVENTS = """
CREATE TABLE IF NOT EXISTS voice_events (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id       INTEGER NOT NULL,
    transcript       TEXT,
    word_count       INTEGER DEFAULT 0,
    duration_ms      INTEGER DEFAULT 0,
    hesitation_count INTEGER DEFAULT 0,
    hesitation_score REAL    DEFAULT 0,
    created_at       TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES learning_sessions(id) ON DELETE CASCADE
)
"""

CREATE_SCRATCHPAD_EVENTS = """
CREATE TABLE IF NOT EXISTS scratchpad_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    content    TEXT,
    word_count INTEGER DEFAULT 0,
    created_at TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES learning_sessions(id) ON DELETE CASCADE
)
"""

# ─────────────────────────────────────────────────────────────────────────────
# AI-side helper tables  (created by sync_service in db_queries.py)
# ─────────────────────────────────────────────────────────────────────────────

CREATE_FRICTION_LOGS_SQLITE = """
CREATE TABLE IF NOT EXISTS friction_logs (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id        INTEGER,
    user_id          TEXT,
    session_id       TEXT,
    timestamp        TEXT,
    cfi              REAL,
    difficulty_score REAL,
    attention_drift  INTEGER,
    squinting        INTEGER,
    downward_gaze    INTEGER,
    intervention     TEXT
)
"""

CREATE_CONTEXT_REGISTRY_SQLITE = """
CREATE TABLE IF NOT EXISTS context_registry (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id  INTEGER,
    deck_id    TEXT,
    title      TEXT,
    content    TEXT,
    type       TEXT,
    tags       TEXT,
    created_at TEXT
)
"""

# ─────────────────────────────────────────────────────────────────────────────
# Indexes  (kept separate so CREATE TABLE and CREATE INDEX stay idempotent)
# ─────────────────────────────────────────────────────────────────────────────

CREATE_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_telemetry_session_time ON telemetry (session_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_sessions_code          ON learning_sessions (session_code)",
    "CREATE INDEX IF NOT EXISTS idx_answers_session        ON answers (session_id)",
    "CREATE INDEX IF NOT EXISTS idx_review_user_question   ON review_cards (user_id, question_id)",
]

# ─────────────────────────────────────────────────────────────────────────────
# Seed data  (INSERT OR IGNORE so re-runs are safe)
# ─────────────────────────────────────────────────────────────────────────────

SEED_DEMO_USER = """
INSERT OR IGNORE INTO users (name, email, password_hash)
VALUES ('Demo User', 'demo@metis.com', 'demo')
"""

SEED_DEMO_QUESTION = """
INSERT OR IGNORE INTO questions (id, question_text, subject, topic, difficulty)
VALUES (1, 'What is photosynthesis?', 'Biology', 'Plant Physiology', 'EASY')
"""

# ─────────────────────────────────────────────────────────────────────────────
# SQLite-compatible UPSERT for review_cards
# (replaces the MySQL ON DUPLICATE KEY UPDATE variant in db_queries.py)
# ─────────────────────────────────────────────────────────────────────────────

REVIEW_CARD_UPSERT_SQLITE = """
INSERT INTO review_cards
    (user_id, question_id, repetitions, review_interval,
     ease_factor, next_review, last_reviewed)
VALUES
    (?, ?, ?, ?, ?, ?, datetime('now'))
ON CONFLICT(user_id, question_id) DO UPDATE SET
    repetitions     = excluded.repetitions,
    review_interval = excluded.review_interval,
    ease_factor     = excluded.ease_factor,
    next_review     = excluded.next_review,
    last_reviewed   = datetime('now')
"""

# Ordered list of all DDL statements executed by db_init.
ALL_STATEMENTS = [
    CREATE_USERS,
    CREATE_LEARNING_SESSIONS,
    CREATE_TELEMETRY,
    CREATE_ADAPTIVE_EVENTS,
    CREATE_QUESTIONS,
    CREATE_ANSWERS,
    CREATE_REVIEW_CARDS,
    CREATE_VOICE_EVENTS,
    CREATE_SCRATCHPAD_EVENTS,
    CREATE_FRICTION_LOGS_SQLITE,
    CREATE_CONTEXT_REGISTRY_SQLITE,
    *CREATE_INDEXES,
    SEED_DEMO_USER,
    SEED_DEMO_QUESTION,
]
