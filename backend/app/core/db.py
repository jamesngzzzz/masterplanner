import os
import sqlite3
import logging

logger = logging.getLogger("db")

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "pika.db")
DATABASE_URL = os.getenv("DATABASE_URL")

# Compatibility classes for PostgreSQL to match sqlite3 interface
class PostgreSQLRowWrapper:
    """Wrapper to make PostgreSQL rows behave like sqlite3.Row (indexable by string and int)"""
    def __init__(self, row_dict):
        self._row_dict = row_dict or {}
        self._keys = list(self._row_dict.keys())
        
    def __getitem__(self, key):
        if isinstance(key, int):
            return self._row_dict[self._keys[key]]
        return self._row_dict.get(key)
        
    def keys(self):
        return self._keys

class PostgreSQLCursorWrapper:
    """Wrapper to map sqlite3 cursor behavior to psycopg2 cursor"""
    def __init__(self, pg_cursor):
        self.cursor = pg_cursor
        
    def execute(self, query, parameters=None):
        # Convert ? placeholders to %s
        converted_query = query.replace("?", "%s")
        # Convert SQLite "INSERT OR REPLACE" to Postgres "INSERT ... ON CONFLICT"
        if "INSERT OR REPLACE INTO reasoning_cache" in query:
            converted_query = """
                INSERT INTO reasoning_cache (cache_key, result, usage)
                VALUES (%s, %s, %s)
                ON CONFLICT (cache_key) DO UPDATE 
                SET result = EXCLUDED.result, usage = EXCLUDED.usage
            """
        
        if parameters is not None:
            self.cursor.execute(converted_query, parameters)
        else:
            self.cursor.execute(converted_query)
            
    def fetchone(self):
        row = self.cursor.fetchone()
        if row is None:
            return None
        return PostgreSQLRowWrapper(row)
        
    def fetchall(self):
        rows = self.cursor.fetchall()
        return [PostgreSQLRowWrapper(r) for r in rows]
        
    def close(self):
        self.cursor.close()

class PostgreSQLConnectionWrapper:
    """Wrapper to map sqlite3 connection behavior to psycopg2 connection"""
    def __init__(self, pg_conn):
        self.conn = pg_conn
        
    def cursor(self):
        from psycopg2.extras import RealDictCursor
        pg_cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        return PostgreSQLCursorWrapper(pg_cursor)
        
    def commit(self):
        self.conn.commit()
        
    def rollback(self):
        self.conn.rollback()
        
    def close(self):
        self.conn.close()

def get_db_connection():
    if DATABASE_URL:
        # Use PostgreSQL
        try:
            import psycopg2
            url = DATABASE_URL
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql://", 1)
            conn = psycopg2.connect(url)
            return PostgreSQLConnectionWrapper(conn)
        except ImportError:
            logger.error("psycopg2 is not installed. Please run 'pip install psycopg2-binary'")
            # Fall back to SQLite
        except Exception as e:
            logger.error(f"Error connecting to PostgreSQL: {e}. Falling back to SQLite.")
            
    # SQLite fallback
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS eval_sessions (
            id TEXT PRIMARY KEY,
            created_at TEXT,
            updated_at TEXT,
            phone TEXT,
            profile_id TEXT,
            profile_name TEXT,
            current_step TEXT,
            data TEXT,
            totals TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS plan_feedback (
            id TEXT PRIMARY KEY,
            dataset TEXT,
            week_label TEXT,
            star_rating INTEGER,
            tags TEXT,
            comment TEXT,
            item_feedback TEXT,
            submitted_at TEXT,
            UNIQUE(dataset, week_label)
        )
    """)
    conn.commit()
    conn.close()
