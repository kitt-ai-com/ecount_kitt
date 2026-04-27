"""보고서 스케줄 / 이력"""

from datetime import datetime
from sqlalchemy import String, DateTime, Integer, Text, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class ReportSchedule(Base):
    __tablename__ = "report_schedules"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    report_type: Mapped[str] = mapped_column(String(50))  # daily, weekly-ar, monthly-pl, client-rank, product-rank
    cron_expression: Mapped[str] = mapped_column(String(50))  # "0 9 * * *"
    recipients: Mapped[str] = mapped_column(Text)  # comma-separated emails
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ReportHistory(Base):
    __tablename__ = "report_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    schedule_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    report_type: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), default="generated")
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sent_to: Mapped[str | None] = mapped_column(Text, nullable=True)
    report_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
