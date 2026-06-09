# Hướng Dẫn Triển Khai Hệ Thống (Production Deployment Guide)

Tài liệu này hướng dẫn chi tiết cách cấu hình và triển khai hệ thống lên môi trường production:
*   **Database (PostgreSQL)**: Railway
*   **Backend (FastAPI)**: Railway
*   **Frontend (Next.js)**: Vercel
*   **Event Tracking & Analytics**: PostHog

---

## 1. Tổng Quan Kiến Trúc Kết Nối

```mermaid
graph TD
    User([Người dùng]) -->|Truy cập| FE[Frontend - Next.js trên Vercel]
    FE -->|API Requests| BE[Backend - FastAPI trên Railway]
    BE -->|Query / Insert| DB[(Database - PostgreSQL trên Railway)]
    FE -->|Track Events / Replay| PH[PostHog Cloud]
    BE -->|Track LLM Costs / Events| PH
```

---

## 2. Chuẩn Bị Tài Khoản & Cài Đặt PostHog

Hệ thống sử dụng **PostHog** cho cả frontend (để ghi lại hành vi click, scroll, session replay) và backend (để theo dõi số lượng token tiêu thụ, chi phí cuộc gọi LLM).

### Bước 1: Tạo tài khoản & dự án
1.  Truy cập [PostHog Cloud](https://app.posthog.com/) (chọn US hoặc EU Cloud).
2.  Đăng ký tài khoản và tạo một **Project** mới (ví dụ: `Pika AI Parenting`).

### Bước 2: Lấy thông tin kết nối
1.  Vào phần **Project Settings** (biểu tượng bánh răng ở góc dưới bên trái).
2.  Copy các thông số sau:
    *   **Project API Key** (thường có tiền tố `phc_...`).
    *   **API Host** (ví dụ: `https://us.i.posthog.com` hoặc `https://eu.i.posthog.com`).

### Bước 3: Cấu hình Recording & Session Replays
*   Trong mục **Settings** -> **Web Analytics**, đảm bảo tính năng **Record user sessions** được kích hoạt (để xem được replay thao tác chuột và cuộn trang của cha mẹ).

---

## 3. Cài Đặt PostgreSQL và Backend FastAPI trên Railway

Railway là nền tảng phù hợp nhất để chạy backend Python FastAPI và PostgreSQL nhờ khả năng liên kết dịch vụ (Service Linkage) cực kỳ nhanh gọn.

### Bước 1: Tạo Project trên Railway
1.  Đăng nhập vào [Railway.app](https://railway.app/).
2.  Chọn **New Project** -> **Deploy from GitHub repo** -> Chọn repository chứa code của bạn.

### Bước 2: Thêm PostgreSQL Database
1.  Trong giao diện Project Railway vừa tạo, nhấn nút **+ New** (hoặc nhấn chuột phải vào khoảng trống).
2.  Chọn **Database** -> **Add PostgreSQL**.
3.  Railway sẽ khởi tạo một database PostgreSQL trống và tự động cấu hình các biến môi trường kết nối.

### Bước 3: Thêm & Cấu hình dịch vụ Backend
1.  Nhấn **+ New** -> Chọn **Github Repo** -> Chọn repo của bạn.
2.  Sau khi service được tạo, bấm vào service đó và chọn tab **Settings**:
    *   **Root Directory**: Đặt là `/backend` (để Railway biết chỉ build và deploy thư mục backend).
    *   **Start Command**: Nhập lệnh khởi chạy production:
        ```bash
        uvicorn app.main:app --host 0.0.0.0 --port $PORT
        ```
3.  Vào tab **Variables** để nhập cấu hình môi trường:
    *   Liên kết với PostgreSQL: Nhấn **New Variable** -> Chọn **Reference Value** -> Chọn biến `DATABASE_URL` từ dịch vụ PostgreSQL của bạn. Railway sẽ tự động map đường dẫn dạng `postgresql://user:password@host:port/database` vào backend.
    *   Thêm các biến cấu hình cần thiết:
        | Tên Biến | Giá trị ví dụ | Mô tả |
        | :--- | :--- | :--- |
        | `OPENAI_API_KEY` | `sk-proj-xxxx...` | OpenAI API Key dùng cho planner |
        | `OPENAI_MODEL` | `gpt-4o` | Model chính để phân tích |
        | `OPENAI_MODEL_MINI` | `gpt-4o-mini` | Model phụ để đúc kết tối ưu chi phí |
        | `POSTHOG_PROJECT_TOKEN` | `phc_xnMNcnqreAfBC4...` | Token dự án PostHog của bạn |
        | `POSTHOG_HOST` | `https://us.i.posthog.com` | API Host của PostHog |
        | `CORS_ORIGINS` | `https://your-app.vercel.app` | URL Frontend trên Vercel (hoặc `*` nếu muốn dev) |

4.  Vào tab **Settings** -> Tìm mục **Networking** -> Nhấn **Generate Domain** để lấy URL API Public của Backend (ví dụ: `https://backend-production-xxxx.up.railway.app`).

### 💡 Tự động tạo bảng (Database Auto-initialization)
> [!NOTE]
> Mã nguồn backend đã được tích hợp bộ adapter PostgreSQL tự động. Khi dịch vụ FastAPI trên Railway khởi chạy, nó sẽ tự động chạy hàm `init_db()` để tạo các bảng `eval_sessions`, `plan_feedback` và `reasoning_cache` trên cơ sở dữ liệu PostgreSQL nếu chúng chưa tồn tại. Bạn không cần chạy các câu lệnh SQL khởi tạo thủ công.

---

## 4. Triển Khai Frontend Next.js trên Vercel

Vercel là nền tảng tối ưu và miễn phí cho ứng dụng Next.js.

### Bước 1: Liên kết Repository lên Vercel
1.  Truy cập [Vercel.com](https://vercel.com/) và đăng nhập.
2.  Chọn **Add New** -> **Project** -> Import repository GitHub của bạn.

### Bước 2: Cấu hình Dự Án
1.  **Framework Preset**: Chọn **Next.js**.
2.  **Root Directory**: Click *Edit* và chọn thư mục `frontend`.
3.  **Build & Development Settings**: Giữ nguyên mặc định (Vercel tự động nhận diện `npm run build`).

### Bước 3: Cấu hình Biến Môi Trường (Environment Variables)
Mở mục **Environment Variables** và nhập các biến sau:

| Tên Biến | Giá trị ví dụ | Mô tả |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://backend-production-xxxx.up.railway.app` | **URL API của Backend trên Railway** |
| `NEXT_PUBLIC_POSTHOG_KEY` | `phc_xnMNcnqreAfBC4...` | Token dự án PostHog |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` | API Host của PostHog |
| `NEXT_PUBLIC_ROBOT_API_URL` | `https://robot-api.stepup.edu.vn/robot-user` | API hệ thống robot |
| `NEXT_PUBLIC_ROBOT_CORE_API_URL`| `https://robot-api.stepup.edu.vn/robot` | Core API robot học tập |
| `MEM0_BASE_URL` | `https://mem0.hacknao.edu.vn` | Địa chỉ dịch vụ Mem0 |

Nhấn **Deploy**. Sau khi hoàn tất, Vercel sẽ cung cấp domain public cho Frontend (ví dụ: `https://pika-parenting.vercel.app`).

---

## 5. Script Di Chuyển Dữ Liệu (SQLite sang PostgreSQL)

Nếu bạn đã chạy thử nghiệm cục bộ và muốn chuyển toàn bộ dữ liệu đánh giá và feedback (`pika.db`) lên database PostgreSQL mới trên Railway, hãy sử dụng script Python dưới đây.

Tạo file `migrate.py` trong thư mục `backend` và chạy cục bộ:

```python
import sqlite3
import psycopg2
import json
import os
from dotenv import load_dotenv

# Tải file .env để lấy cấu hình kết nối postgres
load_dotenv()

SQLITE_DB = "pika.db"
# Thay bằng chuỗi kết nối PostgreSQL lấy từ tab Variables/Connect của Railway
POSTGRES_URL = os.getenv("DATABASE_URL") 

if not POSTGRES_URL:
    print("❌ Lỗi: Chưa cấu hình biến môi trường DATABASE_URL!")
    exit(1)

def migrate():
    print("🔄 Bắt đầu kết nối CSDL...")
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cur = sqlite_conn.cursor()

    pg_conn = psycopg2.connect(POSTGRES_URL)
    pg_cur = pg_conn.cursor()

    # 1. Migrate bảng eval_sessions
    print("📦 Đang di chuyển dữ liệu eval_sessions...")
    sqlite_cur.execute("SELECT * FROM eval_sessions")
    sessions = sqlite_cur.fetchall()
    
    migrated_sessions = 0
    for s in sessions:
        pg_cur.execute("""
            INSERT INTO eval_sessions (id, created_at, updated_at, phone, profile_id, profile_name, current_step, data, totals)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                updated_at = EXCLUDED.updated_at,
                current_step = EXCLUDED.current_step,
                data = EXCLUDED.data,
                totals = EXCLUDED.totals
        """, (
            s["id"], s["created_at"], s["updated_at"], s["phone"], 
            s["profile_id"], s["profile_name"], s["current_step"], 
            s["data"], s["totals"]
        ))
        migrated_sessions += 1
    
    # 2. Migrate bảng plan_feedback
    print("📦 Đang di chuyển dữ liệu plan_feedback...")
    sqlite_cur.execute("SELECT * FROM plan_feedback")
    feedbacks = sqlite_cur.fetchall()
    
    migrated_feedbacks = 0
    for f in feedbacks:
        pg_cur.execute("""
            INSERT INTO plan_feedback (id, dataset, week_label, star_rating, tags, comment, item_feedback, submitted_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (dataset, week_label) DO UPDATE SET
                star_rating = EXCLUDED.star_rating,
                tags = EXCLUDED.tags,
                comment = EXCLUDED.comment,
                item_feedback = EXCLUDED.item_feedback,
                submitted_at = EXCLUDED.submitted_at
        """, (
            f["id"], f["dataset"], f["week_label"], f["star_rating"], 
            f["tags"], f["comment"], f["item_feedback"], f["submitted_at"]
        ))
        migrated_feedbacks += 1

    pg_conn.commit()
    
    sqlite_conn.close()
    pg_conn.close()
    
    print(f"✅ Đã di chuyển thành công {migrated_sessions} sessions và {migrated_feedbacks} feedback mục tiêu lên PostgreSQL!")

if __name__ == "__main__":
    migrate()
```

Chạy script trên máy cá nhân:
```bash
cd backend
python migrate.py
```

---

## 6. Giám Sát & Vận Hành (Monitoring & Auditing)

Sau khi hệ thống online, bạn có ba công cụ chính để theo dõi:

### 1. Xem nhật ký hoạt động trên PostHog Cloud
*   **Session Replays**: Vào mục **Session Replays** trong PostHog để xem trực tiếp video ghi màn hình cha mẹ click chọn hoạt động tuần, thả tim hoặc mở các cụm ký ức. Điều này giúp phát hiện nhanh các lỗi tràn chữ hoặc giao diện khó dùng.
*   **Events Explorer**: Theo dõi sự kiện `eval_session_created` và `plan_feedback_submitted`. Bạn có thể thiết lập biểu đồ (Dashboard) để đếm tỷ lệ hài lòng trung bình (star rating) của cha mẹ từ các tag feedback.

### 2. Xem log ứng dụng trên Railway
*   Vào dashboard dự án Railway -> Click vào service Backend -> Tab **Deployments** -> Chọn bản deploy mới nhất để xem log thời gian thực của FastAPI (Uvicorn).
*   Kiểm tra các dòng log in ra từ LLM API hoặc lỗi kết nối database để xử lý kịp thời.

### 3. Quản trị qua Frontend Admin Dashboard
*   Truy cập đường dẫn `/admin` của frontend (ví dụ: `https://your-app.vercel.app/admin`).
*   Tại đây bạn sẽ thấy danh sách tất cả các lượt chạy đánh giá (Eval Sessions), trạng thái hoàn thành (`completed` / `loading_profile`...), số lượng token tiêu thụ và tổng chi phí ước tính bằng USD của từng phiên.
