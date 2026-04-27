"""보고서 생성 엔진"""

from datetime import date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import SaleSlip, SaleItem, PurchaseSlip, DepositRecord, Account, InventorySnapshot
from .excel_service import generate_report_excel


def generate_daily_sales_report(db: Session, report_date: date, company_id: int = 1) -> dict:
    """일간 매출 보고서"""
    sales = db.query(SaleSlip).filter(
        SaleSlip.company_id == company_id,
        SaleSlip.io_date == report_date,
    ).all()

    total_sales = sum(s.total_amount for s in sales)
    total_count = len(sales)

    # 전일 대비
    prev_date = report_date - timedelta(days=1)
    prev_sales = db.query(func.sum(SaleSlip.total_amount)).filter(
        SaleSlip.company_id == company_id, SaleSlip.io_date == prev_date,
    ).scalar() or 0

    return {
        "date": str(report_date),
        "total_sales": int(total_sales),
        "total_count": total_count,
        "prev_day_sales": int(prev_sales),
        "change_rate": round((int(total_sales) - int(prev_sales)) / max(int(prev_sales), 1) * 100, 1),
        "by_channel": _group_by_channel(sales),
        "top_products": _top_products(db, report_date, company_id),
    }


def generate_weekly_ar_report(db: Session, company_id: int = 1) -> dict:
    """주간 채권현황 보고서"""
    accounts = db.query(Account).filter(
        Account.company_id == company_id,
        Account.outstanding_balance > 0,
    ).order_by(Account.outstanding_balance.desc()).all()

    total_ar = sum(a.outstanding_balance for a in accounts)

    return {
        "total_ar": int(total_ar),
        "account_count": len(accounts),
        "accounts": [{
            "cust_code": a.cust_code,
            "cust_name": a.cust_name,
            "balance": int(a.outstanding_balance),
            "avg_payment_days": a.avg_payment_days,
            "activity_grade": a.activity_grade,
        } for a in accounts[:20]],
    }


def generate_monthly_pl_report(db: Session, year: int, month: int, company_id: int = 1) -> dict:
    """월별 매입·매출 균형 리포트"""
    from_date = date(year, month, 1)
    if month == 12:
        to_date = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        to_date = date(year, month + 1, 1) - timedelta(days=1)

    total_sales = db.query(func.sum(SaleSlip.total_amount)).filter(
        SaleSlip.company_id == company_id,
        SaleSlip.io_date.between(from_date, to_date),
    ).scalar() or 0

    total_purchases = db.query(func.sum(PurchaseSlip.total_amount)).filter(
        PurchaseSlip.company_id == company_id,
        PurchaseSlip.io_date.between(from_date, to_date),
    ).scalar() or 0

    return {
        "year": year,
        "month": month,
        "total_sales": int(total_sales),
        "total_purchases": int(total_purchases),
        "gross_profit": int(total_sales) - int(total_purchases),
        "margin_rate": round((int(total_sales) - int(total_purchases)) / max(int(total_sales), 1) * 100, 1),
    }


def generate_client_rank_report(db: Session, company_id: int = 1, limit: int = 20) -> dict:
    """거래처 매출 순위"""
    accounts = db.query(Account).filter(
        Account.company_id == company_id,
    ).order_by(Account.total_sales.desc()).limit(limit).all()

    total = sum(a.total_sales for a in accounts)
    cumulative = 0
    ranked = []
    for i, a in enumerate(accounts, 1):
        cumulative += int(a.total_sales)
        ranked.append({
            "rank": i,
            "cust_code": a.cust_code,
            "cust_name": a.cust_name,
            "total_sales": int(a.total_sales),
            "share": round(int(a.total_sales) / max(int(total), 1) * 100, 1),
            "cumulative_share": round(cumulative / max(int(total), 1) * 100, 1),
            "order_count": a.total_orders,
            "activity_grade": a.activity_grade,
        })

    return {"total": int(total), "accounts": ranked}


def report_to_excel(report_type: str, report_data: dict) -> bytes:
    """보고서 데이터를 엑셀로 변환"""
    if report_type == "client-rank":
        headers = ["순위", "거래처코드", "거래처명", "매출합계", "점유율(%)", "누적점유율(%)", "주문건수", "활동등급"]
        rows = [[a["rank"], a["cust_code"], a["cust_name"], a["total_sales"],
                 a["share"], a["cumulative_share"], a["order_count"], a["activity_grade"]]
                for a in report_data.get("accounts", [])]
        return generate_report_excel("거래처매출순위", headers, rows)

    if report_type == "weekly-ar":
        headers = ["거래처코드", "거래처명", "미수잔액", "평균결제일수", "활동등급"]
        rows = [[a["cust_code"], a["cust_name"], a["balance"], a["avg_payment_days"], a["activity_grade"]]
                for a in report_data.get("accounts", [])]
        return generate_report_excel("채권현황", headers, rows)

    return b""


# ── 내부 헬퍼 ──

def _group_by_channel(sales: list) -> dict:
    channels = {}
    for s in sales:
        ch = s.channel or "기타"
        channels[ch] = channels.get(ch, 0) + int(s.total_amount)
    return channels


def _top_products(db: Session, report_date: date, company_id: int, limit: int = 10) -> list:
    results = db.query(
        SaleItem.prod_name,
        func.sum(SaleItem.amount).label("total"),
        func.sum(SaleItem.qty).label("total_qty"),
    ).join(SaleSlip).filter(
        SaleSlip.company_id == company_id,
        SaleSlip.io_date == report_date,
    ).group_by(SaleItem.prod_name).order_by(func.sum(SaleItem.amount).desc()).limit(limit).all()

    return [{"prod_name": r[0], "total": int(r[1] or 0), "qty": int(r[2] or 0)} for r in results]
