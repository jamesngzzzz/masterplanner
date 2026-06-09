# Hệ thống Master Planning

**Feature name:** Master Planning System

**Artifact type:** Project Brief

**Archetype:** D — System

**Status:** Reviewed v1.0

**Author:** Trang Nguyen Thu

**Date:** 2026-05-20

**Audience:** Cross-team (PM/PO · Tech Lead/Engineering · MKT/Sales/CSKH)

---

## 1. Problem Statement

### 1.1 Problem Table

| Problem | Severity | In/Out |
|---------|----------|--------|
| Logic lên kế hoạch của Pika chưa được articulate rõ — phụ huynh không thấy "Pika plan cho con thế nào" | High | IN |
| Value proposition (Learn + Buddy Talk + đa mục tiêu) chưa communicate xuyên suốt MKT → Sales → Product | High | IN |
| Phụ huynh thiếu visibility vào việc Pika hiểu con và plan → không build trust → stickiness thấp | High | IN |
| Đa mục tiêu sắp launch mà chưa có planning foundation → messaging sẽ fragmented thêm | High | IN |
| Phụ huynh churned vì không thấy value rõ ràng | Medium | IN |
| Parent goals không phù hợp / biết quá nhiều memory → trải nghiệm trẻ xấu đi | Medium | Guardrail |

### 1.2 Root Cause

Pika chưa có planning layer visible cho phụ huynh — toàn bộ logic cá nhân hoá diễn ra "behind the scenes." Phụ huynh không có mental model về cách Pika hoạt động → không biết đánh giá giá trị → MKT/Sales/CSKH thiếu anchor cụ thể để communicate → value proposition rời rạc theo cách hiểu của từng team.

### 1.3 Signal Table

| Tín hiệu | Type | Source |
|----------|------|--------|
| Các chỉ số gắn kết của phụ huynh với app tăng: DAU/MAU = 14.1%; DAU/WAU = 27.7%; WAU/MAU = 51.1% | FACT | Internal analytics, May 2026 |
| Phụ huynh chụp màn hình plan/insight đẹp, share lên nhóm phụ huynh | FACT | Qualitative observation |
| Sales demo offline: positive feedback khi thấy planning logic của Pika | FACT | Sales team |
| CSKH ghi nhận feedback tích cực khi giải thích planning logic cho phụ huynh | FACT | CSKH team |
| Phụ huynh churned quay lại khi có visibility rõ hơn vào plan | FACT | Behavioral observation |
| Phụ huynh sẽ engage regularly với planning UI nếu được build | ASSUMPTION | Chưa validated |
| Planning visibility sẽ tăng renewal rate | INFERENCE | Dựa trên engagement pattern hiện tại |

---

## 2. User & Context

### 2.1 Primary User

Phụ huynh có con dùng Pika — đang hoặc từng đăng ký. Đầu tư vào việc con học tiếng Anh nhưng thiếu visibility vào tiến trình và kế hoạch → dễ churn khi không thấy rõ giá trị nhận được.

### 2.2 Sub-segments

| Segment | Đặc điểm | Pain point chính |
|---------|----------|-----------------|
| New parents (onboarding) | Chưa biết Pika lên plan thế nào | Không biết set goal phù hợp cho con |
| Active parents | Dùng app thường xuyên | Muốn thấy tiến trình và plan rõ hơn |
| Churned parents | Lâu không dùng | Không thấy value, quên Pika tồn tại |
| Internal (MKT/Sales/CSKH) | Secondary user | Thiếu anchor cụ thể để communicate value |

### 2.3 Behavioral Insight

Phụ huynh có "screenshot reflex" — khi thấy điều gì đó personalized và đáng tự hào về con, họ chụp và share. Đây là WOM signal mạnh nếu planning UI tạo được những moments rõ ràng ("Pika hiểu con tôi đến mức này").

### 2.4 Context of Use

Chủ yếu qua Parent App — on-demand, bất kỳ lúc nào phụ huynh muốn check plan/progress. Trigger: sau khi con học, trước khi lên plan tuần mới, khi Sales/CSKH demo cho khách hàng tiềm năng.

---

## 3. Goal & Metrics

### 3.1 Outcome Goal

Phụ huynh hiểu được cách Pika lên kế hoạch cho con và thấy rõ giá trị nhận được → tăng trust → tăng stickiness, plan approval rate, và renewal.

### 3.2 Metric Framework

| Metric | Baseline | Target | Timeframe |
|--------|----------|--------|-----------|
| Parent DAU/MAU | 14.1% | 20%+ | 1 tháng post-launch |
| Parent WAU/MAU | 51.1% | 60%+ | 1 tháng post-launch |
| Plan NPS (đo sau mỗi weekly dashboard interval) | Chưa đo | Ngang top-tier EdTech products | 3 tháng post-launch |
| "Screenshot moment" proxy: số bài đăng liên quan trên group phụ huynh | Chưa đo | Establish baseline trong 1 tháng sau launch | 1 tháng post-launch |
| Sales demo positive signal | Qualitative | Quantify conversion lift | 1 tháng post-launch |

