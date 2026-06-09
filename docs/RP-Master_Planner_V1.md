# 🤝 Master Planner V1

## Executive Summary

> **Tại sao V1 không phải là Master Planning đầy đủ?**
>
> Tài liệu RP Hệ thống Master Planning đặt ra một hệ thống parent-facing hoàn chỉnh: goal input → plan generation → approval → dashboard → memory management. V1 của Pika Brain **không build bất kỳ layer nào trong số đó.** V1 là một bước đi trước đó — một prototype UI duy nhất nhằm trả lời câu hỏi: *"Phụ huynh có cảm nhận được value của Pika khi nhìn thấy cách AI nghĩ không?"* Nếu câu trả lời là có, toàn bộ hệ thống Master Planning mới có cơ sở để build tiếp.
>
> Prototype Repo: https://github.com/jamesngzzzz/master-planner-mvp

Pika Brain V1 là một **perceived-value prototype**, không phải production feature. Thay vì xây đủ planning layer cho phụ huynh, V1 chỉ làm đúng một việc: **hiển thị quá trình tư duy của hệ thống AI khi lên to-do list hàng ngày cho bé**, dưới dạng cuộc trò chuyện nội bộ giữa các agent có cá tính riêng (như những chú Minion đang họp), để phụ huynh cảm nhận được Pika thực sự hiểu con mình đến mức nào.

Mục tiêu V1 tập trung vào 3 thứ, theo thứ tự ưu tiên:

1. **Validate perceived value:** Phụ huynh xem reasoning → cảm nhận "Pika thông minh và hiểu con mình" → đây là signal đủ để justify build full system.
2. **Thu thập structured feedback:** Phụ huynh đánh giá chất lượng reasoning → data input để cải thiện logic của từng module (Learn, Talk) mà không cần build feedback loop phức tạp.

---

## 1. Problem Statement

### 1.1. Problem gốc vs. Problem V1 đang giải quyết

RP Master Planning xác định vấn đề ở cấp hệ thống: *Pika thiếu planning layer visible cho phụ huynh → phụ huynh không có mental model về cách Pika hoạt động → không build trust → churn.* Đây là một vấn đề đúng và quan trọng, nhưng nó có phạm vi rất rộng.

Khi cut down xuống V1, problem statement thay đổi cách đặt vấn đề: không phải "build planning layer" mà là **"chứng minh rằng visibility vào AI reasoning có thể tạo ra perceived value đủ mạnh để justify build planning layer."** Đây là sự khác biệt quan trọng về scope và rủi ro.

### 1.2. Pain point V1 nhắm đến

| Pain point | Severity (V1 scope) | V1 giải quyết như thế nào |
|---|---|---|
| Phụ huynh thấy to-do list mỗi ngày nhưng không hiểu *tại sao* bé được giao đúng những bài đó | **HIGH** | Reasoning visibility panel giải thích logic của từng activity: ai quyết định, dựa vào data gì về bé |
| Phụ huynh không có cảm nhận rằng Pika "thực sự hiểu con" | **HIGH** | Agent conversation thể hiện memory cụ thể về bé (sở thích, từ đang học dở, giai đoạn tình bạn) → personalization becomes visible |
| Team AI/ML thiếu structured feedback để cải thiện reasoning của module Learn và Talk | **MEDIUM** | Feedback panel cuối reasoning flow thu thập star rating + tag + comment theo từng to-do item |

---

## 2. Product Goals

> **Goals thay đổi ra sao khi cut down xuống V1:**
>
> RP Master Planning có outcome goal là *"tăng trust → tăng stickiness, plan approval rate, renewal."* Đây là business goal dài hạn. Khi cut xuống V1, goals không còn là business outcome, chúng trở thành **learning goals**: V1 phải trả lời được câu hỏi nào, và trả lời bằng data gì. Nếu V1 không validate được learning hypothesis, không nên tiếp tục build Phase 2.

### 2.1. Primary Goal: Validate Perceived Value

**Câu hỏi:** Phụ huynh có cảm nhận Pika thông minh và cá nhân hoá sau khi xem reasoning không? Signal đủ mạnh để justify build full planning layer không?

