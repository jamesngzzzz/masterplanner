"""
Reasoning Cache (SQLite/PostgreSQL)
Caches LLM reasoning results to avoid repeated API calls during demos.
"""
import json
import logging
from typing import Any, Dict, Optional
from app.core.db import get_db_connection

logger = logging.getLogger("reasoning_db")


def _get_conn():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS reasoning_cache (
            cache_key TEXT PRIMARY KEY,
            result    TEXT NOT NULL,
            usage     TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()
    cursor.close()
    return conn


def get_cached_reasoning(cache_key: str) -> Optional[Dict[str, Any]]:
    try:
        conn = _get_conn()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT result, usage FROM reasoning_cache WHERE cache_key = ?",
            (cache_key,),
        )
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if row:
            result = json.loads(row["result"])
            usage = json.loads(row["usage"]) if row["usage"] else {}
            result["cached"] = True
            result["token_usage"] = usage
            return result
    except Exception as e:
        logger.warning(f"Cache read error: {e}")
    return None


def save_reasoning_cache(
    cache_key: str, result: Dict[str, Any], usage: Dict[str, Any]
) -> None:
    try:
        conn = _get_conn()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO reasoning_cache (cache_key, result, usage)
            VALUES (?, ?, ?)
            """,
            (cache_key, json.dumps(result, ensure_ascii=False), json.dumps(usage)),
        )
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        logger.warning(f"Cache write error: {e}")
