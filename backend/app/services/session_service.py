from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError

from app.config import settings


class SessionService:
    @staticmethod
    def create_token(
        org: str,
        team: str,
        workspace: str,
        project: str,
        runtime_key: str,
        runtime_key_id: str,
    ) -> str:
        payload = {
            "org": org,
            "team": team,
            "workspace": workspace,
            "project": project,
            "runtime_key": runtime_key,
            "runtime_key_id": runtime_key_id,
            "exp": datetime.now(timezone.utc)
            + timedelta(hours=settings.jwt_expiry_hours),
            "iat": datetime.now(timezone.utc),
        }
        return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

    @staticmethod
    def decode_token(token: str) -> dict | None:
        try:
            return jwt.decode(
                token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
            )
        except JWTError:
            return None

    @staticmethod
    def get_session_from_cookie(cookie_value: str | None) -> dict | None:
        if not cookie_value:
            return None
        return SessionService.decode_token(cookie_value)

    @staticmethod
    def get_default_session() -> dict | None:
        """Return a session using the platform API key and default org config.
        Used by the OWS executable endpoint which authenticates via Bearer token."""
        if not settings.memrail_admin_api_key:
            return None
        return {
            "org": settings.memrail_org,
            "team": settings.memrail_team,
            "workspace": "development",
            "project": "default",
            "runtime_key": settings.memrail_admin_api_key,
            "runtime_key_id": "platform-key",
        }