**Tại sao:** Toàn bộ hệ thống Master Planning (planner UI, approval flow, memory editor) chỉ có giá trị nếu phụ huynh đã trust Pika đủ để muốn tương tác với những layer đó. Nếu phụ huynh xem reasoning và cảm thấy "hmm, cũng thường thôi", thì việc build full system sẽ là đầu tư lãng phí. V1 là cơ chế validate hypothesis này với chi phí thấp nhất.

**Measurement:** V1 đo trust thông qua immediate perception: phụ huynh có rate cao không, có comment tích cực không, có share/screenshot không ngay sau lần xem đầu tiên.

### 2.2. Secondary Goal: Truyền tải Product Differentiation

**Câu hỏi:** Reasoning visibility có trở thành một "aha moment" để Sales/CSKH dùng khi demo, và là lý do phụ huynh giới thiệu Pika cho người khác không?

**Tại sao:** Pika cần một differentiator rõ ràng và dễ demo - điều mà competitor không có. "Xem AI nghĩ gì" là một demo moment mạnh, visual, và sharable. V1 là cơ hội sớm nhất để test xem moment này có work không trước khi invest thêm vào infrastructure.

### 2.3. Secondary Goal: Thu thập Structured Feedback về Reasoning Quality

**Câu hỏi:** Phụ huynh đang cảm thấy sao về cách Pika đưa ra hệ thống todolist và cấu trúc, nội dung các bài Learn + Talk?

**Tại sao:** Nếu không collect ngay từ V1, Phase 2 sẽ launch với reasoning quality chưa được validate → NPS thấp → phản tác dụng. Feedback loop phải bắt đầu từ prototype.

---

## 3. Users & Context

### 3.1. Primary User - Active Parents

**Tại sao là Active parents:** Đây là nhóm phù hợp nhất để validate perceived value vì họ đã có context về bé, đã thấy to-do list nhiều lần, và đủ để nhận ra sự cá nhân hoá khi được explain. Họ cũng là nhóm có khả năng cung cấp feedback chất lượng nhất.

**Tại sao không target churned parents ở V1:** Churned parents cần một hook mạnh hơn nhiều để reactivate. V1 chưa phải sản phẩm hoàn chỉnh, targeting churned parents với prototype là rủi ro cao, potential upside thấp.

### 3.2. Secondary User - Sales & CSKH

Mặc dù không phải primary user của V1, Sales và CSKH là một multiplier quan trọng: họ có thể dùng reasoning panel như một demo tool khi thuyết phục phụ huynh tiềm năng, hoặc khi giải thích giá trị của Pika cho phụ huynh đang xem xét renewal.

---

## 4. Solution Design

### 4.1. Cấu trúc Solution

V1 solution bao gồm một linear flow duy nhất, triggered từ to-do list:

1. **Trigger button trên To-do List:** "Xem cách Pika nghĩ ra to-do list này" nằm ngay trên danh sách to-do. Phụ huynh tap vào do tò mò.
2. **Agent Conversation Panel:** Hiển thị lần lượt các agents đang giao tiếp với nhau từ tổng quan đến chi tiết. Mỗi agent có avatar, tên, và tone riêng.
3. **To-do List with "Why":** To-do List hiện ra sau khi Agent Conversation kết thúc, lúc này có section "Lý do" trong mỗi To-do card.
4. **Feedback Panel:** Cuối To-do List, phụ huynh đánh giá đội ngũ Pika được mấy sao, chọn tag ("Hiểu bé", "Logic rõ ràng", "Cần điều chỉnh"…), và có thể để lại comment.

### 4.2. Agent Roles và Flow của Conversation

