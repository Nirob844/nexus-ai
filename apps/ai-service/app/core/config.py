import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Service Config
    APP_NAME: str = "NEXUS AI Service"
    AI_SERVICE_PORT: int = 8000
    AI_SERVICE_HOST: str = "0.0.0.0"
    AI_SERVICE_SECRET_KEY: str = "nexus_internal_ai_secret_key"
    
    # Database Config (PostgreSQL with pgvector)
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "nexus_ai"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5433
    
    # Database URL
    DATABASE_URL: Optional[str] = None
    
    # LLM & Embedding Config
    OPENAI_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSION: int = 1536
    
    class Config:
        env_file = [".env", "../../.env"]
        extra = "ignore"

    @property
    def async_database_url(self) -> str:
        if self.DATABASE_URL:
            # Handle prisma-style or standard postgres url
            url = self.DATABASE_URL.replace("postgresql://", "postgres://")
            # Remove any query parameters like ?schema=public
            if "?" in url:
                url = url.split("?")[0]
            return url
        return f"postgres://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

settings = Settings()
