# CNC코리아 이카운트 ERP 자동화

## 프로젝트 개요
CNC코리아의 이카운트 ERP 반복 업무(판매입력, 매출전표, 구매입력, 급여, 채권 등)를 자동화.
기획1(Chrome 확장) → 기획2(MCP 플랫폼) 순서.

## 기술 스택
- **Chrome Extension**: MV3, Service Worker, Side Panel, SheetJS, PDF.js
- **Backend**: Python FastAPI, PostgreSQL, SQLAlchemy, Alembic, APScheduler
- **Frontend**: Next.js 14 App Router, Tailwind CSS, shadcn/ui, Recharts
- **MCP**: ecount-mcp, pg-mcp, cafe24-mcp

## 코딩 컨벤션
- JavaScript: ES2022+, async/await, JSDoc 타입 힌트
- Python: 3.11+, type hints, pydantic v2
- 한글 주석 허용, 변수명은 영문
- 에러 메시지는 한국어

## 이카운트 API 인증 흐름
1. Zone 조회: POST `https://sboapi.ecount.com/OAPI/V2/Zone` → Zone 코드 (예: "CC")
2. 로그인: POST `https://sboapi{ZONE}.ecount.com/OAPI/V2/OAPILogin` → SESSION_ID
3. API 호출: `https://sboapi{ZONE}.ecount.com` + Header `SESSION_ID` 포함

## 참조 패턴
- Chrome Extension MV3: `/Users/jasonmac/Claude/review/chrome-extension/`
- MCP/Proxy: `/Users/jasonmac/Claude/k-skill/`