| Agent | Vai trò | Nói về điều gì | To-do item tương ứng |
|---|---|---|---|
| 🎯 **POPI** — Orchestrator | Điều phối tổng: mở đầu và kết nối các agent khác | Mục tiêu học của ngày + giai đoạn tình bạn của bé (Phase 1/2/3). VD: *"Hôm nay Kem đang ở Giai đoạn Bạn thân, tớ cần cả LIA và TOMO chú ý đặc biệt…"* | Toàn bộ to-do list (context chung) |
| 💬 **TOMO** — Talk Agent | Đề xuất cách mở đầu cuộc trò chuyện phù hợp với hôm nay | Opening logic theo ngày trong tuần / sự kiện đặc biệt. VD: *"Hôm nay thứ 2, tớ sẽ hỏi Kem đầu tuần thế nào - sau đó dẫn sang chủ đề học…"* | Activity: Opening / Greeting, Talk |
| 📚 **LIA** — Learn Agent | Quyết định nội dung học và ôn tập, explain dựa vào progress của bé | **Review:** "Sau opening, tớ sẽ hỏi lại bài động vật - từ 'monkey' - Kem học hôm qua nhưng mình chưa test lại." **Learn topic:** "Kem đang học dở cụm về thời tiết, hôm nay học tiếp để nói được câu 'It's sunny today'…" **Pronunciation:** "Hôm trước Pika để ý Kem hay nhầm âm /æ/ - hôm nay luyện thêm bài này…" | Activities: Review, Learn Unit, Pronunciation |
| 🎮 **MUN** — Game Agent | Propose game activity để reinforce bài học, giữ engagement | Chọn game phù hợp với chủ đề đang học. VD: *"Sau khi học xong từ mới, tớ cài một mini-game flashcard động vật - Kem thích kiểu này lắm!"* | Activity: Game / Mini-challenge |
| ✨ **BO** — Emotion Agent | Thêm context cảm xúc - tại sao hôm nay là một ngày học tốt với bé | Nhắc về memory cá nhân của bé để tạo motivation. VD: *"Kem hay nhắc đến chú chó nhà mình - hôm nay học vocabulary động vật là perfect timing!"* | Context cho toàn bộ session |

---

## 5. Logic Architecture Audit

### 5.1. Kiến trúc tổng quan

V1 backend xử lý theo 2 lớp nối tiếp:

1. **Logic Detector (deterministic):** Nhận todo JSON → phân tích heuristic để "đoán ngược" 5 lớp logic (friendship phase, ratio mode, memory profile, spaced repetition, content threading). Output là structured context object — không gọi LLM.
2. **LLM Layer (generative):** Nhận structured context → generate agent conversation với ngôn ngữ tự nhiên, cá tính agents, và reasoning cụ thể cho bé. Output là JSON agent conversation + todo reasoning annotations.

### 5.2. Output Schema - Cấu trúc AI trả về

```json
// AI OUTPUT SCHEMA
{
  "agent_conversation": [
    {
      "agent_id": "popi" | "lia" | "tomo" | "mun" | "bo",
      "agent_name": "tên hiển thị",
      "avatar": "emoji",
      "message": "nội dung — agents nói với nhau, không với phụ huynh",
      "highlights": [
        { "label": "<20 chars", "type": "metric" | "preference" | "info" }
      ],
      "addressed_to": "agent_id | 'all'"
    }
  ],
  "todo_reasoning": [
    {
      "item_order": 1,
      "item_name": "tên activity",
      "role": "GREETING" | "LEARN" | "TALK" | "REVIEW" | "GAME",
      "agent_responsible": "agent_id",
      "why_for_child": "câu giải thích",
      "personalization_tags": ["tag"],
      "duration_minutes": number
    }
  ]
}
```

---

## 6. Logic Gốc vs Backend Prototype vs Production Target

> ⚠️ **Context về Prototype:**
>
> Prototype backend (`logic_detector.py`) nhận input là **raw JSON todo list** - đây là output cuối cùng của hệ thống orchestration Pika. Lúc todo list đến tay prototype, mọi quyết định (phase nào, ratio mode nào, review từ nào) **đã được backend gốc của Pika quyết định rồi**. Prototype chỉ "đoán ngược" (reverse-engineer) các quyết định đó bằng heuristic, ***không truy cập trực tiếp vào nguồn dữ liệu thật*** (friendship score DB, user engagement history, spaced repetition scheduler).

### Layer 1: Friendship Phase Detection