### 3.3 Guardrail Metrics

| Guardrail | Lý do bắt buộc |
|-----------|---------------|
| Child engagement rate không giảm | Parent goals không phù hợp → plan sai → con không muốn học |
| Child session depth không giảm | Parent biết quá nhiều memory → con không còn cởi mở với Pika |
| Memory accuracy score không giảm | Parent edit quá nhiều theo bias → cá nhân hoá kém đi |

---

## 4. Solution Direction

### 4.1 Approach

Xây dựng **Parent Planning & Visibility Layer** — hệ thống interface cho phép phụ huynh:

- (1) input goals
- (2) xem plan Pika generate
- (3) approve/điều chỉnh plan
- (4) theo dõi daily/weekly dashboard
- (5) manage memory và preferences

**MLP:**

- ~~(1) input goals~~
- (2) xem plan Pika generate
- (3) ~~approve/điều chỉnh plan~~ thu thập feedback về plan làm input phân tích các nhu cầu điều chỉnh / dùng các config đã có (tỉ lệ Learn / Talk)
- (4) theo dõi daily/weekly dashboard
- (5) manage memory và preferences

### 4.2 Why Not Alternatives

| Alternative | Lý do không chọn |
|-------------|-----------------|
| Chỉ cải thiện MKT messaging | Không giải quyết product gap — phụ huynh vào app vẫn không thấy value |
| Build đầy đủ 3-phase flow ngay | Scope quá lớn, risk cao; MVP on-demand đã đủ để validate |
| Tích hợp vào child app | Wrong surface — planning là parent concern, không phải child |
| Weekly email digest thay UI | Không tạo được habit quay lại app; thiếu interactivity |

### 4.3 Core Mechanism

**Input:** Parent goals + Child profile + Conversation data (memory từ sessions của con)

**Process:** AI/ML generate personalized plan → Parent review/approve → Plan thành weekly todo list → Child executes → Data logged → Dashboard aggregated → Parent rates/edits memory → Feeds back vào plan cycle

**Output:** Dashboard (daily/weekly) + Memory editor + Plan visibility + Feedback loop cho system

### 4.4 Components Table

| Component | Team chính | MVP hay Defer |
|-----------|-----------|---------------|
| Planner interface (goal input, plan view, approval) | App PH + AI/ML + Backend | MVP |
| Daily & Weekly dashboard | App PH + Backend | MVP |
| Memory management (view + selective edit theo định nghĩa expose types) | App PH + Backend | MVP |
| On-demand: preferences config, cumulative stats | App PH + Backend | MVP |
| Phase 1–3 flow integration (onboarding wizard, daily loop, weekly replanning) | All teams | Defer — Phase 2 |
| MKT automation trigger từ plan data | MKT + Backend | Defer — Phase 2 |

### 4.5 Memory Exposure Definition

Phụ huynh được xem và tương tác với các loại memory sau — không phải raw log:

| Memory type | Expose | Ghi chú |
|-------------|--------|---------|
| Nhận định về tính cách của con | ✅ View | Read-only hoặc có thể flag |
| Tóm tắt loại hoạt động con yêu thích | ✅ View | Aggregate, không phải log từng session |
| Cluster chủ đề con yêu thích (kèm entity cụ thể) | ✅ View | Vd: "Animals > Dogs, Dinosaurs" |
| Events Pika cần/nên follow-up với con | ✅ View + Input | Parent có thể confirm/cập nhật |
| Mối quan hệ xung quanh con | ✅ View + Input | Vd: tên bạn bè, anh chị em |
| Conflict memory cần parent clarify | ✅ View + Input | Pika flag, parent resolve |
| Raw log từng memory event | ❌ Không expose | Bảo vệ child's sense of privacy với Pika |

### 4.6 UX Concern

Hai nguy cơ UX cần design address từ đầu:

1. Phụ huynh không có thời gian đọc plan dài → UI phải scan-optimized, dạng highlights không dạng report.
2. Phụ huynh đánh giá plan quá nghiêm ngặt → cần set expectation rõ trong UI ("đây là AI suggestion, bạn có thể điều chỉnh").
3. Memory editor cần tuân theo exposure definition ở Section 4.5 — không expose raw logs.

---

## 5. Scope

### 5.1 In Scope (MVP)

Planner interface (goal input + plan view + approval), Daily & Weekly dashboard, Memory management (view + selective edit), On-demand preferences config, Cumulative stats view.

### 5.2 Out of Scope (Defer Phase 2+)

Phase-integrated flows (onboarding planning wizard, daily check-in loop, weekly replanning loop), MKT/Sales automation triggered by plan data, Robot-side integration, Multi-child/sibling planning.

---

## 6. Risks & Assumptions

