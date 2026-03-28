import logging
import sys

from pathlib import Path
from dotenv import load_dotenv

import uvicorn
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.database import init_db
from api.router import router

# ── Environment ───────────────────────────────────────────

_ = load_dotenv(Path(__file__).resolve().parent.parent / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    stream=sys.stdout,
)

# ── FastAPI App ───────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Agent Chat API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


# ── CLI entry point (preserved) ──────────────────────────

if __name__ == "__main__":
    if "--cli" in sys.argv:
        from agent.agent import run_agent
        run_agent(task="What is an LLM. Give me a quick sentence")
    else:
        uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
