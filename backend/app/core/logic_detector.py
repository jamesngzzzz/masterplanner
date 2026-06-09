import re
import logging
from typing import Dict, Any, List, Optional, Tuple
from app.core.learning_db import db

logger = logging.getLogger("logic_detector")

# ---------------------------------------------------------------------------
# TOPIC MAP — mission_id prefix → friendly Vietnamese topic name
# ---------------------------------------------------------------------------
MISSION_TOPIC_MAP = {
    "preA1_1": "Thời tiết (Weather)",
    "preA1_2": "Thời tiết (Weather)",
    "preA1_3": "Thời tiết (Weather)",
    "preA1_4": "Thời tiết (Weather)",
    "preA1_5": "Thời tiết (Weather)",
    "preA1_6": "Thời tiết (Weather)",
    "preA1_7": "Đồ dùng học tập (School Supplies)",
    "preA1_8": "Đồ dùng học tập (School Supplies)",
    "preA1_9": "Đồ dùng học tập (School Supplies)",
    "preA1_10": "Đồ dùng học tập (School Supplies)",
    "preA1_11": "Đồ dùng học tập (School Supplies)",
    "preA1_15": "Trái cây & Thực phẩm (Fruits & Food)",
    "preA1_16": "Trái cây & Thực phẩm (Fruits & Food)",
    "preA1_21": "Trái cây & Thực phẩm (Fruits & Food)",
    "preA1_22": "Trái cây & Thực phẩm (Fruits & Food)",
    "preA1_23": "Trái cây & Thực phẩm (Fruits & Food)",
    "preA1_30": "Thể thao & Vận động (Sports & Activities)",
    "preA1_31": "Thể thao & Vận động (Sports & Activities)",
    "preA1_32": "Thể thao & Vận động (Sports & Activities)",
    "preA1_33": "Thể thao & Vận động (Sports & Activities)",
    "preA1_34": "Thể thao & Vận động (Sports & Activities)",
    "preA1_35": "Thể thao & Vận động (Sports & Activities)",
    "preA1_36": "Thể thao & Vận động (Sports & Activities)",
    "preA1_91": "Đồ vật & Đồ chơi (Objects & Toys)",
    "preA1_97": "Phòng & Nhà cửa (Rooms & Home)",
}

# ---------------------------------------------------------------------------
# ONBOARDING bot IDs — all belong to Phase 1 (Stranger / Người lạ)
# ---------------------------------------------------------------------------
ONBOARDING_BOT_IDS = {"661", "736", "1350", "662", "663", "1222"}


def get_friendly_topic(mission_id: str) -> str:
    if not mission_id:
        return "Chủ đề Tổng hợp"
    if mission_id in MISSION_TOPIC_MAP:
        return MISSION_TOPIC_MAP[mission_id]
    for k, v in MISSION_TOPIC_MAP.items():
        if mission_id.startswith(k):
            return v
    return f"Chủ đề {mission_id}"


# ---------------------------------------------------------------------------
# WORD / SENTENCE EXTRACTORS
# ---------------------------------------------------------------------------

def extract_words(learn_data: Optional[Dict[str, Any]]) -> List[str]:
    if not learn_data:
        return []
    words = learn_data.get("words") or []
    result = []
    for item in words:
        if isinstance(item, str):
            result.append(item.lower().strip())
        elif isinstance(item, dict):
            word_val = item.get("word") or item.get("text")
            if word_val:
                result.append(str(word_val).lower().strip())
    seen: set = set()
    return [w for w in result if not (w in seen or seen.add(w))]  # type: ignore


def extract_sentences(learn_data: Optional[Dict[str, Any]]) -> List[str]:
    if not learn_data:
        return []
    sentences = learn_data.get("sentences") or []
    result = []
    for item in sentences:
        if isinstance(item, str):
            result.append(item.strip())
        elif isinstance(item, dict):
            sent_val = item.get("text") or item.get("sentence")
            if sent_val:
                result.append(str(sent_val).strip())
    seen: set = set()
    return [s for s in result if not (s in seen or seen.add(s))]  # type: ignore


# ---------------------------------------------------------------------------
# LAYER 3: MEMORY EXTRACTION
# ---------------------------------------------------------------------------

