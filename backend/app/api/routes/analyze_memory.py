"""
Memory Analysis Route
POST /api/analyze/memory

Upgraded from buddy-talk-eval-be with:
- gpt-4o instead of gpt-4o-mini
- Much richer prompt: multiple clusters, multiple events, multiple relationships
- Extracts en_level estimate, persona_tone, warmth, engagement_insights
- Follows PRD memory exposure definition (no raw logs, focused on observable patterns)
"""
from __future__ import annotations
from typing import Any, List, Optional
import json
import logging
import os
import re

import httpx
import yaml
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/analyze", tags=["analysis"])
logger = logging.getLogger(__name__)

PRICING = {
    "gpt-4o": {"input": 2.50, "output": 10.0},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
}

ANALYZE_MODEL = "gpt-4o"

from app.core.prompts import MEMORY_ANALYSIS_PROMPT, WEEKLY_PLAN_PROMPT

# ─── Schemas ──────────────────────────────────────────────────────────────────

class MemoryItem(BaseModel):
    memory: str
    created_at: Optional[str] = None


class AnalyzeMemoryRequest(BaseModel):
    profile_id: str
    profile_name: Optional[str] = None
    memories: List[MemoryItem] = Field(default_factory=list)


class AnalyzeMemoryResponse(BaseModel):
    profile_id: str
    model_id: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    raw_response: str
    parsed: Optional[dict]
    age_estimate: Optional[int]


# ─── Helpers ──────────────────────────────────────────────────────────────────

AGE_PATTERNS = [
    r"(\d+)\s*tuổi",
    r"(\d+)\s*years?\s*old",
    r"grade\s*(\d+)",
    r"lớp\s*(\d+)",
]


def _prepare_memories(memories: list, max_count: int = 250) -> list:
    sorted_mems = sorted(
        memories,
        key=lambda m: str(m.created_at or ""),
        reverse=True,
    )
    prepared = []
    for m in sorted_mems[:max_count]:
        text = (m.memory or "").strip()
        if len(text) < 10:
            continue
        date_str = str(m.created_at or "")[:10] if m.created_at else ""
        prepared.append({"text": text, "date": date_str})
    return prepared


def _build_user_prompt(profile_id: str, profile_name: Optional[str], memories: list) -> str:
    lines = [
        f"user_id: {profile_id}",
        f"name: {profile_name or 'Unknown'}",
        f"total_memories: {len(memories)}",
        "",
        "--- MEMORIES (most recent first) ---",
    ]
    for i, m in enumerate(memories, 1):
        prefix = f"[{m['date']}] " if m['date'] else ""
        lines.append(f"{i}. {prefix}{m['text']}")
    return "\n".join(lines)


def _extract_age(memories: list) -> Optional[int]:
    for m in memories:
        text = str(m.memory or "")
        for pattern in AGE_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if not match:
                continue
            val = int(match.group(1))
            if "grade" in pattern or "lớp" in pattern:
                val += 6
            if 2 <= val <= 18:
                return val
    return None