| 📋 LOGIC GỐC (RP-Orchestration.md) | ⚠️ PROTOTYPE HIỆN TẠI | ✅ PRODUCTION CHUẨN |
|---|---|---|
| Phase tính bằng **engaged days** — ngày bé sử dụng ≥70% todo list: **Phase 1** (Stranger): < 7 engaged days / **Phase 2** (Friend): 7–14 engaged days / **Phase 3** (Best Friend): > 14 engaged days. Nguồn dữ liệu thật: Backend Pika có DB lưu `engaged_days_count` cho mỗi user. Orchestrator query DB này mỗi đầu ngày để chọn PHASE_TEMPLATE tương ứng. | Không có access vào `engaged_days` DB. Thay vào đó dùng 3 heuristic nối tiếp: **1. Tag suffix:** tìm `_p1/`, `_p2/`, `_p3` trong tag field → nếu có → phase xác định. Chỉ dùng khi tag có suffix này. **2. Bot ID hardcoded:** 6 ID onboarding cố định → Phase 1. Sẽ sai nếu onboarding bot IDs thay đổi. **3. Heuristic fallback:** có REVIEW + GAME → Phase 3. Đây là pattern matching thuần tuý — có REVIEW không nhất thiết là Phase 3. `engaged_days` trả về là **con số giả lập cố định** (2, 10, hoặc 25) — không phải dữ liệu thật. | Truy vấn trực tiếp Pika backend API hoặc DB: `GET /api/user/{id}/friendship-phase`. Trả về: `phase_number`, `engaged_days` thật, `phase_started_at`. Hoặc nhận từ todo list metadata (nếu orchestrator đính kèm phase info vào JSON output). **Không cần heuristic.** Phase là data có sẵn trong Pika system. |

### Layer 2: Ratio Mode Detection

| 📋 LOGIC GỐC (ratiomode.png) | ⚠️ PROTOTYPE HIỆN TẠI | ✅ PRODUCTION CHUẨN |
|---|---|---|
| Ratio Mode là cấu hình phụ huynh chọn, không phải hệ thống tự detect: **Cân bằng** (default): LEARN_SLOT + TALK_SLOT theo phase template / **Học nhiều** (Learn, heavy): 5 learn_slots, 0 talk_slots — override tất cả phases / **Nói nhiều** (Talk, heavy): 1 learn_slot, 4 talk_slots — override tất cả phases. Nguồn thật: Lưu trong user preference DB. Orchestrator đọc config này khi generate todo list. | Không biết user đã chọn mode nào. Đoán ngược bằng đếm số items: learn ≥ 4 AND talk ≤ 1 → LEARN_HEAVY / talk ≥ 3 AND learn ≤ 1 → TALK_HEAVY / còn lại → BALANCED. **Vấn đề:** Phase 3 template gốc có 3 Learn + 1 Talk + 1 Game → prototype detect = BALANCED. Nhưng thực tế đó là default template Phase 3, không phải user chọn cân bằng. Prototype không phân biệt được "user chọn BALANCED" và "hệ thống tự generate default". | Đọc trực tiếp user preference: `GET /api/user/{id}/learning-config`. Trả về: `ratio_mode` (user-selected), `is_default` (boolean). Dashboard sẽ hiển thị chính xác: "Bạn đã chọn chế độ Cân bằng" hoặc "Pika tự động chọn theo giai đoạn tình bạn". |

### Layer 3: Memory Profile Extraction

| 📋 LOGIC GỐC (greeting1.png) | ⚠️ PROTOTYPE HIỆN TẠI | ✅ PRODUCTION CHUẨN |
|---|---|---|
| Memory được lưu trong Pika Memory Service — structured DB riêng: Static memory (nhập liệu): tên, tuổi, sinh nhật / Dynamic memory (AI ghi nhớ): phim yêu thích, bạn bè, sở thích / Greeting prompt tổng hợp: Persona + Memory + Greeting Guide + Review Guide + Navigation Guide. Nguồn thật: Memory Service API trả về structured JSON theo categories. | **Không access Memory Service.** Dùng regex parsing trên raw `system_prompt`: Tìm block "You remember about user:" / Parse dòng theo pattern "Category: value". Đây là cách "dùng nhất có thể" trong constraint prototype vì memory thực sự có mặt trong system prompt. Nhưng phạm vi có thể thay đổi bất kỳ lúc nào / Không phân biệt được static vs dynamic memory / Không biết memory nào mới (tuần này) vs cũ (tháng trước). | Gọi Memory Service API: `GET /api/user/{id}/memory`. Trả về: `categories[]`, mỗi category có `source` (static/dynamic), `confidence`, `last_updated`. Dashboard sẽ hiện thị: "Pika nhớ 12 điều về bé, 3 điều mới học được tuần này". |

### Layer 4: Pronunciation Spaced Repetition

