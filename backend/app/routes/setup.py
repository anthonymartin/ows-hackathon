import logging

from fastapi import APIRouter, Depends, HTTPException, Response

from app.config import settings
from app.db import get_db
from app.dependencies import get_memrail_proxy, get_session
from app.gate.starter_pack import STARTER_EMUS
from app.services.memrail_proxy import MemrailProxy
from app.services.session_service import SessionService
from memrail.errors import AMIConflict
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()


class BootstrapRequest(BaseModel):
    org: str = "ows"
    project: str = "default"


class BootstrapResponse(BaseModel):
    org: str
    team: str
    workspace: str
    project: str
    emus_registered: int
    message: str
    integration_key: str | None = None
    integration_key_id: str | None = None


async def _store_integration_key(key_id: str, secret: str) -> None:
    """Store integration key in the integration_config table."""
    db = await get_db()
    await db.execute(
        "INSERT OR REPLACE INTO integration_config (key, value, updated_at) VALUES ('integration_api_key', ?, datetime('now'))",
        (secret,),
    )
    await db.execute(
        "INSERT OR REPLACE INTO integration_config (key, value, updated_at) VALUES ('integration_key_id', ?, datetime('now'))",
        (key_id,),
    )
    await db.commit()


async def _load_integration_key() -> tuple[str | None, str | None]:
    """Load integration key from DB. Returns (key_id, secret)."""
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT key, value FROM integration_config WHERE key IN ('integration_api_key', 'integration_key_id')"
    )
    result = {r["key"]: r["value"] for r in rows}
    return result.get("integration_key_id"), result.get("integration_api_key")


@router.post("/bootstrap", response_model=BootstrapResponse)
async def bootstrap(
    req: BootstrapRequest,
    response: Response,
    proxy: MemrailProxy = Depends(get_memrail_proxy),
):
    org = req.org
    team = settings.memrail_team
    project = req.project

    # Bootstrap org in Memrail (idempotent — catch conflict on re-run)
    runtime_key = ""
    runtime_key_id = ""
    workspace = "development"
    integration_key: str | None = None
    integration_key_id: str | None = None

    try:
        result = await proxy.bootstrap(org, team, workspace="", project=project)
        # Fresh bootstrap — extract workspace and runtime key
        workspaces = result.get("workspaces", [])
        if workspaces:
            workspace = workspaces[0]["slug"]
            # Extract workspace-scoped API key from bootstrap response
            ws_api_key = workspaces[0].get("api_key", {})
            if ws_api_key:
                integration_key = ws_api_key.get("secret")
                integration_key_id = ws_api_key.get("key_id")

        api_keys = result.get("api_keys", {})
        # Use team_standard key as runtime key (has standard permissions)
        team_key = api_keys.get("team_standard", {})
        runtime_key = team_key.get("secret", "")
        runtime_key_id = team_key.get("key_id", "")
    except AMIConflict:
        # Org already exists — use the platform key as runtime key
        # (it has admin scope which includes decide permissions)
        runtime_key = settings.memrail_admin_api_key
        runtime_key_id = "platform-key"

        # Create a workspace-scoped integration key via admin API
        try:
            ws_id = await proxy.get_workspace_id(workspace)
            key_result = await proxy.create_workspace_key(ws_id, "OWS Integration Key")
            integration_key = key_result.get("secret")
            integration_key_id = key_result.get("key_id")
        except Exception as e:
            logger.warning("Failed to create integration key on re-bootstrap: %s", e)

    # Store integration key in DB
    if integration_key and integration_key_id:
        await _store_integration_key(integration_key_id, integration_key)

    # Register starter pack EMUs
    registered = 0
    for emu in STARTER_EMUS:
        try:
            await proxy.register_emu(workspace, project, emu)
            registered += 1
        except Exception:
            pass  # EMU may already exist

    # Create session token
    token = SessionService.create_token(
        org=org,
        team=team,
        workspace=workspace,
        project=project,
        runtime_key=runtime_key,
        runtime_key_id=runtime_key_id,
    )
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=86400,
    )

    return BootstrapResponse(
        org=org,
        team=team,
        workspace=workspace,
        project=project,
        emus_registered=registered,
        message=f"Project bootstrapped with {registered} starter policies",
        integration_key=integration_key,
        integration_key_id=integration_key_id,
    )


@router.get("/credentials")
async def get_credentials(session: dict = Depends(get_session)):
    return {
        "org": session["org"],
        "team": session["team"],
        "workspace": session["workspace"],
        "project": session["project"],
        "runtime_key_id": session.get("runtime_key_id"),
    }


@router.get("/integration-key")
async def get_integration_key(session: dict = Depends(get_session)):
    """Return the stored workspace-scoped integration key."""
    key_id, secret = await _load_integration_key()
    if not secret:
        raise HTTPException(status_code=404, detail="No integration key found. Run bootstrap first.")
    return {"key_id": key_id, "secret": secret}


@router.post("/regenerate-key")
async def regenerate_key(
    session: dict = Depends(get_session),
    proxy: MemrailProxy = Depends(get_memrail_proxy),
):
    """Create a new workspace-scoped integration key, replacing the stored one."""
    workspace = session["workspace"]
    try:
        ws_id = await proxy.get_workspace_id(workspace)
        key_result = await proxy.create_workspace_key(ws_id, "OWS Integration Key")
        secret = key_result.get("secret", "")
        key_id = key_result.get("key_id", "")
        await _store_integration_key(key_id, secret)
        return {"key_id": key_id, "secret": secret}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to regenerate key: {e}")