def extract_memory_from_prompt(prompt: str) -> Dict[str, str]:
    """Extract the structured memory block from a Pika system prompt."""
    if not prompt:
        return {}

    match = re.search(r'(?:7\.\s+)?You\s+remember\s+about\s+user:[ \t]*(.*)', prompt, re.DOTALL | re.IGNORECASE)
    if not match:
        match = re.search(r'(?:Bạn nhớ về bé|remembered about user):[ \t]*(.*)', prompt, re.DOTALL | re.IGNORECASE)
        if not match:
            return {}

    content = match.group(1)
    end_patterns = [
        r'\n\d+\.\s+[A-Z\s]+',
        r'\n\w+\s+limit:',
        r'\nBehavior:',
        r'\nLanguage:',
        r'\nCONVERSATION GOAL:',
    ]
    for pattern in end_patterns:
        end_match = re.search(pattern, content, re.IGNORECASE)
        if end_match:
            content = content[:end_match.start()]

    content = content.strip()
    lines = content.split('\n')
    memory_dict: Dict[str, str] = {}
    current_category = "General"

    for line in lines:
        line = line.strip()
        if not line:
            continue
        cat_match = re.match(r'^([^:]+):\s*(.*)$', line)
        if cat_match:
            cat_name = cat_match.group(1).strip()
            cat_desc = cat_match.group(2).strip()
            memory_dict[cat_name] = cat_desc
            current_category = cat_name
        else:
            if current_category in memory_dict:
                memory_dict[current_category] += " " + line
            else:
                memory_dict[current_category] = line

    cleaned: Dict[str, str] = {}
    for k, v in memory_dict.items():
        v_clean = v.strip()
        if v_clean and len(v_clean) > 2:
            cleaned[k] = v_clean
    return cleaned


def extract_child_profile(prompt: str) -> Dict[str, Any]:
    """
    Extract child profile info (name, age, favorite movie) from standard user profile section in system prompt.
    Avoid placeholder values like '{{name}}', '{{age}}', '{{favorite_movie}}'.
    """
    if not prompt:
        return {}
    profile = {}
    
    # Check for name, age, movie in the template section
    name_match = re.search(r'Tên trẻ:\s*([^\n]+)', prompt, re.IGNORECASE)
    if name_match:
        name_val = name_match.group(1).strip()
        if name_val and "{{" not in name_val and "}}" not in name_val and name_val.lower() != "name":
            profile["name"] = name_val
            
    age_match = re.search(r'Tuổi:\s*([^\n]+)', prompt, re.IGNORECASE)
    if age_match:
        age_val = age_match.group(1).strip()
        if age_val and "{{" not in age_val and "}}" not in age_val and age_val.lower() != "age":
            profile["age"] = age_val
            
    movie_match = re.search(r'Bộ phim yêu thích:\s*([^\n]+)', prompt, re.IGNORECASE)
    if movie_match:
        movie_val = movie_match.group(1).strip()
        if movie_val and "{{" not in movie_val and "}}" not in movie_val and movie_val.lower() != "favorite_movie":
            profile["favorite_movie"] = movie_val

    # Fallback to search inside memory text if name not found in the template fields
    if not profile.get("name"):
        child_name_match = re.search(r'(?:child named|child\'s name is|bé tên(?: là)?)\s+([A-ZÀ-Ỹa-zà-ỹ]+)', prompt, re.IGNORECASE)
        if child_name_match:
            name_val = child_name_match.group(1).strip()
            if name_val and name_val.lower() not in ["is", "the", "a", "an", "bé", "trẻ", "name"]:
                profile["name"] = name_val

    return profile


# ---------------------------------------------------------------------------
# LAYER 2 (TALK/GAME): CONVERSATION GOAL & DIALOGUE AGENDA EXTRACTION
# ---------------------------------------------------------------------------

def extract_conversation_goal(system_prompt: str) -> Optional[str]:
    """Extract the 'CONVERSATION GOAL' section from a TALK/GAME system prompt."""
    if not system_prompt:
        return None
    match = re.search(
        r'(?:4\.\s+)?CONVERSATION GOAL[:\s]+(.*?)(?=\n\d+\.|$)',
        system_prompt,
        re.DOTALL | re.IGNORECASE,
    )
    if match:
        goal = match.group(1).strip()
        # Truncate to first 300 chars to keep context concise
        return goal[:300].strip()
    return None


def extract_dialogue_phases(system_prompt: str) -> List[str]:
    """
    Extract the ordered PHASE list from a TALK/GAME dialogue agenda.
    Returns a list like ["PHASE 0: HOOK & ROLE ASSIGNMENT", "PHASE 1: DIALOGUE LOOP", ...]
    """
    if not system_prompt:
        return []
    phases = re.findall(
        r'(PHASE\s+\d+[^:\n]*:[^\n]+)',
        system_prompt,
        re.IGNORECASE,
    )
    return [p.strip() for p in phases]


def extract_memory_categories_activated(system_prompt: str, memory_profile: Dict[str, str]) -> List[str]:
    """
    Detect which memory categories from the child's profile are explicitly
    referenced or likely activated in this activity's system prompt.
    """
    if not system_prompt or not memory_profile:
        return []
    activated = []
    for category in memory_profile.keys():
        if category.lower() in system_prompt.lower():
            activated.append(category)
    # Also detect common memory usage patterns
    if re.search(r'favorite\s*(cartoon|movie|film|character)', system_prompt, re.IGNORECASE):
        for cat in ["Movie", "Film", "Cartoon", "Movie, Film, Cartoon"]:
            if cat in memory_profile and cat not in activated:
                activated.append(cat)
    if re.search(r'memory|remember|recall', system_prompt, re.IGNORECASE):
        # Any memory usage pattern — flag all profile keys as potentially activated
        for cat in memory_profile.keys():
            if cat not in activated:
                activated.append(cat)
    return activated