| 📋 LOGIC GỐC (pronouncereview.png) | ⚠️ PROTOTYPE HIỆN TẠI | ✅ PRODUCTION CHUẨN |
|---|---|---|
| **Luồng Bổ trợ cuối ngày (T+1):** Điều kiện: Có data từ lần sửa phát âm của ngày hôm trước / Chọn ngẫu nhiên tối đa 1–4 từ cần ôn / Số lượng: Tối đa 2 bài / Dữ liệu: Lấy 2 từ mới + 1 mẫu câu từ bài học ngày hôm trước. Nguồn thật: Spaced Repetition Scheduler query pronunciation log DB → trả về danh sách từ + `target_pattern` (âm vị cần luyện). | **Không access Spaced Repetition Scheduler.** Dùng 3 signals: 1. `category == "REVIEW"/"PRONOUNCE"` / 2. `tag == "review"/"pronounce"` / 3. Tên chứa "ôn tập". Sau đó extract từ trong `learn_data.words[]` inline hoặc fallback vào CSV DB. **Vấn đề nghiêm trọng:** Không biết từ nào thật sự cần ôn — chỉ biết từ nào có mặt trong bài review. Prototype có thể có warmup words lẫn vào / Không có `target_pattern` (âm vị mục tiêu) — nên AI prompt rules cần tự phán đoán âm /đầu/cuối/giữa / Không biết "T+1" là T nào — không truy vấn được lịch sử bé học gì. | Gọi Spaced Repetition API: `GET /api/user/{id}/review-schedule`. Trả về: `words_due[]` + `target_phoneme` + `last_practiced_at` + `accuracy_score`. Dashboard sẽ hiển thị: "Pika đến 'tờ board' (lần cuối hôm qua, độ chính xác: 70%) — tập trung vào âm cuối /d/ ơi". |

### Layer 5: Content Threading

| 📋 LOGIC GỐC (RP-Orchestration.md) | ⚠️ PROTOTYPE HIỆN TẠI | ✅ PRODUCTION CHUẨN |
|---|---|---|
| Orchestrator chọn Learn Units từ **learning roadmap** — một curriculum định trước: Mỗi ngày nhận list Learn Units sẽ học / Units cùng `mission_id` = cùng chủ đề / Thứ tự do curriculum engine quyết định (giới thiệu → luyện → ứng dụng). Nguồn thật: Curriculum Service trả về `mission_id`, `topic_name`, `position_in_sequence`. | Dùng `roadmap_activity_id` để tra cứu CSV database (639 activities): Match ID → lấy `mission_id`, `story`, `words` / Group by `mission_id` → tag content connections / Map `mission_id` → topic name qua MISSION_TOPIC_MAP (hardcoded). **Vấn đề:** MISSION_TOPIC_MAP chỉ cover ~25 mission IDs — curriculum thật có hàng trăm. Mission ID không có trong map → fallback "Chủ đề {id}" (xấu cho UX) / CSV database là snapshot tĩnh — không tự cập nhật khi curriculum mới. | Gọi Curriculum Service API: `GET /api/activity/{id}`. Trả về: `topic_name`, `position_in_sequence`, `total_in_sequence`, `learning_objective`. Không cần hardcoded map. Topic name đến từ source of truth. Dashboard hiển thị: "Bài 2/5 trong chuỗi Thời tiết". |

### Layer 6 (Bonus): Greeting Selection Logic *(chưa implement trong prototype)*

| Logic gốc — Greeting Opening Selection | Prototype — Chỉ detect "có greeting hay không" |
|---|---|
| **Chọn greeting theo ưu tiên:** 1. **Special Event:** birthday → `is_holiday → noel → mid_autumn → weekend → after_weekend` / 2. **Frequency:** a 3 ngày không dùng → `tag last_usage_3_days`; < 3 ngày → `tag used_yesterday` / 3. **Random Greeting:** fallback khi không có điều kiện đặc biệt. **Rule:** Không trùng lặp với 2 greetings gần nhất. **Data đầu vào:** Lấy 2 từ + 1 câu từ bài học hôm trước → fill vào `{{last_lesson_material}}`. | Prototype chỉ kiểm tra `category == "GREETING"` hoặc `"greeting"` in tag → gán role = GREETING. **Không biết:** Tại sao greeting này được chọn (special event? frequency?) / Greeting trước đó là gì (de-dupe logic) / `{{last_lesson_material}}` chứa gì — data ổn tập từ hôm qua. **Hệ quả:** AI prompt nhận Greeting item nhưng thiếu context tại sao greeting đó được chọn → AI chỉ mô tả chung chung "Pika mở đầu bằng trò chào âm ấp". |

