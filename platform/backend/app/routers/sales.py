"""매출 API 라우터"""

from datetime import date
from fastapi import APIRouter, Depends, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import SaleSlip, SaleItem, Account
from ..services.ecount_client import EcountClient
from ..services.excel_service import parse_excel, detect_file_type
from ..services.ai_service import parse_kakao_order
from ..config import settings

router = APIRouter(prefix="/api/sales", tags=["매출"])


def get_ecount():
    return EcountClient(settings.ecount_com_code, settings.ecount_user_id, settings.ecount_api_cert_key)


@router.get("/")
async def list_sales(
    from_date: date = Query(default=None),
    to_date: date = Query(default=None),
    channel: str | None = None,
    db: Session = Depends(get_db),
):
    """매출 전표 목록"""
    q = db.query(SaleSlip)
    if from_date:
        q = q.filter(SaleSlip.io_date >= from_date)
    if to_date:
        q = q.filter(SaleSlip.io_date <= to_date)
    if channel:
        q = q.filter(SaleSlip.channel == channel)
    slips = q.order_by(SaleSlip.io_date.desc()).limit(100).all()
    return {"count": len(slips), "slips": slips}


@router.get("/summary")
async def sales_summary(
    from_date: date = Query(default=None),
    to_date: date = Query(default=None),
    db: Session = Depends(get_db),
):
    """매출 요약 (KPI)"""
    q = db.query(
        func.count(SaleSlip.id).label("count"),
        func.sum(SaleSlip.total_amount).label("total"),
        func.sum(SaleSlip.supply_amount).label("supply"),
        func.sum(SaleSlip.vat_amount).label("vat"),
    )
    if from_date:
        q = q.filter(SaleSlip.io_date >= from_date)
    if to_date:
        q = q.filter(SaleSlip.io_date <= to_date)
    result = q.first()
    return {
        "count": result.count or 0,
        "total": int(result.total or 0),
        "supply": int(result.supply or 0),
        "vat": int(result.vat or 0),
    }


@router.get("/by-channel")
async def sales_by_channel(
    from_date: date = Query(default=None),
    to_date: date = Query(default=None),
    db: Session = Depends(get_db),
):
    """채널별 매출 비중"""
    q = db.query(
        SaleSlip.channel,
        func.count(SaleSlip.id),
        func.sum(SaleSlip.total_amount),
    ).group_by(SaleSlip.channel)
    if from_date:
        q = q.filter(SaleSlip.io_date >= from_date)
    if to_date:
        q = q.filter(SaleSlip.io_date <= to_date)
    results = q.all()
    return [{"channel": r[0] or "기타", "count": r[1], "total": int(r[2] or 0)} for r in results]


@router.get("/by-product")
async def sales_by_product(
    from_date: date = Query(default=None),
    to_date: date = Query(default=None),
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """품목별 매출 순위"""
    q = db.query(
        SaleItem.prod_name,
        SaleItem.category,
        func.sum(SaleItem.qty),
        func.sum(SaleItem.amount),
    ).join(SaleSlip).group_by(SaleItem.prod_name, SaleItem.category)
    if from_date:
        q = q.filter(SaleSlip.io_date >= from_date)
    if to_date:
        q = q.filter(SaleSlip.io_date <= to_date)
    results = q.order_by(func.sum(SaleItem.amount).desc()).limit(limit).all()
    return [{"prod_name": r[0], "category": r[1], "qty": int(r[2] or 0), "amount": int(r[3] or 0)} for r in results]


@router.post("/upload-excel")
async def upload_sales_excel(file: UploadFile = File(...)):
    """엑셀 업로드 → 판매입력"""
    data = await file.read()
    parsed = parse_excel(data)
    file_type = detect_file_type(parsed["headers"])
    return {"file_type": file_type, "row_count": len(parsed["rows"]), "headers": parsed["headers"], "preview": parsed["rows"][:5]}


@router.post("/from-kakao")
async def from_kakao_order(text: str):
    """카톡 주문 → 판매입력"""
    orders = await parse_kakao_order(text)
    return {"orders": orders, "count": len(orders) if isinstance(orders, list) else 1}


@router.post("/sync-ecount")
async def sync_to_ecount(slip_ids: list[int], db: Session = Depends(get_db)):
    """이카운트로 매출 전표 동기화"""
    ec = get_ecount()
    results = []
    for slip_id in slip_ids:
        slip = db.query(SaleSlip).get(slip_id)
        if not slip:
            results.append({"slip_id": slip_id, "success": False, "error": "전표 없음"})
            continue
        try:
            res = await ec.create_sale([{
                "IO_DATE": slip.io_date.strftime("%Y%m%d"),
                "CUST_CODE": slip.cust_code or "",
                "PRICE": int(slip.total_amount),
                "SUPPLY_AMT": int(slip.supply_amount),
                "VAT_AMT": int(slip.vat_amount),
                "REMARKS": slip.remarks or "",
            }])
            slip.ecount_synced = True
            db.commit()
            results.append({"slip_id": slip_id, "success": True, "response": res})
        except Exception as e:
            results.append({"slip_id": slip_id, "success": False, "error": str(e)})
    await ec.close()
    return {"results": results}
