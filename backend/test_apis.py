import requests
import json
import sys
import time

BASE_URL = "http://localhost:8001"
TEST_PROFILE_CODE = "019d"
TEST_DATASET_NAME = "019dfd3e-282c-76b9-a760-b9cf3cd22212"

def print_result(name, success, details=""):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} | {name}")
    if details:
        print(f"       {details}")

def run_tests():
    print(f"Starting Backend API Tests at {BASE_URL}...\n")

    # 1. Test Login
    try:
        res = requests.post(f"{BASE_URL}/api/sessions/login", json={"code": TEST_PROFILE_CODE})
        if res.status_code == 200:
            data = res.json()
            if data.get("dataset_name") == TEST_DATASET_NAME:
                print_result("Login API (/api/sessions/login)", True, f"Returned correct dataset: {TEST_DATASET_NAME}")
            else:
                print_result("Login API (/api/sessions/login)", False, f"Expected {TEST_DATASET_NAME}, got {data.get('dataset_name')}")
        else:
            print_result("Login API (/api/sessions/login)", False, f"HTTP {res.status_code}: {res.text}")
    except Exception as e:
        print_result("Login API (/api/sessions/login)", False, str(e))

    # 2. Test Reasoning Layers
    try:
        res = requests.get(f"{BASE_URL}/api/reasoning/layers?dataset={TEST_DATASET_NAME}")
        if res.status_code == 200:
            data = res.json()
            if "phase" in data and "ratio_mode" in data and "session_sequence" in data:
                print_result("Layers API (/api/reasoning/layers)", True, f"Parsed {len(data['session_sequence'])} sessions, ratio: {data['ratio_mode']}")
            else:
                print_result("Layers API (/api/reasoning/layers)", False, f"Missing keys in response: {list(data.keys())}")
        else:
            print_result("Layers API (/api/reasoning/layers)", False, f"HTTP {res.status_code}: {res.text}")
    except Exception as e:
        print_result("Layers API (/api/reasoning/layers)", False, str(e))

    # 3. Test Reasoning Todo
    try:
        res = requests.get(f"{BASE_URL}/api/reasoning/todo?dataset={TEST_DATASET_NAME}")
        if res.status_code == 200:
            data = res.json()
            if isinstance(data, list) and len(data) > 0:
                print_result("Todo API (/api/reasoning/todo)", True, f"Returned {len(data)} todo items")
            else:
                print_result("Todo API (/api/reasoning/todo)", False, "Returned empty or invalid array")
        else:
            print_result("Todo API (/api/reasoning/todo)", False, f"HTTP {res.status_code}: {res.text}")
    except Exception as e:
        print_result("Todo API (/api/reasoning/todo)", False, str(e))

    # 4. Test Reasoning Generate (This calls OpenAI, we'll verify it returns a structure)
    try:
        # Send force_refresh=False to hopefully hit cache if it exists, otherwise it will generate
        res = requests.post(f"{BASE_URL}/api/reasoning/generate", json={"dataset_name": TEST_DATASET_NAME, "force_refresh": False})
        if res.status_code == 200:
            data = res.json()
            if "agent_conversation" in data and "todo_items" in data:
                print_result("Generate API (/api/reasoning/generate)", True, f"Generated {len(data['agent_conversation'])} messages, cached={data.get('cached')}")
            else:
                print_result("Generate API (/api/reasoning/generate)", False, f"Missing keys in response: {list(data.keys())}")
        else:
            print_result("Generate API (/api/reasoning/generate)", False, f"HTTP {res.status_code}: {res.text}")
    except Exception as e:
        print_result("Generate API (/api/reasoning/generate)", False, str(e))

if __name__ == "__main__":
    run_tests()