---

## 7. User Flow - 4 Screens

### 7.1. Screen 1: To-do List — Preview (Locked)

- Preview danh sách bài: tên bài, type badge, duration - không có reasoning
- **Dynamic banner** phase tình bạn + ratio mode lấy real-time từ `/api/reasoning/layers`
- CTA: "🔮 Bật chế độ phân tích AI"

### 7.2. Screen 2: Loading - Đội ngũ đang phân tích

- Checklist animation 5 bước tick lần lượt + progress bar
- Tối thiểu **~2.5s animation** kể cả khi cache trả về nhanh hơn

### 7.3. Screen 3: Briefing Room - Cuộc họp nội bộ

- Giao diện **chat-style**: mỗi agent có avatar, tên, màu accent riêng
- Tin nhắn hiện lần lượt với typewriter effect (28ms/ký tự); auto-scroll; bold/highlight keywords
- Button *"Xem kế hoạch chi tiết →"* chỉ xuất hiện sau khi tất cả tin nhắn hiển thị xong

### 7.4. Screen 4: To-do Unlocked + Per-item Reasoning + Feedback

- **A) To-do list:** Expand item → 2–3 câu reasoning; cite dữ kiện cụ thể; 👍 / 👎 per-item
- **B) Inline Rating:** 1–5 sao + contextual tags + free-text comment + Submit

---

## 8. Success Metrics

| Metric | Target V1 | Cách đo |
|---|---|---|
| **Star Rating** | ≥ 4.0/5 | Feedback database |
| **Feedback Submit Rate** | ≥ 40% | (Số feedback / Số lần view Screen 3) × 100 |
| **Time on Reasoning** | ≤ 2 phút | Delta entering Screen 3 → leaving Screen 4 |
| **Item Expand Rate** | ≥ 60% | Số items click expand / tổng items |
| **Per-item Feedback Rate** | ≥ 30% | Số items có 👍/👎 / tổng items |

---

## 9. Feedback & Considerations

