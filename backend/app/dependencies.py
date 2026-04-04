from fastapi import Cookie, Depends, HTTPException, Request

from app.services.memrail_proxy import MemrailProxy
from app.services.session_service import SessionService


def get_memrail_proxy(request: Request) -> MemrailProxy:
    return MemrailProxy(request.app.state.memrail_client)


def get_session(session_token: str | None = Cookie(default=None)) -> dict:
    session = SessionService.get_session_from_cookie(session_token)
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated. Run setup first.")
    return session
