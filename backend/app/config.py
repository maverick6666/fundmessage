from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://postgres:123580@localhost:5432/fundmessenger"

    # JWT
    secret_key: str = "your-super-secret-key-change-this-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7

    # SMTP (이메일 발송)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""

    # KIS API
    kis_app_key: str = ""
    kis_app_secret: str = ""

    # OpenAI API
    openai_api_key: str = ""
    openai_model: str = "gpt-5-mini"  # 400K context, 정확한 프롬프트에 최적화
    openai_temperature: float = 0.2  # 낮을수록 일관된 출력 (0.0~1.0)
    openai_max_tokens: int = 0  # 0이면 제한 없음 (모델이 자연스럽게 종료)
    openai_max_tokens_report: int = 0  # 0이면 제한 없음

    # Environment
    environment: str = "development"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
