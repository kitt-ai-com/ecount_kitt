"""거래처 모델 — 통계/분석용"""

from datetime import datetime, date
from sqlalchemy import String, DateTime, Date, Integer, Numeric, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    cust_code: Mapped[str] = mapped_column(String(50))
    cust_name: Mapped[str] = mapped_column(String(200))
    contact_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 통계 필드
    total_sales: Mapped[int] = mapped_column(Numeric(15, 0), default=0)
    total_orders: Mapped[int] = mapped_column(Integer, default=0)
    last_order_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    avg_order_amount: Mapped[int] = mapped_column(Numeric(15, 0), default=0)
    outstanding_balance: Mapped[int] = mapped_column(Numeric(15, 0), default=0)
    avg_payment_days: Mapped[int] = mapped_column(Integer, default=0)
    # 활동성 등급: active, caution, dormant, churned
    activity_grade: Mapped[str | None] = mapped_column(String(20), default="active")
    first_order_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
