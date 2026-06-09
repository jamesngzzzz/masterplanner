import json
import re
from typing import Dict, Any, List, Optional


# ---------------------------------------------------------------------------
# HELPERS — clean up raw extracted text before sending to AI
# ---------------------------------------------------------------------------

def _strip_template_vars(text: str) -> str:
    return re.sub(r'\{\{[^}]+\}\}', '[bé]', text).strip()


def _clean_goal(raw_goal: Optional[str], max_len: int = 120) -> Optional[str]:
    if not raw_goal:
        return None
    cleaned = _strip_template_vars(raw_goal)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    m = re.search(r'(?:Primary Goal|Goal):\s*(.+?)(?:\.|$)', cleaned, re.IGNORECASE)
    if m:
        cleaned = m.group(1).strip()
    if re.match(r'Step\s+\d+', cleaned, re.IGNORECASE):
        first_sentence = cleaned.split('.')[0].strip()
        cleaned = first_sentence if first_sentence else cleaned
    if len(cleaned) > max_len:
        cleaned = cleaned[:max_len].rstrip() + "…"
    return cleaned


def _clean_phase_name(raw: List[str]) -> List[str]:
    cleaned = []
    for p in raw:
        p = _strip_template_vars(p)
        m = re.match(r'PHASE\s+[\d.]+\s*[:\-]?\s*(.+)', p, re.IGNORECASE)
        if m:
            label = m.group(1).strip()
            label = re.sub(r'\([^)]*\)', '', label).strip()
            cleaned.append(label[:60])
        else:
            p_clean = p[:60].strip()
            if p_clean:
                cleaned.append(p_clean)
    return cleaned


