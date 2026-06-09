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
"""
import json
import os

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/planner", tags=["data-import"])

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

    return data


@router.get("/candidates")
async def get_candidates(dataset: str = Query(...)):
    """Return the imported plan.json (topic candidates) for a user."""
    return _load_user_file(dataset, "plan.json")
