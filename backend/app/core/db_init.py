"""
db_init.py — idempotent schema initialiser for the METIS SQLite database.

Called once at application startup (see app/main.py).
In MySQL mode this is a no-op because the schema is managed externally via
dashboard.sql.
"""
import logging

logger = logging.getLogger("metis.db_init")


def init_sqlite_schema() -> None:
    """Create all METIS tables and seed data in the SQLite database.

    Safe to call multiple times — every statement uses IF NOT EXISTS /
    INSERT OR IGNORE so it is fully idempotent.
    """
    from app.core.config import settings

    if not settings.USE_SQLITE:
        logger.debug("USE_SQLITE=false — skipping SQLite schema init.")
        return

    from app.core.db import _get_sqlite_connection
    from app.core.sqlite_queries import ALL_STATEMENTS

    conn = _get_sqlite_connection()
    try:
        for stmt in ALL_STATEMENTS:
            conn.execute(stmt)
        conn.commit()
        logger.info("SQLite schema initialised at %s", settings.SQLITE_PATH)
    except Exception as exc:  # noqa: BLE001
        logger.error("SQLite schema init failed: %s", exc)
        conn.rollback()
