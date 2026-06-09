"""
Compose Prompt Route
POST /api/generate/compose-prompt

Takes a weekly plan session + memory analysis and generates:
- opening_line: Pika's first message to the child
- conversation_seeds: 3 seeded exchanges to guide the conversation
- vocab_embed_points: where/how to naturally inject English vocab
- uhm_recovery_lines: what Pika says when the child is silent
- closing_hook: how to end the session memorably
- final_prompt: the assembled full Pika system prompt

Ported from buddy-talk-eval-be with MongoDB dependency removed.
Prompts and skeletons are embedded directly.
"""
from __future__ import annotations
from typing import Any, List, Optional, Tuple

import json
import logging
import os
import re

import httpx
import yaml
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

load_dotenv()

router = APIRouter(prefix="/api/generate", tags=["generation"])
logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
COMPOSE_MODEL = "gpt-4o"

PRICING = {
    "gpt-4o": {"input": 2.50, "output": 10.0},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
}


# ─── Embedded System Prompt ───────────────────────────────────────────────────

COMPOSE_SYSTEM_PROMPT = """Bạn là chuyên gia soạn thảo system prompt (Prompt Composer) cho Pika.
Nhiệm vụ: Tổng hợp thông tin buổi học, hồ sơ bé và ký ức để tạo ra kịch bản hội thoại chi tiết.

Đầu ra BẮT BUỘC là một JSON object duy nhất:
{
  "opening_line": "Câu mở đầu Pika nói với bé — phải nhắc đến ký ức/sở thích cụ thể của bé",
  "conversation_seeds": [
    {
      "pika": "Câu Pika nói",
      "child_might_say": "Câu bé có thể trả lời",
      "pika_responds": "Câu Pika phản hồi lại"
    }
  ],
  "vocab_embed_points": [
    "Mô tả ngắn: lồng ghép từ 'X' khi nói về chủ đề Y"
  ],
  "uhm_recovery_lines": [
    "Câu Pika nói khi bé im lặng hoặc không biết trả lời"
  ],
  "closing_hook": "Câu kết thúc buổi học — tạo tò mò cho buổi sau",
  "final_prompt": "Toàn bộ system prompt hoàn chỉnh cho robot Pika"
}

Quy tắc cho final_prompt:
1. Viết ở vai trò: Pika đang nhập vai dẫn dắt buổi học này
2. Bao gồm: opening, các seeds đã chuẩn bị, cách embed vocab, closing hook
3. Ngắn gọn nhưng đủ để robot hiểu cách dẫn dắt toàn bộ buổi
4. Sử dụng ngôi thứ nhất (Pika xưng mình)
5. Ngôn ngữ phù hợp với tuổi bé (6-12 tuổi)"""


# ─── Skeleton Templates (embedded, no MongoDB needed) ─────────────────────────

SKELETONS = {
    "TALK": """
## Loại buổi: TALK (Trò chuyện cá nhân hoá)
Pattern: Pika khơi chủ đề → bé nói → Pika hỏi sâu hơn → bé chia sẻ → Pika lồng ghép từ vựng → wrap up
Loop: Hỏi - Nghe - Đào sâu - Vocabulary moment - Hỏi tiếp
Tối đa: {{max_turns}} lượt (1 lượt = bé nói 1 lần)
Vocab pressure: {{en_pressure}}
""",
    "TALK_ACTIVITY": """
## Loại buổi: TALK_ACTIVITY (Hoạt động tương tác)
Pattern: Setup tình huống → bé nhập vai / quyết định → Pika phản ứng → bé tiếp tục → twist → wrap up
Loop: Tình huống - Bé chọn - Hệ quả - Twist mới
Tối đa: {{max_turns}} lượt
Vocab pressure: {{en_pressure}}
""",
    "GAME_AGENT": """
## Loại buổi: GAME_AGENT (Trò chơi tương tác)
Pattern: Pika giải thích luật chơi → bé chơi → Pika tính điểm / phản hồi → round tiếp
Loop: Câu hỏi/thử thách - Bé trả lời - Điểm số / phản hồi - Câu tiếp
Tối đa: {{max_turns}} lượt
Vocab pressure: {{en_pressure}}
""",
    "REVIEW": """
## Loại buổi: REVIEW (Ôn tập)
Pattern: Pika nhắc lại chủ đề tuần trước → bé nhớ lại → Pika test → bé trả lời → reinforcement
Loop: Nhắc - Test - Phản hồi - Reinforce
Tối đa: {{max_turns}} lượt
Vocab pressure: {{en_pressure}}
""",
    "LEARN": """
## Loại buổi: LEARN (Học từ vựng mới)
Pattern: Pika giới thiệu từ → bé lặp lại → Pika dùng trong câu → bé thử tự dùng → confirm
Loop: Từ mới - Lặp lại - Câu ví dụ - Bé thử - Confirm - Từ tiếp
Tối đa: {{max_turns}} lượt
Vocab pressure: structured
""",
}


