"""
Schedule Config API
Stores and retrieves the parent-configured daily schedule structure per dataset.
Also provides a live recommendation engine (/recommend) that adapts block
durations to fit a target session length and preset ratio — no LLM required.
"""
import json
import logging
import os
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.posthog_client import get_posthog

router = APIRouter(prefix="/api/planner", tags=["schedule-config"])
logger = logging.getLogger(__name__)

# ─── Storage ─────────────────────────────────────────────────────────────────

SCHEDULE_CONFIG_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "main", "schedule_configs"
)
os.makedirs(SCHEDULE_CONFIG_DIR, exist_ok=True)


def _config_path(dataset: str) -> str:
    dataset = dataset.rstrip('.')
    safe = dataset.replace("/", "_").replace("..", "_")
    return os.path.join(SCHEDULE_CONFIG_DIR, f"{safe}.json")


# ─── Models ───────────────────────────────────────────────────────────────────

class ScheduleBlock(BaseModel):
    id: str
    type: str           # GREETING | TALK | TALK_ACTIVITY | WARM_UP | LEARN | GAME | WRAP_UP
    label: str
    emoji: str
    duration_min: int
    enabled: bool
    locked: Optional[bool] = False


class ScheduleConfig(BaseModel):
    dataset: str
    preset: str
    session_duration_min: int
    days_per_week: int
    include_greeting: bool
    include_game: bool
    blocks: List[ScheduleBlock]
    feedback_text: Optional[str] = ""


class RecommendRequest(BaseModel):
    dataset: str
    preset: str
    session_duration_min: int
    days_per_week: int
    blocks: List[ScheduleBlock]


# ─── Defaults ─────────────────────────────────────────────────────────────────

PHASE3_DEFAULT_BLOCKS = [
    {"id": "b1", "type": "GREETING",      "label": "Chào hỏi & Check-in",    "emoji": "👋", "duration_min": 3,  "enabled": True,  "locked": True},
    {"id": "b2", "type": "WARM_UP",       "label": "Warm-up Tiếng Anh",      "emoji": "🔥", "duration_min": 5,  "enabled": True,  "locked": False},
    {"id": "b3", "type": "LEARN",         "label": "Học tiếng Anh · Unit 1", "emoji": "📚", "duration_min": 8,  "enabled": True,  "locked": False},
    {"id": "b4", "type": "LEARN",         "label": "Học tiếng Anh · Unit 2", "emoji": "📚", "duration_min": 8,  "enabled": True,  "locked": False},
    {"id": "b5", "type": "LEARN",         "label": "Học tiếng Anh · Unit 3", "emoji": "📚", "duration_min": 8,  "enabled": True,  "locked": False},
    {"id": "b6", "type": "TALK_ACTIVITY", "label": "Trò chuyện / Game",       "emoji": "🎭", "duration_min": 10, "enabled": True,  "locked": False},
    {"id": "b7", "type": "WRAP_UP",       "label": "Kết thúc & Nghỉ ngơi",   "emoji": "🌙", "duration_min": 2,  "enabled": True,  "locked": True},
]

DEFAULT_CONFIG: Dict[str, Any] = {
    "preset": "phase3_default",
    "session_duration_min": 45,
    "days_per_week": 5,
    "include_greeting": True,
    "include_game": False,
    "blocks": PHASE3_DEFAULT_BLOCKS,
    "feedback_text": "",
}

