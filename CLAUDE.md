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

## Claude Code ↔ Codex 협업 프로토콜

상세 프로토콜: `chrome-extension/CLAUDE_SHARED_CONTEXT.md`

| 역할 | 터미널 | 담당 |
|------|--------|------|
| **Codex** | 분석 터미널 | 원인 분석, 가이드라인/지시서 작성, 검증 기준 정의 |
| **Claude Code** | 개발 터미널 | 지시서 기반 코드 구현, 구현 완료 보고 |

### 흐름
1. 이슈 발생 → **Codex**가 `CLAUDE_SHARED_CONTEXT.md > 현재 작업 지시` 또는 `CLAUDE.md`에 지시서 작성
2. 사용자가 Claude Code에 "실행" 지시
3. **Claude Code**가 지시서 읽고 가이드 제시 → 승인 후 구현
4. **Claude Code**가 `CLAUDE_SHARED_CONTEXT.md > 구현 완료 보고`에 결과 기록
5. **Codex**가 결과 검증 → 후속 이슈 분석

### 규칙
- 동일 파일 동시 수정 금지 (대상 파일을 지시서에 명시)
- 지시서 범위 밖 코드 수정 금지
- 가이드 우선: 구현 전 설명 → 승인 후 실행
- 에러 분류: `[세션]` / `[네트워크]` / `[서버]` / `[입력]`

## 현재 이슈

> Codex가 새 이슈 분석 시 여기에 작성. 구현 완료되면 해결 완료로 이동.

### 상태: 구현 완료 — 검증 필요

**kakao-order 세션 만료 저장 실패** (2026-04-28)
- 구현: `reconnectEcountSession()`, `ecountRequest()` 자동 재시도, row 검증
- 검증 대기: 확장 리로드 후 실제 카톡 주문 저장 테스트 필요
- 추가 분석:
  - 현재 DevTools 로그상 `amount=0` 문제는 해결됨
  - 실제 요청 payload는 `PRICE=25000`, `PRICE=1000`까지 정상 생성됨
  - 그러나 `SaveSale` 응답이 HTTP 500 + JSON 본문 `로그인 하기 바랍니다.` 로 돌아옴
  - 로그에 `세션 무효 감지 — 자동 재연결 시도`가 보이지 않음
- 핵심 원인:
  - `background.js`의 `ecountRequest()`가 `res.ok === false`이면 JSON 본문을 세션 오류로 해석하기 전에 `[네트워크]`로 먼저 throw 하는 구조일 가능성이 큼
  - ECOUNT는 세션 무효를 HTTP 500 + JSON 메시지로 주기 때문에, 본문을 읽고 세션 오류로 분류해야 자동 재연결이 동작함
- 다음 수정 지시:
  1. `res.ok === false`여도 먼저 `res.text()`를 읽고 JSON 파싱 시도
  2. 본문에 `로그인 하기 바랍니다`가 있으면 `[세션]`으로 분류하고 `reconnectEcountSession()` 후 1회 재시도
  3. JSON 파싱이 불가한 순수 transport 실패만 `[네트워크]` 처리
  4. HTTP 500 + ECOUNT JSON은 `[네트워크]`가 아니라 `[세션]` 또는 `[서버]`로 분류
- 후속 확인 포인트:
  - 세션 재연결이 살아난 뒤에도 `CUST_CODE=''` 상태가 SaveSale에서 허용되는지 별도 확인 필요
  - 더 근본적으로는 현재 SaveSale 요청 URL/바디 스키마가 ECOUNT 실제 형식과 다른지 확인 필요

### 최신 분석 (2026-04-28 추가)
- 현재 로그상 자동 재로그인은 실제로 동작함
  - `세션 무효 감지 — 자동 재연결 시도`
  - `세션 재연결 성공`
- 그런데 재로그인 후 동일 `SaveSale` 요청도 다시 `HTTP 500 + 로그인 하기 바랍니다.` 로 실패함
- 즉, 이제 핵심은 단순 세션 만료보다 `SaveSale 호출 방식 자체`일 가능성이 큼

### 의심 1순위: SaveSale URL/인증 방식
- 현재 구현은 `https://sboapi{ZONE}.ecount.com/OAPI/V2/Sale/SaveSale` 에 POST하고 `SESSION_ID`를 header로 전달
- 그런데 ECOUNT 계열 구현 자료상
  - Zone 조회 / OAPILogin: `sboapi{ZONE}`
  - 실제 입력 API request URL: `oapi{ZONE}`
  - `SESSION_ID`도 header가 아니라 query string (`?SESSION_ID=...`) 패턴 가능성이 높음
- 따라서 Claude는 공식 문서/기존 운영 코드 기준으로 `SaveSale` request URL과 `SESSION_ID` 전달 방식을 재검증해야 함

### 의심 2순위: SaveSale body 스키마
- 현재 payload는 flat 구조:
  - `CUST_CODE`, `PROD_CODE`, `PROD_NAME`, `QTY`, `PRICE`
- 하지만 ECOUNT 판매입력 계열 예시는 보통 `SaleList[].BulkDatas` 구조와
  - `CUST`
  - `PROD_CD`
  - `PROD_DES`
  - `QTY`
  - `PRICE`
  같은 필드명을 쓰는 패턴이 강함
- 즉, 현재 flat payload 자체가 SaveSale의 기대 형식과 안 맞을 가능성이 큼

### Claude 다음 작업 지시
1. `SaveSale`의 실제 공식 요청 형식 재확인
   - base URL: `sboapi` vs `oapi`
   - `SESSION_ID`: header vs query param
   - body: flat `SaleList[]` vs `SaleList[].BulkDatas`
2. 현재 `background.js`의 `SaveSale` payload 필드명을 공식 스키마와 대조
3. `GetSaleList` 같은 조회 API가 현재 방식으로는 성공하는지 별도 확인
   - 조회는 되는데 SaveSale만 실패하면 `쓰기 API 스키마/URL` 문제 쪽으로 확정 가능
4. 특히 아래 필드는 우선 확인
   - `CUST_CODE` -> `CUST`
   - `PROD_CODE` -> `PROD_CD`
   - `PROD_NAME` -> `PROD_DES`
   - `SaleList: [{ ... }]` -> `SaleList: [{ Line, BulkDatas: { ... } }]`