def _get_skeleton(activity_type: str, session: dict) -> str:
    template = SKELETONS.get(activity_type, SKELETONS["TALK"])
    return (
        template
        .replace("{{max_turns}}", str(session.get("max_turns") or 15))
        .replace("{{en_pressure}}", str(session.get("en_pressure") or "minimal"))
    )


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _calculate_cost(model: str, in_tok: int, out_tok: int) -> float:
    p = PRICING.get(model, PRICING["gpt-4o"])
    return (in_tok * p["input"] + out_tok * p["output"]) / 1_000_000


def _strip_fence(text: str) -> str:
    m = re.search(r"```(?:json|yaml)?\s*\n(.*?)```", text.strip(), re.DOTALL)
    return m.group(1).strip() if m else text.strip()


def _parse_response(raw: str) -> dict:
    stripped = _strip_fence(raw)
    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    try:
        parsed = yaml.safe_load(stripped)
        if isinstance(parsed, dict):
            return parsed
    except yaml.YAMLError:
        pass
    return {}


def _get(d: dict, key: str, default: Any = "") -> Any:
    return d.get(key, default) or default


def _build_user_prompt(body: "ComposePromptRequest", skeleton_text: str) -> str:
    session = body.session
    ma_root = body.memory_analysis_parsed or {}
    ma = ma_root.get("memory_analysis") if isinstance(ma_root.get("memory_analysis"), dict) else ma_root
    persona = ma.get("persona") if isinstance(ma, dict) else {}
    persona = persona if isinstance(persona, dict) else {}

    persona_summary = str(persona.get("persona_summary") or "")
    engagement_insights = str(persona.get("engagement_insights") or "")

    memories_str = (
        "\n".join(f"- {m}" for m in (session.get("memory_to_inject") or []))
        or "(none)"
    )
    vocab_str = ", ".join(session.get("target_vocab") or []) or "(none)"
    sentences_str = ", ".join(session.get("target_sentences") or []) or "(none)"
    techniques_str = json.dumps(session.get("talk_techniques") or {}, ensure_ascii=False)

    return "\n".join([
        "## SESSION PLAN",
        f"- Day: {session.get('day')}, Session: {session.get('session')}",
        f"- Title: {session.get('title')}",
        f"- Topic: {session.get('topic')}",
        f"- Activity type: {session.get('activity_type')}",
        f"- Rationale: {session.get('rationale')}",
        f"- Talk techniques: {techniques_str}",
        f"- Target vocab: {vocab_str}",
        f"- Target sentences: {sentences_str}",
        f"- Embedded value: {session.get('embedded_value')}",
        f"- Cliffhanger: {session.get('cliffhanger_for_next')}",
        f"- Max turns: {session.get('max_turns')}",
        "",
        "## MEMORIES TO INJECT",
        memories_str,
        "",
        "## USER PROFILE",
        f"- Name: {body.profile_name or 'Unknown'}",
        "",
        "## PERSONA",
        f"- Summary: {persona_summary}",
        f"- Engagement insights: {engagement_insights}",
        "",
        "## SESSION SKELETON",
        skeleton_text,
    ])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class ConversationSeed(BaseModel):
    pika: str
    child_might_say: str
    pika_responds: str


