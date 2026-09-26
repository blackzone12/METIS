"""
db_queries.py — centralised SQL query dictionary for the METIS backend.

Every raw SQL string used across services lives here as a named constant.
Services import only what they need; nothing is duplicated across files.

Table reference (from MYSQL/dashboard.sql):
  users, learning_sessions, telemetry, adaptive_events,
  questions, answers, review_cards, voice_events, scratchpad_events
"""

# ─────────────────────────────────────────────────────────────────────────────
# learning_sessions
# ─────────────────────────────────────────────────────────────────────────────

SESSION_INSERT = """
    INSERT INTO learning_sessions
        (user_id, session_code, status)
    VALUES
        (%s, %s, 'ACTIVE')
"""

SESSION_COMPLETE = """
    UPDATE learning_sessions
       SET ended_at = NOW(),
           status   = 'COMPLETED'
     WHERE session_code = %s
"""

SESSION_GET_BY_CODE = """
    SELECT id, user_id
      FROM learning_sessions
     WHERE session_code = %s
     LIMIT 1
"""

SESSION_GET_ID_BY_CODE = """
    SELECT id
      FROM learning_sessions
     WHERE session_code = %s
     LIMIT 1
"""

SESSION_GET_USER_BY_ID = """
    SELECT user_id
      FROM learning_sessions
     WHERE id = %s
     LIMIT 1
"""

# ─────────────────────────────────────────────────────────────────────────────
# telemetry
# ─────────────────────────────────────────────────────────────────────────────

TELEMETRY_INSERT = """
    INSERT INTO telemetry
        (session_id, ear, head_pitch, head_yaw,
         voice_hesitation, speech_duration_ms, motor_fatigue, cfi)
    VALUES
        (%s, %s, %s, %s, %s, %s, %s, %s)
"""

TELEMETRY_LATEST_BY_SESSION = """
    SELECT ear, head_pitch, head_yaw, voice_hesitation,
           speech_duration_ms, motor_fatigue, cfi, created_at
      FROM telemetry
     WHERE session_id = %s
     ORDER BY created_at DESC
     LIMIT 1
"""

# ─────────────────────────────────────────────────────────────────────────────
# adaptive_events
# ─────────────────────────────────────────────────────────────────────────────

ADAPTIVE_EVENT_INSERT = """
    INSERT INTO adaptive_events
        (session_id, cfi, mode, timer_paused,
         scratchpad_enabled, voice_first_enabled, font_scale)
    VALUES
        (%s, %s, %s, %s, %s, %s, %s)
"""

# ─────────────────────────────────────────────────────────────────────────────
# voice_events
# ─────────────────────────────────────────────────────────────────────────────

VOICE_EVENT_INSERT = """
    INSERT INTO voice_events
        (session_id, transcript, word_count, duration_ms,
         hesitation_count, hesitation_score)
    VALUES
        (%s, %s, %s, %s, %s, %s)
"""

# ─────────────────────────────────────────────────────────────────────────────
# scratchpad_events
# ─────────────────────────────────────────────────────────────────────────────

SCRATCHPAD_EVENT_INSERT = """
    INSERT INTO scratchpad_events
        (session_id, content, word_count)
    VALUES
        (%s, %s, %s)
"""

# ─────────────────────────────────────────────────────────────────────────────
# answers
# ─────────────────────────────────────────────────────────────────────────────

ANSWER_INSERT = """
    INSERT INTO answers
        (session_id, question_id, answer_text, is_correct, quality)
    VALUES
        (%s, %s, %s, %s, %s)
"""

# ─────────────────────────────────────────────────────────────────────────────
# review_cards  (SM-2)
# ─────────────────────────────────────────────────────────────────────────────

REVIEW_CARD_GET = """
    SELECT repetitions, review_interval, ease_factor
      FROM review_cards
     WHERE user_id     = %s
       AND question_id = %s
     LIMIT 1
"""

REVIEW_CARD_UPSERT = """
    INSERT INTO review_cards
        (user_id, question_id, repetitions, review_interval,
         ease_factor, next_review, last_reviewed)
    VALUES
        (%s, %s, %s, %s, %s, %s, NOW())
    ON DUPLICATE KEY UPDATE
        repetitions     = VALUES(repetitions),
        review_interval = VALUES(review_interval),
        ease_factor     = VALUES(ease_factor),
        next_review     = VALUES(next_review),
        last_reviewed   = NOW()
"""

# ─────────────────────────────────────────────────────────────────────────────
# users
# ─────────────────────────────────────────────────────────────────────────────

USER_GET_ID_BY_EMAIL = """
    SELECT id
      FROM users
     WHERE email = %s
     LIMIT 1
"""

# ─────────────────────────────────────────────────────────────────────────────
# Sync helper tables  (not in dashboard.sql — created by sync_service)
# ─────────────────────────────────────────────────────────────────────────────

CREATE_FRICTION_LOGS = """
    CREATE TABLE IF NOT EXISTS friction_logs (
        id               BIGINT      AUTO_INCREMENT PRIMARY KEY,
        client_id        INT,
        user_id          VARCHAR(255),
        session_id       VARCHAR(255),
        timestamp        VARCHAR(255),
        cfi              FLOAT,
        difficulty_score FLOAT,
        attention_drift  TINYINT(1),
        squinting        TINYINT(1),
        downward_gaze    TINYINT(1),
        intervention     VARCHAR(255)
    )
"""

CREATE_CONTEXT_REGISTRY = """
    CREATE TABLE IF NOT EXISTS context_registry (
        id         BIGINT      AUTO_INCREMENT PRIMARY KEY,
        client_id  INT,
        deck_id    VARCHAR(255),
        title      VARCHAR(255),
        content    TEXT,
        type       VARCHAR(100),
        tags       TEXT,
        created_at VARCHAR(255)
    )
"""

FRICTION_LOG_INSERT = """
    INSERT INTO friction_logs
        (client_id, user_id, session_id, timestamp, cfi,
         difficulty_score, attention_drift, squinting,
         downward_gaze, intervention)
    VALUES
        (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""

CONTEXT_CARD_INSERT = """
    INSERT INTO context_registry
        (client_id, deck_id, title, content, type, tags, created_at)
    VALUES
        (%s, %s, %s, %s, %s, %s, %s)
"""
