import json
import logging
import os
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import httpx
import yaml
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.api.routes.planner_memory import DATASET_PROFILE_MAP, _load_cached_memory
from app.core.learning_db import db as learning_db
from app.api.routes.schedule_config import get_learn_session_count, get_talk_session_count, get_schedule_config
from app.core.prompts import WEEKLY_PLAN_PROMPT
from app.core.posthog_client import get_posthog

load_dotenv()

router = APIRouter(prefix="/api/planner", tags=["weekly-plan"])
logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
WEEKLY_PLAN_MODEL = "gpt-4o"

WEEKLY_PLAN_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "main", "planner_weekly"
)

PRICING = {
    "gpt-4o": {"input": 2.50, "output": 10.0},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
}


class WeeklyPlanResponse(BaseModel):
    profile_id: str
    week_start: str
    week_end: str
    week_label: str
    week_strategy: dict
    talk_sessions: list
    learn_sessions: list
    ai_powered: bool
    model_id: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    generated_at: str


def _safe_int(v: Any, default: int = 0) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def _yaml_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def _calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    pricing = PRICING.get(model, PRICING["gpt-4o"])
    return (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1_000_000


def _build_user_prompt(memory_data: Dict) -> str:
    persona = memory_data.get("persona", {})
    clusters = memory_data.get("memory_clusters", [])
    life_events = memory_data.get("life_events", [])
    relationships = memory_data.get("relationship_graph", [])
    talk_history = memory_data.get("talk_history", [])
    observations = memory_data.get("observations_by_domain", {})

    PIKA_DEFAULT_THEMES = ["hành tinh", "popa", "tinh vị", "tàu vũ trụ", "robot pika", "flags", "vũ trụ pika", "sao", "thiên hà pika"]
    
    # Determine Anchor
    best_cluster = None
    for c in clusters:
        if c.get("engagement_potential") != "high":
            continue
        # Check if majority of top items are Pika defaults
        items = c.get("top_items", [])
        default_count = sum(1 for item in items if any(theme in str(item).lower() for theme in PIKA_DEFAULT_THEMES))
        if items and default_count / len(items) >= 0.5:
            continue # Skip default theme cluster
        
        best_cluster = c
        break
        
    if not best_cluster and clusters:
        # Fallback
        for c in clusters:
            items = c.get("top_items", [])
            default_count = sum(1 for item in items if any(theme in str(item).lower() for theme in PIKA_DEFAULT_THEMES))
            if not items or default_count / len(items) < 0.5:
                best_cluster = c
                break
        if not best_cluster:
            best_cluster = clusters[0]
        
    anchor_name = best_cluster.get("name", "") if best_cluster else ""
    anchor_items = best_cluster.get("top_items", [])[:4] if best_cluster else []
    
    # Process Observations
    underserved = []
    for domain, obs_list in observations.items():
        if not obs_list:
            underserved.append(domain)

    sections = [
        "## 1. PERSONA BÉ",
        "```yaml",
        f'disc_type: "{_yaml_escape(str(persona.get("disc_type", "")))}"',
        f'en_level: "{_yaml_escape(str(persona.get("en_level", "")))}"',
        f'persona_summary: "{_yaml_escape(str(persona.get("persona_summary", "")))}"',
        f'engagement_insights: "{_yaml_escape(str(persona.get("engagement_insights", "")))}"',
        f'engage_preferences: {json.dumps(persona.get("engage_preferences", []), ensure_ascii=False)}',
        "```",
        "",
        "## 2. ANCHORED INTEREST & EXCLUDED FACETS",
        "```yaml",
        "anchored_interest:",
        f'  name: "{_yaml_escape(anchor_name)}"',
        f'  top_memories: {json.dumps(anchor_items, ensure_ascii=False)}',
        f'excluded_facets_this_week: {json.dumps(talk_history, ensure_ascii=False)}',
        "ratio:",
        '  mode: "70/30"',
        '  reasoning: "E2 (tuần trước) chưa có dữ liệu so sánh cụ thể -> mặc định dùng anchored dominant"',
        '  target: "3-4 sessions anchored, 1-2 sessions new topics"',
        "```",
        "",
        "## 3. DOMAIN PRIORITIES (Sự phát triển của bé — dùng làm observation_cited)",
        "```yaml",
    ]

    # Build enriched domain priorities from observations_by_domain
    sections += ["strong_this_week:"]
    for domain, obs_list in observations.items():
        if obs_list:
            sections.append(f'  - domain: "{domain}"')
            for obs in obs_list[:3]:  # top 3 per domain
                obs_text = obs.get("observation", "") if isinstance(obs, dict) else str(obs)
                details_text = obs.get("details", "") if isinstance(obs, dict) else ""
                if obs_text:
                    sections.append(f'    observation: "{_yaml_escape(obs_text)}"')
                    if details_text:
                        sections.append(f'    detail: "{_yaml_escape(details_text)}"')
    sections += ["underserved:"]
    for domain in underserved:
        sections.append(f'  - "{domain}"')
    sections += ["```", "", "## 4. KÝ ỨC VÀ SỰ KIỆN KHÁC", "```yaml"]

    sections += ["life_events:"]
    for e in life_events:
        sections += [
            f'  - event: "{_yaml_escape(str(e.get("event", "")))}"',
            f'    priority: "{_yaml_escape(str(e.get("priority", "")))}"',
            f'    follow_up_question: "{_yaml_escape(str(e.get("follow_up_question", "")))}"',
        ]

    sections += ["", "relationship_graph:"]
    for r in relationships:
        sections += [
            f'  - name: "{_yaml_escape(str(r.get("name", "")))}"',
            f'    role: "{_yaml_escape(str(r.get("role", "")))}"',
            f'    details: "{_yaml_escape(str(r.get("details", "")))}"',
        ]

    sections += ["```"]
    return "\n".join(sections)


def _strip_fence(text: str) -> str:
    m = re.search(r"```(?:yaml|yml|json)?\s*\n(.*?)```", text.strip(), re.DOTALL)
    return m.group(1).strip() if m else text.strip()


def _parse_plan_output(raw_text: str) -> Tuple[dict, dict, list]:
    candidate = _strip_fence(raw_text)
    parsed: dict = {}
    try:
        loaded = yaml.safe_load(candidate)
        if isinstance(loaded, dict):
            parsed = loaded
    except yaml.YAMLError:
        pass
    if not parsed:
        try:
            loaded = json.loads(candidate)
            if isinstance(loaded, dict):
                parsed = loaded
        except json.JSONDecodeError:
            pass

    week_strategy = parsed.get("week_strategy", {})
    week_learning_summary = parsed.get("week_learning_summary", {})
    sessions_raw = parsed.get("talk_sessions", parsed.get("sessions", []))

    def _decode_memory_labels(text: str) -> str:
        """
        Replace internal memory-evidence codes with parent-friendly Vietnamese.
        E1 = bé gần đây vẫn đang thể hiện điều này (recent/ongoing signal)
        E2 = đây là sở thích lâu dài của bé (long-term memory anchor)
        NOTE: trim these out every time new data is imported.
        """
        import re
        text = re.sub(r'\(E1\)', '(bé gần đây vẫn đang thể hiện điều này)', text)
        text = re.sub(r'\(E2\)', '(đây là sở thích lâu dài của bé)', text)
        # Also handle standalone E1/E2 at sentence boundaries
        text = re.sub(r'\bE1\b', 'bé gần đây vẫn đang thể hiện điều này', text)
        text = re.sub(r'\bE2\b', 'đây là sở thích lâu dài của bé', text)
        return text

    sessions = []
    for s in sessions_raw:
        if not isinstance(s, dict):
            continue
        sessions.append({
            "day": _safe_int(s.get("day"), 1),
            "session": _safe_int(s.get("session"), 1),
            "title": str(s.get("title") or ""),
            "topic": str(s.get("topic") or ""),
            "topic_strategy": str(s.get("topic_strategy") or ""),
            "domain": str(s.get("domain") or ""),
            "pillar": _safe_int(s.get("pillar"), 0),
            "observation_cited": _decode_memory_labels(str(s.get("observation_cited") or "")),
            "template_used": str(s.get("template_used") or ""),
            "activity_type": str(s.get("activity_type") or "TALK"),
            "rationale": _decode_memory_labels(str(s.get("rationale") or "")),
            "embedded_value": str(s.get("embedded_value") or ""),
            "memory_to_inject": [str(x) for x in (s.get("memory_to_inject") or [])],
            "follow_up_event": str(s.get("follow_up_event")) if s.get("follow_up_event") is not None else None,
            "relationship_to_mention": str(s.get("relationship_to_mention")) if s.get("relationship_to_mention") is not None else None,
            "target_vocab": [str(x) for x in (s.get("target_vocab") or [])],
            "target_sentences": [str(x) for x in (s.get("target_sentences") or [])],
            "en_pressure": str(s.get("en_pressure") or "minimal"),
            "max_turns": _safe_int(s.get("max_turns"), 15),
            "cliffhanger_for_next": str(s.get("cliffhanger_for_next") or ""),
            "parent_summary": str(s.get("parent_summary") or ""),
        })
    if len(sessions) < 5:
        import logging
        logging.getLogger(__name__).warning(
            f"[weekly_plan] GPT returned only {len(sessions)} talk_sessions (expected 5). "
            f"Check prompt compliance or increase max_tokens. "
            f"Raw output length: {len(raw_text)} chars."
        )
    return week_learning_summary, week_strategy, sessions


def _load_cached_weekly_plan(dataset: str, week_label: str) -> Optional[Dict]:
    dataset = dataset.rstrip('.')
    os.makedirs(WEEKLY_PLAN_DIR, exist_ok=True)
    path = os.path.join(WEEKLY_PLAN_DIR, f"{dataset}_{week_label}.json")
    if os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return None


def _save_cached_weekly_plan(dataset: str, week_label: str, data: Dict):
    dataset = dataset.rstrip('.')
    os.makedirs(WEEKLY_PLAN_DIR, exist_ok=True)
    path = os.path.join(WEEKLY_PLAN_DIR, f"{dataset}_{week_label}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@router.get("/weekly-plan")
async def get_weekly_plan(dataset: str = Query(...), force_refresh: bool = False):
    """GET weekly plan — reads from cache first, then generates, or falls back to eval_sessions."""
    import json as _json
    dataset = dataset.rstrip('.')
    profile_id = DATASET_PROFILE_MAP.get(dataset, dataset)

    # 1. Determine week_label — must match the label used when plan was generated (from memory cache)
    memory_data = _load_cached_memory(dataset)
    week_label = (memory_data or {}).get("week_label") or datetime.utcnow().strftime("%Y-W%W")

    if not force_refresh:
        cached = _load_cached_weekly_plan(dataset, week_label)
        if cached:
            logger.info(f"[weekly_plan] Cache HIT for {dataset}")
            return cached

    # 2. Try to generate from cached memory (Excel path)
    if memory_data:
        try:
            logger.info(f"[weekly_plan] Memory exists but no plan cache. Generating on the fly for {dataset}...")
            return await generate_weekly_plan(dataset=dataset, force_refresh=True)
        except Exception as e:
            logger.error(f"[weekly_plan] On-the-fly generation failed: {e}")
            # Fall through to eval_sessions if memory exists but we can't regenerate
            pass

    # 3. Fallback: read weekly_plan from eval_sessions
    try:
        from app.core.db import get_db_connection
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT data FROM eval_sessions WHERE profile_id = ? AND current_step = 'completed' ORDER BY created_at DESC LIMIT 1",
            (profile_id,)
        )
        row = cursor.fetchone()
        conn.close()

        if row:
            session_data = _json.loads(row["data"] or "{}")
            wp = session_data.get("weekly_plan") or {}
            parsed = wp.get("parsed") or wp

            if parsed:
                now = datetime.utcnow()
                week_start = now.strftime("%Y-%m-%d")
                week_end = (now.replace(day=now.day + 6)).strftime("%Y-%m-%d")

                # Map admin pipeline format → planner page format
                daily_sessions = parsed.get("daily_sessions") or []
                talk_sessions = []
                learn_sessions = []
                session_counter = 0
                for day_item in daily_sessions:
                    activities = day_item.get("activities") or []
                    for act in activities:
                        act_type = str(act.get("type", "TALK")).upper()
                        session_counter += 1
                        # Map to full TalkSession interface expected by planner/page.tsx
                        entry = {
                            "day": session_counter,
                            "session": 1,
                            "title": act.get("name", day_item.get("theme", "Buổi học")),
                            "topic": day_item.get("theme", ""),
                            "topic_strategy": "anchored",
                            "domain": "COGNITIVE",
                            "pillar": 7,
                            "observation_cited": act.get("why", ""),
                            "template_used": act.get("type", "TALK"),
                            "activity_type": act_type.lower(),
                            "rationale": act.get("why", act.get("description", "")),
                            "embedded_value": act.get("description", ""),
                            "memory_to_inject": [],
                            "follow_up_event": None,
                            "relationship_to_mention": None,
                            "target_vocab": [],
                            "target_sentences": [],
                            "en_pressure": "minimal",
                            "max_turns": act.get("duration_min", 15),
                            "cliffhanger_for_next": "",
                            "parent_summary": act.get("description", ""),
                            # Legacy fields for backward compat
                            "theme": day_item.get("theme", ""),
                            "name": act.get("name", ""),
                            "description": act.get("description", ""),
                            "duration_min": act.get("duration_min", 15),
                            "skill_tags": act.get("why", ""),
                            "day_label": day_item.get("day", ""),
                            "session_type": act_type,
                        }
                        if act_type == "LEARN":
                            learn_sessions.append(entry)
                        else:
                            talk_sessions.append(entry)


                result = {
                    "profile_id": profile_id,
                    "week_start": week_start,
                    "week_end": week_end,
                    "week_label": week_label,
                    "week_strategy": parsed.get("week_strategy") or {},
                    "plan_name": (parsed.get("week_strategy") or {}).get("week_theme") or "Kế hoạch cá nhân hóa",
                    "talk_sessions": talk_sessions,
                    "learn_sessions": learn_sessions,
                    "personalization_notes": parsed.get("personalization_notes") or "",
                    "weekly_focus_topics": parsed.get("weekly_focus_topics") or [],
                    "ai_powered": True,
                    "from_eval_session": True,
                    "generated_at": datetime.utcnow().isoformat(),
                }
                _save_cached_weekly_plan(dataset, week_label, result)
                logger.info(f"[weekly_plan] Served from eval_sessions for {dataset}")
                return result
    except Exception as fallback_err:
        logger.warning(f"[weekly_plan] eval_sessions fallback failed: {fallback_err}")

    raise HTTPException(
        status_code=404,
        detail=f"Không có kế hoạch tuần cho '{dataset}'. Hãy chạy pipeline trước."
    )


@router.post("/weekly-plan")

async def generate_weekly_plan(
    dataset: str = Query(...), 
    force_refresh: bool = False
):
    """Generate or retrieve cached weekly plan for a dataset based on its memory."""
    dataset = dataset.rstrip('.')
    profile_id = DATASET_PROFILE_MAP.get(dataset, dataset)
    
    # Read memory data
    memory_data = _load_cached_memory(dataset)
    if not memory_data:
        raise HTTPException(
            status_code=404,
            detail="Memory not found for this dataset. Please process memory first."
        )

    week_label = memory_data.get("week_label", "2026-W22") # Example default
    # Try parsing week_label to week_start
    try:
        # e.g., 2026-W22
        year = int(week_label[:4])
        week = int(week_label[6:])
        d = datetime.strptime(f"{year}-W{week}-1", "%Y-W%W-%w")
        week_start = d.strftime("%Y-%m-%d")
        week_end = (d + timedelta(days=6)).strftime("%Y-%m-%d")
    except Exception:
        week_start = datetime.utcnow().strftime("%Y-%m-%d")
        week_end = (datetime.utcnow() + timedelta(days=6)).strftime("%Y-%m-%d")

    # Check cache
    if not force_refresh:
        cached = _load_cached_weekly_plan(dataset, week_label)
        if cached:
            logger.info(f"[weekly_plan] Cache HIT for {dataset}_{week_label}")
            return cached

    if not OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPENAI_API_KEY not configured",
        )

    # Fetch learn sessions — count driven by parent's schedule config
    n_learn = get_learn_session_count(dataset)
    n_talk  = get_talk_session_count(dataset)
    schedule_cfg = get_schedule_config(dataset)
    logger.info(f"[weekly_plan] Schedule config: {n_learn} learn, {n_talk} talk, preset={schedule_cfg.get('preset')}")

    next_missions = learning_db.get_next_missions(level_prefix="preA1", last_mission="preA1_6", count=n_learn)
    learn_sessions = []
    for m in next_missions:
        acts = learning_db.get_mission_activities(m)
        if acts:
            learn_sessions.append({
                "mission_id": m,
                "title": acts[0].get("name", "Bài học mới"),
                "activities": [{"id": a.get("id"), "name": a.get("name"), "category": a.get("activity_category")} for a in acts]
            })

    user_prompt = _build_user_prompt(memory_data)

    logger.info(f"[weekly_plan] Cache MISS for {dataset}_{week_label}. Calling {WEEKLY_PLAN_MODEL}")

    payload = {
        "model": WEEKLY_PLAN_MODEL,
        "max_tokens": 16000,
        "temperature": 0.4,
        "messages": [
            {"role": "system", "content": WEEKLY_PLAN_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    }

    async with httpx.AsyncClient(timeout=300) as client:
        res = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            json=payload,
        )

    if res.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OpenAI error {res.status_code}: {res.text[:400]}",
        )

    data = res.json()
    choices = data.get("choices") or []
    raw_text = ""
    if choices and isinstance(choices[0], dict):
        raw_text = (choices[0].get("message") or {}).get("content") or ""

    usage = data.get("usage") or {}
    input_tokens = int(usage.get("prompt_tokens") or 0)
    output_tokens = int(usage.get("completion_tokens") or 0)
    cost_usd = _calculate_cost(WEEKLY_PLAN_MODEL, input_tokens, output_tokens)

    week_learning_summary, week_strategy, sessions = _parse_plan_output(raw_text)

    # Convert sets to list if any, but PyYAML handles that usually
    # just in case for JSON serialization
    def make_json_serializable(d):
        if isinstance(d, dict):
            return {k: make_json_serializable(v) for k, v in d.items()}
        if isinstance(d, list):
            return [make_json_serializable(v) for v in d]
        if isinstance(d, set):
            return list(d)
        return d
        
    week_learning_summary = make_json_serializable(week_learning_summary)
    week_strategy = make_json_serializable(week_strategy)
    sessions = make_json_serializable(sessions)
    learn_sessions = make_json_serializable(learn_sessions)

    result = {
        "profile_id": profile_id,
        "week_start": week_start,
        "week_end": week_end,
        "week_label": week_label,
        "week_learning_summary": week_learning_summary,
        "week_strategy": week_strategy,
        "talk_sessions": sessions,
        "learn_sessions": learn_sessions,
        "ai_powered": True,
        "model_id": WEEKLY_PLAN_MODEL,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cost_usd": cost_usd,
        "generated_at": datetime.utcnow().isoformat(),
    }

    _save_cached_weekly_plan(dataset, week_label, result)
    logger.info(f"[weekly_plan] Generated and cached {dataset}_{week_label} with {len(sessions)} sessions.")

    posthog = get_posthog()
    if posthog:
        posthog.capture(
            distinct_id=profile_id,
            event="weekly_plan_generated",
            properties={
                "model_id": WEEKLY_PLAN_MODEL,
                "week_label": week_label,
                "talk_session_count": len(sessions),
                "learn_session_count": len(learn_sessions),
                "cost_usd": round(cost_usd, 4),
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
            },
        )

    return result


