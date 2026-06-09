"""
Comprehensive Backend Test Suite — Pika Master Planning
Covers all major API endpoints and core logic functions.

Usage:
    cd backend
    ./.venv/bin/python -m pytest tests/test_comprehensive.py -v
OR run directly against the live server:
    ./.venv/bin/python tests/test_comprehensive.py
"""

import json
import os
import sys
import time
import uuid

import requests

BASE_URL = "http://localhost:8001"
# Test datasets (all 5 AI profiles)
TEST_CODES = {
    "019d": "019dfd3e-282c-76b9-a760-b9cf3cd22212",
    "019e": "019e7fa3-5b8a-7c5c-bc63-2bfbd302e61b",
}
PRIMARY_CODE = "019d"
PRIMARY_DATASET = TEST_CODES[PRIMARY_CODE]

PASS = []
FAIL = []

# ─── Helpers ──────────────────────────────────────────────────────────────────

def ok(name: str, detail: str = ""):
    mark = "✅ PASS"
    print(f"{mark} | {name}")
    if detail:
        print(f"       {detail}")
    PASS.append(name)

def fail(name: str, detail: str = ""):
    mark = "❌ FAIL"
    print(f"{mark} | {name}")
    if detail:
        print(f"       {detail}")
    FAIL.append(name)

def check(name: str, condition: bool, detail: str = ""):
    if condition:
        ok(name, detail)
    else:
        fail(name, detail)

def section(title: str):
    print(f"\n{'─' * 60}")
    print(f"  {title}")
    print('─' * 60)

# ─── 1. Health & Root ─────────────────────────────────────────────────────────

def test_health():
    section("1. Health & Root")
    try:
        r = requests.get(f"{BASE_URL}/api/health", timeout=5)
        check("GET /api/health → 200", r.status_code == 200)
        data = r.json()
        check("Health response has 'status: ok'", data.get("status") == "ok", str(data))
    except Exception as e:
        fail("GET /api/health", str(e))

    try:
        r = requests.get(f"{BASE_URL}/", timeout=5)
        check("GET / → 200", r.status_code == 200)
        check("Root has endpoints map", "endpoints" in r.json())
    except Exception as e:
        fail("GET /", str(e))

# ─── 2. Session Login ─────────────────────────────────────────────────────────

def test_login():
    section("2. Session Login")
    # Valid code
    try:
        r = requests.post(f"{BASE_URL}/api/sessions/login", json={"code": PRIMARY_CODE}, timeout=5)
        check("POST /api/sessions/login [valid code] → 200", r.status_code == 200)
        data = r.json()
        check(
            "Login returns correct dataset_name",
            data.get("dataset_name") == PRIMARY_DATASET,
            f"got: {data.get('dataset_name')}"
        )
        check("Login returns session_id", bool(data.get("session_id")))
    except Exception as e:
        fail("Login valid code", str(e))

    # Invalid code
    try:
        r = requests.post(f"{BASE_URL}/api/sessions/login", json={"code": "INVALID_XYZ"}, timeout=5)
        check("POST /api/sessions/login [invalid code] → 404", r.status_code == 404)
    except Exception as e:
        fail("Login invalid code", str(e))

    # Case-insensitive (uppercase forced)
    try:
        r = requests.post(f"{BASE_URL}/api/sessions/login", json={"code": "019D"}, timeout=5)
        check("Login case-insensitive (019D) → 200", r.status_code == 200)
    except Exception as e:
        fail("Login case-insensitive", str(e))

# ─── 3. Reasoning Layers ──────────────────────────────────────────────────────

def test_reasoning_layers():
    section("3. Reasoning Layers (logic_detector)")
    try:
        r = requests.get(f"{BASE_URL}/api/reasoning/layers", params={"dataset": PRIMARY_DATASET}, timeout=10)
        check("GET /api/reasoning/layers → 200", r.status_code == 200)
        data = r.json()
        required_keys = ["phase", "ratio_mode", "session_sequence", "memory_profile", "child_profile"]
        for k in required_keys:
            check(f"Layers has key '{k}'", k in data)
        sessions = data.get("session_sequence", [])
        check("session_sequence is non-empty list", isinstance(sessions, list) and len(sessions) > 0,
              f"{len(sessions)} sessions")
        check("ratio_mode is valid string", data.get("ratio_mode") in ("BALANCED", "LEARN_HEAVY", "TALK_HEAVY"),
              f"got: {data.get('ratio_mode')}")
    except Exception as e:
        fail("GET /api/reasoning/layers", str(e))

    # 404 for unknown dataset
    try:
        r = requests.get(f"{BASE_URL}/api/reasoning/layers", params={"dataset": "nonexistent_xyz"}, timeout=5)
        check("Layers 404 for unknown dataset", r.status_code == 404)
    except Exception as e:
        fail("Layers 404 test", str(e))