| Risk/Assumption | Type | Severity | Consequence nếu sai | Mitigation |
|----------------|------|----------|---------------------|------------|
| Phụ huynh không có thời gian xem plan/dashboard | Risk | High | Stickiness không tăng dù feature built | Scan-optimized UI; measure time-on-page sớm |
| Phụ huynh đánh giá plan quá nghiêm ngặt → thất vọng | Risk | High | Phản tác dụng — churn tăng | Set expectation trong UI; allow easy edit; alpha test trước |
| Phụ huynh sẽ engage regularly với on-demand planning UI | Assumption | High | Feature không được dùng → wasted | Validate bằng parent DAU/MAU sau 8 tuần |
| Child experience không bị ảnh hưởng bởi parent goals | Assumption | High | Core value erosion — con không cởi mở | Memory exposure definition (Section 4.5); AI filter goals trước khi plan |
| AI/ML có thể generate plan đủ chất lượng để parent approve | Assumption | Medium | NPS thấp → mất tin | Alpha với cohort active users (không dùng new users — họ đang làm quen, chưa đánh giá value được); fallback template plan |
| Phụ huynh không share nội dung memory/personalization vì privacy con | Risk | Medium | "Screenshot moment" metric bị undercount — WOM thấp hơn thực tế | Tách biệt: WOM về plan/progress (shareable) vs memory content (private); đo riêng hai loại |
| 3 teams (AI/ML, App PH, Backend) deliver đồng bộ | Risk | Medium | Integration delay, miss multi-goal window | Decouple MVP: on-demand first, không cần phase sync |

---

## 7. Tech & Resource Reality

### 7.1 Tech Stack Touched

Parent App (UI layer) · Backend (data aggregation, plan storage, memory CRUD, stats) · AI/ML (plan generation engine, memory processing, personalization)

### 7.2 Cross-team Effort

| Team | Effort level | Deliverable chính |
|------|-------------|-------------------|
| App phụ huynh | High | Planner UI, Dashboard, Memory editor, On-demand screens |
| Backend | High | API plan, dashboard data, memory CRUD, stats aggregation |
| AI/ML | High | Plan generation engine, memory processing |
| Child app | Low (dependency) | Data logging từ child sessions |
| Robot | None (MVP) | Defer |
| MKT | None (MVP) | Phase 2 integration |

---

## 8. Prior Art & Precedent

### 8.1 Hiện trạng Pika

Learn cung cấp learning path nhưng không visible to parents. Buddy Talk conversation-based, không có planning layer. Chưa có parent-facing planning UI — đây là first-time build.

### 8.2 Competitor & Inspiration

Duolingo for Schools: parent/teacher dashboard với progress tracking. Khan Academy: detailed parent activity reports. Lingokids: weekly progress email. Gap chung của competitors: reporting-only, không có interactive planning layer như Pika hướng tới.

### 8.3 First-time Check

✅ Feature mới hoàn toàn — không có version trước. Risk: phải validate UX patterns từ đầu; không có internal baseline để compare.

---

## 9. Open Questions

Tất cả open questions đã được resolve — xem open-questions.md để biết chi tiết từng quyết định.

| Câu hỏi | Status | Quyết định |
|---------|--------|-----------|
| Alpha cohort | ✅ Resolved | Active users — đánh giá value tốt nhất |
| Memory exposure level | ✅ Resolved | Xem Section 4.5 — 6 loại expose, raw log không expose |
| Plan quality threshold | ✅ Resolved | Đo bằng NPS sau weekly dashboard interval; target ngang top-tier |
| "Screenshot moment" đo thế nào | ✅ Resolved | Social listening trên group phụ huynh (1 tháng post-launch) |
| UX copy expectation | ✅ Deferred | Không cần thiết ở stage này |
| Churned parent segment | ✅ Deferred | Không cần quan tâm ở MVP |
| Phase 2 trigger | ✅ Resolved | Sau MVP validation (DAU/MAU + NPS signal) |

---

## Appendix D: Failure Mode Enumeration (System Archetype)

| Failure Mode | Trigger | Impact | Detection signal | Mitigation |
|-------------|---------|--------|-----------------|------------|
| Plan generation quality thấp | AI/ML thiếu data từ child sessions | Parent không approve → feature disused | Approval rate < 50% | Alpha với cohort con dùng lâu; fallback template plan |
| Memory exposure gây friction cho con | Parent "correct" memory quá nhiều | Con cảm thấy bị theo dõi → ít chia sẻ | Drop in child session depth | Access control; limit editable memory fields |
| Parent goals không phù hợp với child level | Parent set goal quá cao/thấp | Plan sai → con không engage | Child completion rate drop | AI filter goals; suggest calibrated goals |
| Dashboard zero engagement | Parent không có thời gian / không thấy notif | Feature vô dụng sau launch | Parent DAU/MAU không tăng sau 8 tuần | Push notification strategy; scan-optimized UI |
| 3-team integration delay | Coordination issue AI/ML–App–Backend | Delay launch, miss multi-goal window | Sprint velocity drop | Decouple: on-demand surfaces first |

---

*Reviewed v1.1 — Open questions resolved · Approved by: Trang Nguyen Thu · 2026-05-20*

*Sources: User Stickiness chart (internal analytics, May 2026); Master Planner System Design PDF (Trang Nguyen Thu, internal); Qualitative signals từ Sales & CSKH feedback.*
