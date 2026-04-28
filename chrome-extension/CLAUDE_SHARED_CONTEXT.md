# Shared Context — Claude Code ↔ Codex 협업 프로토콜

## 역할 분담

### Codex (분석 터미널)
- 원인 분석, 디버깅, 로그 해석
- 작업 지시서 작성 → 이 파일 또는 `CLAUDE.md`에 기록
- 코드 직접 수정 X — 가이드라인/지시서만 작성
- 검증 기준 정의, 테스트 시나리오 설계

### Claude Code (개발 터미널)
- Codex가 작성한 지시서를 읽고 코드 구현
- 구현 전 이 파일의 `## 현재 작업 지시`를 반드시 확인
- 구현 완료 후 `## 구현 완료 보고`에 결과 기록
- 지시서 범위 밖의 코드는 건드리지 않음

## 협업 흐름

```
1. 사용자 → 이슈 발견/기능 요청
2. Codex → 원인 분석 + 작업 지시서 작성 (이 파일 또는 CLAUDE.md)
3. 사용자 → Claude Code에 "실행" 지시
4. Claude Code → 지시서 읽기 → 가이드 제시 → 승인 후 구현
5. Claude Code → 구현 완료 보고 기록
6. Codex → 결과 검증 + 후속 이슈 분석
7. 반복
```

## 공유 규칙

- **파일 충돌 방지**: 동일 파일 동시 수정 금지. 작업 대상 파일을 `## 현재 작업 지시 > 대상 파일`에 명시
- **스코프 제한**: 지시서에 명시된 파일/함수만 수정. "ついでに" 리팩토링 금지
- **에러 분류 표준**: `[세션]`, `[네트워크]`, `[서버]`, `[입력]` 접두사 사용
- **민감 정보**: API 키/SESSION_ID 전체 출력 금지 (앞 8자 + `...`)
- **가이드 우선**: Claude Code도 구현 전 가이드를 먼저 제시하고 사용자 승인 후 실행
- **공유 위치 고정**: 지금부터 Codex의 최신 분석/지시/검증 메모는 이 파일에 우선 기록. `CLAUDE.md`는 보조 문맥으로만 사용

## 프로젝트 정보

- **경로**: `/Users/jasonmac/Claude/cnc-korea-erp/chrome-extension`
- **AI 프로바이더**: Google Gemini (무료, 기본) / OpenCode / Anthropic (선택)
- **ECOUNT 인증**: comCode=184153, userId=CNCKOREA21, Zone=BA
- **성공 코드**: ECOUNT Status="200", 내부 Code="00"

## 해결 완료 이슈

| 날짜 | 이슈 | 해결 |
|------|------|------|
| 04-28 | API_CERT_KEY 유효하지 않음 | 실제 키 발급 |
| 04-28 | Code "00"을 에러로 오판 | !== "00" 체크 수정 |
| 04-28 | Claude API 키 마스킹 저장 | getAnthropicApiKey() 검증 |
| 04-28 | OpenCode 크레딧 소진 | Google Gemini 전환 |
| 04-28 | Gemini 2.0-flash 비활성화 | 2.5 계열 fallback |
| 04-28 | 세션 만료 시 저장 실패 | reconnectEcountSession() 자동 재연결 |
| 04-28 | 워크플로우 실행/저장 미분리 | 2단계 (파싱→확인→저장) 분리 |

---

## 현재 작업 지시

> Codex가 새 작업 지시를 여기에 작성합니다.
> Claude Code는 이 섹션을 읽고 구현합니다.

### 상태: 진행 중

**이슈명**
- `kakao-order` SaveSale 실패 지속

**대상 파일**
- `background.js`

**현재까지 확인된 사실**
- AI 파싱은 정상
- 금액 0 문제는 이미 해결됨
- 현재 payload 예:
  - 1건차: `IO_DATE=20260428`, `CUST=''`, `PROD=A0001`, `QTY=50`, `PRICE=50000`
  - 2건차: `IO_DATE=20260428`, `CUST=''`, `PROD=T001`, `QTY=10`, `PRICE=50000`
- `ecountRequest()`의 세션 무효 감지와 `reconnectEcountSession()`는 실제로 동작함
  - 로그: `세션 무효 감지 — 자동 재연결 시도`
  - 로그: `세션 재연결 성공`
