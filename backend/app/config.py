from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://postgres:123580@localhost:5432/fundmessenger"

    # JWT
    secret_key: str = ""  # 환경변수 SECRET_KEY 필수 설정
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    # SMTP (이메일 발송)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""

    # KIS API
    kis_app_key: str = ""
    kis_app_secret: str = ""

    # OpenAI API (공통)
    openai_api_key: str = ""
    openai_model: str = "gpt-5-mini"
    openai_temperature: float = 0.7

    # 뉴스데스크 AI 설정
    newsdesk_verbosity: str = "high"
    newsdesk_max_tokens: int = 32768
    newsdesk_reasoning_effort: str = "medium"

    # 의사결정서 AI 설정
    decision_verbosity: str = "medium"
    decision_max_tokens: int = 16384
    decision_reasoning_effort: str = "medium"

    # 운용보고서 AI 설정
    report_verbosity: str = "high"
    report_max_tokens: int = 16384
    report_reasoning_effort: str = "medium"

    # Web Push (VAPID)
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_claims_email: str = "mailto:fund@messenger.app"

    # Environment
    environment: str = "development"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
