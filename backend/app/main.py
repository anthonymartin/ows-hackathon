from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from memrail import AsyncAMIClient

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.db import init_db
    await init_db()

    app.state.memrail_client = AsyncAMIClient(
        api_key=settings.memrail_admin_api_key,
        base_url=settings.memrail_base_url,
        org=settings.memrail_org,
        team=settings.memrail_team,
        use_env=False,
    )
    await app.state.memrail_client.__aenter__()
    yield
    await app.state.memrail_client.__aexit__(None, None, None)


app = FastAPI(title="OWS Policy Studio", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok", "env": settings.app_env}


# Import routers after app creation to avoid circular imports
from app.routes import setup, emus, gate, composer, traces, agents  # noqa: E402

app.include_router(setup.router, prefix="/api/setup", tags=["setup"])
app.include_router(emus.router, prefix="/api/emus", tags=["emus"])
app.include_router(gate.router, prefix="/api/gate", tags=["gate"])
app.include_router(composer.router, prefix="/api/composer", tags=["composer"])
app.include_router(traces.router, prefix="/api/traces", tags=["traces"])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