# Preset targets: ideal ratios per block category
PRESET_TARGETS = {
    "talk_heavy":     {"talk_ratio": 0.45, "learn_ratio": 0.30, "warmup_ratio": 0.10},
    "balanced":       {"talk_ratio": 0.30, "learn_ratio": 0.50, "warmup_ratio": 0.10},
    "learn_heavy":    {"talk_ratio": 0.20, "learn_ratio": 0.65, "warmup_ratio": 0.08},
    "phase3_default": {"talk_ratio": 0.25, "learn_ratio": 0.55, "warmup_ratio": 0.10},
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _load_config(dataset: str) -> Dict[str, Any]:
    path = _config_path(dataset)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {**DEFAULT_CONFIG, "dataset": dataset}


def _save_config(dataset: str, config: Dict[str, Any]) -> None:
    path = _config_path(dataset)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


# ─── Recommendation Engine ────────────────────────────────────────────────────

def _compute_recommendations(
    blocks: List[Dict], preset: str, session_duration_min: int, days_per_week: int
) -> Dict[str, Any]:
    """
    Deterministic adaptation engine with Add/Remove logic.
    Prioritizes scaling adjustable blocks (3-8m).
    Adds or removes blocks if limits are hit or ratios require it.
    LEARN blocks are always fixed at 5m.
    """
    import uuid
    enabled = [b for b in blocks if b.get("enabled", True)]
    actions_taken = []
    
    locked_blocks = [b for b in enabled if b.get("locked", False)]
    learn_blocks = [dict(b) for b in enabled if b.get("type") == "LEARN" and not b.get("locked", False)]
    adjustable_blocks = [dict(b) for b in enabled if b.get("type") not in ("LEARN",) and not b.get("locked", False)]
    
    locked_total = sum(b["duration_min"] for b in locked_blocks)
    budget = max(0, session_duration_min - locked_total)
    
    targets = PRESET_TARGETS.get(preset, PRESET_TARGETS["phase3_default"])
    target_learn_min = budget * targets["learn_ratio"]
    target_learn_count = round(target_learn_min / 5)
    
    # --- LEARN Logic (Fixed 5m) ---
    original_learn_count = len(learn_blocks)
    if target_learn_count > original_learn_count:
        for i in range(target_learn_count - original_learn_count):
            new_unit_idx = len(learn_blocks) + 1
            learn_blocks.append({
                "id": f"auto_l_{new_unit_idx}_{uuid.uuid4().hex[:6]}",
                "type": "LEARN",
                "label": f"Học tiếng Anh · Unit {new_unit_idx}",
                "emoji": "📚",
                "duration_min": 5,
                "enabled": True, "locked": False
            })
        actions_taken.append(f"Thêm {target_learn_count - original_learn_count} buổi Học")
    elif target_learn_count < original_learn_count:
        removed = original_learn_count - target_learn_count
        learn_blocks = learn_blocks[:target_learn_count]
        actions_taken.append(f"Bớt {removed} buổi Học")
        
    for b in learn_blocks:
        b["duration_min"] = 5
        
    learn_total = len(learn_blocks) * 5
    remaining_budget = max(0, session_duration_min - locked_total - learn_total)
    
    # --- Adjustable Logic (Talk, Warmup, Game) ---
    added_adjustable = 0
    removed_adjustable = 0
    
    while remaining_budget > len(adjustable_blocks) * 8:
        adjustable_blocks.append({
            "id": f"auto_t_{uuid.uuid4().hex[:6]}",
            "type": "TALK_ACTIVITY",
            "label": "Trò chuyện / Game",
            "emoji": "🎭",
            "duration_min": 5,
            "enabled": True, "locked": False
        })
        added_adjustable += 1

    while remaining_budget < len(adjustable_blocks) * 3 and len(adjustable_blocks) > 0:
        adjustable_blocks.pop()
        removed_adjustable += 1
        
    if added_adjustable > 0:
        actions_taken.append(f"Thêm {added_adjustable} buổi Trò chuyện")
    if removed_adjustable > 0:
        actions_taken.append(f"Bớt {removed_adjustable} session phụ")

    for b in adjustable_blocks:
        b["duration_min"] = 3
        
    allocated = len(adjustable_blocks) * 3
    to_distribute = remaining_budget - allocated
    
    # Distribute remaining budget
    while to_distribute > 0 and adjustable_blocks:
        min_b = min(adjustable_blocks, key=lambda x: x["duration_min"])
        if min_b["duration_min"] >= 8: break
        min_b["duration_min"] += 1
        to_distribute -= 1

    # --- Reconstruct Order ---
    adapted_blocks = []
    learn_map = {b["id"]: b for b in learn_blocks if not str(b["id"]).startswith("auto_")}
    adj_map = {b["id"]: b for b in adjustable_blocks if not str(b["id"]).startswith("auto_")}
    
    auto_learn = [b for b in learn_blocks if str(b["id"]).startswith("auto_")]
    auto_adj = [b for b in adjustable_blocks if str(b["id"]).startswith("auto_")]
    
    for b in enabled:
        if b.get("locked"):
            adapted_blocks.append(b)
        elif b["type"] == "LEARN":
            if b["id"] in learn_map: adapted_blocks.append(learn_map[b["id"]])
        else:
            if b["id"] in adj_map: adapted_blocks.append(adj_map[b["id"]])
                
    wrap_idx = len(adapted_blocks)
    for i, b in enumerate(adapted_blocks):
        if b["type"] == "WRAP_UP":
            wrap_idx = i
            break
            
    adapted_blocks = adapted_blocks[:wrap_idx] + auto_learn + auto_adj + adapted_blocks[wrap_idx:]
    
    # --- Compile Text & Stats ---
    if not actions_taken:
        feedback_text = "Đã tự động điều chỉnh thời lượng các block để khớp với thời gian mục tiêu."
    else:
        feedback_text = "Đã tự động: " + ", ".join(actions_taken) + " và điều chỉnh thời lượng để khớp với tổng thời gian."

    # Compute final stats for UI
    final_enabled = [b for b in adapted_blocks if b.get("enabled", True)]
    final_total   = sum(b["duration_min"] for b in final_enabled)
    final_talk    = sum(b["duration_min"] for b in final_enabled if b["type"] in ("TALK", "TALK_ACTIVITY"))
    final_learn   = sum(b["duration_min"] for b in final_enabled if b["type"] == "LEARN")
    delta = session_duration_min - final_total
    
    return {
        "adapted_blocks": adapted_blocks,
        "recommendations": [feedback_text] if actions_taken else [],
        "warnings": [feedback_text] if not actions_taken else [],
        "stats": {
            "total_minutes": final_total,
            "target_minutes": session_duration_min,
            "delta_minutes": delta,
            "talk_minutes": final_talk,
            "learn_minutes": final_learn,
            "talk_pct": round((final_talk / final_total) * 100) if final_total else 0,
            "learn_pct": round((final_learn / final_total) * 100) if final_total else 0,
            "fit_score": max(0, min(100, 100 - abs(delta) * 2)),
        },
    }


# ─── Public helpers (used by weekly_plan.py) ─────────────────────────────────

def get_schedule_config(dataset: str) -> Dict[str, Any]:
    return _load_config(dataset)


def get_talk_session_count(dataset: str) -> int:
    cfg = _load_config(dataset)
    blocks = cfg.get("blocks", PHASE3_DEFAULT_BLOCKS)
    return sum(1 for b in blocks if b.get("enabled", True) and b.get("type") in ("TALK", "TALK_ACTIVITY"))


def get_learn_session_count(dataset: str) -> int:
    cfg = _load_config(dataset)
    blocks = cfg.get("blocks", PHASE3_DEFAULT_BLOCKS)
    return sum(1 for b in blocks if b.get("enabled", True) and b.get("type") == "LEARN")


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/schedule-config")
async def get_config(dataset: str):
    return _load_config(dataset)


@router.post("/schedule-config")
async def save_config(config: ScheduleConfig):
    data = config.model_dump()
    _save_config(config.dataset, data)

    enabled = [b for b in data["blocks"] if b["enabled"]]
    talk_count  = sum(1 for b in enabled if b["type"] in ("TALK", "TALK_ACTIVITY"))
    learn_count = sum(1 for b in enabled if b["type"] == "LEARN")
    total_min   = sum(b["duration_min"] for b in enabled)

    posthog = get_posthog()
    if posthog:
        posthog.capture(
            distinct_id=config.dataset,
            event="schedule_config_saved",
            properties={
                "preset": config.preset,
                "session_duration_min": config.session_duration_min,
                "days_per_week": config.days_per_week,
                "talk_sessions": talk_count,
                "learn_sessions": learn_count,
                "total_minutes": total_min,
            },
        )

    return {
        "status": "saved",
        "dataset": config.dataset,
        "summary": {
            "talk_sessions": talk_count,
            "learn_sessions": learn_count,
            "total_minutes": total_min,
            "days_per_week": config.days_per_week,
            "preset": config.preset,
        },
    }


@router.post("/schedule-config/recommend")
async def recommend(req: RecommendRequest):
    """
    Live recommendation endpoint — call on every config change.
    Returns adapted_blocks (scaled durations) + recommendations + warnings.
    Pure math, no LLM, responds in <50ms.
    """
    blocks_raw = [b.model_dump() for b in req.blocks]
    result = _compute_recommendations(
        blocks=blocks_raw,
        preset=req.preset,
        session_duration_min=req.session_duration_min,
        days_per_week=req.days_per_week,
    )
    logger.info(
        f"[recommend] dataset={req.dataset} preset={req.preset} "
        f"target={req.session_duration_min}p fit={result['stats']['fit_score']}"
    )
    return result


@router.delete("/schedule-config")
async def reset_config(dataset: str):
    path = _config_path(dataset)
    if os.path.exists(path):
        os.remove(path)
    return {"status": "reset", "dataset": dataset}
