"""
Reasoning Route
POST /api/reasoning/generate   — run full 5-agent reasoning for a weekly plan
GET  /api/reasoning/todo        — get todo items for a session
GET  /api/reasoning/layers      — get detected logic layers
GET  /api/sessions/login        — login with profile code
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional, List, Dict

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.core.llm_service import reasoning_service
from app.core.logic_detector import detect_layers
from app.core.posthog_client import get_posthog

load_dotenv()

router = APIRouter(tags=["reasoning"])
logger = logging.getLogger(__name__)

# ─── Dataset (profile) login map ──────────────────────────────────────────────
# Maps login code → dataset_name used for caching and mock data lookup

MOCK_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "mock_data", "plans")

DATASET_LOGIN_MAP = {
    # Original dailytodo datasets
    "PHASE3": "phase3data",
    "PHASE2": "phase2data",
    "PHASE1": "phase1data",
    # Generated AI profiles (5 from pipeline)
    "019d": "019dfd3e-282c-76b9-a760-b9cf3cd22212",
    "019e": "019e7fa3-5b8a-7c5c-bc63-2bfbd302e61b",
    "019f": "019dbf57-771d-7a01-8b92-c1592ad61f8f",
    "019c": "019c9991-6ad8-7a87-91ff-673ec60b6d6f",
    "0199": "019cff81-1bc3-7939-9230-a1f032605728",
}

# Dataset name → mock data file path
# We load the pre-generated plan results from the pipeline
PLAN_RESULTS_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "main", "plan_results_v2"
)

DAILYTODO_MOCK_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "..",
    "..", "references", "dailytodo", "backend", "mock_data"
)


def _load_mock_todo(dataset_name: str) -> Optional[dict]:
    """Try to load todo data from mock files."""
    # 1. Try our plan_results directory
    plan_file = os.path.join(PLAN_RESULTS_DIR, f"{dataset_name}.json")
    if os.path.exists(plan_file):
        try:
            with open(plan_file, encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Could not load plan file {plan_file}: {e}")

    # 2. Try dailytodo mock_data directory  
    mock_file = os.path.join(DAILYTODO_MOCK_DIR, f"{dataset_name}.json")
    if os.path.exists(mock_file):
        try:
            with open(mock_file, encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Could not load mock file {mock_file}: {e}")

    return None


# ─── Schemas ──────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    code: str


class LoginResponse(BaseModel):
    session_id: str
    dataset_name: str
    profile_name: Optional[str] = None


class FeedbackRequest(BaseModel):
    dataset: str
    star_rating: int
    tags: List[str] = []
    comment: str = ""
    item_feedback: Optional[List[Dict[str, Any]]] = None


class ReasoningRequest(BaseModel):
    dataset_name: str
    force_refresh: bool = False


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/api/sessions/login", response_model=LoginResponse)
async def login(body: LoginRequest) -> LoginResponse:
    raw = body.code.strip()
    code_up = raw.upper()
    code_lo = raw.lower()
    # Try uppercase (PHASE3), then lowercase (019d), then original
    dataset_name = DATASET_LOGIN_MAP.get(code_up) or DATASET_LOGIN_MAP.get(code_lo) or DATASET_LOGIN_MAP.get(raw)
    if not dataset_name:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mã truy cập không hợp lệ: {body.code}",
        )
    posthog = get_posthog()
    if posthog:
        posthog.set(
            distinct_id=dataset_name,
            properties={"dataset_name": dataset_name},
        )
        posthog.capture(
            distinct_id=dataset_name,
            event="user_logged_in",
            properties={"is_phase_code": code_up.startswith("PHASE")},
        )

    return LoginResponse(
        session_id=dataset_name,
        dataset_name=dataset_name,
        profile_name=None,
    )


@router.get("/api/reasoning/layers")
async def get_layers(dataset: str = Query(...)):
    todo_data = _load_mock_todo(dataset)
    if not todo_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset '{dataset}' not found",
        )
    layers = detect_layers(todo_data)
    return {
        "phase": layers.get("phase", {}),
        "ratio_mode": layers.get("ratio_mode", "BALANCED"),
        "session_sequence": layers.get("session_sequence", []),
        "memory_profile": layers.get("memory_profile", {}),
        "child_profile": layers.get("child_profile", {}),
        "causal_chain_summary": layers.get("causal_chain_summary", {}),
        "pronounce_review": layers.get("pronounce_review", {}),
        "content_connections": layers.get("content_connections", []),
        "talk_game_reasoning": layers.get("talk_game_reasoning", []),
        "analyzed_activities_count": layers.get("analyzed_activities_count", 0),
    }


@router.get("/api/plan")
async def get_raw_plan(dataset: str = Query(...)):
    todo_data = _load_mock_todo(dataset)
    if not todo_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset '{dataset}' not found",
        )
    return todo_data


@router.get("/api/reasoning/todo")
async def get_todo(dataset: str = Query(...)):
    todo_data = _load_mock_todo(dataset)
    if not todo_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset '{dataset}' not found",
        )
    layers = detect_layers(todo_data)
    return layers.get("session_sequence", [])


@router.post("/api/reasoning/generate")
async def generate_reasoning(body: ReasoningRequest):
    todo_data = _load_mock_todo(body.dataset_name)
    if not todo_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset '{body.dataset_name}' not found",
        )
    try:
        result = reasoning_service.get_reasoning(
            dataset_name=body.dataset_name,
            todo_data=todo_data,
            force_refresh=body.force_refresh,
        )
        return result
    except Exception as e:
        logger.exception(f"Reasoning error for {body.dataset_name}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/api/health")
async def health():
    return {"status": "ok", "service": "pika-master-planning-backend"}


@router.post("/api/feedback")
async def receive_feedback(body: FeedbackRequest):
    logger.info(f"Received feedback for {body.dataset}: rating={body.star_rating}, comment={body.comment}")
    # Save feedback locally in a json file
    feedback_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "main", "feedback")
    os.makedirs(feedback_dir, exist_ok=True)
    file_path = os.path.join(feedback_dir, f"{body.dataset}.json")
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(body.dict(), f, ensure_ascii=False, indent=2)
        return {"status": "success", "message": "Feedback saved successfully"}
    except Exception as e:
        logger.error(f"Error saving feedback: {e}")
        return {"status": "partial_success", "message": f"Logged feedback but failed to save file: {e}"}