- 그런데 재로그인 후 동일 `SaveSale` 요청도 다시 실패함
  - 1건차: HTTP 500 + JSON body `"로그인 하기 바랍니다."`
  - 2건차: HTTP 412 + HTML 응답

### 최신 상태 업데이트 (저장 성공 응답 이후)
- 현재 `SaveSale` 요청 형식을 `Line + BulkDatas`, `CUST/PROD_CD/PROD_DES` 구조로 바꾼 뒤
  - `Status=200`
  - `Msg=OK`
  응답까지는 정상 확인됨
- 하지만 사용자가 실제 ECOUNT 판매조회에서도 해당 데이터를 찾지 못함
- 따라서 이전 `조회 조건/날짜 오해` 가설은 우선순위가 내려감

**중요 로그 포인트**
- 실제 저장 요청 `IO_DATE`가 로그에 그대로 찍힘
  - 한 실행: `IO_DATE=20260428` = 2026년 4월 28일
  - 다른 실행: `IO_DATE=20230428` = 2023년 4월 28일
- 날짜 오해 가능성은 있었지만, 사용자가 실제 판매조회에서도 없다고 확인했으므로 이제 핵심은 응답 해석 문제

**새 핵심 판단**
- 지금 가장 가능성 높은 원인은 `Status=200`만 보고 성공 처리했지만,
  실제 본문 `Data.ResultDetails`, `SuccessCnt`, `FailCnt`, `SlipNos`를 확인하지 않아
  "API 호출 성공"을 "전표 저장 성공"으로 오판하고 있는 것
- ECOUNT 예시상 validation 실패도 `Status=200`으로 내려올 수 있음
- 따라서 `Msg=OK` 로그는 저장 성공의 충분조건이 아님

### 최신 상태 업데이트 (실제 validation 에러 확인)
- 이제 SaveSale 응답 본문 오류가 실제로 확인됨
- 현재 sidepanel 표시 기준 row별 실패 메시지:
  - `[전표묶음0] 출하창고(필수), 부서(필수), 품목코드(미등록코드[A0001])`
  - `[전표묶음1] 출하창고(필수), 부서(필수), 품목코드(미등록코드[T001])`
- 따라서 원인은 세션/응답 해석 문제가 아니라 ECOUNT 필수 입력값 미충족과 품목코드 미등록임
- `CUST=''` 공란보다 우선순위 높은 실제 blocker는 아래 3개
  1. 출하창고 코드 필수
  2. 부서 코드 필수
  3. 품목코드 `A0001`, `T001` 이 ECOUNT에 미등록

### 최신 상태 업데이트 (사전 검증 UI 동작)
- 현재 UI에서 API 호출 전 사전 검증이 추가로 동작함
- 최신 사용자 화면 에러:
  - `[입력] 출하창고 코드가 설정되지 않았습니다. 설정 탭 > 이카운트 기본값에서 설정하세요.`
- 의미:
  - 이제 출하창고 코드가 없으면 SaveSale 호출 전에 바로 차단됨
  - 이전처럼 ECOUNT 응답까지 갔다가 실패하는 것이 아니라, 로컬 검증에서 먼저 막는 상태
- 최신 화면 흐름 확인:
  - `다시 파싱` / `이카운트 저장` 2단계 UI가 보임
  - `이카운트 저장` 클릭 시점에 위 입력 검증 에러가 발생
  - 즉, AI 파싱 단계는 통과했고 저장 단계 진입 시 기본값 검증에서 중단됨
- 다음 실제 blocker 순서:
  1. 출하창고 코드 설정
  2. 부서 코드 설정
  3. 품목명/내부약칭 -> 실제 ECOUNT 품목코드 매핑

### 최신 상태 업데이트 (ESA009M.xlsx 반영)
- 사용자가 제공한 파일: `/Users/jasonmac/Downloads/ESA009M.xlsx`
- 시트 구성:
  - `품목등록` 1개 시트
- 컬럼:
  - `품목코드`, `품목명`, `규격정보`, `단위`, `입고단가`, `출고단가`, `구매처명`, `적요`, `검색창내용`, `재고수량관리`, `사용`
- 결론:
  - 이 파일은 `품목 마스터` 용도임
  - `출하창고 코드`, `부서 코드` 정보는 없음
  - 따라서 이 파일로 해결 가능한 것은 `품목코드 매핑`까지만임

**확인된 사실**
- 현재 사용 중인 내부 코드 `A0001`, `T001`은 이 파일에 존재하지 않음
- 즉, `A0001`, `T001`은 ECOUNT 실제 품목코드가 아니라 내부 약칭/임시코드로 판단됨

