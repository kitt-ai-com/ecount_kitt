# cmux Claude-Codex 협업 분석 구조 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `AI자동화봇_도입제안서`(HTML)를 cmux 안에서 Claude(작성자)와 Codex(리뷰어)가 협업해 분석할 수 있는 디렉토리/프로토콜 구조를 셋업한다.

**Architecture:** 새 작업 디렉토리(`analysis-도입제안서/`)를 만들고, 그 안에서 Claude·Codex CLI가 같은 파일 시스템을 통해 단계별 결과물을 주고받는다. cmux 워크스페이스는 사용자가 GUI에서 직접 만들고 3분할 한다(브라우저 + Claude + Codex). 자동 오케스트레이션은 없으며, 사용자가 단계별로 트리거한다.

**Tech Stack:** Bash (디렉토리/심볼릭 링크), Markdown (프로토콜·결과물), cmux.app (GUI 워크스페이스), Claude Code CLI, codex CLI.

---

## File Structure

생성/수정할 파일:

| 경로 | 책임 |
|---|---|
| `/Users/jasonmac/claude_ai/analysis-도입제안서/` (신규 디렉토리) | 분석 작업의 루트 |
| `analysis-도입제안서/source/AI자동화봇_도입제안서.html` (심볼릭 링크) | 원본 제안서 참조 |
| `analysis-도입제안서/README.md` (신규) | 협업 프로토콜. 두 에이전트가 시작 시 반드시 읽음 |
| `analysis-도입제안서/01-claude-draft.md` (신규, placeholder) | Claude 1차 분석 자리 |
| `analysis-도입제안서/02-codex-review.md` (신규, placeholder) | Codex 리뷰 자리 |
| `analysis-도입제안서/03-claude-revised.md` (신규, placeholder) | Claude 최종 보완본 자리 |
| `analysis-도입제안서/00-summary.md` (신규, placeholder) | 의사결정 1페이지 요약 자리 |

> 작업 디렉토리(`/Users/jasonmac/claude_ai`)는 git repo가 아니므로 git commit 단계는 없음. 검증은 파일 시스템 상태 확인으로 대체한다.

---

### Task 1: 작업 디렉토리와 원본 심볼릭 링크 생성

**Files:**
- Create: `/Users/jasonmac/claude_ai/analysis-도입제안서/`
- Create: `/Users/jasonmac/claude_ai/analysis-도입제안서/source/`
- Create (symlink): `/Users/jasonmac/claude_ai/analysis-도입제안서/source/AI자동화봇_도입제안서.html` → `/Users/jasonmac/claude_ai/AI자동화봇_도입제안서`

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p "/Users/jasonmac/claude_ai/analysis-도입제안서/source"
```

- [ ] **Step 2: 원본 HTML 심볼릭 링크 생성**

```bash
ln -sf "/Users/jasonmac/claude_ai/AI자동화봇_도입제안서" \
       "/Users/jasonmac/claude_ai/analysis-도입제안서/source/AI자동화봇_도입제안서.html"
