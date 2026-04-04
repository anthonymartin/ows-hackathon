from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_memrail_proxy, get_session
from app.models.emu import EmuRegistration, EmuStateUpdate
from app.services.memrail_proxy import MemrailProxy

router = APIRouter()


@router.get("")
async def list_emus(
    proxy: MemrailProxy = Depends(get_memrail_proxy),
    session: dict = Depends(get_session),
):
    return await proxy.list_emus(
        workspace=session["workspace"],
        project=session["project"],
    )


@router.post("")
async def register_emu(
    emu: EmuRegistration,
    proxy: MemrailProxy = Depends(get_memrail_proxy),
    session: dict = Depends(get_session),
):
    try:
        return await proxy.register_emu(
            workspace=session["workspace"],
            project=session["project"],
            emu_data=emu.model_dump(),
        )
    except Exception as e:
        msg = str(e)
        # EMU key conflict — update instead of failing
        if "409" in msg or "conflict" in msg.lower() or "already exists" in msg.lower():
            return await proxy.update_emu(
                workspace=session["workspace"],
                project=session["project"],
                emu_key=emu.emu_key,
                emu_data=emu.model_dump(),
            )
        raise HTTPException(status_code=500, detail=msg)


@router.put("/{emu_key}")
async def update_emu(
    emu_key: str,
    emu: EmuRegistration,
    proxy: MemrailProxy = Depends(get_memrail_proxy),
    session: dict = Depends(get_session),
):
    return await proxy.update_emu(
        workspace=session["workspace"],
        project=session["project"],
        emu_key=emu_key,
        emu_data=emu.model_dump(),
    )


@router.patch("/{emu_key}/state")
async def update_emu_state(
    emu_key: str,
    body: EmuStateUpdate,
    proxy: MemrailProxy = Depends(get_memrail_proxy),
    session: dict = Depends(get_session),
):
    new_state = "active" if body.enabled else "inactive"
    return await proxy.update_emu_lifecycle(
        workspace=session["workspace"],
        project=session["project"],
        emu_key=emu_key,
        state_val=new_state,
    )
