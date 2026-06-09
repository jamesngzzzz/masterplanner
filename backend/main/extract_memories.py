import json
import os
import sys
from collections import defaultdict
import openpyxl
from datetime import datetime

EXCEL_PATH = '/Users/admin/full prototype/backend/mockdata/childconvo.xlsx'
OUTPUT_DIR = '/Users/admin/full prototype/backend/main/processed_memories'

def main():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    print(f"Loading {EXCEL_PATH}...")
    wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True)
    ws = wb['Result 1']

    # profile_id -> [ { "id": "conv_id", "memory": "raw transcript", "created_at": "date" } ]
    profiles_data = defaultdict(lambda: defaultdict(list))
    profile_dates = defaultdict(dict)

    row_count = 0
    for row in ws.iter_rows(min_row=2, values_only=True):
        row_count += 1
        conv_id = str(row[0])
        activity_type = row[1]
        profile_id = row[2]
        created_at_str = str(row[4]) if row[4] else ""
        character = row[7]
        content = row[8]

        if activity_type == 'TALK' and profile_id and character and content:
            # We only process up to 5 profiles
            if len(profiles_data) < 5 or profile_id in profiles_data:
                # Format: BOT or USER: content
                role = "Bot" if "BOT" in character else "Child"
                profiles_data[profile_id][conv_id].append(f"{role}: {content}")
                if created_at_str and conv_id not in profile_dates[profile_id]:
                    profile_dates[profile_id][conv_id] = created_at_str

    wb.close()

    print(f"Processed {row_count} rows. Found {len(profiles_data)} profiles.")

    for profile_id, convs in profiles_data.items():
        memories = []
        for conv_id, turns in convs.items():
            # Skip very short conversations
            if len(turns) < 3:
                continue
            
            transcript = "\n".join(turns)
            # Truncate if too long to save context space, though LLM handles 16k tokens
            if len(transcript) > 2000:
                transcript = transcript[:2000] + "\n... (truncated)"
            
            # Prepend context to help LLM
            memory_text = f"Conversation transcript:\n{transcript}"
            created_at = profile_dates[profile_id].get(conv_id, datetime.now().isoformat())

            memories.append({
                "id": str(conv_id),
                "memory": memory_text,
                "created_at": created_at,
                "metadata": {"source": "raw_transcript"}
            })

        # Sort by date
        memories.sort(key=lambda x: x['created_at'], reverse=True)
        # Keep latest 50 conversations to avoid token limits
        memories = memories[:50]

        out_path = os.path.join(OUTPUT_DIR, f"{profile_id}.json")
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(memories, f, ensure_ascii=False, indent=2)
        print(f"Saved {len(memories)} memory items for profile {profile_id} to {out_path}")

if __name__ == '__main__':
    main()