**품목코드 후보 (엑셀 기준)**
- 테이프 후보
  - `003-리드` : `OPP 아크릴 테이프 _박스 (50입)` / 출고단가 `35000`
  - `344-리드상사` : `우림박스테이프 L3-경포장 (50MX50개)투명` / 출고단가 `27500`
  - `346-리드상사` : `우림박스테이프 H3-중포장(50MX50개)투명` / 출고단가 `30100`
  - `103-리드` : `OPP 아크릴 테이프 (중포장용) (50입)`
- 아이스팩 후보
  - `1512-JH` : `PE 비동결 워터 아이스팩 12x17(1박스 90EA)` / 출고단가 `110`
  - `1617-아주` : `비피젠 아이스팩 A` / 출고단가 `68`
  - `1683-AJ` : `얼린아이스팩(소)_120*180` / 출고단가 `134`
- 박스/냉동 포장 관련 후보
  - `918` : `JH글로벌 박스3호(무인쇄/아이스팩)` / 출고단가 `740`
  - `024`, `024-1` : `아워홈용 골판박스 1호(소)` 계열 / 출고단가 `231`

### 사용자 확정 매핑 예시 (카톡 주문 기준)
- 카톡 예시:
  - `리드상사입니다`
  - `OPP 아크릴 테이프 박스 50입 2박스 부탁합니다`
  - `단가 35,000원`
- 이 문구가 들어오면 우선 아래처럼 매핑
  - 거래처명(표시용): `리드상사`
  - 품목명: `OPP 아크릴 테이프 박스 50입`
  - 품목코드: `003-리드`
  - 수량: `2`
  - 단가: `35000`
  - 금액: `70000`
- 근거:
  - `ESA009M.xlsx > 품목등록`에서
  - `003-리드 = OPP 아크릴 테이프 _박스 (50입)`
  - 출고단가 `35000`

**파싱/매핑 규칙 추가**
- 아래 표현들은 동일 품목으로 우선 매핑
  - `OPP 아크릴 테이프 박스 50입`
  - `OPP 아크릴 테이프 박스`
  - `테이프 박스 50입`
  - `리드상사 테이프 박스`
- 위 표현이 들어오면 `PROD_CD='003-리드'` 우선 적용
- 수량 표현 `2박스`는 `QTY=2`로 해석
- `단가 35,000원`이 있으면 `PRICE=70000`이 아니라
  - 단가 `unitPrice=35000`
  - 총금액 `amount=70000`
  로 계산해서 저장 payload 생성

**주의**
- 이 확정은 `테이프` 케이스에 한정
- `리드상사입니다`는 현재 거래처명 표시/파싱 힌트로는 사용 가능
- 하지만 ECOUNT `거래처코드(CUST)`로 무엇을 넣을지는 별도 거래처 매핑이 필요할 수 있음

**의미**
- 저장 전 품목 매핑 로직에서 `박스`, `테이프`, `아이스팩`을 위 실제 품목코드 후보로 바꾸는 흐름이 필요
- 다만 어떤 코드를 쓸지는 현재 사용자 운영 기준에 따라 확정해야 함
  - 예: 테이프를 `003-리드`로 볼지 `344-리드상사`/`346-리드상사`로 볼지
  - 예: 아이스팩을 `1512-JH` / `1617-아주` / `1683-AJ` 중 무엇으로 볼지
  - 예: 박스를 `918`로 볼지 다른 박스 코드로 볼지

**Claude Code 다음 작업 추가**
1. 설정 또는 매핑 테이블에 사용자 확정 품목코드를 넣을 수 있게 할 것
2. `A0001`, `T001` 같은 임시코드를 직접 SaveSale에 보내지 말 것
3. `ESA009M.xlsx`의 `품목등록` 시트를 기준으로 품목명/별칭 -> 실제 `품목코드` 검색 보조를 제공할 것
4. 출하창고/부서 코드는 이 파일에 없으므로 별도 설정값 입력 흐름을 유지할 것

**핵심 판단**
- 단순 세션 만료 문제는 해결됨
- SaveSale 호출 방식 수정도 1차 통과
- 현재 남은 핵심은 `필수 값 매핑`과 `ECOUNT 마스터 코드 정합성`
- 즉, 카톡 파싱 결과만으로는 저장 불가하고 아래 코드 매핑 계층이 필요
  - 제품명/별칭 -> 실제 ECOUNT 품목코드
  - 기본 출하창고 코드
  - 기본 부서 코드

