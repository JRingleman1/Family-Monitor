from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    firebase_api_key: str = ""
    firebase_project_id: str = ""
    firebase_database_url: str = ""
    google_application_credentials: str = ""

    secret_key: str = "changeme"
    jwt_secret: str = "changeme"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: str = "http://localhost:3000,http://localhost:8081"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
