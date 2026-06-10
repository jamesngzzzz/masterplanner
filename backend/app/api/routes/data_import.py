"""
Data Import Routes
GET /api/planner/memo?dataset=<id>        — serve imported memo.json for a user
GET /api/planner/candidates?dataset=<id>  — serve imported plan.json for a user

Data is stored per-user at:
  backend/mock_data/<dataset>/memo.json
  backend/mock_data/<dataset>/plan.json

memo.json supplies the golden-format fields (engagement, derived, missing_pillars).
If memory_clusters / persona / life_events / relationship_graph are absent from
memo.json, they are supplemented from the pipeline cache (main/planner_memory/).
If the pipeline cache is also missing, the memory pipeline is auto-triggered on first
request — it fetches Mem0 memories → runs GPT-4o analysis → caches result.
This means: drop memo.json + plan.json → data auto-populates on first visit.
"""
import json
import os
import logging

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/planner", tags=["data-import"])
logger = logging.getLogger(__name__)

MOCK_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "mock_data")

# Reuse the pipeline cache loader from planner_memory
from app.api.routes.planner_memory import _load_cached_memory

# Fields that come from the pipeline cache when not present in memo.json
_PIPELINE_FIELDS = ("memory_clusters", "persona", "life_events", "relationship_graph", "talk_history")


def _load_user_file(dataset: str, filename: str) -> dict:
    path = os.path.join(MOCK_DATA_DIR, dataset, filename)
    if not os.path.exists(path):
        raise HTTPException(
            status_code=404,
            detail=f"No imported data found for dataset '{dataset}'. "
                   f"Expected file at mock_data/{dataset}/{filename}",
        )
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.get("/memo")
async def get_memo(dataset: str = Query(...)):
    """
    Return merged memory data for a user:
    - Golden-format fields (engagement, derived, missing_pillars) come from memo.json.
    - memory_clusters, persona, life_events, relationship_graph, talk_history are
      supplemented from the pipeline cache when absent in memo.json.
    - If pipeline cache is also missing, the memory pipeline is AUTO-TRIGGERED:
      it fetches Mem0 memories → GPT-4o analysis → caches the result.
      This way new profiles auto-populate Cụm ký ức on first page visit.
    """
    data = _load_user_file(dataset, "memo.json")

    # Check whether any pipeline fields are missing
    missing = [f for f in _PIPELINE_FIELDS if not data.get(f)]
    if missing:
        cached = _load_cached_memory(dataset)
        if cached:
            for field in missing:
                if cached.get(field):
                    data[field] = cached[field]

        # Re-check after merging from cache
        still_missing = [f for f in _PIPELINE_FIELDS if not data.get(f)]
        if still_missing:
            # Auto-trigger the full memory pipeline (fetches Mem0 → GPT-4o → caches)
            logger.info(
                f"[data_import] Pipeline fields {still_missing} missing for '{dataset}'. "
                f"Auto-triggering memory pipeline (Mem0 fetch)..."
            )
            try:
                from app.api.routes.planner_memory import _run_memory_pipeline, DATASET_PROFILE_MAP
                profile_id = DATASET_PROFILE_MAP.get(dataset, dataset)
                pipeline_result = _run_memory_pipeline(dataset, profile_id)
                for field in still_missing:
                    if pipeline_result.get(field):
                        data[field] = pipeline_result[field]
                logger.info(f"[data_import] Pipeline OK for '{dataset}'. Clusters: {len(data.get('memory_clusters', []))}")
            except Exception as e:
                logger.warning(
                    f"[data_import] Auto-pipeline failed for '{dataset}': {e}. "
                    f"Returning memo.json data without cluster fields."
                )

    # ── Synthesize 'derived' from pipeline cache when memo.json has derived=null ──
    # Covers profiles whose memo.json was generated without derived data
    # but whose pipeline cache has derived_insights + observations_by_domain.
    if not data.get("derived"):
        cached = _load_cached_memory(dataset)
        if not cached:
            # Try to load it if not loaded above
            from app.api.routes.planner_memory import _load_cached_memory as _lcm
            cached = _lcm(dataset)
        if cached:
            derived_insights = cached.get("derived_insights") or ""
            obs = cached.get("observations_by_domain") or {}

            # Build trends list from observations_by_domain
            trends = []
            for domain, items in obs.items():
                for item in (items or []):
                    obs_text = item.get("observation") or item.get("label") or ""
                    if obs_text:
                        details = ""
                        occurrences = item.get("occurrences", [])
                        if occurrences:
                            details = occurrences[0].get("details", "")[:150]
                        trends.append({
                            "title": obs_text[:60],
                            "description": details or obs_text,
                            "category": domain,
                            "is_new": item.get("is_new_this_week", False),
                        })

            if derived_insights or trends:
                data["derived"] = {
                    "summary": derived_insights[:500] if derived_insights else None,
                    "trends": trends[:10],
                    "growing_skills": [],
                }
                logger.info(f"[data_import] Synthesized derived for '{dataset}': {len(trends)} trends from observations")

    return data


@router.get("/candidates")
async def get_candidates(dataset: str = Query(...)):
    """Return the imported plan.json (topic candidates) for a user."""
    return _load_user_file(dataset, "plan.json")
