from fastapi import APIRouter, Depends

from app.dependencies import get_memrail_proxy, get_session
from app.services.memrail_proxy import MemrailProxy

router = APIRouter()


@router.get("")
async def list_traces(
    limit: int = 50,
    proxy: MemrailProxy = Depends(get_memrail_proxy),
    session: dict = Depends(get_session),
):
    try:
        return await proxy.list_traces(limit=limit)
    except Exception:
        return []


@router.get("/{trace_id}")
async def get_trace(
    trace_id: str,
    proxy: MemrailProxy = Depends(get_memrail_proxy),
    session: dict = Depends(get_session),
):
    return await proxy.get_trace(
        trace_id,
        workspace=session["workspace"],
        project=session["project"],
    )
