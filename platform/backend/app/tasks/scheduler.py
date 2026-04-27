"""APScheduler 기반 정기 작업"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler()


def init_scheduler():
    """스케줄러 초기화 — 앱 시작 시 호출"""
    from .daily_summary import run_daily_summary
    from .weekly_ar import run_weekly_ar

    # 매일 오전 9시 — 일간 매출 요약
    scheduler.add_job(
        run_daily_summary,
        CronTrigger(hour=9, minute=0),
        id="daily_summary",
        replace_existing=True,
    )

    # 매주 목요일 오전 10시 — 채권현황 갱신
    scheduler.add_job(
        run_weekly_ar,
        CronTrigger(day_of_week="thu", hour=10, minute=0),
        id="weekly_ar",
        replace_existing=True,
    )

    scheduler.start()