| Type | Description | Consideration | Final decision |
|---|---|---|---|
| **Feedback** | Luồng Agent Chat có thể bị dài với Second Time users. Core problem: Phụ huynh hiểu được reasoning để làm gì sau first impression về value của Pika? ⇒ feedback cho todo ⇒ How? Có thật không? | - Chạy sẵn AI convo để user không phải đợi. - Từ lần 2, có option hiện full Agent Chat (double tap) / auto hiện full Chat ngay lập tức, không cần hiện từ từ. **Core hypo cần test:** Phụ huynh đang có nhiều feedback về việc học của con họ nhưng do họ không có 1 structure để neo vào nên feedback đều generic. Ví dụ: Con học 1 chút là chán, con chơi nhiều không biết con có học được gì không, etc ⇒ lower hiệu quả improve product theo feedback phụ huynh của team. **H1:** Việc show reasoning sẽ khiến phụ huynh có sense/ độ hiểu nhất định về cách Pika lên giáo trình. **H2:** Nhờ vào sự hiểu đó + routine to-do reasoning 1 ngày/ lần, phụ huynh sẽ engage hơn vào việc đưa feedback để Pika improve chương trình học match con hơn. **H3:** Nhờ engagement tốt hơn + độ hiểu cao hơn, các feedback của phụ huynh sẽ specific hơn, giúp team improve product tốt hơn. | *(pending)* |
| **Feedback** | Content dài, đọc tốn cognitive load | - Test về văn phong, có thể concise hơn không? - Test với user thật: Record session để xem họ có thật sự đọc hết không? Nếu không là vì độ dài hay vì gì? | *(pending)* |
| **Consideration** | Giả thuyết: Việc Pika dùng memory của bé để generate content activity là data input vào prompt theo memory cứng ⇒ không sure outcome sẽ dùng memory nào trong các data input ⇒ logic hiện tại là tìm memory input trong prompt ⇒ đưa ra nhận định là Pika sẽ dựa vào memory A B C là **KHÔNG CHẮC CHẮN ĐÚNG** ⇒ bố mẹ đọc todo nghĩ con sẽ được hỏi về phim Doraemon, về nhà hỏi con thì con không được hỏi. | Confirm với anh @Hưng Phạm | **Đổi approach khai thác memory context:** Thay đổi tone nói từ "Con sẽ nói về sở thích X…" thành "Dựa vào trí nhớ của Pika, con thích X Y Z, Pika sẽ lựa chọn trong các chủ đề này để con học hứng thú và nhiệt tình" ⇒ sửa Prompt |
| **Consideration / Open question** | Các bài Learn: tóm tắt + cách các topic kết nối với nhau nên triển khai hiệu quả nhất bằng cách nào? **1. Theo chương trình học:** Các logic chương trình học là gì? Từ vựng, form thành câu, practice, etc. **2. Theo technical:** Data source, query thế nào, logic connect ra sao… | **Cách làm hiện tại:** Todolist có `learning_activity_id` match id sheet learning activities dev ([link spreadsheet](https://docs.google.com/spreadsheets/d/1dliigW-knVb5YmWJt_pp2Y54nG1QcRI33MwfuKNM8Zg/edit?gid=1560489791)). Lấy story + word, xâu chuỗi để ra được cách học: ví dụ các hoạt động đều liên quan đến topic weather trong 1 ngày, từ vựng - trò chơi để practice mà không nặng nề etc. **Input từ anh Long:** Approach hiện tại: Limitation là story có thể hơi generic + các word có thể bé không học 100% do nội dung tuỳ bài AI prompt sẽ select bất kì. Tuy nhiên, với output hiện tại, tiếp tục đi với approach này cho V1. **V2:** kết nối Learning 1 tuần sẽ có thể showcase nhiều nền tảng học thuật hơn ⇒ Lấy documents từ anh Long. | Tiếp tục đi với approach hiện tại cho V1 này |

---

## Appendix: System Prompt

```
"""Bạn là hệ thống đa agent của Pika. Nhiệm vụ: mô phỏng một cuộc họp nhóm ngắn giữa các agents để THẢO LUẬN và QUYẾT ĐỊNH lộ trình học hôm nay dựa trên dữ liệu đầu vào.

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

🧸 MUN (Psychology Agent — Chuyên gia tâm lý):
    Tính cách: Nhẹ nhàng, hay dùng ẩn dụ. "Bé cần...", "Hãy để ý...", "Điều này giúp...". Chậm rãi, sâu sắc. Chuyên về ký ức và tâm lý phát triển của trẻ.
    Vai trò: Kết nối sở thích, bộ phim, câu chuyện của bé vào hoạt động; giải thích tâm lý học của hoạt động.

🛡 BO (Safety Agent — Đại sứ an toàn):
    Tính cách: Ngắn gọn, dứt khoát, như bảo vệ chuyên nghiệp. "Đã kiểm tra.", "Cleared!", "Không vấn đề.". Chuyên về rà soát an toàn nội dung.
    Vai trò: Xác nhận nội dung và kịch bản an toàn tuyệt đối cho bé học tập.

═══ LUỒNG CUỘC HỘI THOẠI BẮT BUỘC (6-9 messages) ═══
Msg 1: POPI briefing tổng → nêu giai đoạn thân quen (friendship phase), số ngày đồng hành, và mục tiêu tổng quát của ngày.
Msg 2: LIA báo cáo kế hoạch GREETING + TALK/GAME → trích dẫn cụ thể các chiều ký ức (memory category) của bé.
Msg 3: TOMO phản hồi LIA → báo cáo về chuỗi bài học (topic), các từ vựng mới sẽ học hôm nay.
Msg 4: TOMO tiếp tục → nói về kế hoạch ôn tập (review) nếu có, trích dẫn rõ các từ vựng cũ cần ôn tập giãn cách hôm nay.
Msg 5: MUN bổ sung dưới góc độ tâm lý → kết nối sở thích cụ thể của bé (phim, nhạc...) vào hoạt động để giải thích cách giúp bé hứng thú.
Msg 6: BO xác nhận → trích dẫn các hoạt động/chủ đề cụ thể đã được kiểm duyệt an toàn.
Msg 7: POPI tổng kết → chốt tỷ lệ học/chơi hôm nay (balanced, learn heavy...), cấu trúc các bước, và phát lệnh triển khai lộ trình.

═══ QUY TẮC TUYỆT ĐỐI ═══
1. XƯNG HÔ THÂN THIỆN: Sử dụng tên cụ thể của bé nếu biết (lấy từ `child_profile.name` hoặc từ ký ức). Nếu không có tên thật (ví dụ chỉ có placeholder {{name}} hoặc chỉ nói chung chung) thì thành thật xưng hô là "bé". Tuyệt đối KHÔNG sử dụng các placeholder kỹ thuật như {{name}} hay tự bịa ra một cái tên ngẫu nhiên (ví dụ: An, Linh, v.v.).

2. KHÔNG SỬ DỤNG THUẬT NGỮ KỸ THUẬT KHÓ HIỂU (JARGON): Tuyệt đối không dùng các từ như "Spaced Repetition", "Content Threading", "Gamification", "Ratio Mode", "Friendship Phase" trong cả phần hội thoại và phần lý do cho phụ huynh. Thay vào đó, hãy diễn giải cực kỳ dân dã và dễ hiểu với phụ huynh Việt Nam:
    - "Spaced Repetition" -> "Ôn tập giãn cách / nhắc lại đúng lúc / đúng nhịp quên - nhớ để não bộ khắc sâu từ vựng"
    - "Content Threading" -> "Học theo chuỗi bài liên tiếp cùng chủ đề / bài học nối tiếp nhau như một câu chuyện"
    - "Gamification" -> "Học qua trò chơi / game đóng vai thú vị"
    - "Friendship Phase" -> "Mức độ thân quen giữa Pika và bé"

3. LÝ DO THỰC TẾ & CHÂN THỰC — CĂN CỨ THEO `data_confidence` CỦA TỪNG ITEM:
Mỗi item trong `session_flow` có field `data_confidence`. Độ chi tiết của `why_for_child` PHẢI tương ứng:

    a) `data_confidence = "rich"` → Có đủ `story` + `learn_mechanism`. Viết 2-3 câu sinh động, mô tả cụ thể kịch bản và cơ chế tương tác bé sẽ trải qua.

    b) `data_confidence = "words_only"` → Chỉ có danh sách từ (`words`) hoặc chủ đề (`topic`). Viết 1-2 câu, trích dẫn chính xác các từ/chủ đề đó. KHÔNG bịa thêm kịch bản hay cơ chế nào không có trong data.
        - REVIEW item: BẮT BUỘC liệt kê đúng các từ trong `words` (ví dụ: 'board', 'photos', 'clear').
        - PRONOUNCE item: Chỉ nêu từ cần luyện và mục tiêu phát âm rõ ràng hơn. KHÔNG tự phán âm nào (đầu/cuối/giữa) nếu không có `targeted_phoneme` trong data.

    c) `data_confidence = "greeting"` → Item chào hỏi mở đầu — ĐƯỢC PHÉP trích dẫn tối đa 1-2 điểm cụ thể từ `memory_profile` của bé (phim yêu thích, bài hát, trò chơi...) để cá nhân hóa lời chào. Viết 1-2 câu ấm áp, tự nhiên. Không bịa thêm gì ngoài memory đã có.

    d) `data_confidence = "minimal"` → Không có content data cụ thể. Viết 1 câu ngắn, KHÔNG highlight, dựa trên:
        - Vị trí item trong session (ví dụ: "đứng sau 2 bài học từ vựng" → "để bé thư giãn")
        - Role của item (TALK/GAME/LEARN) và tên hoạt động
        - Tuyệt đối KHÔNG tự kết nối memory của bé (sở thích phim, nhạc, v.v.) vào item nếu không có evidence trong `talk_block` hoặc `session_flow` của item đó

4. QUY TẮC CHỐNG HALLUCINATION TUYỆT ĐỐI:
    - CHỈ được trích dẫn sở thích của bé (phim, nhạc, đồ ăn, thú cưng...) trong `why_for_child` nếu item đó có `data_confidence = "rich"` hoặc nếu sở thích đó xuất hiện trực tiếp trong `talk_block` của item tương ứng.
    - Đối với GAME item: KHÔNG được tự nối tên bài hát/phim vào game nếu `talk_block` của game đó không nhắc đến.
    - REVIEW: Chỉ nhắc đúng số từ và tên từ trong `words`. Không thêm từ không có trong list.
    - PRONOUNCE: Chỉ nhắc từ trong `words`. Không tự đặt ra âm vị (âm đầu/âm cuối) nếu không có data.
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
"""
```
