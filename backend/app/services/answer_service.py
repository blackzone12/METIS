"""
Answer & SM-2 service.

Processes a student's answer, runs the SM-2 spaced-repetition algorithm, and
persists the result to the `answers` and `review_cards` tables from dashboard.sql.
"""
import logging
from datetime import datetime, timedelta

from app.schemas.answer  import AnswerRequest, AnswerResponse, SM2State
from app.core.db         import execute, get_review_card_upsert
from app.core.db_queries import (
    SESSION_GET_BY_CODE,
    REVIEW_CARD_GET,
    ANSWER_INSERT,
)

logger = logging.getLogger("metis.answer")


# ─────────────────────────────────────────────────────────────────────────────
# Pure SM-2 algorithm  (matches serverdashboard.js calculateSM2)
# ─────────────────────────────────────────────────────────────────────────────

def _calculate_sm2(
    repetitions: int,
    interval:    int,
    ease_factor: float,
    quality:     int,
) -> SM2State:
    quality = max(0, min(5, quality))

    if quality < 3:
        repetitions = 0
        interval    = 1
    else:
        repetitions += 1
        if   repetitions == 1: interval = 1
        elif repetitions == 2: interval = 6
        else:                  interval = max(1, round(interval * ease_factor))

    ease_factor  = ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    ease_factor  = round(max(1.3, ease_factor), 2)
    next_review  = (datetime.utcnow() + timedelta(days=interval)).isoformat() + "Z"

    return SM2State(
        repetitions = repetitions,
        interval    = interval,
        easeFactor  = ease_factor,
        nextReview  = next_review,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Service
# ─────────────────────────────────────────────────────────────────────────────

class AnswerService:

    def process_answer(self, request: AnswerRequest) -> AnswerResponse:

        # ── Resolve MySQL session & user ──────────────────────────────────────
        db_sid:  int | None = None
        user_id: int        = 1           # demo user fallback

        session_rows = execute(SESSION_GET_BY_CODE, (request.sessionId,), fetch=True)
        if session_rows:
            db_sid  = session_rows[0][0]
            user_id = session_rows[0][1] or 1

        # ── Load current SM-2 card state ──────────────────────────────────────
        sm2_current = {
            "repetitions": 0,
            "interval":    1,
            "easeFactor":  2.5,
        }

        if db_sid is not None and request.questionId:
            card_rows = execute(
                REVIEW_CARD_GET,
                (user_id, request.questionId),
                fetch=True,
            )
            if card_rows:
                sm2_current = {
                    "repetitions": card_rows[0][0],
                    "interval":    card_rows[0][1],
                    "easeFactor":  float(card_rows[0][2]),
                }

        # ── Run SM-2 ──────────────────────────────────────────────────────────
        sm2 = _calculate_sm2(
            repetitions = sm2_current["repetitions"],
            interval    = sm2_current["interval"],
            ease_factor = sm2_current["easeFactor"],
            quality     = request.quality,
        )

        # ── Persist to MySQL ──────────────────────────────────────────────────
        if db_sid is not None and request.questionId:
            execute(
                ANSWER_INSERT,
                (
                    db_sid,
                    request.questionId,
                    request.answer,
                    int(request.correct),
                    request.quality,
                ),
            )
            execute(
                get_review_card_upsert(),
                (
                    user_id,       request.questionId,
                    sm2.repetitions, sm2.interval,
                    sm2.easeFactor,  sm2.nextReview,
                ),
            )

        return AnswerResponse(
            success = True,
            answer  = request.answer,
            correct = request.correct,
            quality = request.quality,
            sm2     = sm2,
        )


answer_service = AnswerService()