def _deduplicate_connections(connections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Merge content connections by topic, deduplicating activities and words.
    
    Output keys: topic_name, activities, words  — must match the L5 context schema
    that the AI prompt references (topic_name, activities, words).
    """
    merged: Dict[str, Dict[str, Any]] = {}
    for conn in connections:
        topic = conn.get("topic_name", "")
        if topic not in merged:
            merged[topic] = {
                "topic_name": topic,
                "activities": list(conn.get("activities", [])),
                "words": list(conn.get("words", []))[:10],
            }
        else:
            existing_acts = set(merged[topic]["activities"])
            for act in conn.get("activities", []):
                if act not in existing_acts:
                    merged[topic]["activities"].append(act)
                    existing_acts.add(act)
            existing_words = set(merged[topic]["words"])
            for w in conn.get("words", []):
                if w not in existing_words and len(merged[topic]["words"]) < 10:
                    merged[topic]["words"].append(w)
                    existing_words.add(w)
    return list(merged.values())


def _build_memory_activation_map(
    memory_profile: Dict[str, str],
    talk_game_reasoning: List[Dict[str, Any]],
    session_sequence: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    activation_map = []
    for tg in talk_game_reasoning:
        activated_cats = tg.get("memory_categories_activated", [])
        for cat in activated_cats:
            if cat in memory_profile:
                mem_content = memory_profile[cat]
                if len(mem_content) > 80:
                    mem_content = mem_content[:80].rstrip() + "…"
                activation_map.append({
                    "memory_category": cat,
                    "memory_content_summary": mem_content,
                    "available_as_pool_for_activity": tg.get("activity_name"),
                    "activity_type": tg.get("type"),
                    "selection_note": "Pika linh hoạt chọn chiều ký ức phù hợp nhất vào lúc học — không cam kết trước dimension nào",
                })
    if memory_profile:
        greeting_item = next(
            (s for s in session_sequence if s.get("role_in_session") == "GREETING"), None
        )
        if greeting_item:
            cat_samples = list(memory_profile.keys())[:3]
            activation_map.append({
                "memory_category": f"Tổng hợp ({', '.join(cat_samples)}…)",
                "memory_content_summary": "Pika có toàn bộ ký ức đa chiều về bé sẵn sàng được khai thác",
                "available_as_pool_for_activity": greeting_item["name"],
                "activity_type": "GREETING",
            })
    return activation_map


def _lean_session_item(item: Dict[str, Any]) -> Dict[str, Any]:
    lean: Dict[str, Any] = {
        "order": item.get("order"),
        "name": item.get("name"),
        "role": item.get("role_in_session"),
    }
    if item.get("topic"):
        lean["topic"] = item["topic"]
    if item.get("duration_minutes") is not None:
        lean["duration_minutes"] = item["duration_minutes"]
    if item.get("story"):
        lean["story"] = item["story"]
    if item.get("learn_mechanism"):
        lean["learn_mechanism"] = item["learn_mechanism"]
    if item.get("words"):
        lean["words"] = item["words"]

    # --- Anti-hallucination: signal how much concrete data is available ---
    role = item.get("role_in_session", "")
    has_story = bool(item.get("story"))
    has_mechanism = bool(item.get("learn_mechanism"))
    has_words = bool(item.get("words"))
    has_topic = bool(item.get("topic"))
    if role == "GREETING":
        lean["data_confidence"] = "greeting"      # special: MAY cite memory profile to personalize the warm-up
    elif has_story and has_mechanism:
        lean["data_confidence"] = "rich"          # can write detailed, vivid reasoning
    elif has_words or has_topic:
        lean["data_confidence"] = "words_only"    # cite the words/topic; keep other details minimal
    else:
        lean["data_confidence"] = "minimal"       # NO content data — use role + position logic only

    return lean


def _phase_evidence(phase_number: int, session_sequence: List[Dict[str, Any]]) -> str:
    if phase_number == 1:
        onboarding = [s["name"] for s in session_sequence if s.get("role_in_session") == "LEARN"][:2]
        if onboarding:
            return f"Ví dụ: '{onboarding[0]}' — Pika chưa có ký ức về bé, tập trung làm quen."
        return "Pika đang trong giai đoạn làm quen, chưa có ký ức cá nhân của bé."
    if phase_number == 2:
        greeting = next((s["name"] for s in session_sequence if s.get("role_in_session") == "GREETING"), None)
        talk = next((s["name"] for s in session_sequence if s.get("role_in_session") == "TALK"), None)
        parts = []
        if greeting:
            parts.append(f"'{greeting}': Pika mở đầu bằng ký ức đã lưu về bé")
        if talk:
            parts.append(f"'{talk}': Pika dùng sở thích thực tế của bé làm nền tảng")
        return "; ".join(parts) if parts else "Pika bắt đầu cá nhân hóa dựa trên ký ức đã tích lũy."
    if phase_number == 3:
        review = next((s["name"] for s in session_sequence if s.get("role_in_session") == "REVIEW"), None)
        game = next((s["name"] for s in session_sequence if s.get("role_in_session") == "GAME"), None)
        parts = []
        if review:
            parts.append(f"'{review}': Bạn thân nhắc ôn bài đúng lúc")
        if game:
            parts.append(f"'{game}': Game đóng vai dựa hoàn toàn trên sở thích cá nhân")
        return "; ".join(parts) if parts else "Pika khai thác toàn bộ 5 chiều ký ức."
    return ""


# ---------------------------------------------------------------------------
# MAIN BUILDER
# ---------------------------------------------------------------------------

def build_openai_prompt(layers: Dict[str, Any], dataset_name: str) -> str:
    """
    Builds the full context payload + system instruction for Gemini/OpenAI.
    Output format: multi-agent conversation (agents talk to each other)
    + per-todo reasoning for parents.
    """
    phase = layers.get("phase", {})
    ratio_mode = layers.get("ratio_mode", "BALANCED")
    memory_profile = layers.get("memory_profile", {})
    pronounce_review = layers.get("pronounce_review", {})
    content_connections = layers.get("content_connections", [])
    talk_game_reasoning = layers.get("talk_game_reasoning", [])
    session_sequence = layers.get("session_sequence", [])

    phase_number = phase.get("number", 2)

    # -----------------------------------------------------------------------
    # Build lean logic-evidence context
    # -----------------------------------------------------------------------
    learn_items = [s["name"] for s in session_sequence if s.get("role_in_session") == "LEARN"]
    talk_items  = [s["name"] for s in session_sequence if s.get("role_in_session") in ("TALK", "GAME", "GREETING")]

    ratio_descriptions = {
        "BALANCED": "Cân bằng học thuật và giao tiếp tự nhiên",
        "LEARN_HEAVY": "Thiên về bài học tiếng Anh chuyên sâu",
        "TALK_HEAVY": "Thiên về trò chuyện phản xạ và game đóng vai",
    }

    memory_activation_map = _build_memory_activation_map(
        memory_profile, talk_game_reasoning, session_sequence
    )

    review_activity = next(
        (s["name"] for s in session_sequence if s.get("role_in_session") == "REVIEW"), None
    )

    deduped_connections = _deduplicate_connections(content_connections)

    talk_block = [
        {
            "activity_name": tg.get("activity_name"),
            "type": tg.get("type"),
            "conversation_purpose": _clean_goal(tg.get("conversation_goal"), max_len=120),
            "dialogue_flow": _clean_phase_name(tg.get("dialogue_phases", []))[:3],
            "memory_dimensions_activated": tg.get("memory_categories_activated", []),
            "skill_developed": tg.get("skill_developed"),
        }
        for tg in talk_game_reasoning
    ]

    session_flow = [_lean_session_item(item) for item in session_sequence]

    context_payload = {
        "dataset": dataset_name,
        "child_profile": layers.get("child_profile", {}),
        "session_flow": session_flow,
        "logic_evidence": {
            "L1_friendship_phase": {
                "logic": "Mức độ thân quen giữa Pika và bé — quyết định mức độ cá nhân hóa sâu",
                "detected_phase": phase.get("label", ""),
                "phase_number": phase_number,
                "phase_implication": phase.get("rationale", ""),
                "evidence_in_session": _phase_evidence(phase_number, session_sequence),
            },
            "L2_ratio_mode": {
                "logic": "Tỷ lệ thời lượng — cân bằng giữa học từ mới và phản xạ giao tiếp tự nhiên",
                "detected_mode": ratio_mode,
                "description": ratio_descriptions.get(ratio_mode, ratio_mode),
                "learn_activities": learn_items,
                "talk_or_game_activities": talk_items,
                "counts": {"learn": len(learn_items), "talk_game": len(talk_items)},
            },
            "L3_memory_personalization": {
                "logic": "Ký ức là POOL lựa chọn: Pika chọn linh hoạt chiều ký ức phù hợp nhất VÀO ĐÚNG KHOẢNH KHẮC thực tế — không cam kết trước dimension nào.",
                "total_memory_dimensions": len(memory_profile),
                "memory_profile": memory_profile,
                "memory_pool_evidence": memory_activation_map,
            },
            "L4_pronunciation_spaced_repetition": {
                "logic": "Ôn tập giãn cách thông minh — nhắc lại từ vựng cũ đúng thời điểm vàng",
                "words_due_today": pronounce_review.get("words", []),
                "sentences_due_today": pronounce_review.get("sentences", [])[:3],
                "review_activity_name": review_activity,
                "has_review_today": bool(pronounce_review.get("words")),
            },
            "L5_content_threading": {
                "logic": "Dòng chảy chủ đề liền mạch — học các hoạt động cùng chủ đề liên tiếp để khắc sâu",
                "topic_threads": deduped_connections,
                "has_threading": bool(deduped_connections),
            },
            "L6_talk_game_design": talk_block,
        },
    }

    # -----------------------------------------------------------------------
    # System instruction — MULTI-AGENT CONVERSATION FORMAT
    # -----------------------------------------------------------------------
    system_instruction = """Bạn là hệ thống đa agent của Pika. Nhiệm vụ: mô phỏng một cuộc họp nhóm ngắn giữa các agents để THẢO LUẬN và QUYẾT ĐỊNH lộ trình học hôm nay dựa trên dữ liệu đầu vào.

═══ BỐI CẢNH ═══
Phụ huynh đang "nghe lén" cuộc trò chuyện nội bộ này — họ KHÔNG phải người được agents nói chuyện cùng. Các agents nói chuyện với NHAU.
Mục tiêu: phụ huynh cảm thấy "Wow, Pika thực sự có tư duy giáo dục sâu sắc và đang thiết kế lộ trình riêng cho con mình!"

═══ 5 AGENTS VÀ TÍNH CÁCH ═══
🎓 POPI (Orchestrator — Trưởng ban điều phối):
  Tính cách: Trang trọng nhưng ấm, kiểu tướng quân điều phối. Hay dùng "Báo cáo!", "Triển khai!", "Rõ ràng!". Nói ngắn gọn, chắc nịch. Nhắm vào big picture và mục tiêu gắn kết.
  Vai trò: Mở đầu cuộc họp, giao nhiệm vụ cho từng agent, tổng kết cuối buổi.

🗣 LIA (Talk Agent — Chuyên gia giao tiếp):
  Tính cách: Vui vẻ, sôi nổi, nhiều dấu chấm cảm! Hay dùng "Ồ!", "Tuyệt quá!", "Nhớ nhé!". Nói nhanh, nhiều ý tưởng. Chuyên về kết nối cảm xúc và giao tiếp phản xạ.
  Vai trò: Đề xuất kế hoạch mở đầu (greeting) và thiết kế TALK/GAME activity.

🗺 TOMO (Learn Agent — Chuyên gia học thuật):
  Tính cách: Kỹ thuật nhưng hào hứng, như kỹ sư thiết kế. Hay dùng "Blueprint!", "Đã tính toán:", "Kết quả:". Nói có cấu trúc, theo từng bước logic học tập.
  Vai trò: Báo cáo nội dung học mới, lộ trình ôn tập (review), chuỗi bài học liền mạch (content threading).

🧸🧠 MUN (Psychology Agent — Chuyên gia tâm lý):
  Tính cách: Nhẹ nhàng, hay dùng ẩn dụ. "Bé cần...", "Hãy để ý...", "Điều này giúp...". Chậm rãi, sâu sắc. Chuyên về ký ức và tâm lý phát triển của trẻ.
  Vai trò: Giải thích pool ký ức cá nhân của bé (nêu tên các dimension đã lưu) và cách Pika LINH HOẠT chọn chiều phù hợp nhất VÀO ĐÚNG KHOẢNH KHẮC HỌC — không cam kết trước; giải thích tâm lý học của hoạt động.

🛡 BO (Safety Agent — Đại sứ an toàn):
  Tính cách: Ngắn gọn, dứt khoát, như bảo vệ chuyên nghiệp. "Đã kiểm tra.", "Cleared!", "Không vấn đề.". Chuyên về rà soát an toàn nội dung.
  Vai trò: Xác nhận nội dung và kịch bản an toàn tuyệt đối cho bé học tập.

═══ LUỒNG CUỘC HỘI THOẠI BẮT BUỘC (6-9 messages) ═══
Msg 1: POPI briefing tổng → nêu giai đoạn thân quen (friendship phase) và mục tiêu tổng quát của buổi học hôm nay.
Msg 2: LIA báo cáo kế hoạch GREETING + TALK/GAME → đề cập rằng Pika có pool ký ức đa chiều của bé, và sẽ linh hoạt khai thác pool đó vào lúc học.
Msg 3: TOMO phản hồi LIA → báo cáo về chuỗi bài học (topic), các từ vựng mới sẽ học hôm nay.
Msg 4: TOMO tiếp tục → nói về kế hoạch ôn tập (review) nếu có, trích dẫn rõ các từ vựng cũ cần ôn tập giãn cách hôm nay.
Msg 5: MUN bổ sung dưới góc độ tâm lý → mô tả rằng Pika có pool ký ức đa chiều (liệt kê 2-3 tên dimension thực tế), sẽ CHỌN LINH HOẠT chiều phù hợp nhất TRONG LÚC HỌC để tạo kết nối tự nhiên.
Msg 6: BO xác nhận → trích dẫn các hoạt động/chủ đề cụ thể đã được kiểm duyệt an toàn.
Msg 7: POPI tổng kết → chốt tỷ lệ học/chơi hôm nay (balanced, learn heavy...), cấu trúc các bước, và phát lệnh triển khai lộ trình.

═══ QUY TẮC TUYỆT ĐỐI ═══
1. XƯNG HÔ THÂN THIỆN: Sử dụng tên cụ thể của bé nếu biết. Nếu không có tên thật thì thành thật xưng hô là "bé". Tuyệt đối KHÔNG sử dụng các placeholder kỹ thuật hay tự bịa ra cái tên ngẫu nhiên.
2. KHÔNG SỬ DỤNG THUẬT NGỮ KỸ THUẬT: Tuyệt đối không dùng "Spaced Repetition", "Content Threading", "Gamification", "Ratio Mode", "Friendship Phase" trong cả hội thoại và lý do cho phụ huynh. Hãy diễn giải cực kỳ dân dã, dễ hiểu với phụ huynh Việt Nam.
3. LÝ DO THỰC TẾ & CHÂN THỰC — CĂN CỨ THEO `data_confidence` CỦA TỪNG ITEM:
   - `rich`: Mô tả sinh động kịch bản và cơ chế.
   - `words_only`: Chỉ trích dẫn chính xác từ/chủ đề. Không bịa thêm kịch bản.
   - `greeting`: Được phép trích dẫn pool ký ức cá nhân để mở đầu ấm áp.
   - `minimal`: Viết ngắn gọn, dựa trên vai trò item và vị trí trong buổi học. KHÔNG tự nối sở thích vào nếu không có data.

4. QUY TẮC CHỐNG HALLUCINATION TUYỆT ĐỐI:
   - CHỈ được đề cập đến sở thích của bé (phim, nhạc, đồ ăn, thú cưng...) trong `why_for_child` theo dạng POOL (xem Quy tắc #10 bên dưới) — TUYỆT ĐỐI không cam kết Pika “sẽ nói về [dimension cụ thể]”.
   - Đối với TALK/GAME item: KHÔNG được tự nối tên bài hát/phim/món ăn cụ thể vào activity — chỉ được nói Pika xem xét các sở thích của bé và chọn phù hợp nhất trong lúc học.
   - REVIEW: Chỉ nhắc đúng số từ và tên từ trong `words`.
   - PRONOUNCE: Chỉ nhắc từ trong `words`.
   - Nếu không chắc → viết ngắn, trung tính, thừa nhận là "Pika sắp xếp hoạt động này ở đây để [logic vị trí]" thay vì bịa nội dung.

5. CÁC VÍ DỤ MINH HỌA:
   - `data_confidence = "minimal"` ĐÚNG: "Đây là khoảng thời gian trò chuyện nhẹ nhàng sau chuỗi bài học tập trung — giúp bé thư giãn và duy trì kết nối tự nhiên với Pika."
   - `data_confidence = "minimal"` SAI (hallucinate): "Pika sẽ cùng bé thảo luận về **khủng long** và **bánh ma thuật**." ← Không có data backup!
   - `data_confidence = "words_only"` (REVIEW) ĐÚNG: "🔄 Hôm nay Pika sẽ nhắc lại đúng 3 từ **'board'**, **'photos'** và **'clear'** mà bé đã học. Ôn đúng lúc giúp não bé khắc sâu thay vì học đi học lại từ đầu."
   - `data_confidence = "rich"` ĐÚNG: Viết đầy đủ kịch bản + cơ chế như ví dụ tốt ở trên.

6. TIẾNG VIỆT TỰ NHIÊN: Toàn bộ phản hồi viết bằng tiếng Việt mượt mà, lưu loát, giàu cảm xúc. Chỉ giữ lại tiếng Anh cho các từ vựng học tập hoặc tên riêng của chủ đề khi cần thiết.
7. DÙNG EMOJI TỰ NHIÊN: Mỗi tin nhắn của agent trong `agent_conversation` nên có 1-3 emoji phù hợp ngữ cảnh. Lý do (`why_for_child`) cũng nên có 1 emoji mở đầu — nhưng `data_confidence = "minimal"` thì bỏ emoji để tránh thổi phồng nội dung ít.
8. DÙNG BOLD MARKDOWN (**text**) ĐỂ HIGHLIGHT:
   - Trong `message` (hội thoại chuyên gia): BẮT BUỘC bôi đậm (**bold**) 2-4 cụm từ quan trọng nhất trong MỌI tin nhắn — tên bé, sở thích, số liệu cụ thể, hoặc tên hoạt động. Không có ngoại lệ.
   - Trong `why_for_child` (lý do cho phụ huynh): Bôi đậm 2-4 cụm từ quan trọng. Riêng với `data_confidence = "minimal"`, tối đa 1 cụm bold — KHÔNG bold nếu không có gì thực sự đáng highlight.
9. Trả về DUY NHẤT một chuỗi JSON hợp lệ theo schema dưới đây. KHÔNG sử dụng markdown wrapper ```json ... ``` trong phản hồi của API.
10. `todo_reasoning` PHẢI bao gồm MỌI hoạt động trong `session_flow` — KHÔNG được bỏ sót bất kỳ item nào dù dataset có nhiều item đến đâu.

11. QUY TẮC KÝ ỨC ĐỘNG — BẮT BUỘC TUYỆT ĐỐI (dành cho CẢ `agent_conversation` lẫn `why_for_child`):
    - Bộ nhớ của bé (phim yêu thích, nhạc, ăn, trò chơi...) là MỘT POOL CÁC LỰA CHỌN mà Pika XEM XÉT — KHÔNG phải cam kết cố định sẽ dùng dimension nào.
    - Pika chọn chiều ký ức phù hợp nhất VÀO ĐÚNG LÚC HỌC dựa trên ngữ cảnh thực — không thể xác định trước.
    - TUYỆT ĐỐI KHÔNG viết: “Pika sẽ nói về bộ phim [X]”, “Pika sẽ kết nối với sở thích âm nhạc của bé”.
    - BẮT BUỘC dùng ngôn ngữ pool và linh hoạt:
      ✅ ĐÚNG: “Pika xem xét toàn bộ sở thích cá nhân của bé — từ phim ảnh đến âm nhạc — và sẽ chọn điều phù hợp nhất **trong lúc học** để bé cảm thấy kết nối.”
      ✅ ĐÚNG: “Pika có bộ nhớ đa chiều về bé (**phim, nhạc, ăn...**) và linh hoạt khai thác ký ức nào khiến bé vui vẻ nhất vào đúng khoảnh khắc đó.”
      ❌ SAI: “Pika sẽ dùng sở thích **phim hoạt hình** của bé để kết nối.” ← Cam kết dimension cụ thể!
      ❌ SAI: “Hôm nay Pika sẽ nói chuyện về **[tên phim]** mà bé yêu thích.” ← Hardcode dimension!

═══ OUTPUT JSON SCHEMA ═══
{
  "agent_conversation": [
    {
      "agent_id": "popi" | "lia" | "tomo" | "mun" | "bo",
      "agent_name": "tên hiển thị",
      "avatar": "emoji",
      "role": "chức danh ngắn",
      "message": "nội dung tin nhắn — các agent nói với nhau, có tính cách riêng, trích dẫn dữ kiện cụ thể, không dùng jargon tiếng Anh",
      "highlights": [
        { "label": "dữ kiện nổi bật tối đa 20 ký tự", "type": "metric" | "preference" | "info" }
      ],
      "addressed_to": "agent_id người nhận hoặc 'all'"
    }
  ],
  "todo_reasoning": [
    {
      "item_order": 1,
      "item_name": "tên activity",
      "role": "GREETING" | "LEARN" | "TALK" | "REVIEW" | "GAME",
      "agent_responsible": "agent_id phụ trách",
      "why_for_child": "2-3 câu tiếng Việt dân dã, cụ thể, giải thích sinh động cơ chế hoạt động và lợi ích chân thực cho bé. Trích dẫn từ vựng, sở thích hoặc kịch bản cụ thể.",
      "personalization_tags": ["cá nhân hóa ngắn gọn"],
      "duration_minutes": null | number
    }
  ],
  "session_summary": {
    "phase_label": "tên giai đoạn thân quen",
    "ratio_mode": "cân bằng học-chơi | tập trung học thuật | tập trung giao tiếp",
    "total_activities": number,
    "key_insight": "1 câu tóm tắt giá trị quan trọng nhất của buổi học hôm nay dựa trên tính cá nhân hóa sâu sắc của bé"
  }
}

═══ DỮ LIỆU ĐẦU VÀO ═══
"""

    full_prompt = system_instruction + "\n" + json.dumps(context_payload, ensure_ascii=False, indent=2)
    return full_prompt