**확정된 blocker**
- `WH_CD` 또는 출하창고 필드 누락
- `DEPT_CD` 또는 부서 필드 누락
- `PROD_CD`에 들어간 `A0001`, `T001`이 ECOUNT 미등록 코드

**추가 확인값**
- `CUST=''` 공란 허용 여부는 여전히 확인 필요하나, 현재는 위 3개가 먼저 해결되어야 함

**Claude Code 다음 작업**
1. `workflowKakaoOrder()` 저장 payload에 ECOUNT 필수 필드를 채우는 방식으로 수정
   - 출하창고 코드 필드 추가
   - 부서 코드 필드 추가
   - 실제 ECOUNT 품목코드만 `PROD_CD`에 들어가도록 보정
2. 제품명/별칭 -> ECOUNT 품목코드 매핑 계층 추가
   - 예: `박스`/`박스 A0001` -> 실제 등록 품목코드
   - 예: `테이프`/`테이프 T001` -> 실제 등록 품목코드
   - 현재 `A0001`, `T001`은 사용자 내부 약칭일 뿐 ECOUNT 코드가 아닌 것으로 판단
3. 설정 탭 또는 기본 설정값에 아래 코드 보관 방식 추가 검토
   - 기본 출하창고 코드
   - 기본 부서 코드
4. SaveSale 전 사전 검증 추가
   - 출하창고 코드 없음 -> API 호출 전에 실패
   - 부서 코드 없음 -> API 호출 전에 실패
   - 품목코드 미매핑 -> API 호출 전에 실패
5. 응답 본문 검증 로직은 유지
   - `SuccessCnt`
   - `FailCnt`
   - `ResultDetails`
   - `SlipNos`
6. `CUST=''`는 위 blocker 해소 후 별도 확인

**검증 기준**
1. 출하창고/부서/품목코드 미등록 오류가 더 이상 나타나지 않을 것
2. `SuccessCnt > 0`, `FailCnt = 0`, `ResultDetails[].IsSuccess = true`, `SlipNos.length > 0` 확인
3. 반환된 `SlipNo`로 실제 ECOUNT 판매조회에서 전표가 보여야 함
4. 품목코드 매핑 실패 시 API 호출 전에 사용자에게 명확한 오류를 보여줄 것

---

## 구현 완료 보고

> Claude Code가 구현 후 여기에 결과를 기록합니다.
> Codex가 검증 시 참고합니다.

### 최근 구현 (2026-04-28 #4) — 필수 필드 추가 (WH_CD, DEPT_CD)

**index.html — 이카운트 기본값 설정 UI 추가**
- 출하창고 코드 (`setDefaultWH`)
- 부서코드 (`setDefaultDept`)
- 거래처코드 (`setDefaultCust`, 선택)
- `btnSaveDefaults` → `chrome.storage.local` `ecount_defaults` 저장

**app.js — 기본값 저장/로드**
- `initSettings()`에 `btnSaveDefaults` 이벤트 추가
- `loadSettings()`에서 `ecount_defaults` 로드 → input 복원

**background.js — payload에 WH_CD, DEPT_CD 추가**
- `workflowKakaoOrder()`: 기본값 로드 + 사전 검증 (WH_CD/DEPT_CD 없으면 API 호출 전 실패)
- 모든 SaveSale 워크플로우: `WH_CD`, `DEPT_CD` 포함
- SavePurchase도 동일 적용
- CUST 필드: row 값 없으면 기본값 사용

**사용자 필요 작업**
1. 확장 리로드
2. 설정 탭 > 이카운트 기본값 설정에서 출하창고/부서코드 입력
3. 품목코드(PROD_CD)는 이카운트에 등록된 실제 코드 사용 필요 (A0001, T001이 미등록이면 등록 또는 매핑 필요)
4. 카톡 주문 저장 재테스트

---

### 이전 구현 (2026-04-28 #3) — SaveSale 응답 본문 검증 강화

**background.js `workflowKakaoOrder()` 성공 판정 강화**
- 변경 전: `Status=200`이면 무조건 `success: true`
- 변경 후: 아래 조건 모두 충족해야 `success: true`
  - `FailCnt === 0`
  - `ResultDetails.every(r => r.IsSuccess === true)` (또는 빈 배열)
