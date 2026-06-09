import uuid
import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.core.db import get_db_connection
from app.schemas.eval_session import EvalSessionCreate, EvalSessionPatch, EvalSessionSummaryOut
from app.core.posthog_client import get_posthog

router = APIRouter(prefix="/eval-sessions", tags=["eval-sessions"])

@router.get("", tags=["eval-sessions"])
def list_eval_sessions():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM eval_sessions ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return {
        "sessions": [
            {
                "id": r["id"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
                "phone": r["phone"],
                "profile_id": r["profile_id"],
                "profile_name": r["profile_name"],
                "current_step": r["current_step"],
                "data": json.loads(r["data"] or "{}"),
                "totals": json.loads(r["totals"] or "{}"),
            }
            for r in rows
        ]
    }

@router.post("", response_model=EvalSessionSummaryOut, status_code=status.HTTP_201_CREATED)
def create_eval_session(body: EvalSessionCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    cursor.execute("""
        INSERT INTO eval_sessions (id, created_at, updated_at, phone, profile_id, profile_name, current_step, data, totals)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (session_id, now, now, body.phone, body.profile_id, body.profile_name, "loading_profile", "{}", "{}"))
    
    conn.commit()
    conn.close()
    
    posthog = get_posthog()
    if posthog:
        posthog.capture(
            distinct_id=body.profile_id,
            event="eval_session_created",
            properties={"session_id": session_id},
        )

    return EvalSessionSummaryOut(
        id=session_id,
        created_at=now,
        updated_at=now,
        phone=body.phone or "",
        profile_id=body.profile_id,
        profile_name=body.profile_name or "",
        current_step="loading_profile",
        data={},
        totals={}
    )

@router.get("/latest-active/by-profile")
def get_latest_active_eval_session(profile_id: str = ""):
    profile_id = profile_id.strip()
    if not profile_id:
        raise HTTPException(status_code=400, detail="Thiếu profile_id")
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM eval_sessions 
        WHERE profile_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
    """, (profile_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return {"session": None}
        
    return {
        "session": {
            "id": row["id"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "phone": row["phone"],
            "profile_id": row["profile_id"],
            "profile_name": row["profile_name"],
            "current_step": row["current_step"],
            "data": json.loads(row["data"] or "{}"),
            "totals": json.loads(row["totals"] or "{}")
        }
    }

@router.post("/{session_id}/update")
def update_eval_session(session_id: str, body: EvalSessionPatch):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM eval_sessions WHERE id = ?", (session_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên")
        
    current_data = json.loads(row["data"] or "{}")
    current_totals = json.loads(row["totals"] or "{}")
    
    if body.data:
        current_data.update(body.data)
        
    if body.totals:
        current_totals.update(body.totals)
        
    now = datetime.now(timezone.utc).isoformat()
    current_step = body.current_step if body.current_step else row["current_step"]
    
    cursor.execute("""
        UPDATE eval_sessions 
        SET updated_at = ?, current_step = ?, data = ?, totals = ?
        WHERE id = ?
    """, (now, current_step, json.dumps(current_data), json.dumps(current_totals), session_id))
    
    conn.commit()
    conn.close()
    
    # Invalidate local JSON caches so the UI reads the fresh SQLite DB data
    profile_id = row["profile_id"]
    if profile_id:
        import os, glob
        base_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "main")
        for cache_dir in ["planner_memory", "planner_weekly"]:
            pattern = os.path.join(base_dir, cache_dir, f"{profile_id}*.json")
            for f in glob.glob(pattern):
                try:
                    os.remove(f)
                except OSError:
                    pass
    
    
    posthog = get_posthog()
    if posthog:
        posthog.capture(
            distinct_id=row["profile_id"],
            event="eval_session_step_updated",
            properties={"new_step": current_step},
        )

    return {"ok": True, "session": {
            "id": session_id,
            "updated_at": now,
            "current_step": current_step,
            "data": current_data,
            "totals": current_totals
        }}
