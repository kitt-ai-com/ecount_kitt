"""재고 API 라우터"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import InventorySnapshot
from ..services.ecount_client import EcountClient
from ..config import settings

router = APIRouter(prefix="/api/inventory", tags=["재고"])


@router.get("/")
async def list_inventory(db: Session = Depends(get_db)):
    """최신 재고 스냅샷"""
    latest = db.query(func.max(InventorySnapshot.snapshot_date)).scalar()
    if not latest:
        return {"items": [], "snapshot_date": None}
    items = db.query(InventorySnapshot).filter(InventorySnapshot.snapshot_date == latest).all()
    return {"items": items, "snapshot_date": str(latest), "count": len(items)}


@router.get("/low-stock")
async def low_stock(db: Session = Depends(get_db)):
    """재고 부족 품목 (발주 필요)"""
    latest = db.query(func.max(InventorySnapshot.snapshot_date)).scalar()
    if not latest:
        return {"items": []}
    items = db.query(InventorySnapshot).filter(
        InventorySnapshot.snapshot_date == latest,
        InventorySnapshot.min_stock.isnot(None),
        InventorySnapshot.qty < InventorySnapshot.min_stock,
    ).all()
    return {"items": items, "count": len(items)}


@router.post("/sync-ecount")
async def sync_inventory_from_ecount(db: Session = Depends(get_db)):
    """이카운트에서 재고 동기화"""
    ec = EcountClient(settings.ecount_com_code, settings.ecount_user_id, settings.ecount_api_cert_key)
    try:
        data = await ec.get_inventory()
        items = data.get("Data", {}).get("Datas", [])
        return {"synced": len(items), "sample": items[:5]}
    finally:
        await ec.close()