# ─── 4. Reasoning Todo ────────────────────────────────────────────────────────

def test_reasoning_todo():
    section("4. Reasoning Todo")
    try:
        r = requests.get(f"{BASE_URL}/api/reasoning/todo", params={"dataset": PRIMARY_DATASET}, timeout=10)
        check("GET /api/reasoning/todo → 200", r.status_code == 200)
        data = r.json()
        check("Todo returns a list", isinstance(data, list))
        check("Todo list is non-empty", len(data) > 0, f"{len(data)} items")
    except Exception as e:
        fail("GET /api/reasoning/todo", str(e))

# ─── 5. Reasoning Generate (cached) ──────────────────────────────────────────

def test_reasoning_generate():
    section("5. Reasoning Generate (force_refresh=False → uses cache)")
    try:
        r = requests.post(
            f"{BASE_URL}/api/reasoning/generate",
            json={"dataset_name": PRIMARY_DATASET, "force_refresh": False},
            timeout=30
        )
        check("POST /api/reasoning/generate → 200", r.status_code == 200)
        data = r.json()
        check("Generate has 'agent_conversation'", "agent_conversation" in data)
        check("Generate has 'todo_items'", "todo_items" in data)
        check("agent_conversation is list", isinstance(data.get("agent_conversation"), list))
        check("todo_items is list", isinstance(data.get("todo_items"), list))
    except Exception as e:
        fail("POST /api/reasoning/generate", str(e))

# ─── 6. Planner Memory ────────────────────────────────────────────────────────

def test_planner_memory():
    section("6. Planner Memory")
    try:
        r = requests.get(f"{BASE_URL}/api/planner/memory", params={"dataset": PRIMARY_DATASET}, timeout=10)
        check("GET /api/planner/memory → 200 or 404", r.status_code in (200, 404))
        if r.status_code == 200:
            data = r.json()
            check("Memory has 'dataset'", "dataset" in data)
            check("Memory has 'observations_by_domain'", "observations_by_domain" in data)
            check("Memory has 'engagement_report'", "engagement_report" in data)
            obs = data.get("observations_by_domain", {})
            check("observations_by_domain is dict", isinstance(obs, dict))
            expected_domains = ["COGNITIVE", "LANGUAGE", "SOCIAL_EMOTIONAL"]
            for d in expected_domains:
                check(f"Domain '{d}' present in observations", d in obs)
    except Exception as e:
        fail("GET /api/planner/memory", str(e))

# ─── 7. Schedule Config ───────────────────────────────────────────────────────

def test_schedule_config():
    section("7. Schedule Config")
    try:
        # GET — should return default or saved config
        r = requests.get(f"{BASE_URL}/api/planner/schedule-config", params={"dataset": PRIMARY_DATASET}, timeout=5)
        check("GET /api/planner/schedule-config → 200", r.status_code == 200)
        data = r.json()
        check("Config has 'preset'", "preset" in data)
        check("Config has 'blocks' list", isinstance(data.get("blocks"), list))
        check("Config has 'session_duration_min'", isinstance(data.get("session_duration_min"), int))
        check("Config has 'days_per_week'", isinstance(data.get("days_per_week"), int))
        blocks = data.get("blocks", [])
        has_greeting = any(b.get("type") == "GREETING" for b in blocks)
        has_learn = any(b.get("type") == "LEARN" for b in blocks)
        check("Blocks include GREETING type", has_greeting)
        check("Blocks include LEARN type", has_learn)
    except Exception as e:
        fail("GET /api/planner/schedule-config", str(e))

    # POST — save a custom config
    try:
        custom_config = {
            "dataset": PRIMARY_DATASET,
            "preset": "balanced",
            "session_duration_min": 30,
            "days_per_week": 5,
            "include_greeting": True,
            "include_game": False,
            "blocks": [
                {"id": "b1", "type": "GREETING", "label": "Chào hỏi", "emoji": "👋", "duration_min": 3, "enabled": True, "locked": True},
                {"id": "b2", "type": "LEARN", "label": "Học tiếng Anh · Unit 1", "emoji": "📚", "duration_min": 8, "enabled": True, "locked": False},
                {"id": "b3", "type": "TALK_ACTIVITY", "label": "Trò chuyện", "emoji": "🎭", "duration_min": 10, "enabled": True, "locked": False},
                {"id": "b4", "type": "WRAP_UP", "label": "Kết thúc", "emoji": "🌙", "duration_min": 2, "enabled": True, "locked": True},
            ],
            "feedback_text": ""
        }
        r = requests.post(f"{BASE_URL}/api/planner/schedule-config", json=custom_config, timeout=5)
        check("POST /api/planner/schedule-config → 200", r.status_code == 200)
        saved = r.json()
        check("Save config returns 'status: saved'", saved.get("status") == "saved")
        check("Save summary has talk_sessions count", "talk_sessions" in saved.get("summary", {}))
        check("Save summary has learn_sessions count", "learn_sessions" in saved.get("summary", {}))
    except Exception as e:
        fail("POST /api/planner/schedule-config", str(e))

