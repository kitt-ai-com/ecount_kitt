"""워크플로우 실행 API 라우터"""

from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from ..models import WorkflowRun
from ..services.ai_service import parse_kakao_order, recommend_price, recommend_box, detect_churn_risk
from ..services.pdf_service import ocr_invoice, ocr_receipt
from ..services.excel_service import parse_excel

router = APIRouter(prefix="/api/workflows", tags=["워크플로우"])


class KakaoOrderRequest(BaseModel):
    text: str


class PriceRecommendRequest(BaseModel):
    prod_code: str
    cust_code: str
    history: list[dict]


class BoxRecommendRequest(BaseModel):
    width: int
    height: int
    depth: int
    qty: int
    inventory: list[dict]


class ChurnDetectRequest(BaseModel):
    account_data: dict
    history: list[dict]


@router.get("/history")
async def workflow_history(limit: int = 20, db: Session = Depends(get_db)):
    runs = db.query(WorkflowRun).order_by(WorkflowRun.started_at.desc()).limit(limit).all()
    return {"runs": runs}


@router.post("/kakao-order")
async def run_kakao_order(req: KakaoOrderRequest, db: Session = Depends(get_db)):
    """카톡 주문 파싱 워크플로우"""
    run = WorkflowRun(workflow_id="kakao-order", status="running")
    db.add(run)
    db.commit()
    try:
        orders = await parse_kakao_order(req.text)
        run.status = "completed"
        run.success_count = len(orders) if isinstance(orders, list) else 1
        run.result_data = {"orders": orders}
        db.commit()
        return {"success": True, "orders": orders}
    except Exception as e:
        run.status = "failed"
        run.error_message = str(e)
        db.commit()
        return {"success": False, "error": str(e)}


@router.post("/invoice-ocr")
async def run_invoice_ocr(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """인보이스 OCR 워크플로우"""
    run = WorkflowRun(workflow_id="invoice-ocr", status="running")
    db.add(run)
    db.commit()
    try:
        data = await file.read()
        invoice = await ocr_invoice(data)
        run.status = "completed"
        run.success_count = 1
        run.result_data = invoice
        db.commit()
        return {"success": True, "invoice": invoice}
    except Exception as e:
        run.status = "failed"
        run.error_message = str(e)
        db.commit()
        return {"success": False, "error": str(e)}


@router.post("/receipt-ocr")
async def run_receipt_ocr(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """영수증 OCR 워크플로우"""
    run = WorkflowRun(workflow_id="receipt-ocr", status="running")
    db.add(run)
    db.commit()
    try:
        data = await file.read()
        media_type = file.content_type or "image/jpeg"
        receipt = await ocr_receipt(data, media_type)
        run.status = "completed"
        run.success_count = 1
        run.result_data = receipt
        db.commit()
        return {"success": True, "receipt": receipt}
    except Exception as e:
        run.status = "failed"
        run.error_message = str(e)
        db.commit()
        return {"success": False, "error": str(e)}


@router.post("/price-recommend")
async def run_price_recommend(req: PriceRecommendRequest):
    """거래처별 단가 추천"""
    result = await recommend_price(req.prod_code, req.cust_code, req.history)
    return {"success": True, "recommendation": result}


@router.post("/box-recommend")
async def run_box_recommend(req: BoxRecommendRequest):
    """가견적 — 박스 추천"""
    result = await recommend_box(req.width, req.height, req.depth, req.qty, req.inventory)
    return {"success": True, "recommendation": result}


@router.post("/churn-detect")
async def run_churn_detect(req: ChurnDetectRequest):
    """거래처 이탈 예측"""
    result = await detect_churn_risk(req.account_data, req.history)
    return {"success": True, "prediction": result}


@router.post("/excel-upload")
async def run_excel_upload(file: UploadFile = File(...)):
    """엑셀 파싱 워크플로우"""
    data = await file.read()
    parsed = parse_excel(data)
    return {"success": True, "rows": len(parsed["rows"]), "headers": parsed["headers"], "preview": parsed["rows"][:10]}
