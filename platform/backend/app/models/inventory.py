"""재고 스냅샷 모델"""

from datetime import datetime, date
from sqlalchemy import String, DateTime, Date, Integer, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class InventorySnapshot(Base):
    __tablename__ = "inventory_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    snapshot_date: Mapped[date] = mapped_column(Date)
    prod_code: Mapped[str] = mapped_column(String(50))
    prod_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    qty: Mapped[int] = mapped_column(Integer, default=0)
    unit_cost: Mapped[int] = mapped_column(Numeric(15, 0), default=0)
    total_value: Mapped[int] = mapped_column(Numeric(15, 0), default=0)
    min_stock: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reorder_qty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
