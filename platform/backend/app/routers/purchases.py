"""구매 API 라우터"""

from datetime import date
from fastapi import APIRouter, Depends, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import PurchaseSlip
from ..services.pdf_service import ocr_invoice
from ..config import settings

router = APIRouter(prefix="/api/purchases", tags=["구매"])


@router.get("/")
async def list_purchases(
    from_date: date = Query(default=None),
    to_date: date = Query(default=None),
    db: Session = Depends(get_db),
):
    q = db.query(PurchaseSlip)
    if from_date:
        q = q.filter(PurchaseSlip.io_date >= from_date)
    if to_date:
        q = q.filter(PurchaseSlip.io_date <= to_date)
    slips = q.order_by(PurchaseSlip.io_date.desc()).limit(100).all()
    return {"count": len(slips), "slips": slips}


@router.get("/summary")
async def purchase_summary(
    from_date: date = Query(default=None),
    to_date: date = Query(default=None),
    db: Session = Depends(get_db),
):
    q = db.query(
        func.count(PurchaseSlip.id),
        func.sum(PurchaseSlip.total_amount),
    )
    if from_date:
        q = q.filter(PurchaseSlip.io_date >= from_date)
    if to_date:
        q = q.filter(PurchaseSlip.io_date <= to_date)
    result = q.first()
    return {"count": result[0] or 0, "total": int(result[1] or 0)}


@router.post("/ocr-invoice")
async def upload_invoice_ocr(file: UploadFile = File(...)):
    """PDF 인보이스 OCR → 구매입력 데이터"""
    data = await file.read()
    result = await ocr_invoice(data)
    return {"invoice": result}


@router.post("/sync-ecount")
async def sync_purchase_to_ecount(slip_ids: list[int], db: Session = Depends(get_db)):
    from ..services.ecount_client import EcountClient
    ec = EcountClient(settings.ecount_com_code, settings.ecount_user_id, settings.ecount_api_cert_key)
    results = []
    for slip_id in slip_ids:
        slip = db.query(PurchaseSlip).get(slip_id)
        if not slip:
            results.append({"slip_id": slip_id, "success": False, "error": "전표 없음"})
            continue
        try:
            res = await ec.create_purchase([{
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
