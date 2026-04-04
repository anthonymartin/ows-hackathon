from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_env: str = "development"
    cors_origins: str = "http://localhost:3000"
    memrail_base_url: str = "https://api.memrail.com"
    memrail_org: str = "ows"
    memrail_team: str = "default"
    memrail_admin_api_key: str = ""
    anthropic_api_key: str = ""
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expiry_hours: int = 24

    model_config = {"env_prefix": "", "case_sensitive": False, "env_file": ".env"}


settings = Settings()