def _calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    pricing = PRICING.get(model, PRICING["gpt-4o"])
    return (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1_000_000


def _parse_yaml_response(raw_text: str) -> Optional[dict]:
    candidate = raw_text.strip()
    fence = re.search(r"```(?:yaml|yml)?\s*\n(.*?)```", candidate, re.DOTALL)
    if fence:
        candidate = fence.group(1).strip()
    try:
        parsed = yaml.safe_load(candidate)
        if isinstance(parsed, dict):
            return parsed
    except yaml.YAMLError:
        pass
    try:
        parsed = json.loads(candidate)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    return None


# ─── Route ────────────────────────────────────────────────────────────────────

import os
from dotenv import load_dotenv
load_dotenv()

from app.core.posthog_client import get_posthog

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")


@router.post("/memory", response_model=AnalyzeMemoryResponse)
async def analyze_memory(body: AnalyzeMemoryRequest) -> AnalyzeMemoryResponse:
    if not OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPENAI_API_KEY not configured",
        )

    prepared = _prepare_memories(body.memories)
    age_estimate = _extract_age(body.memories)
    user_prompt = _build_user_prompt(body.profile_id, body.profile_name, prepared)

    logger.info(
        f"[analyze_memory] profile={body.profile_id} memories={len(prepared)} model={ANALYZE_MODEL}"
    )

    payload = {
        "model": ANALYZE_MODEL,
        "max_tokens": 4096,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": MEMORY_ANALYSIS_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    }

    async with httpx.AsyncClient(timeout=180) as client:
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
    cost_usd = _calculate_cost(ANALYZE_MODEL, input_tokens, output_tokens)

    parsed = _parse_yaml_response(raw_text)

    # Patch age_estimate into parsed if we extracted it from memories
    if parsed and age_estimate and not parsed.get("persona", {}).get("age_estimate"):
        parsed.setdefault("persona", {})["age_estimate"] = age_estimate

    logger.info(
        f"[analyze_memory] done profile={body.profile_id} "
        f"clusters={len((parsed or {}).get('memory_clusters', []))} "
        f"cost=${cost_usd:.4f}"
    )

    posthog = get_posthog()
    if posthog:
        posthog.capture(
            distinct_id=body.profile_id,
            event="memory_analysis_completed",
            properties={
                "model_id": ANALYZE_MODEL,
                "memory_count": len(prepared),
                "cluster_count": len((parsed or {}).get("memory_clusters", [])),
                "cost_usd": round(cost_usd, 4),
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
            },
        )

    return AnalyzeMemoryResponse(
        profile_id=body.profile_id,
        model_id=ANALYZE_MODEL,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
        raw_response=raw_text,
        parsed=parsed,
        age_estimate=age_estimate,
    )


@router.get("/memory")
async def get_memory_analysis(dataset: str):
    # Load analysis file from main/analysis_results_v2
    analysis_dir = os.path.join(
        os.path.dirname(__file__), "..", "..", "..", "main", "analysis_results_v2"
    )
    file_path = os.path.join(analysis_dir, f"{dataset}.json")
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Memory analysis for dataset '{dataset}' not found",
        )
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error reading memory analysis file {file_path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


# ─── Weekly Plan from Memory Analysis ─────────────────────────────────────────


class GeneratePlanRequest(BaseModel):
    profile_id: str
    profile_name: Optional[str] = None
    memory_analysis: Optional[dict] = None


class GeneratePlanResponse(BaseModel):
    profile_id: str
    model_id: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    raw_response: str
    parsed: Optional[dict]


@router.post("/generate-plan", response_model=GeneratePlanResponse)
async def generate_plan_from_analysis(body: GeneratePlanRequest) -> GeneratePlanResponse:
    if not OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPENAI_API_KEY not configured",
        )

    analysis = body.memory_analysis or {}
    persona = analysis.get("persona", {})
    clusters = analysis.get("memory_clusters", [])
    life_events = analysis.get("life_events", [])
    relationships = analysis.get("relationship_graph", [])

    user_prompt = f"""profile_id: {body.profile_id}
name: {body.profile_name or 'Unknown'}

=== KẾT QUẢ PHÂN TÍCH TÂM LÝ ===
disc_type: {persona.get('disc_type', 'S')}
en_level: {persona.get('en_level', 'pre_a1')}
talkative_score: {persona.get('talkative_score', 5)}/10
proactive_score: {persona.get('proactive_score', 5)}/10
emotional_score: {persona.get('emotional_score', 5)}/10
age_estimate: {persona.get('age_estimate', 'không rõ')}
persona_summary: {persona.get('persona_summary', '')}
engagement_insights: {persona.get('engagement_insights', '')}
engage_preferences: {', '.join(persona.get('engage_preferences', []))}

=== MEMORY CLUSTERS (chủ đề nổi bật) ===
{json.dumps(clusters[:5], ensure_ascii=False, indent=2)}

=== SỰ KIỆN CUỘC SỐNG ===
{json.dumps(life_events[:3], ensure_ascii=False, indent=2)}

=== QUAN HỆ ===
{json.dumps(relationships[:5], ensure_ascii=False, indent=2)}

Hãy thiết kế kế hoạch học tuần tới cho bé này."""

    payload = {
        "model": ANALYZE_MODEL,
        "max_tokens": 4096,
        "temperature": 0.3,
        "messages": [
            {"role": "system", "content": WEEKLY_PLAN_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    }

    async with httpx.AsyncClient(timeout=180) as client:
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
    cost_usd = _calculate_cost(ANALYZE_MODEL, input_tokens, output_tokens)

    # Parse JSON from response
    parsed = None
    fence = re.search(r"```(?:json)?\s*\n(.*?)```", raw_text, re.DOTALL)
    if fence:
        try:
            parsed = json.loads(fence.group(1).strip())
        except json.JSONDecodeError:
            pass
    if not parsed:
        try:
            parsed = json.loads(raw_text.strip())
        except json.JSONDecodeError:
            pass

    logger.info(
        f"[generate_plan] done profile={body.profile_id} "
        f"days={len((parsed or {}).get('daily_sessions', []))} "
        f"cost=${cost_usd:.4f}"
    )

    posthog = get_posthog()
    if posthog:
        posthog.capture(
            distinct_id=body.profile_id,
            event="plan_from_analysis_generated",
            properties={
                "model_id": ANALYZE_MODEL,
                "cost_usd": round(cost_usd, 4),
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "has_parsed_plan": parsed is not None,
            },
        )

    return GeneratePlanResponse(
        profile_id=body.profile_id,
        model_id=ANALYZE_MODEL,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
        raw_response=raw_text,
        parsed=parsed,
    )