# ─── Feedback Endpoints ───

import uuid
from app.core.db import get_db_connection

class PlannerFeedbackItem(BaseModel):
    id: str
    title: str
    type: str  # "talk" | "learn"
    liked: Optional[bool] = None
    comment: Optional[str] = None

class PlannerFeedbackRequest(BaseModel):
    dataset: str
    week_label: str
    star_rating: int
    tags: List[str] = []
    comment: str = ""
    item_feedback: Optional[List[PlannerFeedbackItem]] = None


@router.post("/feedback")
async def submit_planner_feedback(body: PlannerFeedbackRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if feedback already exists for this dataset and week_label
    cursor.execute(
        "SELECT id FROM plan_feedback WHERE dataset = ? AND week_label = ?",
        (body.dataset, body.week_label)
    )
    row = cursor.fetchone()
    
    feedback_id = str(uuid.uuid4())
    submitted_at = datetime.utcnow().isoformat()
    tags_json = json.dumps(body.tags, ensure_ascii=False)
    item_feedback_list = [item.dict() for item in body.item_feedback] if body.item_feedback else []
    item_feedback_json = json.dumps(item_feedback_list, ensure_ascii=False)
    
    try:
        if row:
            # Update
            feedback_id = row["id"]
            cursor.execute(
                """
                UPDATE plan_feedback 
                SET star_rating = ?, tags = ?, comment = ?, item_feedback = ?, submitted_at = ?
                WHERE id = ?
                """,
                (body.star_rating, tags_json, body.comment, item_feedback_json, submitted_at, feedback_id)
            )
        else:
            # Insert
            cursor.execute(
                """
                INSERT INTO plan_feedback (id, dataset, week_label, star_rating, tags, comment, item_feedback, submitted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (feedback_id, body.dataset, body.week_label, body.star_rating, tags_json, body.comment, item_feedback_json, submitted_at)
            )
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        
    conn.close()

    posthog = get_posthog()
    if posthog:
        posthog.capture(
            distinct_id=body.dataset,
            event="plan_feedback_submitted",
            properties={
                "week_label": body.week_label,
                "star_rating": body.star_rating,
                "tag_count": len(body.tags),
                "has_comment": bool(body.comment),
                "has_item_feedback": bool(item_feedback_list),
            },
        )

    return {"status": "success", "feedback_id": feedback_id}


@router.get("/feedback")
async def get_planner_feedback(dataset: str = Query(...), week_label: Optional[str] = Query(None)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if not week_label:
        week_label = datetime.utcnow().strftime("%Y-W%W")
        
    cursor.execute(
        "SELECT * FROM plan_feedback WHERE dataset = ? AND week_label = ?",
        (dataset, week_label)
    )
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return {"status": "not_found"}
        
    return {
        "status": "success",
        "feedback_id": row["id"],
        "dataset": row["dataset"],
        "week_label": row["week_label"],
        "star_rating": row["star_rating"],
        "tags": json.loads(row["tags"] or "[]"),
        "comment": row["comment"] or "",
        "item_feedback": json.loads(row["item_feedback"] or "[]"),
        "submitted_at": row["submitted_at"]
    }