- 응답에서 추출하는 값: `SuccessCnt`, `FailCnt`, `ResultDetails`, `SlipNos`
- 실패 시 `ResultDetails[].Errors`, `TotalError`를 에러 메시지로 포함

**background.js 로그 강화**
- SaveSale 응답마다 `SuccessCnt`, `FailCnt`, `SlipNos`, `ResultDetails` 전체 로그
- 각 row 결과에 `slipNos`, `successCnt`, `ioDate`, `resultDetails` 포함

**app.js 결과 표시 강화**
- 성공 row: `IO_DATE`, `SlipNo`, `SuccessCnt` 표시
- 실패 row: 에러 메시지 + `ResultDetails[].Errors`, `TotalError` 상세 표시

**검증 필요**
1. 확장 리로드 후 카톡 주문 저장 → 로그에 `SuccessCnt/FailCnt/SlipNos` 확인
2. `SlipNos`가 반환되면 이카운트 판매조회에서 해당 번호로 검증
3. `CUST=''` 공란이 validation 실패를 만드는지 `ResultDetails.Errors`로 확인

---

### 이전 구현 (2026-04-28 #2) — SaveSale 호출 방식 수정

**ecountRequest() SESSION_ID 전달 방식 변경**
- 변경 전: `SESSION_ID`를 HTTP header로 전달
- 변경 후: URL query parameter로 전달 `?SESSION_ID={sid}`
- `encodeURIComponent()` 적용

**SaveSale body 스키마 변경 (kakao-order 외 전체)**
- 변경 전: flat `SaleList: [{ IO_DATE, CUST_CODE, PROD_CODE, PROD_NAME, ... }]`
- 변경 후: `SaleList: [{ Line: N, BulkDatas: { IO_DATE, CUST, PROD_CD, PROD_DES, ... } }]`
- 필드명 매핑:
  - `CUST_CODE` → `CUST`
  - `PROD_CODE` → `PROD_CD`
  - `PROD_NAME` → `PROD_DES`
- 적용 대상: `workflowKakaoOrder`, `workflowPGSettlementRegister`, `workflowPGToSales`, `workflowCafe24ToSales`, `workflowPayrollEntry`

**SavePurchase body도 동일 적용**
- `PurchaseList: [{ Line: 0, BulkDatas: { CUST, PROD_CD, ... } }]`
- 적용 대상: `workflowInvoiceToPurchase`

**검증 필요**
1. 확장 리로드 후 카톡 주문 저장 테스트 — `로그인 하기 바랍니다` 해소 여부
2. SaveSale 응답에서 Status=200, Code=00 정상 반환 여부
3. 이카운트 판매조회에서 실제 등록 확인

---

### 이전 구현 (2026-04-28 #1)

**ecountRequest() HTTP 500 JSON 파싱 수정 (Codex 지시)**
- 문제: ECOUNT가 HTTP 500 + JSON body `"로그인 하기 바랍니다"` 반환 시, `!res.ok`에서 바로 `[네트워크]` throw → 세션 재연결 로직 미도달
- 수정: `res.text()` → `JSON.parse()` 시도 후 파싱 성공하면 세션 무효 감지 로직으로 진행
- JSON 파싱 실패한 순수 transport 에러만 `[네트워크]` 처리
- HTTP 500 + ECOUNT JSON은 `[세션]` 또는 `[서버]`로 정상 분류

**background.js 세션 안정화 (CLAUDE.md 지시 기반)**
- `reconnectEcountSession()` 추가 — credentials 기반 자동 재로그인
- `ecountRequest()` 보강 — 세션 무효 감지 + 1회 자동 재시도 (`_retried` 플래그)
- `workflowKakaoOrder()` — 금액 0 사전 차단, 에러 타입 분류
- `getStoredSession()` — 24시간 경과 시 자동 재연결
- 로그: 호출 직전 핵심 필드, 응답 Status/Message, SID 8자 제한

**app.js 2단계 워크플로우**
- [실행] → AI 파싱 + 미리보기만
- [이카운트 저장] → 실제 API 호출 + 결과 상세 로그

**AI 프로바이더 3종 분리**
- Gemini (무료, 기본) / OpenCode / Anthropic
- `callAI()`, `callAIVision()` — 프로바이더별 자동 분기
- Gemini fallback: 2.5-flash → 2.5-flash-lite → 2.5-pro
