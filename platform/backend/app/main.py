"""FastAPI 메인 엔트리포인트 — CNC코리아 ERP 자동화"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import engine, Base
from .routers import sales, purchases, inventory, reports, workflows, accounts
from .tasks.scheduler import init_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 시작 시
    Base.metadata.create_all(bind=engine)
    init_scheduler()
    yield
    # 종료 시
    from .tasks.scheduler import scheduler
    scheduler.shutdown()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="CNC코리아 이카운트 ERP 자동화 백엔드 API",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(sales.router)
app.include_router(purchases.router)
app.include_router(inventory.router)
app.include_router(reports.router)
app.include_router(workflows.router)
app.include_router(accounts.router)


@app.get("/")
async def root():
    return {"message": settings.app_name, "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/connection-test")
async def test_ecount_connection():
    """이카운트 연결 테스트"""
    from .services.ecount_client import EcountClient
    ec = EcountClient(settings.ecount_com_code, settings.ecount_user_id, settings.ecount_api_cert_key)
    result = await ec.test_connection()
    await ec.close()
    return result