```

- [ ] **Step 3: 검증 — 디렉토리와 심볼릭 링크 존재 확인**

```bash
ls -la "/Users/jasonmac/claude_ai/analysis-도입제안서/source/"
```

Expected: `AI자동화봇_도입제안서.html -> /Users/jasonmac/claude_ai/AI자동화봇_도입제안서` 라인이 출력. 링크가 깨지지 않아야 함.

- [ ] **Step 4: 검증 — 심볼릭 링크가 올바른 파일을 가리키는지 확인**

```bash
head -c 200 "/Users/jasonmac/claude_ai/analysis-도입제안서/source/AI자동화봇_도입제안서.html"
```

Expected: `<!DOCTYPE html>`로 시작하는 HTML 출력 (한국어 메타 포함).

---

### Task 2: 협업 프로토콜 README.md 작성

**Files:**
- Create: `/Users/jasonmac/claude_ai/analysis-도입제안서/README.md`

- [ ] **Step 1: README.md 파일 작성**

다음 내용을 그대로 작성한다 (Write 도구 사용):

````markdown
# AI 음성 상담 에이전트 도입제안서 — 협업 분석 프로토콜

이 디렉토리는 **Claude(작성자)** 와 **Codex(리뷰어)** 가 협업해 `source/AI자동화봇_도입제안서.html` 을 분석하는 공간입니다. 두 에이전트는 작업을 시작하기 전 이 문서를 끝까지 읽어주세요.

## 0. 분석 대상

- 파일: `source/AI자동화봇_도입제안서.html`
- 형식: 한국어 HTML (Tailwind 기반 정적 페이지)
- 내용: AI 음성 상담 에이전트 도입 제안서

## 1. 워크플로우

| 단계 | 담당 | 산출물 | 입력 |
|---|---|---|---|
| ① 1차 분석 | Claude | `01-claude-draft.md` | `source/`, 본 README |
| ② 리뷰 | Codex | `02-codex-review.md` | `01-claude-draft.md`, 본 README |
| ③ 보완 + 요약 | Claude | `03-claude-revised.md`, `00-summary.md` | `01`, `02`, 본 README |

각 단계는 사용자가 트리거합니다. 자동 핸드오프는 없습니다.

## 2. 분석 차원 (6개)

작성자(Claude)는 1차 분석에서 다음 6개 섹션을 모두 다뤄야 합니다.

1. **무엇을(What)** — 제안의 핵심. 무엇을 도입하자는 것인가
2. **왜(Why)** — 도입 동기, 현재 문제, 기대 효과
3. **어떻게(How)** — 도입 방식, 통합 지점, 운영 모델
4. **리스크** — 기술적·운영적·보안·법적 리스크
5. **비용·ROI** — 도입 비용, 운영 비용, 회수 시점·근거
6. **권고** — Go / No-go / 조건부 Go (조건부일 경우 조건 명시)

## 3. 작성 규칙 (Claude)

- **언어**: 한국어, 마크다운
- **근거 명시**: 제안서 내 근거는 인용("…" 형태)으로, 외부 추정은 `(추정)` 으로 명시
- **톤**: 객관·중립. 옹호·폄하 없음
- **불확실성 명시**: 결정에 필요한데 제안서에 빠진 정보는 별도 "정보 부족" 섹션에 나열
- **구조**: 위 6개 차원을 H2(`##`) 헤딩으로, 마지막에 "정보 부족" H2

## 4. 리뷰 체크리스트 (Codex)

리뷰는 다음 5축으로 진행하고, 각 항목은 `01-claude-draft.md`의 어느 부분에 대한 것인지 인용으로 명시합니다.

- [ ] **누락된 관점**: 작성자가 빠뜨린 분석 차원·이해관계자·시나리오
- [ ] **근거 부족한 주장**: 제안서에 없거나 출처가 불명확한 단정
- [ ] **검증되지 않은 가정**: "당연히 ~할 것이다" 식의 암묵 가정
- [ ] **대안 미검토**: 비교했어야 할 대안 (자체 구축, 타사 솔루션, 미도입 등)
- [ ] **의사결정 정보 부족**: 결정에 필요한데 빠진 데이터·질문

리뷰 형식: 각 축마다 H2(`##`), 그 아래 발견 항목을 H3(`###`)로 정리. 인용은 markdown blockquote(`>`).

## 5. 수정 규칙 (Claude 2차)

`02-codex-review.md`의 각 리뷰 항목에 대해 다음 마커로 응답:

- ✅ **반영**: 어떻게 반영했는지 한 줄
- ❌ **반박**: 반영하지 않은 이유
- ⚠️ **부분 반영**: 일부만 수용한 이유와 범위