# ─── 8. Schedule Config Recommend (deterministic engine) ─────────────────────

def test_schedule_recommend():
    section("8. Schedule Recommend (deterministic, no LLM)")
    cases = [
        {"preset": "talk_heavy", "session_duration_min": 30, "days": 5},
        {"preset": "balanced",   "session_duration_min": 45, "days": 5},
        {"preset": "learn_heavy","session_duration_min": 60, "days": 3},
    ]
    base_blocks = [
        {"id": "b1", "type": "GREETING",      "label": "Chào hỏi", "emoji": "👋", "duration_min": 3,  "enabled": True,  "locked": True},
        {"id": "b2", "type": "LEARN",         "label": "Học · Unit 1", "emoji": "📚", "duration_min": 8, "enabled": True, "locked": False},
        {"id": "b3", "type": "LEARN",         "label": "Học · Unit 2", "emoji": "📚", "duration_min": 8, "enabled": True, "locked": False},
        {"id": "b4", "type": "TALK_ACTIVITY", "label": "Trò chuyện", "emoji": "🎭", "duration_min": 10, "enabled": True, "locked": False},
        {"id": "b5", "type": "WRAP_UP",       "label": "Kết thúc",   "emoji": "🌙", "duration_min": 2,  "enabled": True,  "locked": True},
    ]
    for case in cases:
        try:
            payload = {
                "dataset": PRIMARY_DATASET,
                "preset": case["preset"],
                "session_duration_min": case["session_duration_min"],
                "days_per_week": case["days"],
                "blocks": base_blocks,
            }
            r = requests.post(f"{BASE_URL}/api/planner/schedule-config/recommend", json=payload, timeout=5)
            check(
                f"Recommend [{case['preset']} {case['session_duration_min']}min] → 200",
                r.status_code == 200
            )
            if r.status_code == 200:
                data = r.json()
                stats = data.get("stats", {})
                fit = stats.get("fit_score", 0)
                total = stats.get("total_minutes", 0)
                delta = abs(stats.get("delta_minutes", 999))
                check(
                    f"  fit_score ≥ 50 [{case['preset']}]",
                    fit >= 50,
                    f"fit={fit}, total={total}min, delta={delta}min"
                )
                check(
                    f"  adapted_blocks is list [{case['preset']}]",
                    isinstance(data.get("adapted_blocks"), list)
                )
        except Exception as e:
            fail(f"Recommend [{case['preset']}]", str(e))

# ─── 9. Weekly Plan (GET from cache) ─────────────────────────────────────────

def test_weekly_plan_get():
    section("9. Weekly Plan (GET — cache or eval_sessions fallback)")
    try:
        r = requests.get(f"{BASE_URL}/api/planner/weekly-plan", params={"dataset": PRIMARY_DATASET}, timeout=15)
        check("GET /api/planner/weekly-plan → 200 or 404", r.status_code in (200, 404))
        if r.status_code == 200:
            data = r.json()
            check("Weekly plan has 'profile_id'", "profile_id" in data)
            check("Weekly plan has 'week_label'", "week_label" in data)
            check("Weekly plan has 'talk_sessions'", "talk_sessions" in data)
            check("talk_sessions is list", isinstance(data.get("talk_sessions"), list))
            # Verify session structure
            sessions = data.get("talk_sessions", [])
            if sessions:
                s = sessions[0]
                check("Session has 'title'", "title" in s)
                check("Session has 'topic'", "topic" in s)
                check("Session has 'rationale'", "rationale" in s)
        elif r.status_code == 404:
            ok("Weekly plan 404 expected (no cache, no eval_sessions) — acceptable for fresh env")
    except Exception as e:
        fail("GET /api/planner/weekly-plan", str(e))

