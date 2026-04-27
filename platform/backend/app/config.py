"""환경 설정 — pydantic-settings"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # 이카운트 ERP
    ecount_com_code: str = ""
    ecount_user_id: str = ""
    ecount_api_cert_key: str = ""
    ecount_zone: str = ""

    # Claude API
    anthropic_api_key: str = ""

    # Database
    database_url: str = "postgresql://cnc:cnc@localhost:5432/cnc_korea"

    # Email
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""

    # Cafe24
    cafe24_mall_id: str = ""
    cafe24_client_id: str = ""
    cafe24_client_secret: str = ""

    # App
    app_name: str = "CNC코리아 ERP 자동화"
    debug: bool = False

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