# ---------------------------------------------------------------------------
# LAYER 1: PHASE DETECTION — tag-based (primary) + heuristic (fallback)
# ---------------------------------------------------------------------------

def detect_phase_from_items(items: List[Dict[str, Any]]) -> Tuple[int, str]:
    """
    Returns (phase_number, phase_label).
    Strategy:
      1. Tag-based: look for _p1, _p2, _p3 suffixes in tags
      2. Onboarding bot IDs → Phase 1
      3. Heuristic fallback from activity patterns
    """
    phase_signals_p1 = 0
    phase_signals_p2 = 0
    phase_signals_p3 = 0
    onboarding_count = 0
    has_review = False
    has_game = False
    has_roleplay = False

    for item in items:
        tag = str(item.get("tag") or "").lower()
        bot_id = str(item.get("bot_id") or "").strip()
        item_type = str(item.get("type") or "").upper()
        category = str(item.get("category") or "").upper()
        name = str(item.get("name") or "").lower()
        system_prompt = item.get("system_prompt") or ""

        # --- Tag-based phase signals ---
        # Patterns: greeting_p1, cartoon_movie_activity_3_p2, etc.
        if re.search(r'_p1\b', tag) or tag == "greeting_p1":
            phase_signals_p1 += 2
        if re.search(r'_p2\b', tag):
            phase_signals_p2 += 2
        if re.search(r'_p3\b', tag):
            phase_signals_p3 += 2

        # --- Onboarding bot IDs → Phase 1 ---
        if bot_id in ONBOARDING_BOT_IDS:
            onboarding_count += 1

        # --- Content signals ---
        if category == "REVIEW" or "review" in tag or "ôn tập" in name:
            has_review = True
        if item_type == "GAME_AGENT" or category == "GAME_AGENT":
            has_game = True
        if "role" in system_prompt.lower() or "roleplay" in system_prompt.lower() or "role-play" in system_prompt.lower():
            has_roleplay = True

    # Decision: tag signals win
    if phase_signals_p3 > 0:
        return 3, "Bạn thân (Best Friend)"
    if phase_signals_p2 > 0:
        return 2, "Bạn bè (Friend)"
    if phase_signals_p1 > 0 or onboarding_count >= 2:
        return 1, "Người lạ (Stranger)"

    # Heuristic fallback
    if onboarding_count >= 1:
        return 1, "Người lạ (Stranger)"
    if has_review and (has_game or has_roleplay):
        return 3, "Bạn thân (Best Friend)"
    if has_review or has_game:
        return 3, "Bạn thân (Best Friend)"
    return 2, "Bạn bè (Friend)"


# ---------------------------------------------------------------------------
# LAYER 2: RATIO MODE
# ---------------------------------------------------------------------------

def detect_ratio_mode(items: List[Dict[str, Any]]) -> str:
    learn_count = 0
    talk_count = 0
    for item in items:
        item_type = str(item.get("type") or "").upper()
        if item_type in ("LEARN_WORKFLOW", "LEARN_AGENT"):
            learn_count += 1
        elif item_type in ("TALK", "GAME_AGENT"):
            talk_count += 1
    if learn_count >= 4 and talk_count <= 1:
        return "LEARN_HEAVY"
    if learn_count <= 1 and talk_count >= 3:
        return "TALK_HEAVY"
    return "BALANCED"


# ---------------------------------------------------------------------------
# CAUSAL CHAIN BUILDER — produces human-readable "why" summaries per item
# ---------------------------------------------------------------------------

RATIO_DESCRIPTIONS = {
    "BALANCED": "Cân bằng giữa Học máy (English Units) và Trò chuyện Giao tiếp (Talk / Game Agents)",
    "LEARN_HEAVY": "Tập trung cao độ vào bài học tiếng Anh chuyên sâu (nhiều bài học học thuật, ít giao tiếp hơn)",
    "TALK_HEAVY": "Tập trung tương tác giao tiếp tự nhiên và phản xạ qua trò chuyện & game đóng vai (nhiều talk/game, ít học thuật hơn)",
}

