"""거래처 통계·분석 API 라우터"""

from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models import Account, SaleSlip

router = APIRouter(prefix="/api/accounts", tags=["거래처"])


@router.get("/")
async def list_accounts(
    grade: str | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    q = db.query(Account)
    if grade:
        q = q.filter(Account.activity_grade == grade)
    accounts = q.order_by(Account.total_sales.desc()).limit(limit).all()
    return {"accounts": accounts, "count": len(accounts)}


@router.get("/rank")
async def account_rank(limit: int = 20, db: Session = Depends(get_db)):
    """거래처 매출 순위 (파레토)"""
    accounts = db.query(Account).order_by(Account.total_sales.desc()).limit(limit).all()
    total = sum(int(a.total_sales) for a in accounts)
    cumul = 0
    ranked = []
    for i, a in enumerate(accounts, 1):
        cumul += int(a.total_sales)
        ranked.append({
            "rank": i,
            "cust_code": a.cust_code,
            "cust_name": a.cust_name,
            "total_sales": int(a.total_sales),
            "share_pct": round(int(a.total_sales) / max(total, 1) * 100, 1),
            "cumulative_pct": round(cumul / max(total, 1) * 100, 1),
            "total_orders": a.total_orders,
            "activity_grade": a.activity_grade,
        })
    return {"total": total, "accounts": ranked}


@router.get("/grades")
async def account_grades(db: Session = Depends(get_db)):
    """활동성 등급 분포"""
    results = db.query(
        Account.activity_grade,
        func.count(Account.id),
    ).group_by(Account.activity_grade).all()
    return {r[0] or "미분류": r[1] for r in results}


@router.get("/payment-patterns")
async def payment_patterns(limit: int = 20, db: Session = Depends(get_db)):
    """거래처별 결제 패턴"""
    accounts = db.query(Account).filter(Account.total_orders > 0).order_by(
        Account.avg_payment_days.desc()
    ).limit(limit).all()
    return [{
        "cust_code": a.cust_code,
        "cust_name": a.cust_name,
        "avg_payment_days": a.avg_payment_days,
        "outstanding_balance": int(a.outstanding_balance),
        "total_orders": a.total_orders,
    } for a in accounts]


@router.get("/new-vs-existing")
async def new_vs_existing(months: int = 6, db: Session = Depends(get_db)):
    """신규 vs 기존 거래처 비율 추이"""
    today = date.today()
    result = []
    for i in range(months):
        m_start = date(today.year, today.month - i, 1) if today.month - i > 0 else date(today.year - 1, today.month - i + 12, 1)
        m_end = m_start + timedelta(days=32)
        m_end = date(m_end.year, m_end.month, 1) - timedelta(days=1)

        new_count = db.query(func.count(Account.id)).filter(
            Account.first_order_date.between(m_start, m_end)
        ).scalar() or 0

        active_count = db.query(func.count(func.distinct(SaleSlip.cust_code))).filter(
            SaleSlip.io_date.between(m_start, m_end)
        ).scalar() or 0

        result.append({
            "month": m_start.strftime("%Y-%m"),
            "new_accounts": new_count,
            "active_accounts": active_count,
            "existing_accounts": max(active_count - new_count, 0),
        })
    return list(reversed(result))