class ComposePromptRequest(BaseModel):
    profile_id: str
    profile_name: Optional[str] = None
    session: dict = Field(default_factory=dict)   # a session item from weekly_plan.sessions
    memory_analysis_parsed: Optional[dict] = None
    model_override: Optional[str] = None


class ComposePromptResponse(BaseModel):
    profile_id: str
    session_key: str
    opening_line: str
    conversation_seeds: List[ConversationSeed]
    vocab_embed_points: List[str]
    uhm_recovery_lines: List[str]
    closing_hook: str
    final_prompt: str
    raw_response: str
    model_id: str
    input_tokens: int
    output_tokens: int
    cost_usd: float


# ─── Route ────────────────────────────────────────────────────────────────────

@router.post("/compose-prompt", response_model=ComposePromptResponse)
async def compose_prompt(body: ComposePromptRequest) -> ComposePromptResponse:
    if not OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPENAI_API_KEY not configured",
        )

    session = body.session
    activity_type = str(session.get("activity_type") or "TALK")
    session_key = f"d{session.get('day')}s{session.get('session')}"
    skeleton_text = _get_skeleton(activity_type, session)
    used_model = body.model_override or COMPOSE_MODEL

    user_prompt = _build_user_prompt(body, skeleton_text)

    logger.info(
        f"[compose_prompt] profile={body.profile_id} session_key={session_key} "
        f"activity={activity_type} model={used_model}"
    )

    payload = {
        "model": used_model,
        "max_tokens": 8192,
        "temperature": 0.4,
        "messages": [
            {"role": "system", "content": COMPOSE_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "response_format": {"type": "json_object"},
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
    cost_usd = _calculate_cost(used_model, input_tokens, output_tokens)

    parsed = _parse_response(raw_text)

    opening_line = str(_get(parsed, "opening_line"))
    closing_hook = str(_get(parsed, "closing_hook"))
    final_prompt = str(_get(parsed, "final_prompt"))

    seeds_raw = parsed.get("conversation_seeds") or []
    seeds: List[ConversationSeed] = []
    if isinstance(seeds_raw, list):
        for s in seeds_raw:
            if not isinstance(s, dict):
                continue
            seeds.append(ConversationSeed(
                pika=str(s.get("pika") or ""),
                child_might_say=str(s.get("child_might_say") or ""),
                pika_responds=str(s.get("pika_responds") or ""),
            ))

    vocab_embed = [str(x) for x in (parsed.get("vocab_embed_points") or []) if x]
    uhm_recovery = [str(x) for x in (parsed.get("uhm_recovery_lines") or []) if x]

    if not final_prompt:
        # Fallback: assemble from parts
        seed_lines = []
        for i, seed in enumerate(seeds, 1):
            seed_lines.append(f"{i}. Pika: {seed.pika}")
            seed_lines.append(f"   Child: {seed.child_might_say}")
            seed_lines.append(f"   Pika: {seed.pika_responds}")
        final_prompt = "\n".join([
            f"Opening: {opening_line}",
            "",
            "Conversation seeds:",
            "\n".join(seed_lines),
            "",
            "Vocab embed points:",
            "\n".join(f"- {v}" for v in vocab_embed),
            "",
            f"Closing: {closing_hook}",
        ])

    logger.info(
        f"[compose_prompt] done profile={body.profile_id} session_key={session_key} "
        f"seeds={len(seeds)} cost=${cost_usd:.4f}"
    )

    return ComposePromptResponse(
        profile_id=body.profile_id,
        session_key=session_key,
        opening_line=opening_line,
        conversation_seeds=seeds,
        vocab_embed_points=vocab_embed,
        uhm_recovery_lines=uhm_recovery,
        closing_hook=closing_hook,
        final_prompt=final_prompt,
        raw_response=raw_text,
        model_id=used_model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
    )
