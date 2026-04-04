from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_session
from app.services.composer_service import ComposerService, ComposerValidationError

router = APIRouter()


class DraftRequest(BaseModel):
    description: str


class RefineRequest(BaseModel):
    existing_emu: dict
    instruction: str


@router.post("/draft")
async def draft(
    req: DraftRequest,
    session: dict = Depends(get_session),
):
    service = ComposerService()
    try:
        emu = await service.draft(req.description)
        return {"emu": emu, "valid": True}
    except ComposerValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/refine")
async def refine(
    req: RefineRequest,
    session: dict = Depends(get_session),
):
    service = ComposerService()
    try:
        emu = await service.refine(req.existing_emu, req.instruction)
        return {"emu": emu, "valid": True}
    except ComposerValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