PHASE_RATIONALE = {
    1: "Pika và bé đang trong giai đoạn làm quen — mọi hoạt động tập trung vào việc xây dựng sự tin tưởng và khám phá sở thích ban đầu. Pika chưa có nhiều ký ức về bé, nên hỏi thăm và lắng nghe là ưu tiên.",
    2: "Pika và bé đã quen nhau đủ để Pika nhớ và dùng ký ức cá nhân của bé trong từng hoạt động. Giai đoạn này Pika bắt đầu cá nhân hóa sâu hơn — kết nối bài học với sở thích thực tế của bé.",
    3: "Pika và bé đã là bạn thân. Pika hiểu bé rất rõ và tích cực dùng toàn bộ ký ức 5 chiều (phim, nhạc, hoạt động, bạn bè, chủ đề yêu thích) để thiết kế trải nghiệm hoàn toàn cá nhân hóa.",
}


def build_item_why(item: Dict[str, Any], phase_number: int, memory_profile: Dict[str, str],
                   content_connections: List[Dict[str, Any]], talk_game_info: Optional[Dict[str, Any]]) -> str:
    """Generate a concise Vietnamese 'why' explanation for a single todo item."""
    item_type = str(item.get("type") or "").upper()
    category = str(item.get("category") or "").upper()
    tag = str(item.get("tag") or "").lower()
    name = item.get("name") or ""

    # GREETING
    if category == "GREETING" or "greeting" in tag:
        mem_count = len(memory_profile)
        if mem_count > 0:
            cats = ", ".join(list(memory_profile.keys())[:3])
            return (
                f"Lượt chào hỏi mở đầu buổi học — Pika kích hoạt ký ức cá nhân của bé ({cats}) "
                f"để tạo kết nối cảm xúc ấm áp trước khi vào học. "
                f"Giai đoạn {phase_number}: Pika đã đủ quen để dùng ký ức như 'bí mật chung' giữa hai bạn."
            )
        return "Lượt chào hỏi mở đầu — Pika làm ấm không khí và chuẩn bị tâm lý tốt nhất cho bé trước khi học."

    # REVIEW / PRONOUNCE
    if category in ("REVIEW", "PRONOUNCE") or "review" in tag or "ôn tập" in name.lower():
        return (
            "Ôn tập giãn cách thông minh (Spaced Repetition T+1) — bé được ôn lại từ/câu từ buổi trước "
            "đúng thời điểm não bộ dễ củng cố ký ức nhất. Không ôn ngay sau khi học, không để quên lâu quá."
        )

    # GAME_AGENT
    if item_type == "GAME_AGENT" or category == "GAME_AGENT":
        if talk_game_info:
            goal = talk_game_info.get("conversation_goal", "")
            phases = talk_game_info.get("dialogue_phases", [])
            mem_activated = talk_game_info.get("memory_categories_activated", [])
            parts = [f"Game đóng vai Pixar-style — mục tiêu: {goal}" if goal else "Game đóng vai tương tác."]
            if mem_activated:
                parts.append(f"Pika kích hoạt ký ức '{', '.join(mem_activated[:2])}' của bé làm bối cảnh game.")
            if phases:
                parts.append(f"Kịch bản: {' → '.join(phases[:3])}.")
            return " ".join(parts)
        return "Game đóng vai giúp bé ứng dụng ngôn ngữ vào tình huống thực tế, phát triển EQ và phản xạ giao tiếp."

    # TALK
    if item_type == "TALK":
        if talk_game_info:
            goal = talk_game_info.get("conversation_goal", "")
            phases = talk_game_info.get("dialogue_phases", [])
            mem_activated = talk_game_info.get("memory_categories_activated", [])
            parts = []
            if goal:
                parts.append(f"Hoạt động trò chuyện tự do — mục tiêu giao tiếp: {goal}.")
            if mem_activated:
                parts.append(f"Pika sử dụng ký ức '{', '.join(mem_activated[:2])}' để duy trì cuộc trò chuyện tự nhiên và cá nhân hóa.")
            if phases:
                parts.append(f"Cấu trúc cuộc trò chuyện: {' → '.join(phases[:3])}.")
            if parts:
                return " ".join(parts)
        return "Trò chuyện tự do giúp bé phản xạ tiếng Việt/Anh tự nhiên, xây dựng sự tự tin khi giao tiếp."

    # LEARN_WORKFLOW / LEARN_AGENT
    if item_type in ("LEARN_WORKFLOW", "LEARN_AGENT"):
        # Find which content thread this activity belongs to
        for conn in content_connections:
            if name in conn.get("activities", []):
                topic = conn.get("topic_name", "")
                words = conn.get("words", [])
                act_list = conn.get("activities", [])
                position = act_list.index(name) + 1 if name in act_list else 1
                word_str = ", ".join([f"'{w}'" for w in words[:4]]) if words else ""
                return (
                    f"Bài học #{position} trong dòng chảy chủ đề '{topic}'. "
                    + (f"Từ vựng trọng tâm hôm nay: {word_str}. " if word_str else "")
                    + "Các bài học cùng chủ đề được sắp xếp liên tiếp để bé xây dựng kiến thức theo lớp, "
                    "thay vì học nhảy cóc rời rạc."
                )
        return "Bài học tiếng Anh tương tác đa giác quan — kết hợp hình ảnh, âm thanh và phản hồi thời gian thực từ Pika."

    return "Hoạt động được thiết kế phù hợp với giai đoạn phát triển và nhu cầu học tập hiện tại của bé."


