import os
import json
import requests
import time

MEMORIES_DIR = '/Users/admin/full prototype/backend/main/processed_memories'
ANALYSIS_DIR = '/Users/admin/full prototype/backend/main/analysis_results'
PLAN_DIR = '/Users/admin/full prototype/backend/main/plan_results'

API_BASE = "http://localhost:8000/api"

def main():
    os.makedirs(ANALYSIS_DIR, exist_ok=True)
    os.makedirs(PLAN_DIR, exist_ok=True)

    files = [f for f in os.listdir(MEMORIES_DIR) if f.endswith('.json')]
    for fname in files:
        profile_id = fname.replace('.json', '')
        print(f"\n{'='*40}\nProcessing Profile: {profile_id}")
        
        with open(os.path.join(MEMORIES_DIR, fname), 'r', encoding='utf-8') as f:
            memories = json.load(f)
        
        print(f"Loaded {len(memories)} memories.")

        # 1. Analyze Memory
        analysis_path = os.path.join(ANALYSIS_DIR, fname)
        analysis_data = None
        if os.path.exists(analysis_path):
            print("Analysis already exists, loading from file...")
            with open(analysis_path, 'r', encoding='utf-8') as f:
                analysis_resp = json.load(f)
                analysis_data = analysis_resp.get("parsed")
        else:
            print("Calling /analyze/memory ...")
            req_body = {
                "profile_id": profile_id,
                "memories": memories
            }
            try:
                res = requests.post(f"{API_BASE}/analyze/memory", json=req_body, timeout=120)
                res.raise_for_status()
                analysis_resp = res.json()
                with open(analysis_path, 'w', encoding='utf-8') as f:
                    json.dump(analysis_resp, f, ensure_ascii=False, indent=2)
                analysis_data = analysis_resp.get("parsed")
                print("Memory Analysis Successful.")
            except Exception as e:
                print(f"Error calling /analyze/memory: {e}")
                if hasattr(e, 'response') and e.response:
                    print(e.response.text)
                continue

        # 2. Generate Weekly Plan
        plan_path = os.path.join(PLAN_DIR, fname)
        if os.path.exists(plan_path):
            print("Weekly plan already exists, skipping.")
        else:
            print("Calling /generate/weekly-plan ...")
            req_body = {
                "profile_id": profile_id,
                "profile_name": f"Child_{profile_id[:4]}",
                "memories": memories,
                "memory_analysis_parsed": analysis_data or {},
                "week_start": "2026-06-01"
            }
            try:
                res = requests.post(f"{API_BASE}/generate/weekly-plan", json=req_body, timeout=180)
                res.raise_for_status()
                plan_resp = res.json()
                with open(plan_path, 'w', encoding='utf-8') as f:
                    json.dump(plan_resp, f, ensure_ascii=False, indent=2)
                print("Weekly Plan Successful.")
            except Exception as e:
                print(f"Error calling /generate/weekly-plan: {e}")
                if hasattr(e, 'response') and e.response:
                    print(e.response.text)

if __name__ == '__main__':
    main()
