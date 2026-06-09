"""
Learn Session Scheduler
-----------------------
Deterministically injects LEARN activities into a weekly plan that comes
out of the AI planner (which only generates TALK/GAME/REVIEW sessions).

Philosophy (from PRD + planner PDF):
- LEARN sessions are consecutive activities from the same mission (same topic, same level)
- The ratio of TALK vs LEARN is driven by the ratio_mode:
    talk_heavy   → 70% TALK, 30% LEARN  (round to whole sessions)
    balanced     → 50% TALK, 50% LEARN
    learn_heavy  → 30% TALK, 70% LEARN
- LEARN activities should be grouped (not scattered), ideally 2-3 in a row
  per day block, mirroring how the real product works
- We pick from the child's current mission level, defaulting to preA1 for
  prototype purposes. The start_order is randomised per-profile to give
  variety across the 5 demo profiles.
"""
import random
import logging
from typing import Any, Dict, List, Optional, Tuple

from app.core.learning_db import db as learning_db

logger = logging.getLogger("learn_scheduler")

# Ratio mode → (talk_slots, learn_slots) for a 7-session week
RATIO_MAP: Dict[str, Tuple[int, int]] = {
    "talk_heavy": (5, 2),
    "TALK_HEAVY": (5, 2),
    "balanced": (4, 3),
    "BALANCED": (4, 3),
    "learn_heavy": (2, 5),
    "LEARN_HEAVY": (2, 5),
}

DEFAULT_RATIO = (4, 3)  # balanced

# Mission levels in order — used to pick the right level bucket
LEVEL_ORDER = ["preA1", "A1", "A2", "B1"]


def _pick_mission(en_level: str, profile_id: str) -> Optional[str]:
    """
    Pick a plausible mission for the child's English level.
    Uses profile_id as a seed so the same profile always gets the same mission.
    """
    # Normalise level
    level_norm = (en_level or "pre_a1").lower().replace("-", "").replace("_", "")
    level_prefix_map = {
        "prea1": "preA1",
        "pre_a1": "preA1",
        "a1": "preA1",    # prototype: A1 still uses preA1 curriculum
        "a2": "preA1",
        "b1": "preA1",
    }
    prefix = level_prefix_map.get(level_norm, "preA1")

    missions = learning_db.get_missions_by_level(prefix)
    if not missions:
        logger.warning(f"No missions found for prefix={prefix}, falling back to all")
        missions = learning_db.get_all_missions()[:10]
    if not missions:
        return None

    # Deterministic pick based on profile_id hash
    rng = random.Random(profile_id)
    return rng.choice(missions)


def _pick_start_order(mission_id: str, profile_id: str) -> float:
    """Pick a random starting position within the mission for variety."""
    activities = learning_db.get_mission_activities(mission_id)
    if not activities:
        return 0.0
    rng = random.Random(profile_id + "_order")
    # Start at one of the first 60% of activities
    max_start = max(0, int(len(activities) * 0.6) - 1)
    idx = rng.randint(0, max_start)
    return activities[idx]["order"]


def _build_learn_session(activity: Dict[str, Any], day: int, session: int) -> Dict[str, Any]:
    """Convert a learning activity into a daily-todo-compatible session item."""
    learn_data = activity.get("learn_data") or {}
    words = []
    if isinstance(learn_data.get("words"), list):
        words = [
            w.get("word", w) if isinstance(w, dict) else str(w)
            for w in learn_data["words"][:5]
        ]

    sentences = []
    if isinstance(learn_data.get("sentences"), list):
        sentences = [
            s.get("text", s) if isinstance(s, dict) else str(s)
            for s in learn_data["sentences"][:2]
        ]

    return {
        "day": day,
        "session": session,
        "time_slot": "buổi sáng",     # LEARN goes in the morning
        "title": activity.get("creative_name") or activity.get("name", ""),
        "topic": activity.get("name", ""),
        "topic_strategy": f"Học tiếng Anh: {activity.get('name', '')}",
        "activity_type": "LEARN",
        "learn_mechanism": activity.get("learn_mechanism", "WORK_FLOW"),
        "activity_id": activity.get("id", ""),
        "mission_id": activity.get("mission_id", ""),
        "rationale": activity.get("story") or f"Học từ vựng và câu qua bài: {activity.get('name', '')}",
        "memory_to_inject": [],
        "target_vocab": words,
        "target_sentences": sentences,
        "embedded_value": "Tự học",
        "en_pressure": "structured",
        "talk_techniques": {},
        "max_turns": 10,
        "cliffhanger_for_next": "",
        "parent_summary": f"Con học bài '{activity.get('name', '')}' — {len(words)} từ mới.",
    }


def inject_learn_sessions(
    talk_sessions: List[Dict[str, Any]],
    profile_id: str,
    en_level: str = "pre_a1",
    ratio_mode: str = "balanced",
) -> List[Dict[str, Any]]:
    """
    Takes the AI-generated TALK sessions and injects LEARN sessions
    to produce the final unified weekly plan.

    Returns a merged list sorted by (day, activity_type priority, session).
    LEARN sessions get morning slot, TALK sessions get afternoon slot.
    """
    talk_count, learn_count = RATIO_MAP.get(ratio_mode, DEFAULT_RATIO)

    # Trim or keep TALK sessions to the target count
    actual_talk = talk_sessions[:talk_count]

    # Pick learning activities
    mission_id = _pick_mission(en_level, profile_id)
    learn_items: List[Dict[str, Any]] = []

    if mission_id and learn_count > 0:
        start_order = _pick_start_order(mission_id, profile_id)
        activities = learning_db.get_consecutive_activities(
            mission_id=mission_id,
            count=learn_count,
            start_order=start_order,
        )
        logger.info(
            f"[learn_scheduler] profile={profile_id} mission={mission_id} "
            f"start_order={start_order} activities_found={len(activities)} "
            f"learn_count={learn_count}"
        )
        learn_items = activities[:learn_count]
    else:
        logger.warning(f"[learn_scheduler] No mission found for profile={profile_id} level={en_level}")

    # Assign days: LEARN in morning, TALK in afternoon
    # Spread across the week: group 2-3 LEARN items on earlier days
    total_days = max(len(actual_talk), 5)
    merged: List[Dict[str, Any]] = []

    # Distribute LEARN sessions to days 1..N
    learn_sessions_built: List[Dict[str, Any]] = []
    for i, activity in enumerate(learn_items):
        day = (i // 2) + 1  # 2 learn activities per day max
        day = min(day, total_days)
        learn_sessions_built.append(_build_learn_session(activity, day=day, session=i + 1))

    # Re-number TALK sessions: day = LEARN day + offset to avoid clashes
    for i, talk in enumerate(actual_talk):
        # Keep original day if present, else assign sequentially
        day = talk.get("day", i + 1)
        merged.append({**talk, "day": day, "time_slot": "buổi chiều"})

    merged.extend(learn_sessions_built)

    # Sort: day asc, LEARN before TALK on same day, then session asc
    def sort_key(s: Dict[str, Any]) -> Tuple:
        day = s.get("day", 99)
        type_order = 0 if s.get("activity_type") == "LEARN" else 1
        session = s.get("session", 99)
        return (day, type_order, session)

    merged.sort(key=sort_key)
    return merged
