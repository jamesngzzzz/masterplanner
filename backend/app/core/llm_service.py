"""
LLM Service — OpenAI only
Runs logic layer detection, compiles context prompt, calls OpenAI,
and returns enriched 5-agent reasoning response.
Adapted from dailytodo/backend, stripped to OpenAI only per project constraint.
"""
import json
import logging
import os
from typing import Any, Dict

from dotenv import load_dotenv
from openai import OpenAI

from app.core.context_builder import build_openai_prompt
from app.core.logic_detector import detect_layers
from app.core.reasoning_db import get_cached_reasoning, save_reasoning_cache

load_dotenv()

logger = logging.getLogger("llm_service")

OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o")
OPENAI_MODEL_MINI = os.environ.get("OPENAI_MODEL_MINI", "gpt-4o-mini")


def _get_openai_client() -> OpenAI:
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set in .env")
    return OpenAI(api_key=api_key)


class LLMService:
    def __init__(self):
        self._client = _get_openai_client()
        logger.info(f"LLMService ready — model: {OPENAI_MODEL}")

    # ------------------------------------------------------------------
    def get_reasoning(
        self,
        dataset_name: str,
        todo_data: Dict[str, Any],
        force_refresh: bool = False,
    ) -> Dict[str, Any]:
        """
        Run logic detection + context build + OpenAI call.
        Results are cached in SQLite to avoid repeated API calls during demos.
        """
        if not force_refresh:
            cached = get_cached_reasoning(dataset_name)
            if cached is not None:
                logger.info(f"Cache HIT for '{dataset_name}'")
                return cached

        logger.info(f"Cache MISS — generating reasoning for '{dataset_name}'")
        layers = detect_layers(todo_data)
        prompt = build_openai_prompt(layers, dataset_name)

        logger.info(
            f"Calling OpenAI {OPENAI_MODEL} for '{dataset_name}' "
            f"— prompt length: {len(prompt):,} chars"
        )

        raw_json, token_usage = self._call_openai(prompt)
        parsed = json.loads(raw_json)
        enriched = self._enrich_response(parsed, todo_data, layers)
        save_reasoning_cache(dataset_name, enriched, token_usage)
        enriched["cached"] = False
        return enriched

    # ------------------------------------------------------------------
    def _call_openai(self, prompt: str):
        response = self._client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a helpful educational reasoning AI. "
                        "Output valid JSON only, with no markdown wrappers."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=1,
            max_tokens=8192,
        )
        content = response.choices[0].message.content
        if not content:
            raise ValueError("OpenAI returned an empty response")

        usage = response.usage
        token_usage: Dict[str, Any] = {}
        if usage:
            token_usage = {
                "provider": "openai",
                "model": OPENAI_MODEL,
                "input_tokens": usage.prompt_tokens,
                "output_tokens": usage.completion_tokens,
                "thinking_tokens": 0,
                "total_tokens": usage.total_tokens,
            }
        logger.info(f"OpenAI usage: {token_usage}")
        return content, token_usage

    # ------------------------------------------------------------------
    def _enrich_response(
        self,
        response_data: Dict[str, Any],
        todo_data: Dict[str, Any],
        layers: Dict[str, Any],
    ) -> Dict[str, Any]:
        session_sequence = layers.get("session_sequence", [])

        todo_items = [
            {
                "order": item.get("order"),
                "name": item.get("name"),
                "type": item.get("type"),
                "role": item.get("role_in_session", "LEARN"),
                "topic": item.get("topic"),
                "duration_minutes": item.get("duration_minutes"),
            }
            for item in session_sequence
        ]

        todo_reasoning = response_data.get("todo_reasoning", [])
        reasoning_by_order: Dict[Any, Any] = {}
        for r in todo_reasoning:
            order_val = r.get("item_order")
            if order_val is not None:
                try:
                    reasoning_by_order[int(order_val)] = r
                except (ValueError, TypeError):
                    pass
                reasoning_by_order[str(order_val)] = r

        for item in todo_items:
            order_key = item["order"]
            reasoning = reasoning_by_order.get(order_key) or reasoning_by_order.get(str(order_key), {})
            item["why_for_child"] = reasoning.get("why_for_child", "")
            item["personalization_tags"] = reasoning.get("personalization_tags", [])
            item["agent_responsible"] = reasoning.get("agent_responsible", "")

        return {
            "provider": "openai",
            "model": OPENAI_MODEL,
            "token_usage": {},  # filled by caller from cache save
            "phase": layers.get("phase", {}),
            "ratio_mode": layers.get("ratio_mode", "BALANCED"),
            "agent_conversation": response_data.get("agent_conversation", []),
            "session_summary": response_data.get("session_summary", {}),
            "todo_items": todo_items,
            "experts": [],
        }


# Singleton
reasoning_service = LLMService()
