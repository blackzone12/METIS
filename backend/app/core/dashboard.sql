CREATE DATABASE IF NOT EXISTS metis;

USE metis;


-- =========================================
-- USERS
-- =========================================

CREATE TABLE IF NOT EXISTS users (

    id INT AUTO_INCREMENT PRIMARY KEY,

    name VARCHAR(100) NOT NULL,

    email VARCHAR(150) UNIQUE NOT NULL,

    password_hash VARCHAR(255),

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP

);


-- =========================================
-- LEARNING SESSIONS
-- =========================================

CREATE TABLE IF NOT EXISTS learning_sessions (

    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    user_id INT,

    session_code VARCHAR(100)
        UNIQUE NOT NULL,

    started_at DATETIME
        DEFAULT CURRENT_TIMESTAMP,

    ended_at DATETIME NULL,

    status ENUM(
        'ACTIVE',
        'COMPLETED',
        'CANCELLED'
    )
    DEFAULT 'ACTIVE',

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL

);


-- =========================================
-- TELEMETRY
-- =========================================

CREATE TABLE IF NOT EXISTS telemetry (

    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    session_id BIGINT NOT NULL,

    ear DECIMAL(6,4),

    head_pitch DECIMAL(8,3),

    head_yaw DECIMAL(8,3),

    voice_hesitation DECIMAL(6,3),

    speech_duration_ms INT DEFAULT 0,

    motor_fatigue DECIMAL(6,3),

    cfi DECIMAL(6,3),

    created_at DATETIME
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id)
        REFERENCES learning_sessions(id)
        ON DELETE CASCADE,

    INDEX idx_session_time
        (session_id, created_at)

);


-- =========================================
-- ADAPTIVE EVENTS
-- =========================================

CREATE TABLE IF NOT EXISTS adaptive_events (

    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    session_id BIGINT NOT NULL,

    cfi DECIMAL(6,3) NOT NULL,

    mode ENUM(
        'NORMAL',
        'FOCUS',
        'SCRATCHPAD',
        'BREAK'
    ) NOT NULL,

    timer_paused BOOLEAN DEFAULT FALSE,

    scratchpad_enabled BOOLEAN DEFAULT FALSE,

    voice_first_enabled BOOLEAN DEFAULT FALSE,

    font_scale DECIMAL(4,2)
        DEFAULT 1.00,

    created_at DATETIME
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id)
        REFERENCES learning_sessions(id)
        ON DELETE CASCADE

);


-- =========================================
-- QUESTIONS
-- =========================================

CREATE TABLE IF NOT EXISTS questions (

    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    question_text TEXT NOT NULL,

    subject VARCHAR(100),

    topic VARCHAR(100),

    difficulty ENUM(
        'EASY',
        'MEDIUM',
        'HARD'
    )
    DEFAULT 'MEDIUM',

    created_at DATETIME
        DEFAULT CURRENT_TIMESTAMP

);


-- =========================================
-- ANSWERS
-- =========================================

CREATE TABLE IF NOT EXISTS answers (

    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    session_id BIGINT NOT NULL,

    question_id BIGINT NOT NULL,

    answer_text TEXT,

    is_correct BOOLEAN
        DEFAULT FALSE,

    quality TINYINT,

    response_time_ms INT,

    answered_at DATETIME
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id)
        REFERENCES learning_sessions(id)
        ON DELETE CASCADE,

    FOREIGN KEY (question_id)
        REFERENCES questions(id)
        ON DELETE CASCADE,

    CHECK (
        quality >= 0
        AND quality <= 5
    )

);


-- =========================================
-- SM-2 REVIEW CARDS
-- =========================================

CREATE TABLE IF NOT EXISTS review_cards (

    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,

    question_id BIGINT NOT NULL,

    repetitions INT
        DEFAULT 0,

    review_interval INT
        DEFAULT 1,

    ease_factor DECIMAL(5,2)
        DEFAULT 2.50,

    next_review DATETIME,

    last_review DATETIME,

    created_at DATETIME
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    FOREIGN KEY (question_id)
        REFERENCES questions(id)
        ON DELETE CASCADE,

    UNIQUE (
        user_id,
        question_id
    )

);


-- =========================================
-- VOICE EVENTS
-- =========================================

CREATE TABLE IF NOT EXISTS voice_events (

    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    session_id BIGINT NOT NULL,

    transcript TEXT,

    word_count INT DEFAULT 0,

    duration_ms INT DEFAULT 0,

    hesitation_count INT DEFAULT 0,

    hesitation_score DECIMAL(6,3)
        DEFAULT 0,

    created_at DATETIME
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id)
        REFERENCES learning_sessions(id)
        ON DELETE CASCADE

);


-- =========================================
-- SCRATCHPAD
-- =========================================

CREATE TABLE IF NOT EXISTS scratchpad_events (

    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    session_id BIGINT NOT NULL,

    content TEXT,

    word_count INT DEFAULT 0,

    created_at DATETIME
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id)
        REFERENCES learning_sessions(id)
        ON DELETE CASCADE

);


-- =========================================
-- DEMO USER
-- =========================================

INSERT IGNORE INTO users
(name, email, password_hash)
VALUES
(
    'Demo User',
    'demo@metis.com',
    'demo'
);


-- =========================================
-- DEMO QUESTION
-- =========================================

INSERT INTO questions
(question_text, subject, topic, difficulty)

SELECT
    'What is photosynthesis?',
    'Biology',
    'Plant Physiology',
    'EASY'

WHERE NOT EXISTS (

    SELECT 1
    FROM questions
    WHERE question_text =
        'What is photosynthesis?'

);
