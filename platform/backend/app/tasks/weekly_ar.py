"""주간 채권현황 갱신 정기 작업"""

from datetime import date
from ..database import SessionLocal
from ..services.report_engine import generate_weekly_ar_report, report_to_excel
from ..services.email_service import send_email
from ..models import ReportHistory


async def run_weekly_ar():
    """매주 목요일 오전 10시 실행"""
    db = SessionLocal()
    try:
        report_data = generate_weekly_ar_report(db)

        subject = f"[CNC코리아] 주간 채권현황 ({date.today()})"
        body = f"""안녕하세요. CNC코리아 주간 채권현황 보고서입니다.

■ 총 미수금: {report_data['total_ar']:,}원
■ 미수 거래처: {report_data['account_count']}개

상위 미수 거래처:
{_format_ar(report_data.get('accounts', []))}
"""

        excel_bytes = report_to_excel("weekly-ar", report_data)

        history = ReportHistory(
            report_type="weekly-ar",
            status="generated",
            report_data=report_data,
        )
        db.add(history)
        db.commit()

        # TODO: settings에서 수신자 목록 가져오기
        # await send_email(
        #     to=recipients, subject=subject, body=body,
        #     attachments=[("채권현황.xlsx", excel_bytes)],
        # )

    finally:
        db.close()


def _format_ar(accounts: list) -> str:
    return "\n".join(
        f"  - {a['cust_name']}: {a['balance']:,}원 (평균 {a['avg_payment_days']}일)"
        for a in accounts[:10]
    ) or "  (데이터 없음)"
