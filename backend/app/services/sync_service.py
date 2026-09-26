"""
Offline-sync service.

Receives batched data from the Next.js / Dexie.js frontend and persists it
into the `metis` MySQL database created by MYSQL/dashboard.sql.

Tables used:
  • friction_logs      (AI-side helper table — created on first sync)
  • context_registry   (AI-side helper table — created on first sync)
  • review_cards       (dashboard.sql SM-2 table — upserted on every retention sync)
"""
import json
import logging

from app.schemas.sync    import SyncPayload
from app.core.db         import execute, get_review_card_upsert
from app.core.db_queries import (
    USER_GET_ID_BY_EMAIL,
    CREATE_FRICTION_LOGS,
    CREATE_CONTEXT_REGISTRY,
    FRICTION_LOG_INSERT,
    CONTEXT_CARD_INSERT,
)

logger = logging.getLogger("metis.sync")


class SyncService:

    # ─────────────────────────────────────────────────────────────────────────
    # Ensure AI-side helper tables exist  (not in dashboard.sql)
    # ─────────────────────────────────────────────────────────────────────────

    def _ensure_helper_tables(self) -> None:
        execute(CREATE_FRICTION_LOGS)
        execute(CREATE_CONTEXT_REGISTRY)

    # ─────────────────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────────────────

    def sync_data(self, payload: SyncPayload) -> dict:
        self._ensure_helper_tables()

        inserted_friction  = 0
        inserted_cards     = 0
        inserted_retention = 0
        errors: list[str]  = []

        # 1. Friction logs
        for log in payload.frictionLogs:
            row = execute(
                FRICTION_LOG_INSERT,
                (
                    log.id,
                    log.userId,
                    log.sessionId,
                    log.timestamp,
                    log.cognitiveFrictionIndex,
                    log.difficultyScore,
                    int(bool(log.attentionDrift)),
                    int(bool(log.squintingDetected)),
                    int(bool(log.downwardGaze)),
                    log.interventionTriggered,
                ),
            )
            if row is not None: inserted_friction += 1
            else:               errors.append(f"friction_log userId={log.userId}")

        # 2. Context registry
        for card in payload.contextRegistry:
            row = execute(
                CONTEXT_CARD_INSERT,
                (
                    card.id,
                    card.deckId,
                    card.title,
                    card.content,
                    card.type,
                    json.dumps(card.tags) if card.tags else "[]",
                    card.createdAt,
                ),
            )
            if row is not None: inserted_cards += 1
            else:               errors.append(f"context_card deckId={card.deckId}")

        # 3. Retention state → upsert review_cards
        #    The frontend sends userId as email string; we resolve to INT,
        #    falling back to the seeded demo user (id=1).
        for state in payload.retentionState:
            user_rows  = execute(USER_GET_ID_BY_EMAIL, (state.userId,), fetch=True)
            user_db_id = (user_rows[0][0] if user_rows else None) or 1

            try:
                q_id = int(state.cardId)
            except (ValueError, TypeError):
                errors.append(f"retention_state cardId={state.cardId} not numeric — skipped")
                continue

            row = execute(
                get_review_card_upsert(),
                (
                    user_db_id,        q_id,
                    state.repetitions, state.interval,
                    state.easeFactor,  state.nextReviewDate,
                ),
            )
            if row is not None: inserted_retention += 1
            else:               errors.append(f"retention_state cardId={state.cardId}")

        result: dict = {
            "status": "success" if not errors else "partial",
            "inserted": {
                "friction_logs":    inserted_friction,
                "context_cards":    inserted_cards,
                "retention_states": inserted_retention,
            },
        }
        if errors:
            result["warnings"] = errors
        return result


sync_service = SyncService()