`03-claude-revised.md`의 첫 H2는 "## 리뷰 대응 표"로, 위 마커별 응답 표를 둡니다. 그 다음 H2부터는 §2의 6개 차원을 보완된 내용으로 다시 작성합니다.

## 6. 요약 작성 규칙 (Claude `00-summary.md`)

의사결정자가 1분 안에 읽도록 다음 구조 엄수:

```
# 도입 결정 요약

**권고**: Go / No-go / 조건부 Go

## 핵심 근거 (3~5개)
- ...

## 주요 리스크 (3개)
- ...

## 도입 시 조건 (조건부 Go의 경우)
- ...

## 다음 액션 (3개 이내)
- ...
```

분량 제한: 1페이지 (≈ 500자 내외).

## 7. 파일명 규약

- `00-` 접두는 요약 (전체 문서 위에 정렬)
- `01-` ~ `03-` 은 작업 순서
- 파일명은 절대 변경하지 말 것 (다른 에이전트가 정확한 이름으로 참조)
````

- [ ] **Step 2: 검증 — README.md가 작성되었는지 확인**

```bash
wc -l "/Users/jasonmac/claude_ai/analysis-도입제안서/README.md"
```

Expected: 80줄 이상.

- [ ] **Step 3: 검증 — 핵심 섹션이 모두 포함되었는지 확인**

```bash
grep -c "^## " "/Users/jasonmac/claude_ai/analysis-도입제안서/README.md"
```

Expected: 8 (섹션 0~7).

---

### Task 3: 결과물 placeholder 파일 4개 생성

**Files:**
- Create: `/Users/jasonmac/claude_ai/analysis-도입제안서/01-claude-draft.md`
- Create: `/Users/jasonmac/claude_ai/analysis-도입제안서/02-codex-review.md`
- Create: `/Users/jasonmac/claude_ai/analysis-도입제안서/03-claude-revised.md`
- Create: `/Users/jasonmac/claude_ai/analysis-도입제안서/00-summary.md`

각 파일은 짧은 placeholder 헤더만 가진다. 내용은 cmux 안에서 에이전트가 채울 자리.

- [ ] **Step 1: `01-claude-draft.md` 생성**

내용:

```markdown
# 01 · Claude 1차 분석 (작성 대기)

> 이 파일은 Claude(작성자)가 채울 자리입니다.
> README.md §3 작성 규칙에 따라 §2의 6개 분석 차원을 모두 다루세요.
```

- [ ] **Step 2: `02-codex-review.md` 생성**

내용:

```markdown
# 02 · Codex 리뷰 (작성 대기)

> 이 파일은 Codex(리뷰어)가 채울 자리입니다.
> README.md §4 리뷰 체크리스트에 따라 5축 리뷰를 작성하세요.
> `01-claude-draft.md`를 인용하며 진행하세요.
```

- [ ] **Step 3: `03-claude-revised.md` 생성**

내용:

```markdown
# 03 · Claude 2차 보완본 (작성 대기)

> 이 파일은 Claude(작성자)가 리뷰 반영 후 채울 자리입니다.
> README.md §5 수정 규칙에 따라 첫 H2는 "## 리뷰 대응 표"로 시작하세요.
```

- [ ] **Step 4: `00-summary.md` 생성**

내용:

```markdown
# 00 · 의사결정 요약 (작성 대기)

> 이 파일은 Claude가 `03-claude-revised.md` 작성 후 마지막으로 채우는 1페이지 요약입니다.
> README.md §6 구조 엄수.
```

- [ ] **Step 5: 검증 — 4개 파일 모두 존재 확인**

```bash
ls -1 "/Users/jasonmac/claude_ai/analysis-도입제안서/" | grep -E "^(00|01|02|03)-.*\.md$"
```

Expected: 정확히 4줄.
```
00-summary.md
01-claude-draft.md
02-codex-review.md
03-claude-revised.md
```

- [ ] **Step 6: 검증 — 디렉토리 전체 구조 최종 확인**

