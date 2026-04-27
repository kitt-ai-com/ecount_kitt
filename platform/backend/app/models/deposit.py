"""입금 / 채권 매칭 모델"""

from datetime import datetime, date
from sqlalchemy import String, DateTime, Date, Numeric, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class DepositRecord(Base):
    __tablename__ = "deposit_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    io_date: Mapped[date] = mapped_column(Date)
    cust_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cust_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    deposit_amount: Mapped[int] = mapped_column(Numeric(15, 0), default=0)
    matched_slip_id: Mapped[int | None] = mapped_column(ForeignKey("sales_slips.id"), nullable=True)
    bank_description: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_matched: Mapped[bool] = mapped_column(default=False)
    overdue_days: Mapped[int | None] = mapped_column(default=0)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    ecount_synced: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
