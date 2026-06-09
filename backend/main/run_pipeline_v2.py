"""
Unified Pipeline Runner
Runs all 5 profiles through the new unified backend:
  1. analyze_memory  (POST /api/analyze/memory)
  2. generate/weekly-plan  (POST /api/generate/weekly-plan)

Results are saved to:
  - analysis_results/<profile_id>.json
  - plan_results/<profile_id>.json
"""
import json
import os
import sys
import time
import requests

API_BASE = "http://localhost:8001/api"
MEMORIES_DIR = os.path.join(os.path.dirname(__file__), "processed_memories")
ANALYSIS_DIR = os.path.join(os.path.dirname(__file__), "analysis_results_v2")
PLAN_DIR     = os.path.join(os.path.dirname(__file__), "plan_results_v2")

# Only run 5 profiles
PROFILES_TO_RUN = [
    "019c9991-6ad8-7a87-91ff-673ec60b6d6f",
    "019cff81-1bc3-7939-9230-a1f032605728",
    "019dbf57-771d-7a01-8b92-c1592ad61f8f",
    "019de2e9-f8a7-773a-9614-7bedde39b230",
    "019dfd3e-282c-76b9-a760-b9cf3cd22212",
]


def load_memories(profile_id: str):
    path = os.path.join(MEMORIES_DIR, f"{profile_id}.json")
    if not os.path.exists(path):
        print(f"  ⚠️  No memory file for {profile_id}")
        return []
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    # Convert to [{memory, created_at}] format
    if isinstance(raw, list):
        if raw and isinstance(raw[0], dict) and "memory" in raw[0]:
            return raw  # already formatted
        # flat strings
        return [{"memory": str(m), "created_at": None} for m in raw]
    if isinstance(raw, dict):
        # Nested: try .memories key
        mems = raw.get("memories", [])
        return [{"memory": str(m.get("memory", m)), "created_at": m.get("created_at")} for m in mems]
    return []


def run_analyze(profile_id: str, memories: list, force: bool = False) -> dict:
    out_path = os.path.join(ANALYSIS_DIR, f"{profile_id}.json")
    if os.path.exists(out_path) and not force:
        print(f"  ✅ Analysis cached, loading...")
        with open(out_path, encoding="utf-8") as f:
            return json.load(f)

    print(f"  🔍 Calling /api/analyze/memory ({len(memories)} memories)...")
    body = {
        "profile_id": profile_id,
        "profile_name": f"Child_{profile_id[:8]}",
        "memories": memories,
    }
    try:
        res = requests.post(f"{API_BASE}/analyze/memory", json=body, timeout=120)
        res.raise_for_status()
        data = res.json()
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        clusters = len((data.get("parsed") or {}).get("memory_clusters") or [])
        cost = data.get("cost_usd", 0)
        print(f"  ✅ Analysis done: {clusters} clusters | cost=${cost:.4f}")
        return data
    except Exception as e:
        print(f"  ❌ Analysis failed: {e}")
        if hasattr(e, "response") and e.response:
            print(f"     {e.response.text[:300]}")
        return None


def run_weekly_plan(profile_id: str, memories: list, analysis: dict, force: bool = False) -> dict:
    out_path = os.path.join(PLAN_DIR, f"{profile_id}.json")
    if os.path.exists(out_path) and not force:
        print(f"  ✅ Plan cached, loading...")
        with open(out_path, encoding="utf-8") as f:
            return json.load(f)

    print(f"  📅 Calling /api/generate/weekly-plan...")
    analysis_parsed = analysis.get("parsed") if analysis else {}
    body = {
        "profile_id": profile_id,
        "profile_name": f"Child_{profile_id[:8]}",
        "memories": memories,
        "memory_analysis_parsed": analysis_parsed,
        "week_start": "2026-06-08",
    }
    try:
        res = requests.post(f"{API_BASE}/generate/weekly-plan", json=body, timeout=300)
        res.raise_for_status()
        data = res.json()
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        sessions = data.get("sessions") or []
        talk = [s for s in sessions if s.get("activity_type") != "LEARN"]
        learn = [s for s in sessions if s.get("activity_type") == "LEARN"]
        cost = data.get("cost_usd", 0)
        print(f"  ✅ Plan done: {len(sessions)} total ({len(learn)} LEARN + {len(talk)} TALK) | cost=${cost:.4f}")
        return data
    except Exception as e:
        print(f"  ❌ Plan failed: {e}")
        if hasattr(e, "response") and e.response:
            print(f"     {e.response.text[:300]}")
        return None


def main():
    os.makedirs(ANALYSIS_DIR, exist_ok=True)
    os.makedirs(PLAN_DIR, exist_ok=True)

    force = "--force" in sys.argv
    if force:
        print("🔄 Force refresh mode — will re-run all LLM calls\n")

    total_cost = 0.0
    for i, profile_id in enumerate(PROFILES_TO_RUN, 1):
        print(f"\n{'='*50}")
        print(f"[{i}/{len(PROFILES_TO_RUN)}] Profile: {profile_id}")

        memories = load_memories(profile_id)
        if not memories:
            print("  ⚠️  Skipping (no memories)")
            continue

        print(f"  📝 Loaded {len(memories)} memories")

        # Step 1: Analyze memory
        analysis = run_analyze(profile_id, memories, force=force)
        if not analysis:
            print("  ⚠️  Skipping weekly plan (analysis failed)")
            continue

        total_cost += analysis.get("cost_usd", 0)
        time.sleep(1)  # be nice to the API

        # Step 2: Weekly plan with LEARN injection
        plan = run_weekly_plan(profile_id, memories, analysis, force=force)
        if plan:
            total_cost += plan.get("cost_usd", 0)

        time.sleep(2)

    print(f"\n{'='*50}")
    print(f"✅ Pipeline complete. Total cost: ${total_cost:.4f}")
    print(f"📁 Analysis: {ANALYSIS_DIR}")
    print(f"📁 Plans:    {PLAN_DIR}")


if __name__ == "__main__":
    main()
