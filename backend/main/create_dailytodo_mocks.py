import os
import json

ANALYSIS_DIR = '/Users/admin/full prototype/backend/main/analysis_results'
PLAN_DIR = '/Users/admin/full prototype/backend/main/plan_results'
MOCK_DIR = '/Users/admin/full prototype/references/dailytodo/backend/mock_data'

def main():
    os.makedirs(MOCK_DIR, exist_ok=True)
    profiles = [f.replace('.json', '') for f in os.listdir(PLAN_DIR) if f.endswith('.json')]
    
    for pid in profiles:
        with open(os.path.join(ANALYSIS_DIR, f"{pid}.json"), 'r', encoding='utf-8') as f:
            analysis = json.load(f).get("parsed", {})
        
        with open(os.path.join(PLAN_DIR, f"{pid}.json"), 'r', encoding='utf-8') as f:
            plan = json.load(f)
            
        persona = analysis.get("persona", {})
        clusters = analysis.get("memory_clusters", [])
        
        # Build memory string to fool logic_detector.py
        memory_str = f"Tên trẻ: {plan.get('user_name', 'Bé')}\nBạn nhớ về bé:\n"
        memory_str += f"Sở thích chung: {', '.join(persona.get('engage_preferences', []))}\n"
        for c in clusters:
            memory_str += f"{c.get('name', '')}: {', '.join(c.get('top_items', []))}\n"

        items = []
        # Inject greeting
        items.append({
            "type": "TALK",
            "category": "GREETING",
            "name": "Chào hỏi đầu tuần",
            "tag": "greeting_p3",
            "system_prompt": memory_str,
            "time_estimation": 5
        })
        
        # Map sessions
        for s in plan.get("sessions", []):
            item_type = s.get("activity_type", "TALK")
            # If it's a TALK, maybe map to GAME_AGENT if topic_strategy implies it
            if "game" in s.get("title", "").lower() or "trò chơi" in s.get("title", "").lower():
                item_type = "GAME_AGENT"
                
            items.append({
                "type": item_type,
                "category": item_type,
                "name": f"Ngày {s.get('day')}: {s.get('title')}",
                "tag": f"activity_day_{s.get('day')}",
                "system_prompt": memory_str + f"\nCONVERSATION GOAL: {s.get('topic_strategy')}\nPHASE 1: {s.get('rationale')}",
                "learn_data": {
                    "words": s.get("target_vocab", []),
                    "sentences": s.get("target_sentences", [])
                },
                "time_estimation": 15
            })

        # Inject review at the end
        items.append({
            "type": "TALK",
            "category": "REVIEW",
            "name": "Ôn tập cuối tuần",
            "tag": "review_p3",
            "system_prompt": memory_str,
            "learn_data": {
                "words": [w for s in plan.get("sessions", []) for w in s.get("target_vocab", [])]
            },
            "time_estimation": 10
        })

        out_data = {
            "id": pid,
            "items": items
        }
        
        out_path = os.path.join(MOCK_DIR, f"{pid}.json")
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(out_data, f, ensure_ascii=False, indent=2)
            
        print(f"Created {out_path} with {len(items)} items")

if __name__ == '__main__':
    main()