# ---------------------------------------------------------------------------
# MAIN DETECTOR
# ---------------------------------------------------------------------------

def detect_layers(todo_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Takes raw todo list JSON and extracts all 5 logic layers plus
    enriched context for the AI reasoning prompt.
    """
    raw_items = todo_data.get("sessions") or todo_data.get("items") or []
    
    items = []
    for raw in raw_items:
        if "type" in raw or "name" in raw:
            items.append(raw)
            continue
            
        act_type = str(raw.get("activity_type") or "").upper()
        if act_type == "LEARN":
            act_type = "LEARN_WORKFLOW"
        elif "TALK" in act_type:
            act_type = "TALK"
            
        mapped = {
            "type": act_type,
            "category": act_type,
            "name": raw.get("title", ""),
            "roadmap_activity_id": raw.get("activity_id", ""),
            "bot_id": "",
            "tag": "",
            "system_prompt": "",
            "learn_data": {},
            "time_estimation": 15
        }
        
        mem_inject = raw.get("memory_to_inject", [])
        if mem_inject:
            fake_prompt = "You remember about user:\n"
            for m in mem_inject:
                fake_prompt += f"General: {m}\n"
            fake_prompt += "\n\nCONVERSATION GOAL: " + raw.get("rationale", "")
            mapped["system_prompt"] = fake_prompt
            
        items.append(mapped)

    # ---- LAYER 1 & 2: Phase + Ratio ----
    phase_number, phase_label = detect_phase_from_items(items)
    ratio_mode = detect_ratio_mode(items)

    # ---- LAYER 3: Memory Profile ----
    memory_profile: Dict[str, str] = {}
    child_profile: Dict[str, Any] = {}
    for item in items:
        prompt = (item.get("system_prompt") or "") + "\n\n" + (item.get("graph_system_prompt") or "")
        extracted = extract_memory_from_prompt(prompt)
        if extracted:
            memory_profile.update(extracted)
        extracted_profile = extract_child_profile(prompt)
        if extracted_profile:
            child_profile.update(extracted_profile)

    # Fallback: if name still not found from template fields ({{name}} placeholder),
    # try to extract from memory_profile (e.g., "User's name is An" in Personal & Family)
    if not child_profile.get("name"):
        for cat_key, cat_val in memory_profile.items():
            name_match = re.search(
                r"(?:user'?s?\s+name\s+is|child'?s?\s+name\s+is|bé\s+tên\s+là)\s+([A-Za-zÀ-Ỹà-ỹ]+)",
                cat_val, re.IGNORECASE,
            )
            if name_match:
                candidate = name_match.group(1).strip()
                # In the context of "name is X", whatever follows is the name.
                # Only exclude structural words that could appear after 'is' by mistake.
                # 'An' is a valid Vietnamese name, so it must NOT be excluded.
                _generic_non_names = {"Is", "The", "A", "And", "Be", "It", "She", "He"}
                if (candidate and len(candidate) >= 2
                        and candidate[0].isupper()
                        and candidate not in _generic_non_names):
                    child_profile["name"] = candidate
                    break
        # Also try: name appears directly (e.g., "Pia enjoys..." at the start of a memory cat value)
        if not child_profile.get("name"):
            for cat_key, cat_val in memory_profile.items():
                # Pattern: value starts with a proper noun that is the child's name
                first_word_match = re.match(r"^([A-ZÀ-Ỹ][a-zà-ỹ]{1,10})\s+(?:enjoys|likes|has|loves|is|was)", cat_val)
                if first_word_match:
                    candidate = first_word_match.group(1)
                    if candidate.lower() not in ("user", "the", "she", "he", "it", "pika"):
                        child_profile["name"] = candidate
                        break


    # ---- LAYER 4: Pronunciation Review ----
    pronounce_words: List[str] = []
    pronounce_sentences: List[str] = []

    for item in items:
        category = str(item.get("category") or "").upper()
        tag = str(item.get("tag") or "").lower()
        learn_data = item.get("learn_data")
        name = str(item.get("name") or "").lower()

        activity_id = item.get("roadmap_activity_id")
        bot_id = item.get("bot_id", "")

        is_review_item = (
            (category in ("REVIEW", "PRONOUNCE")
             or tag in ("review", "pronounce")
             or "ôn tập" in name)
            and not activity_id
        )

        db_activity = db.get_activity(activity_id) if activity_id else db.get_by_bot_id(bot_id)

        if is_review_item:
            pronounce_words.extend(extract_words(learn_data))
            pronounce_sentences.extend(extract_sentences(learn_data))
            if not extract_words(learn_data) and db_activity:
                pronounce_words.extend(extract_words(db_activity.get("learn_data")))
                pronounce_sentences.extend(extract_sentences(db_activity.get("learn_data")))

    seen_w: set = set()
    pronounce_words = [w for w in pronounce_words if not (w in seen_w or seen_w.add(w))]  # type: ignore
    seen_s: set = set()
    pronounce_sentences = [s for s in pronounce_sentences if not (s in seen_s or seen_s.add(s))]  # type: ignore

    # ---- LAYER 5: Content Connections ----
    content_activities: List[Dict[str, Any]] = []
    topic_groups: Dict[str, List[Dict[str, Any]]] = {}

    for item in items:
        activity_id = item.get("roadmap_activity_id")
        bot_id = item.get("bot_id", "")
        db_activity = db.get_activity(activity_id) if activity_id else db.get_by_bot_id(bot_id)
        if not db_activity:
            continue

        mission_id = db_activity.get("mission_id", "")
        activity_name = db_activity.get("name", "")
        activity_category = db_activity.get("activity_category", "")
        words = extract_words(db_activity.get("learn_data"))
        sentences = extract_sentences(db_activity.get("learn_data"))

        activity_info = {
            "id": activity_id,
            "name": activity_name,
            "mission_id": mission_id,
            "category": activity_category,
            "words": words,
            "sentences": sentences,
            "story": db_activity.get("story", ""),
        }
        content_activities.append(activity_info)
        if mission_id:
            topic_groups.setdefault(mission_id, []).append(activity_info)

    content_connections: List[Dict[str, Any]] = []
    for mission_id, group in topic_groups.items():
        if group:
            friendly_topic = get_friendly_topic(mission_id)
            all_words: List[str] = []
            all_sentences: List[str] = []
            for act in group:
                all_words.extend(act["words"])
                all_sentences.extend(act["sentences"])
            seen_cw: set = set()
            unique_words = [w for w in all_words if not (w in seen_cw or seen_cw.add(w))]  # type: ignore
            seen_cs: set = set()
            unique_sentences = [s for s in all_sentences if not (s in seen_cs or seen_cs.add(s))]  # type: ignore

            content_connections.append({
                "mission_id": mission_id,
                "topic_name": friendly_topic,
                "activities": [act["name"] for act in group],
                "words": unique_words,
                "sentences": unique_sentences,
                "activity_count": len(group),
                "description": (
                    f"Dòng chảy {len(group)} bài học liên tiếp giúp bé làm quen → luyện tập → làm chủ "
                    f"chủ đề '{friendly_topic}' qua các trải nghiệm tương tác đa dạng."
                ),
            })

    # ---- TALK/GAME REASONING EXTRACTION ----
    talk_game_reasoning: List[Dict[str, Any]] = []
    for item in items:
        item_type = str(item.get("type") or "").upper()
        if item_type not in ("TALK", "GAME_AGENT"):
            continue

        system_prompt = item.get("system_prompt") or ""
        name = item.get("name") or ""
        category = str(item.get("category") or "").upper()
        tag = str(item.get("tag") or "").lower()

        # Skip pure greeting items (handled separately)
        if category == "GREETING" or "greeting" in tag:
            continue

        goal = extract_conversation_goal(system_prompt)
        phases = extract_dialogue_phases(system_prompt)
        mem_activated = extract_memory_categories_activated(system_prompt, memory_profile)

        talk_game_reasoning.append({
            "activity_name": name,
            "type": item_type,
            "conversation_goal": goal,
            "dialogue_phases": phases,
            "memory_categories_activated": mem_activated,
            "skill_developed": _infer_skill(item_type, goal, phases),
        })

    # ---- SESSION STRUCTURE (ordered todo with per-item why) ----
    # Build a lookup from activity name to talk_game info
    tg_lookup: Dict[str, Dict[str, Any]] = {tg["activity_name"]: tg for tg in talk_game_reasoning}

    session_sequence: List[Dict[str, Any]] = []
    for i, item in enumerate(items):
        item_type = str(item.get("type") or "").upper()
        category = str(item.get("category") or "").upper()
        tag = str(item.get("tag") or "").lower()
        name = item.get("name") or ""
        duration = item.get("time_estimation")

        role = _determine_role(item_type, category, tag, name)
        talk_game_info = tg_lookup.get(name)
        why = build_item_why(item, phase_number, memory_profile, content_connections, talk_game_info)

        seq_item: Dict[str, Any] = {
            "order": i + 1,
            "name": name,
            "type": item_type,
            "role_in_session": role,
            "why_this_item": why,
        }
        if duration is not None:
            seq_item["duration_minutes"] = duration

        # For LEARN items, attach topic and learning database detail (story, learn_mechanism, words)
        activity_id = item.get("roadmap_activity_id")
        bot_id = item.get("bot_id", "")
        db_activity = db.get_activity(activity_id) if activity_id else db.get_by_bot_id(bot_id)
        if db_activity:
            story = db_activity.get("story") or ""
            learn_mechanism = db_activity.get("learn_mechanism") or ""
            words = extract_words(db_activity.get("learn_data"))

            if learn_mechanism:
                seq_item["learn_mechanism"] = learn_mechanism
            if story:
                seq_item["story"] = story[:150]
            if words:
                seq_item["words"] = words

        for conn in content_connections:
            if name in conn.get("activities", []):
                seq_item["topic"] = conn["topic_name"]
                break

        # Fallback: inject inline learn_data.words from the item itself.
        # REVIEW and PRONOUNCE items carry learn_data directly (no roadmap_activity_id).
        if not seq_item.get("words"):
            inline_words = extract_words(item.get("learn_data"))
            if inline_words:
                seq_item["words"] = inline_words

        session_sequence.append(seq_item)


    # ---- CAUSAL CHAIN SUMMARY ----
    causal_chain = _build_causal_chain(
        phase_number, phase_label,
        ratio_mode, memory_profile,
        content_connections, pronounce_words,
        talk_game_reasoning, items,
    )

    return {
        "phase": {
            "number": phase_number,
            "label": phase_label,
            "rationale": PHASE_RATIONALE.get(phase_number, ""),
        },
        "ratio_mode": ratio_mode,
        "memory_profile": memory_profile,
        "child_profile": child_profile,
        "pronounce_review": {
            "words": pronounce_words,
            "sentences": pronounce_sentences,
        },
        "content_connections": content_connections,
        "talk_game_reasoning": talk_game_reasoning,
        "session_sequence": session_sequence,
        "causal_chain_summary": causal_chain,
        "analyzed_activities_count": len(content_activities),
    }


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def _determine_role(item_type: str, category: str, tag: str, name: str) -> str:
    if category == "GREETING" or "greeting" in tag.lower():
        return "GREETING"
    if category in ("REVIEW", "PRONOUNCE") or "review" in tag.lower() or "ôn tập" in name.lower():
        return "REVIEW"
    if item_type == "GAME_AGENT" or category == "GAME_AGENT":
        return "GAME"
    if item_type == "TALK":
        return "TALK"
    if item_type in ("LEARN_WORKFLOW", "LEARN_AGENT"):
        return "LEARN"
    return "OTHER"


def _infer_skill(item_type: str, goal: Optional[str], phases: List[str]) -> str:
    if "roleplay" in str(goal).lower() or "role-play" in str(goal).lower() or any("role" in p.lower() for p in phases):
        return "Phản xạ giao tiếp tình huống, xây dựng câu chuyện, phát triển EQ xã hội"
    if item_type == "GAME_AGENT":
        return "Ứng dụng ngôn ngữ vào tình huống thực tế, tư duy sáng tạo, phản xạ nhanh"
    if "free" in str(goal).lower() or "general" in str(goal).lower():
        return "Giao tiếp tự do, tự tin nói chuyện, mở rộng chủ đề theo sở thích bản thân"
    return "Phát triển kỹ năng nghe-nói tương tác, xây dựng phản xạ ngôn ngữ tự nhiên"


def _build_causal_chain(
    phase_number: int,
    phase_label: str,
    ratio_mode: str,
    memory_profile: Dict[str, str],
    content_connections: List[Dict[str, Any]],
    pronounce_words: List[str],
    talk_game_reasoning: List[Dict[str, Any]],
    items: List[Dict[str, Any]],
) -> Dict[str, str]:
    """Build the human-readable causal chain summary for the AI prompt."""

    # Phase reason
    phase_reason = (
        f"Bé và Pika đang ở {phase_label}. "
        + PHASE_RATIONALE.get(phase_number, "")
    )

    # Ratio reason
    learn_count = sum(1 for it in items if str(it.get("type") or "").upper() in ("LEARN_WORKFLOW", "LEARN_AGENT"))
    talk_count = sum(1 for it in items if str(it.get("type") or "").upper() in ("TALK", "GAME_AGENT"))
    ratio_reason = (
        f"Tỷ lệ hôm nay: {learn_count} bài học + {talk_count} hoạt động giao tiếp "
        f"→ Chế độ {ratio_mode}: {RATIO_DESCRIPTIONS.get(ratio_mode, ratio_mode)}."
    )

    # Memory activation reason — pool framing (not deterministic commitment)
    mem_keys = list(memory_profile.keys())
    if mem_keys:
        memory_reason = (
            f"Pika đang lưu giữ {len(mem_keys)} chiều ký ức của bé: {', '.join(mem_keys)}. "
            "Đây là pool các đặc điểm cá nhân mà Pika XEM XÉT — Pika linh hoạt chọn chiều phù hợp nhất "
            "VÀO ĐÚNG LÚC HỌC để bé cảm thấy kết nối tự nhiên, không cam kết trước sẽ dùng chiều ký ức nào."
        )
    else:
        memory_reason = "Pika chưa có ký ức về bé — đây là buổi đầu tiên khám phá sở thích."

    # Content thread reason
    if content_connections:
        topics = [conn["topic_name"] for conn in content_connections]
        total_words = sum(len(conn.get("words", [])) for conn in content_connections)
        content_thread = (
            f"Hôm nay bé học theo {len(content_connections)} dòng chủ đề: {', '.join(topics)}. "
            f"Tổng {total_words} từ vựng được xây dựng theo chuỗi liên kết — "
            "mỗi bài học là một bước tiến trong cùng một hành trình chủ đề, không học rời rạc."
        )
    else:
        content_thread = "Các hoạt động hôm nay không liên kết qua cơ sở dữ liệu chủ đề."

    # Pronunciation spaced repetition
    if pronounce_words:
        word_str = ", ".join([f"'{w}'" for w in pronounce_words[:5]])
        pronounce_reason = (
            f"Hôm nay bé được ôn tập phát âm các từ: {word_str}. "
            "Đây là ôn tập giãn cách (Spaced Repetition) — Pika chọn đúng thời điểm T+1 "
            "để củng cố ký ức dài hạn, tránh quên lãng."
        )
    else:
        pronounce_reason = "Hôm nay không có từ vựng nào cần ôn tập phát âm từ buổi trước."

    # Talk/game summary
    tg_skills = list({tg["skill_developed"] for tg in talk_game_reasoning if tg.get("skill_developed")})
    if tg_skills:
        talk_reason = (
            f"Hoạt động giao tiếp hôm nay phát triển: {'; '.join(tg_skills[:2])}. "
            "Pika thiết kế kịch bản dựa trên ký ức và sở thích thực tế của bé để trò chuyện cảm thấy tự nhiên, không gượng gạo."
        )
    else:
        talk_reason = "Không có hoạt động giao tiếp đặc biệt trong buổi học hôm nay."

    return {
        "phase_reason": phase_reason,
        "ratio_reason": ratio_reason,
        "memory_activation_reason": memory_reason,
        "content_thread": content_thread,
        "pronunciation_spaced_repetition": pronounce_reason,
        "talk_game_design_rationale": talk_reason,
    }


# ---------------------------------------------------------------------------
# ANNOTATED TODO (for lightweight UI preview — no LLM)
# ---------------------------------------------------------------------------

def get_annotated_todo(todo_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Returns the daily todo items annotated with logic layer labels
    for instant UI preview (no LLM call required).
    """
    layers = detect_layers(todo_data)
    items = todo_data.get("items", [])
    todo_items = []

    for i, item in enumerate(items):
        item_type = item.get("type", "")
        category = item.get("category", "")
        tag = item.get("tag", "")
        name = item.get("name", "")

        annotations = []
        if category == "GREETING" or "greeting" in str(tag).lower():
            annotations.append("Cấu trúc Lộ trình: Lượt chào hỏi sinh động")
            if layers.get("memory_profile"):
                annotations.append("Tương tác Cá nhân hóa: Kích hoạt ký ức đa chiều")
        elif category in ("REVIEW", "PRONOUNCE") or "review" in str(tag).lower():
            annotations.append("Củng cố Kiến thức: Ôn tập giãn cách thông minh (T+1)")
            words = layers.get("pronounce_review", {}).get("words", [])
            if words:
                annotations.append(f"Từ ôn tập: {', '.join(words[:4])}")
        elif str(item_type).upper() == "GAME_AGENT" or category == "GAME_AGENT":
            annotations.append("Ứng dụng Thực tế: Game đóng vai Pixar-style nâng cao EQ")
        elif str(item_type).upper() == "TALK":
            annotations.append("Giao tiếp Tự nhiên: Trò chuyện phản xạ cá nhân hóa")
            # Show memory pool (candidate dimensions, not guaranteed activation)
            for tg in layers.get("talk_game_reasoning", []):
                if tg["activity_name"] == name and tg.get("memory_categories_activated"):
                    annotations.append(f"Ký ức xem xét: {', '.join(tg['memory_categories_activated'][:2])}")
        elif str(item_type).upper() in ("LEARN_WORKFLOW", "LEARN_AGENT"):
            annotations.append("Nạp Kiến thức: Bài học tiếng Anh tương tác đa giác quan")
            for conn in layers.get("content_connections", []):
                if name in conn.get("activities", []):
                    annotations.append(f"Dòng chảy Chủ đề: {conn.get('topic_name')}")

        todo_items.append({
            "order": i + 1,
            "name": name,
            "type": item_type,
            "category": category or "LEARN",
            "layer_annotations": annotations,
        })
    return todo_items
