"""매출 전표 모델"""

from datetime import datetime, date
from sqlalchemy import String, DateTime, Date, Integer, Numeric, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class SaleSlip(Base):
    __tablename__ = "sales_slips"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    slip_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    io_date: Mapped[date] = mapped_column(Date)
    cust_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cust_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    supply_amount: Mapped[int] = mapped_column(Numeric(15, 0), default=0)
    vat_amount: Mapped[int] = mapped_column(Numeric(15, 0), default=0)
    total_amount: Mapped[int] = mapped_column(Numeric(15, 0), default=0)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)  # cafe24, naverpay, inicis, kakao, manual
    channel: Mapped[str | None] = mapped_column(String(50), nullable=True)  # 스마트스토어, 자사몰, B2B
    ecount_synced: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    items: Mapped[list["SaleItem"]] = relationship(back_populates="slip", cascade="all,delete-orphan")


class SaleItem(Base):
    __tablename__ = "sales_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    slip_id: Mapped[int] = mapped_column(ForeignKey("sales_slips.id"))
    prod_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    prod_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)  # 박스, 테이프, 완충재 등
    qty: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[int] = mapped_column(Numeric(15, 0), default=0)
    amount: Mapped[int] = mapped_column(Numeric(15, 0), default=0)

    slip: Mapped["SaleSlip"] = relationship(back_populates="items")
