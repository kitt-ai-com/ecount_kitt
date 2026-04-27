"""보고서 API 라우터"""

from datetime import date
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io

from ..database import get_db
from ..services.report_engine import (
    generate_daily_sales_report,
    generate_weekly_ar_report,
    generate_monthly_pl_report,
    generate_client_rank_report,
    report_to_excel,
)
from ..services.email_service import send_email

router = APIRouter(prefix="/api/reports", tags=["보고서"])


@router.get("/daily")
async def daily_report(report_date: date = Query(default=None), db: Session = Depends(get_db)):
    if not report_date:
        report_date = date.today()
    return generate_daily_sales_report(db, report_date)


@router.get("/weekly-ar")
async def weekly_ar_report(db: Session = Depends(get_db)):
    return generate_weekly_ar_report(db)


@router.get("/monthly-pl")
async def monthly_pl_report(year: int, month: int, db: Session = Depends(get_db)):
    return generate_monthly_pl_report(db, year, month)


@router.get("/client-rank")
async def client_rank_report(limit: int = 20, db: Session = Depends(get_db)):
    return generate_client_rank_report(db, limit=limit)


@router.get("/download/{report_type}")
async def download_report(report_type: str, db: Session = Depends(get_db)):
    """보고서 엑셀 다운로드"""
    if report_type == "weekly-ar":
        data = generate_weekly_ar_report(db)
    elif report_type == "client-rank":
        data = generate_client_rank_report(db)
    else:
        return {"error": f"지원하지 않는 보고서: {report_type}"}

    excel_bytes = report_to_excel(report_type, data)
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={report_type}.xlsx"},
    )


@router.post("/send-email")
async def send_report_email(report_type: str, recipients: list[str], db: Session = Depends(get_db)):
    """보고서 이메일 발송"""
    if report_type == "daily":
        data = generate_daily_sales_report(db, date.today())
        subject = f"[CNC코리아] 일간 매출 보고서 ({date.today()})"
        body = f"일간 매출: {data['total_sales']:,}원 ({data['total_count']}건)\n전일 대비: {data['change_rate']:+.1f}%"
    elif report_type == "weekly-ar":
        data = generate_weekly_ar_report(db)
        subject = "[CNC코리아] 주간 채권현황"
        body = f"총 미수금: {data['total_ar']:,}원 ({data['account_count']}개 거래처)"
    else:
        return {"error": "지원하지 않는 보고서 유형"}

    excel_bytes = report_to_excel(report_type, data)
    await send_email(
        to=recipients,
        subject=subject,
        body=body,
        attachments=[(f"{report_type}_{date.today()}.xlsx", excel_bytes)] if excel_bytes else None,
    )
    return {"sent": True, "recipients": recipients}
