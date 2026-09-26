"""
db.py — unified database layer for the METIS backend.

Strategy
--------
* **SQLite (default)** — uses ``backend/metis.db`` (WAL mode, thread-safe via
  ``check_same_thread=False``).  Zero configuration; works offline and in dev.
* **MySQL fallback** — activated when MYSQL_PASSWORD is set *or*
  USE_SQLITE=false in the environment.  Targets the ``metis`` database
  created by ``app/core/dashboard.sql``.

All callers use the same public API:
  get_connection() -> connection | None
  execute(query, params, *, fetch) -> list[tuple] | int | None
"""

import logging
import os
import sqlite3
import threading

logger = logging.getLogger("metis.db")

# ── runtime flag ─────────────────────────────────────────────────────────────

def _use_sqlite() -> bool:
    """Return True when SQLite mode is active (the default)."""
    from app.core.config import settings  # local import avoids circular import
    return settings.USE_SQLITE


# ─────────────────────────────────────────────────────────────────────────────
# SQLite backend
# ─────────────────────────────────────────────────────────────────────────────

_sqlite_local = threading.local()   # one connection per thread


def _sqlite_path() -> str:
    from app.core.config import settings
    return settings.SQLITE_PATH


def _get_sqlite_connection() -> sqlite3.Connection:
    """Return (lazily created) per-thread SQLite connection in WAL mode."""
    if not hasattr(_sqlite_local, "conn") or _sqlite_local.conn is None:
        path = _sqlite_path()
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        conn = sqlite3.connect(path, check_same_thread=False)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.row_factory = sqlite3.Row
        _sqlite_local.conn = conn
        logger.info("SQLite connection opened — %s", path)
    return _sqlite_local.conn


def _execute_sqlite(query: str, params: tuple = (), *, fetch: bool = False):
    """Execute one statement against SQLite.

    MySQL uses ``%s`` placeholders; SQLite uses ``?``.
    This function transparently rewrites the placeholders.
    """
    sqlite_query = query.replace("%s", "?")
    conn = _get_sqlite_connection()
    try:
        cur = conn.execute(sqlite_query, params)
        if fetch:
            result = [tuple(row) for row in cur.fetchall()]
        else:
            conn.commit()
            result = cur.lastrowid
        cur.close()
        return result
    except sqlite3.Error as err:
        logger.error("SQLite execute error: %s | query: %s", err, query)
        try:
            conn.rollback()
        except Exception:
            pass
        return None


# ─────────────────────────────────────────────────────────────────────────────
# MySQL backend  (unchanged from original implementation)
# ─────────────────────────────────────────────────────────────────────────────

_mysql_pool = None


def _build_mysql_pool_config() -> dict:
    from app.core.config import settings
    return {
        "pool_name": "metis_pool",
        "pool_size": 5,
        "host": settings.MYSQL_HOST,
        "port": settings.MYSQL_PORT,
        "user": settings.MYSQL_USER,
        "password": settings.MYSQL_PASSWORD,
        "database": settings.MYSQL_DATABASE,
        "autocommit": False,
    }


def _get_mysql_pool():
    global _mysql_pool
    if _mysql_pool is None:
        try:
            from mysql.connector import pooling
            from app.core.config import settings

            _mysql_pool = pooling.MySQLConnectionPool(**_build_mysql_pool_config())
            logger.info(
                "MySQL connection pool created — host=%s db=%s",
                settings.MYSQL_HOST,
                settings.MYSQL_DATABASE,
            )
        except Exception as err:  # noqa: BLE001
            logger.warning("MySQL pool init failed: %s", err)
    return _mysql_pool


def _get_mysql_connection():
    pool = _get_mysql_pool()
    if pool is None:
        return None
    try:
        return pool.get_connection()
    except Exception as err:  # noqa: BLE001
        logger.warning("MySQL get_connection failed: %s", err)
        return None


def _execute_mysql(query: str, params: tuple = (), *, fetch: bool = False):
    conn = _get_mysql_connection()
    if conn is None:
        return None
    try:
        cursor = conn.cursor()
        cursor.execute(query, params)
        if fetch:
            result = cursor.fetchall()
        else:
            conn.commit()
            result = cursor.lastrowid
        cursor.close()
        return result
    except Exception as err:  # noqa: BLE001
        logger.error("MySQL execute error: %s | query: %s", err, query)
        try:
            conn.rollback()
        except Exception:
            pass
        return None
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# Public API  (same surface as the original db.py)
# ─────────────────────────────────────────────────────────────────────────────

def get_connection():
    """Return an active connection, or None when the database is unreachable."""
    if _use_sqlite():
        return _get_sqlite_connection()
    return _get_mysql_connection()


def execute(query: str, params: tuple = (), *, fetch: bool = False):
    """
    Run a single SQL statement, optionally returning all rows.

    Returns:
        list[tuple]  when fetch=True
        int          lastrowid  when fetch=False (INSERT/UPDATE)
        None         when the database is unavailable or an error occurred
    """
    if _use_sqlite():
        return _execute_sqlite(query, params, fetch=fetch)
    return _execute_mysql(query, params, fetch=fetch)


# Legacy aliases kept for any code that imported the old pool helpers directly.
def get_pool():
    if _use_sqlite():
        return None          # no pool concept in SQLite
    return _get_mysql_pool()


def get_review_card_upsert() -> str:
    """Return the correct UPSERT statement for the active database backend."""
    if _use_sqlite():
        from app.core.sqlite_queries import REVIEW_CARD_UPSERT_SQLITE
        return REVIEW_CARD_UPSERT_SQLITE
    from app.core.db_queries import REVIEW_CARD_UPSERT
    return REVIEW_CARD_UPSERT