```bash
find "/Users/jasonmac/claude_ai/analysis-도입제안서" -maxdepth 2 -print | sort
```

Expected:
```
/Users/jasonmac/claude_ai/analysis-도입제안서
/Users/jasonmac/claude_ai/analysis-도입제안서/00-summary.md
/Users/jasonmac/claude_ai/analysis-도입제안서/01-claude-draft.md
/Users/jasonmac/claude_ai/analysis-도입제안서/02-codex-review.md
/Users/jasonmac/claude_ai/analysis-도입제안서/03-claude-revised.md
/Users/jasonmac/claude_ai/analysis-도입제안서/README.md
/Users/jasonmac/claude_ai/analysis-도입제안서/source
/Users/jasonmac/claude_ai/analysis-도입제안서/source/AI자동화봇_도입제안서.html
```

---

### Task 4: cmux 워크스페이스 셋업 가이드 사용자에게 출력

cmux는 GUI 앱이므로 자동 셋업이 불가능하다. 사용자가 따라할 수 있는 명확한 단계를 출력한다.

**Files:** 없음 (출력만)

- [ ] **Step 1: 사용자에게 다음 가이드를 메시지로 전달**

```
## cmux 워크스페이스 셋업 가이드

준비가 끝났습니다. cmux에서 다음 순서로 워크스페이스를 여세요.

1. cmux.app 실행 (Spotlight: "cmux")
2. 새 워크스페이스 추가:
   - 사이드바 하단 "+" 버튼 → "Open Folder"
   - 폴더 선택: /Users/jasonmac/claude_ai/analysis-도입제안서
3. 워크스페이스가 열리면 첫 pane을 3분할:
   - cmd+d (오른쪽 split) → 두 번 실행하면 가로 3분할
   - 또는 cmd+shift+d (아래 split) 조합으로 원하는 모양으로
4. 각 pane 설정:
   - 좌측 pane: cmd+shift+l (브라우저 열기)
     · 주소창에 file:///Users/jasonmac/claude_ai/analysis-도입제안서/source/AI자동화봇_도입제안서.html
   - 가운데 pane (터미널): claude 입력 후 Enter
   - 오른쪽 pane (터미널): codex 입력 후 Enter
5. 분석 시작 — 가운데 Claude pane에서 다음 프롬프트 입력:
   README.md를 먼저 읽고, 그 규칙에 따라 source/AI자동화봇_도입제안서.html을 분석해서 01-claude-draft.md에 1차 분석을 작성해줘.
6. Claude 작성이 끝나면 오른쪽 Codex pane에서:
   README.md와 01-claude-draft.md를 읽고, README §4 체크리스트에 따라 02-codex-review.md에 리뷰를 작성해줘.
7. Codex 리뷰가 끝나면 다시 가운데 Claude pane에서:
   02-codex-review.md를 반영해서 03-claude-revised.md를 작성하고, 그 다음 00-summary.md에 1페이지 의사결정 요약을 써줘.
```

- [ ] **Step 2: 사용자 확인 받기**

사용자에게: "워크스페이스 열고 첫 pane이 정상 동작하면 알려주세요. 막히는 부분이 있으면 도와드리겠습니다."

---

## Self-Review

**Spec coverage:** 모든 spec 항목이 plan에 매핑됨.
- 디렉토리 구조 → Task 1
- README 협업 프로토콜 → Task 2
- 결과물 파일 4개 → Task 3
- cmux 셋업 가이드 → Task 4
- spec의 비목표(자동 오케스트레이션 없음, 사람이 트리거)도 Task 4 가이드에서 명시적으로 따름.

**Placeholder scan:** TBD/TODO 없음. 결과물 파일들은 의도된 placeholder(에이전트가 채우는 자리)이며 표시 명확.

**Type consistency:** 파일명·경로가 모든 task에서 일관됨. README 섹션 번호(§3, §4, §6)가 placeholder 안내문과 일치.
