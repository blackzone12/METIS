import os
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve backend/ directory so SQLITE_PATH default is always correct
# regardless of which working directory the server is launched from.
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]


class Settings(BaseSettings):
    """Application configuration for the METIS AI Integration Backend."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # API Configuration
    APP_NAME: str = "METIS — AI Integration & Multimodal Runtime Engine"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = Field(default="development", validation_alias="APP_ENV")
    DEBUG: bool = False
    API_PREFIX: str = "/api"
    CORS_ORIGINS: List[str] = Field(default_factory=lambda: _DEFAULT_CORS_ORIGINS)
    CORS_ORIGIN_REGEX: str = Field(
        default=r"https://.*\\.vercel\\.app$|https://.*\\.netlify\\.app$|http://localhost:3000$|http://127.0.0.1:3000$",
        validation_alias="CORS_ORIGIN_REGEX",
    )

    # Google Gemini & Multimodal Configuration
    GEMINI_API_KEY: str = Field(default="", validation_alias="GEMINI_API_KEY")
    GEMINI_MODEL: str = "gemini-1.5-flash"

    # OpenRouter / OpenAI-Compatible Fallback Configuration
    OPENROUTER_API_KEY: str = Field(default="", validation_alias="OPENROUTER_API_KEY")
    OPENAI_API_KEY: str = Field(default="", validation_alias="OPENAI_API_KEY")
    OPENAI_BASE_URL: str = "https://openrouter.ai/api/v1"
    LLM_MODEL: str = "google/gemma-4-26b-a4b-it:free"

    # Simulation fallback when API keys are not provided
    USE_MOCK_GEMINI_FALLBACK: bool = True

    # AI Runtime Gateway & Security Configuration
    JWT_SECRET: str = Field(default="metis-dev-secret-change-me", validation_alias="JWT_SECRET")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_SECONDS: int = 86400  # 24 hours
    GATEWAY_RATE_LIMIT_PER_MINUTE: int = 60

    # ── SQLite Database (default — zero-config, works offline) ────────────────
    # Set USE_SQLITE=false to switch to MySQL instead.
    USE_SQLITE: bool = Field(default=True, validation_alias="USE_SQLITE")
    # Absolute path to the SQLite database file.
    # Default: <repo_root>/backend/metis.db
    SQLITE_PATH: str = Field(
        default=os.path.join(_BACKEND_DIR, "metis.db"),
        validation_alias="SQLITE_PATH",
    )

    # ── MySQL Database (optional — used when USE_SQLITE=false) ────────────────
    MYSQL_HOST: str = Field(default="127.0.0.1", validation_alias="MYSQL_HOST")
    MYSQL_PORT: int = Field(default=3306, validation_alias="MYSQL_PORT")
    MYSQL_USER: str = Field(default="root", validation_alias="MYSQL_USER")
    MYSQL_PASSWORD: str = Field(default="", validation_alias="MYSQL_PASSWORD")
    MYSQL_DATABASE: str = Field(default="metis", validation_alias="MYSQL_DATABASE")

    def model_post_init(self, __context) -> None:
        is_production = self.APP_ENV.lower() == "production"

        if is_production and (not self.JWT_SECRET or self.JWT_SECRET == "metis-dev-secret-change-me"):
            raise ValueError("JWT_SECRET must be set to a non-default secret in production.")

        if is_production and not self.USE_SQLITE and (
            not self.MYSQL_HOST
            or not self.MYSQL_USER
            or not self.MYSQL_PASSWORD
            or not self.MYSQL_DATABASE
        ):
            raise ValueError(
                "MySQL settings are required when USE_SQLITE=false in production. "
                "Set MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DATABASE."
            )

        if not is_production and not self.JWT_SECRET:
            self.JWT_SECRET = "metis-dev-secret-change-me"


settings = Settings()
