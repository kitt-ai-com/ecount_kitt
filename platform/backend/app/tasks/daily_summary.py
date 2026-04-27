"""일간 매출 요약 정기 작업"""

from datetime import date
from ..database import SessionLocal
from ..services.report_engine import generate_daily_sales_report
from ..services.email_service import send_email
from ..models import ReportHistory


async def run_daily_summary():
    """매일 오전 9시 실행"""
    db = SessionLocal()
    try:
        report_data = generate_daily_sales_report(db, date.today())

        subject = f"[CNC코리아] 일간 매출 보고서 ({date.today()})"
        body = f"""안녕하세요. CNC코리아 일간 매출 보고서입니다.

■ 일자: {report_data['date']}
■ 매출 건수: {report_data['total_count']}건
■ 매출 합계: {report_data['total_sales']:,}원
■ 전일 대비: {report_data['change_rate']:+.1f}%

채널별 매출:
{_format_channels(report_data.get('by_channel', {}))}

Top 상품:
{_format_products(report_data.get('top_products', []))}
"""

        # 보고서 이력 저장
        history = ReportHistory(
            report_type="daily",
            status="generated",
            report_data=report_data,
        )
        db.add(history)
        db.commit()

        # TODO: settings에서 수신자 목록 가져오기
        # await send_email(to=recipients, subject=subject, body=body)

    finally:
        db.close()


def _format_channels(channels: dict) -> str:
    return "\n".join(f"  - {k}: {v:,}원" for k, v in channels.items()) or "  (데이터 없음)"


def _format_products(products: list) -> str:
    return "\n".join(
        f"  {i+1}. {p['prod_name']} — {p['total']:,}원 ({p['qty']}개)"
        for i, p in enumerate(products[:5])
    ) or "  (데이터 없음)"