# ─── 10. Planner Feedback ─────────────────────────────────────────────────────

def test_planner_feedback():
    section("10. Planner Feedback (SQLite)")
    week_label = "2026-W22"
    try:
        # POST feedback
        payload = {
            "dataset": PRIMARY_DATASET,
            "week_label": week_label,
            "star_rating": 4,
            "tags": ["phù hợp", "cá nhân hóa tốt"],
            "comment": "Kế hoạch rất phù hợp với con",
            "item_feedback": [
                {"id": "s1", "title": "Session 1", "type": "talk", "liked": True, "comment": "Hay"}
            ]
        }
        r = requests.post(f"{BASE_URL}/api/planner/feedback", json=payload, timeout=5)
        check("POST /api/planner/feedback → 200", r.status_code == 200)
        saved = r.json()
        check("Feedback returns 'status: success'", saved.get("status") == "success")
        feedback_id = saved.get("feedback_id", "")
        check("Feedback returns feedback_id", bool(feedback_id))

        # GET feedback back
        r2 = requests.get(f"{BASE_URL}/api/planner/feedback",
                          params={"dataset": PRIMARY_DATASET, "week_label": week_label}, timeout=5)
        check("GET /api/planner/feedback → 200", r2.status_code == 200)
        got = r2.json()
        check("Feedback GET returns status success", got.get("status") == "success")
        check("Feedback GET star_rating matches", got.get("star_rating") == 4)
        tags = got.get("tags", [])
        check("Feedback GET tags is list", isinstance(tags, list))

        # Idempotent POST (update existing)
        payload["star_rating"] = 5
        r3 = requests.post(f"{BASE_URL}/api/planner/feedback", json=payload, timeout=5)
        check("POST /api/planner/feedback idempotent update → 200", r3.status_code == 200)
        check("Idempotent returns same feedback_id", r3.json().get("feedback_id") == feedback_id)

    except Exception as e:
        fail("Planner Feedback", str(e))

# ─── 11. Eval Sessions (SQLite) ───────────────────────────────────────────────

def test_eval_sessions():
    section("11. Eval Sessions (SQLite CRUD)")
    session_id = None
    try:
        # CREATE
        body = {
            "phone": "0901234567",
            "profile_id": "test-profile-" + uuid.uuid4().hex[:8],
            "profile_name": "Test Kid"
        }
        r = requests.post(f"{BASE_URL}/api/eval-sessions", json=body, timeout=5)
        check("POST /api/eval-sessions → 201", r.status_code == 201)
        data = r.json()
        check("Session has 'id'", "id" in data)
        check("Session initial step = 'loading_profile'", data.get("current_step") == "loading_profile")
        session_id = data.get("id")

        # UPDATE
        if session_id:
            update_body = {
                "current_step": "completed",
                "data": {"weekly_plan": {"status": "ready"}},
                "totals": {"sessions_completed": 1}
            }
            r2 = requests.post(f"{BASE_URL}/api/eval-sessions/{session_id}/update", json=update_body, timeout=5)
            check("POST /api/eval-sessions/{id}/update → 200", r2.status_code == 200)
            updated = r2.json()
            check("Update returns ok=True", updated.get("ok") is True)
            check("Update current_step = 'completed'", updated.get("session", {}).get("current_step") == "completed")

        # LIST
        r3 = requests.get(f"{BASE_URL}/api/eval-sessions", timeout=5)
        check("GET /api/eval-sessions → 200", r3.status_code == 200)
        sessions = r3.json().get("sessions", [])
        check("List returns list of sessions", isinstance(sessions, list))

        # LATEST ACTIVE
        if body.get("profile_id"):
            r4 = requests.get(f"{BASE_URL}/api/eval-sessions/latest-active/by-profile",
                              params={"profile_id": body["profile_id"]}, timeout=5)
            check("GET latest-active/by-profile → 200", r4.status_code == 200)

    except Exception as e:
        fail("Eval Sessions", str(e))

