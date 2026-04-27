"""회사 / 이카운트 연결 정보"""

from datetime import datetime
from sqlalchemy import String, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    ecount_com_code: Mapped[str] = mapped_column(String(50))
    ecount_user_id: Mapped[str] = mapped_column(String(50))
    ecount_api_cert_key: Mapped[str] = mapped_column(String(200))
    ecount_zone: Mapped[str | None] = mapped_column(String(200), nullable=True)
    ecount_session_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    session_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
