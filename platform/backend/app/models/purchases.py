"""구매 전표 모델"""

from datetime import datetime, date
from sqlalchemy import String, DateTime, Date, Integer, Numeric, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class PurchaseSlip(Base):
    __tablename__ = "purchase_slips"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    slip_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    io_date: Mapped[date] = mapped_column(Date)
    cust_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cust_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    supply_amount: Mapped[int] = mapped_column(Numeric(15, 0), default=0)
    vat_amount: Mapped[int] = mapped_column(Numeric(15, 0), default=0)
    total_amount: Mapped[int] = mapped_column(Numeric(15, 0), default=0)
    currency: Mapped[str | None] = mapped_column(String(10), default="KRW")
    invoice_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)  # ocr, manual
    ecount_synced: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    items: Mapped[list["PurchaseItem"]] = relationship(back_populates="slip", cascade="all,delete-orphan")


class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    slip_id: Mapped[int] = mapped_column(ForeignKey("purchase_slips.id"))
    prod_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    prod_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    qty: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[int] = mapped_column(Numeric(15, 0), default=0)
    amount: Mapped[int] = mapped_column(Numeric(15, 0), default=0)

    slip: Mapped["PurchaseSlip"] = relationship(back_populates="items")
