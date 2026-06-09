"""
Pika Master Planning Backend
Unified backend for the Pika prototype, combining:
  - AI Pipeline: analyze_memory → weekly_plan (with LEARN injection) → replan
  - Reasoning Engine: logic_detector → 5-agent LLM reasoning → todo items
  - Session Management: profile login, dataset routing

Runs on port 8001 (independent from the reference dailytodo backend on 8000).
"""
import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

from app.api.routes.analyze_memory import router as analyze_router
from app.api.routes.weekly_plan import router as weekly_plan_router
from app.api.routes.reasoning import router as reasoning_router
from app.api.routes.planner_memory import router as planner_memory_router
from app.api.routes.schedule_config import router as schedule_config_router
from app.api.routes.eval_sessions import router as eval_sessions_router
from app.api.routes.data_import import router as data_import_router
from app.core.db import init_db

from contextlib import asynccontextmanager

from app.core.posthog_client import init_posthog, shutdown_posthog

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_posthog()
    init_db()
    yield
    shutdown_posthog()

app = FastAPI(
    title="Pika Master Planning Backend",
    description="Unified AI pipeline + reasoning engine for parent planning prototype",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
cors_origins_raw = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
cors_origins = [o.strip() for o in cors_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(eval_sessions_router, prefix="/api")
app.include_router(analyze_router)
app.include_router(weekly_plan_router)
app.include_router(reasoning_router)
app.include_router(planner_memory_router)
app.include_router(schedule_config_router)
app.include_router(data_import_router)


@app.get("/")
async def root():
    return {
        "service": "Pika Master Planning Backend",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "analyze_memory": "POST /api/analyze/memory",
            "weekly_plan": "POST /api/generate/weekly-plan",
            "reasoning_generate": "POST /api/reasoning/generate",
            "reasoning_layers": "GET /api/reasoning/layers?dataset=<name>",
            "reasoning_todo": "GET /api/reasoning/todo?dataset=<name>",
            "planner_memory": "GET /api/planner/memory?dataset=<name>",
            "planner_memory_process": "POST /api/planner/memory/process?dataset=<name>",
            "login": "POST /api/sessions/login",
            "health": "GET /api/health",
        },
    }
