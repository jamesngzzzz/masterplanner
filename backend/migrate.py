import sqlite3
import psycopg2
import json
import os
from dotenv import load_dotenv

# Load local environment files if any
load_dotenv()

SQLITE_DB = "pika.db"
# Use the DATABASE_URL environment variable
POSTGRES_URL = os.getenv("DATABASE_URL") 

if not POSTGRES_URL:
    print("❌ Lỗi: Chưa cấu hình biến môi trường DATABASE_URL!")
    exit(1)

def migrate():
    print("🔄 Bắt đầu kết nối CSDL...")
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cur = sqlite_conn.cursor()

    # Make sure we rewrite postgres:// to postgresql:// if needed
    url = POSTGRES_URL
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
        
    pg_conn = psycopg2.connect(url)
    pg_cur = pg_conn.cursor()

    # First, make sure tables exist by initializing them
    print("⚙️ Tạo bảng trên PostgreSQL nếu chưa tồn tại...")
    pg_cur.execute("""
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
    pg_cur.execute("""
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
    pg_cur.execute("""
        CREATE TABLE IF NOT EXISTS reasoning_cache (
            cache_key TEXT PRIMARY KEY,
            result    TEXT NOT NULL,
            usage     TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    pg_conn.commit()

    # 1. Migrate bảng eval_sessions
    print("📦 Đang di chuyển dữ liệu eval_sessions...")
    sqlite_cur.execute("SELECT * FROM eval_sessions")
    sessions = sqlite_cur.fetchall()
    
    migrated_sessions = 0
    for s in sessions:
        pg_cur.execute("""
            INSERT INTO eval_sessions (id, created_at, updated_at, phone, profile_id, profile_name, current_step, data, totals)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                updated_at = EXCLUDED.updated_at,
                current_step = EXCLUDED.current_step,
                data = EXCLUDED.data,
                totals = EXCLUDED.totals
        """, (
            s["id"], s["created_at"], s["updated_at"], s["phone"], 
            s["profile_id"], s["profile_name"], s["current_step"], 
            s["data"], s["totals"]
        ))
        migrated_sessions += 1
    
    # 2. Migrate bảng plan_feedback
    print("📦 Đang di chuyển dữ liệu plan_feedback...")
    sqlite_cur.execute("SELECT * FROM plan_feedback")
    feedbacks = sqlite_cur.fetchall()
    
    migrated_feedbacks = 0
    for f in feedbacks:
        pg_cur.execute("""
            INSERT INTO plan_feedback (id, dataset, week_label, star_rating, tags, comment, item_feedback, submitted_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (dataset, week_label) DO UPDATE SET
                star_rating = EXCLUDED.star_rating,
                tags = EXCLUDED.tags,
                comment = EXCLUDED.comment,
                item_feedback = EXCLUDED.item_feedback,
                submitted_at = EXCLUDED.submitted_at
        """, (
            f["id"], f["dataset"], f["week_label"], f["star_rating"], 
            f["tags"], f["comment"], f["item_feedback"], f["submitted_at"]
        ))
        migrated_feedbacks += 1

    pg_conn.commit()
    
    sqlite_conn.close()
    pg_conn.close()
    
    print(f"✅ Đã di chuyển thành công {migrated_sessions} sessions và {migrated_feedbacks} feedback mục tiêu lên PostgreSQL!")

if __name__ == "__main__":
    migrate()