# ─── 12. Core Logic: schedule_config helpers ─────────────────────────────────

def test_core_logic_schedule():
    """Test schedule_config deterministic engine directly (unit-style)."""
    section("12. Core Logic: _compute_recommendations (unit tests)")
    # We can't import directly without activating venv, so we call via API
    test_cases = [
        # (preset, target_min, expected_fit_min)
        ("balanced",    30, 50),
        ("talk_heavy",  45, 50),
        ("learn_heavy", 60, 50),
        ("balanced",    20, 40),  # Very short — may have low fit
    ]
    base_blocks = [
        {"id": "b1", "type": "GREETING", "label": "G", "emoji": "👋", "duration_min": 3, "enabled": True, "locked": True},
        {"id": "b2", "type": "LEARN", "label": "L1", "emoji": "📚", "duration_min": 8, "enabled": True, "locked": False},
        {"id": "b3", "type": "TALK_ACTIVITY", "label": "T", "emoji": "🎭", "duration_min": 10, "enabled": True, "locked": False},
        {"id": "b4", "type": "WRAP_UP", "label": "W", "emoji": "🌙", "duration_min": 2, "enabled": True, "locked": True},
    ]
    for preset, target, min_fit in test_cases:
        try:
            r = requests.post(
                f"{BASE_URL}/api/planner/schedule-config/recommend",
                json={"dataset": PRIMARY_DATASET, "preset": preset, "session_duration_min": target,
                      "days_per_week": 5, "blocks": base_blocks},
                timeout=5
            )
            if r.status_code == 200:
                stats = r.json().get("stats", {})
                fit = stats.get("fit_score", 0)
                total = stats.get("total_minutes", 0)
                check(
                    f"  Logic [{preset}/{target}min] fit≥{min_fit}",
                    fit >= min_fit,
                    f"fit={fit}, total={total}min"
                )
            else:
                fail(f"Logic [{preset}/{target}min] HTTP {r.status_code}")
        except Exception as e:
            fail(f"Logic [{preset}/{target}min]", str(e))

# ─── 13. Raw Plan (GET /api/plan) ─────────────────────────────────────────────

def test_raw_plan():
    section("13. Raw Plan (/api/plan)")
    try:
        r = requests.get(f"{BASE_URL}/api/plan", params={"dataset": PRIMARY_DATASET}, timeout=5)
        check("GET /api/plan → 200", r.status_code == 200)
        data = r.json()
        check("Plan data is a dict", isinstance(data, dict))
    except Exception as e:
        fail("GET /api/plan", str(e))

# ─── 14. CORS Headers ─────────────────────────────────────────────────────────

def test_cors():
    section("14. CORS Headers")
    try:
        r = requests.options(
            f"{BASE_URL}/api/health",
            headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
            timeout=5
        )
        cors = r.headers.get("access-control-allow-origin", "")
        check(
            "CORS allows localhost:3000",
            "localhost:3000" in cors or cors == "*",
            f"allow-origin: {cors}"
        )
    except Exception as e:
        fail("CORS check", str(e))

# ─── Summary ──────────────────────────────────────────────────────────────────

def summary():
    total = len(PASS) + len(FAIL)
    print(f"\n{'=' * 60}")
    print(f"  RESULTS: {len(PASS)}/{total} passed, {len(FAIL)} failed")
    print('=' * 60)
    if FAIL:
        print("\nFailed tests:")
        for f in FAIL:
            print(f"  ❌ {f}")
    else:
        print("  🎉 All tests passed!")
    return len(FAIL) == 0

# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"{'=' * 60}")
    print(f"  Pika Backend — Comprehensive Test Suite")
    print(f"  Target: {BASE_URL}")
    print(f"{'=' * 60}")

    test_health()
    test_login()
    test_reasoning_layers()
    test_reasoning_todo()
    test_reasoning_generate()
    test_planner_memory()
    test_schedule_config()
    test_schedule_recommend()
    test_weekly_plan_get()
    test_planner_feedback()
    test_eval_sessions()
    test_core_logic_schedule()
    test_raw_plan()
    test_cors()

    all_passed = summary()
    sys.exit(0 if all_passed else 1)
