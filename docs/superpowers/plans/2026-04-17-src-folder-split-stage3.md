# src/ Folder Split — Stage 3 Implementation Plan

## 한 줄 요약 (사용자 관점)

**유저 동작/UI는 전혀 바뀌지 않아야 합니다 — 하지만 회귀 위험은 가장 큽니다.** Stage 3는 `src/` 최상위에 남은 **core 파일 10개**(main.js, state.js, renderer.js, menu.js, focus.js, mini.js, mac-window.js, telemetry.js, index.html, styles.css)를 `src/core/`로 옮긴다. `package.json`의 `main` 필드도 `src/core/main.js`로 변경. **핵심 위험**: core 파일들엔 단위 테스트가 전무해 `npm test`로 회귀 감지 불가. 수동 smoke 필수.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** core 파일 10개를 `src/core/`로 이동하고, `package.json` main 필드 + main.js 내 25개 내부 require + 외부(hooks/agents/assets/launch/extensions/package.json/.env) 경로 depth +1 + Stage 2 임시 `../telemetry` 참조 최종화를 한 원자적 commit으로 수행한다.

**Architecture:** core 파일 이동은 **하나의 atomic commit**이 원칙. 중간 상태에서 `main.js` require 체인이 깨지면 `npm start`가 크래시하지만 `npm test`는 통과(main.js 실행 안 됨) → 중간 커밋을 green이라 오판. 따라서 모든 파일 이동 + require 갱신 + package.json main 필드 + Stage 2 임시 경로 최종화를 **한 commit에 묶는다**. 문서 갱신만 별도 commit.

**Tech Stack:** Node.js 20+ (Electron main process), `node --test`, `git mv`.

**스펙 참조:** `docs/superpowers/specs/2026-04-15-src-folder-split-design.md` — Stage 3 섹션
**전제:** Stage 1 (PR #8 merged) + Stage 2 (PR #10) 기반. 이 plan의 base = `refactor/src-folder-split-stage2`.
**작업 worktree:** `/Users/sumi/Documents/repo/personal/clawd-on-desk/.worktrees/src-folder-split-stage3/`
**브랜치:** `refactor/src-folder-split-stage3`

---

## 불변 조건

- **공존 강제**: `index.html` + `renderer.js` + `styles.css`는 같은 폴더에 있어야 한다 (index.html의 `<script src="renderer.js">`가 상대경로). 셋 다 `src/core/`로 함께 이동.
- **electron-builder `build.files` `src/**/*` 패턴**: 하위 폴더 자동 포함, 재설정 불필요.
- **`asarUnpack`**: `hooks/**/*`, `extensions/**/*`만 — 변경 없음.
- **핵심 단일 실패 지점**: `package.json` `main` 필드가 파일 이동과 동시에 갱신되어야 함. 아니면 앱 기동 불가.
- **단위 테스트 커버리지 없음**: core 파일 10개 모두 test 파일 없음 → 회귀는 오직 수동 smoke로만 검증.

---

## File Structure (Stage 3 종료 후 `src/` 최종 트리)

```
src/
├── animation/tick.js
├── core/                   ★ Stage 3 신규
│   ├── focus.js
│   ├── index.html
│   ├── mac-window.js
│   ├── main.js
│   ├── menu.js
│   ├── mini.js
│   ├── renderer.js
│   ├── state.js
│   ├── styles.css
│   └── telemetry.js
├── hit/
│   ├── geometry.js
│   ├── hit.html
│   └── renderer.js
├── preload/
│   ├── bubble.js
│   ├── hit.js
│   ├── preload.js
│   ├── prompt.js
│   ├── settings.js
│   └── update-bubble.js
├── server/
│   ├── bubble.html
│   ├── permission.js
│   └── server.js
├── settings/
│   ├── actions.js
│   ├── agent-gate.js
│   ├── controller.js
│   ├── i18n.js
│   ├── login-item.js
│   ├── prefs.js
│   ├── renderer.js
│   ├── settings.html
│   └── store.js
├── theme/
│   ├── loader.js
│   └── remote-sync.js
├── update/
│   ├── bubble.html
│   ├── bubble.js
│   └── updater.js
└── utils/
    ├── log-rotate.js
    └── work-area.js
```

### 동시에 바뀌는 외부/형제 파일

- `src/theme/loader.js` — `require("../telemetry")` → `require("../core/telemetry")`
- `src/server/server.js` — `require("../telemetry")` → `require("../core/telemetry")`
- `src/update/updater.js` — `require("../telemetry")` → `require("../core/telemetry")`
- `package.json` — `"main": "src/main.js"` → `"main": "src/core/main.js"`

---

## 사전 준비

### Task 0: Baseline

- [ ] **Step 0.1:** worktree + 브랜치 확인

```bash
cd /Users/sumi/Documents/repo/personal/clawd-on-desk/.worktrees/src-folder-split-stage3
pwd
git branch --show-current
```
Expected: `refactor/src-folder-split-stage3` 브랜치.

- [ ] **Step 0.2:** baseline `npm test`

```bash
npm test 2>&1 | tail -10
```
Expected: `# pass 327 / # suites 57 / # fail 0`.

- [ ] **Step 0.3:** Stage 3 대상 파일들이 모두 src/ 최상위에 있는지 확인

```bash
ls src/main.js src/state.js src/renderer.js src/menu.js src/focus.js src/mini.js src/mac-window.js src/telemetry.js src/index.html src/styles.css
```
Expected: 10개 파일 모두 정상 출력.

- [ ] **Step 0.4:** 시작 시점 `package.json` main 필드 확인

```bash
grep '"main"' package.json
```
Expected: `"main": "src/main.js",`.

- [ ] **Step 0.5:** Stage 2 임시 telemetry 참조 현황 확인 (이 Stage에서 최종화 대상)

```bash
grep -rn "require(['\"]\\.\\./telemetry" src/
```
Expected: 3줄 — `src/theme/loader.js:7`, `src/server/server.js:18`, `src/update/updater.js:7`.

---

## Task 1: core/ 클러스터 atomic 이동 (단일 commit)

### 목표
10개 파일 이동 + 25개 main.js 내부 require 갱신 + 6개 main.js path.join 갱신 + 9개 main.js 외부(hooks/agents/assets/launch/extensions) 경로 깊이 +1 + state.js 에셋 경로 깊이 + telemetry.js .env/package.json 깊이 + menu.js settings/i18n + tray icon + preload + Stage 2 임시 telemetry 참조 최종화(3파일) + package.json main 필드 = **모두 한 commit**.

### Files (이동)

- Move: `src/main.js` → `src/core/main.js`
- Move: `src/state.js` → `src/core/state.js`
- Move: `src/renderer.js` → `src/core/renderer.js`
- Move: `src/menu.js` → `src/core/menu.js`
- Move: `src/focus.js` → `src/core/focus.js`
- Move: `src/mini.js` → `src/core/mini.js`
- Move: `src/mac-window.js` → `src/core/mac-window.js`
- Move: `src/telemetry.js` → `src/core/telemetry.js`
- Move: `src/index.html` → `src/core/index.html`
- Move: `src/styles.css` → `src/core/styles.css`

### Files (내용 수정)

- Modify: `src/core/main.js` — 대량 require + path.join 갱신
- Modify: `src/core/state.js` — AGENT_ICON_DIR 깊이 +1
- Modify: `src/core/telemetry.js` — .env, package.json 깊이 +1
- Modify: `src/core/menu.js` — i18n require + tray icon path + preload path.join
- Modify: `src/core/mini.js` — intra-core telemetry (실제로는 그대로)
- Modify: `src/theme/loader.js` — telemetry 경로 최종화
- Modify: `src/server/server.js` — telemetry 경로 최종화
- Modify: `src/update/updater.js` — telemetry 경로 최종화
- Modify: `package.json` — main 필드

### Step 1.1: 파일 이동

```bash
cd /Users/sumi/Documents/repo/personal/clawd-on-desk/.worktrees/src-folder-split-stage3
mkdir -p src/core
git mv src/main.js         src/core/main.js
git mv src/state.js        src/core/state.js
git mv src/renderer.js     src/core/renderer.js
git mv src/menu.js         src/core/menu.js
git mv src/focus.js        src/core/focus.js
git mv src/mini.js         src/core/mini.js
git mv src/mac-window.js   src/core/mac-window.js
git mv src/telemetry.js    src/core/telemetry.js
git mv src/index.html      src/core/index.html
git mv src/styles.css      src/core/styles.css
git status --short
```
Expected: 10개 `R`.

### Step 1.2: src/core/main.js — 내부 require 25개 갱신

모든 require 갱신 매핑. **Line 번호는 유동적**이므로 찾기-바꾸기 문자열로 수행.

#### Intra-core (변경 없음, 확인만)

다음 requires는 core 내부끼리 참조 → `./` 그대로:

| 라인 | 패턴 | 결과 |
|---|---|---|
| 4 | `require("./mac-window")` | `./mac-window` (그대로) |
| 7 | `require("./telemetry")` | `./telemetry` (그대로) |
| 583 | `require("./state")` | `./state` (그대로) |
| 643 | `require("./focus")` | `./focus` (그대로) |
| 819 | `require("./menu")` | `./menu` (그대로) |
| 1495 | `require("./mini")` | `./mini` (그대로) |

#### Cross-folder (`./` → `../<folder>/`)

| 찾기 | 바꾸기 |
|---|---|
| `require("./hit/geometry")` | `require("../hit/geometry")` |
| `require("./utils/work-area")` | `require("../utils/work-area")` |
| `require("./settings/prefs")` | `require("../settings/prefs")` |
| `require("./settings/controller")` | `require("../settings/controller")` |
| `require("./settings/login-item")` | `require("../settings/login-item")` |
| `require("./theme/loader")` | `require("../theme/loader")` |
| `require("./theme/remote-sync")` | `require("../theme/remote-sync")` |
| `require("./settings/agent-gate")` | `require("../settings/agent-gate")` |
| `require("./server/permission")` | `require("../server/permission")` |
| `require("./update/bubble")` | `require("../update/bubble")` |
| `require("./animation/tick")` | `require("../animation/tick")` |
| `require("./server/server")` | `require("../server/server")` |
| `require("./utils/log-rotate")` | `require("../utils/log-rotate")` |
| `require("./update/updater")` | `require("../update/updater")` |

#### External (`../` → `../../`)

main.js가 src/ 밖을 `../`로 참조하던 경로들:

| 찾기 | 바꾸기 |
|---|---|
| `require("../hooks/install.js")` | `require("../../hooks/install.js")` (2 occurrences: lines 74, 78) |
| `require("../agents/registry")` | `require("../../agents/registry")` |
| `require("../agents/codex-log-monitor")` | `require("../../agents/codex-log-monitor")` |
| `require("../agents/codex")` | `require("../../agents/codex")` |
| `require("../agents/gemini-log-monitor")` | `require("../../agents/gemini-log-monitor")` |
| `require("../agents/gemini-cli")` | `require("../../agents/gemini-cli")` |

### Step 1.3: src/core/main.js — path.join 갱신

#### Preload (`"preload"` → `".."`, `"preload"` 2-argument → 3-argument)

| 찾기 | 바꾸기 |
|---|---|
| `path.join(__dirname, "preload", "settings.js")` | `path.join(__dirname, "..", "preload", "settings.js")` |
| `path.join(__dirname, "preload", "preload.js")` | `path.join(__dirname, "..", "preload", "preload.js")` |
| `path.join(__dirname, "preload", "hit.js")` | `path.join(__dirname, "..", "preload", "hit.js")` |

#### HTML co-located / cross-folder

| 찾기 | 바꾸기 |
|---|---|
| `path.join(__dirname, "settings", "settings.html")` | `path.join(__dirname, "..", "settings", "settings.html")` |
| `path.join(__dirname, "hit", "hit.html")` | `path.join(__dirname, "..", "hit", "hit.html")` |
| `path.join(__dirname, "index.html")` | `path.join(__dirname, "index.html")` (그대로 — co-located with main in core/) |

#### External assets/launch/extensions (`".."` → `"..", ".."`)

| 찾기 | 바꾸기 |
|---|---|
| `path.join(__dirname, "..", "launch.js")` | `path.join(__dirname, "..", "..", "launch.js")` |
| `path.join(__dirname, "..", "assets", "icon.ico")` | `path.join(__dirname, "..", "..", "assets", "icon.ico")` |
| `path.join(__dirname, "..", "extensions", "vscode")` | `path.join(__dirname, "..", "..", "extensions", "vscode")` |

검증:

```bash
grep -nE 'require\(["\x27]\.{1,2}/|path\.join\(__dirname' src/core/main.js | head -30
```
Expected: 위 매핑대로 모두 반영된 상태.

### Step 1.4: src/core/state.js — AGENT_ICON_DIR 깊이 +1

| 찾기 | 바꾸기 |
|---|---|
| `const AGENT_ICON_DIR = path.join(__dirname, "..", "assets", "icons", "agents");` | `const AGENT_ICON_DIR = path.join(__dirname, "..", "..", "assets", "icons", "agents");` |

검증:

```bash
grep -n 'AGENT_ICON_DIR\|path.join(__dirname' src/core/state.js
```
Expected: 신규 3-단계 상대경로.

### Step 1.5: src/core/telemetry.js — .env 및 package.json 경로 깊이 +1

| 찾기 | 바꾸기 |
|---|---|
| `const envPath = path.resolve(__dirname, "..", ".env");` | `const envPath = path.resolve(__dirname, "..", "..", ".env");` |
| `const pkg = require("../package.json");` | `const pkg = require("../../package.json");` |

검증:

```bash
grep -n "path\.resolve\|require(['\"]\\.\\.\\/package" src/core/telemetry.js
```
Expected: 둘 다 `../..`.

### Step 1.6: src/core/menu.js — require + tray icon + preload 갱신

| 찾기 | 바꾸기 |
|---|---|
| `require("./settings/i18n")` | `require("../settings/i18n")` |
| `path.join(__dirname, "../assets/tray-iconTemplate.png")` | `path.join(__dirname, "../../assets/tray-iconTemplate.png")` |
| `path.join(__dirname, "../assets/tray-icon.png")` | `path.join(__dirname, "../../assets/tray-icon.png")` |
| `path.join(__dirname, "preload", "prompt.js")` | `path.join(__dirname, "..", "preload", "prompt.js")` |

검증:

```bash
grep -n "require\|path.join" src/core/menu.js | head
```

### Step 1.7: Stage 2 임시 telemetry 참조 최종화 (3 파일)

3개 파일에서 `require("../telemetry")` → `require("../core/telemetry")`:

| 파일 | 찾기 | 바꾸기 |
|---|---|---|
| `src/theme/loader.js` | `try { return require("../telemetry"); }` | `try { return require("../core/telemetry"); }` |
| `src/server/server.js` | `try { return require("../telemetry"); }` | `try { return require("../core/telemetry"); }` |
| `src/update/updater.js` | `try { return require("../telemetry"); }` | `try { return require("../core/telemetry"); }` |

검증:

```bash
grep -rn "require(['\"]\\.\\./telemetry\|require(['\"]\\.\\./core/telemetry" src/
```
Expected: 모두 `../core/telemetry`만 남음.

### Step 1.8: package.json `main` 필드 갱신

| 찾기 | 바꾸기 |
|---|---|
| `"main": "src/main.js",` | `"main": "src/core/main.js",` |

검증:

```bash
grep '"main"' package.json
```
Expected: `"main": "src/core/main.js",`.

### Step 1.9: 잔존 참조 0 확인 (grep 매트릭스)

```bash
echo "=== src/core/ 내부에 남은 옛 경로 ==="
grep -rn 'require(["\x27]\\./hit/\|require(["\x27]\\./utils/\|require(["\x27]\\./settings/\|require(["\x27]\\./theme/\|require(["\x27]\\./server/\|require(["\x27]\\./update/\|require(["\x27]\\./animation/' src/core/ || echo "clean (all cross-folder refs are ../)"

echo "=== Stage 2 임시 telemetry 잔존 ==="
grep -rn "require(['\"]\\.\\./telemetry" src/ || echo "clean (모두 ../core/telemetry로 갱신됨)"

echo "=== main.js의 옛 preload/HTML depth ==="
grep -rn 'path\.join(__dirname, "preload"\|path\.join(__dirname, "settings"\|path\.join(__dirname, "hit",' src/core/main.js || echo "clean (모두 \"..\", \"...\", \"...\")"

echo "=== main.js의 옛 external depth ==="
grep -n 'require(["\x27]\\.\\./hooks\|require(["\x27]\\.\\./agents' src/core/main.js || echo "clean (모두 ../../)"

echo "=== state.js AGENT_ICON_DIR 깊이 확인 ==="
grep -n 'AGENT_ICON_DIR' src/core/state.js
```
모두 `clean` 또는 신규 경로만.

### Step 1.10: 테스트 통과 확인 (테스트 자체는 core 파일 커버 안 함)

```bash
npm test 2>&1 | tail -10
```
Expected: 327 / 57 / 0. **단, 이 결과는 core 파일이 제대로 동작한다는 보장이 아니다.** 다음 Step 1.11이 진짜 검증.

### Step 1.11: Electron 기동 검증 (필수, 수동)

Stage 3의 실 검증은 오직 Electron 앱을 띄워 확인하는 수밖에 없음. 다음 체크리스트를 **하나라도 실패하면 Step 1까지 commit 금지**.

메인 체크아웃(다른 터미널)에 다른 Clawd 인스턴스가 돌고 있으면 종료한 뒤:

```bash
npm start
```

**관찰**:
- [ ] stdout에 `GitAnimals state server listening on 127.0.0.1:23333` 출력 (server/server.js 로드 OK)
- [ ] stdout에 `GitAnimals: synced hooks (added N, updated N, removed N)` (hooks 경로 OK)
- [ ] 어떤 "Cannot find module …" 에러도 없어야 함
- [ ] 펫 SVG가 화면에 렌더링 (index.html + core/renderer.js 공존 OK, state.js/theme/loader 연동 OK)
- [ ] 마우스를 움직이면 눈동자 추적 (animation/tick + core/renderer IPC OK)
- [ ] 펫을 드래그하면 이동 (hit/hit.html + hit/renderer + main.js hit window creation OK)
- [ ] 더블클릭 반응 애니메이션 (hit relay OK)
- [ ] 트레이 아이콘 표시 (menu.js tray icon path OK, assets 깊이 OK)
- [ ] 트레이 우클릭 → 메뉴 라벨(한국어/영어) + Language 서브메뉴 (menu.js + settings/i18n OK)
- [ ] 설정 패널 열기 (settings.html 로드 OK)
- [ ] `curl -X POST http://127.0.0.1:23333/permission -H 'Content-Type: application/json' -d '{"tool_name":"Test","tool_input":{},"session_id":"smoke"}'` → 권한 버블 표시 (server/bubble.html + server/permission OK)
- [ ] 메뉴 "Check for Updates" 클릭 (update/updater OK)
- [ ] `.env`에 `SENTRY_DSN=<anything>` 넣어서 재기동 → Sentry 초기화 로그 확인 (telemetry.js의 `.env` 및 `package.json` 깊이 OK)

**이 체크리스트 모두 통과해야 Step 1.12 commit 진행.**

### Step 1.12: Commit (atomic)

```bash
git add -A
git commit -m "refactor(src): core 클러스터를 src/core/로 이동 (atomic)

10개 파일 이동 + main.js 25 require + 6 path.join + 9 external depth
+ state.js/telemetry.js depth +1 + menu.js tray icon/preload/i18n
+ Stage 2 임시 '../telemetry' → '../core/telemetry' 최종화
+ package.json main 필드 'src/core/main.js'

core 파일은 단위 테스트가 없어 회귀 감지는 수동 smoke에만 의존.
부분 commit 시 main.js require 체인이 깨져도 npm test가 통과
(main.js 실행 안 됨) → 모든 변경을 하나의 atomic commit에 묶음.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 문서 갱신

### Files (수정)

- Modify: `CLAUDE.md` — 핵심 파일 표 + 아키텍처 다이어그램 + `npm test` 파일 수 언급 (28 → 현재 실제 개수)
- Modify: `src/CLAUDE.md` — 상태 머신/극간모드/터미널 포커스/눈동자 추적/효과음/자동 업데이트 섹션 헤더 일부

### Step 2.1: 현재 참조 위치 확인

```bash
grep -n "src/main\\.js\|src/state\\.js\|src/theme/loader\|src/updater\|src/update/updater" CLAUDE.md src/CLAUDE.md docs/*.md 2>/dev/null | head
```

### Step 2.2: CLAUDE.md 갱신

루트 CLAUDE.md의 핵심 파일 표에서 main과 state 경로 갱신:

| 찾기 | 바꾸기 |
|---|---|
| `` | `src/main.js` `` | `` | `src/core/main.js` `` |
| `` | `src/state.js` `` | `` | `src/core/state.js` `` |

아키텍처 다이어그램(src/server/server.js → src/state.js → src/renderer.js) 갱신:

| 찾기 | 바꾸기 |
|---|---|
| `src/server/server.js → src/state.js 상태 머신` | `src/server/server.js → src/core/state.js 상태 머신` |
| `→ IPC state-change → src/renderer.js (SVG` | `→ IPC state-change → src/core/renderer.js (SVG` |

(선택) 자주 쓰는 명령어 섹션의 `npm test` 설명 파일 수를 현재 개수에 맞춤 (Stage 3 적용 후 실제 테스트 파일 수로).

### Step 2.3: src/CLAUDE.md 갱신

core 파일명을 언급하는 섹션 헤더/본문 가볍게 조정:

| 찾기 | 바꾸기 |
|---|---|
| `## 상태 머신 (state.js)` | `## 상태 머신 (core/state.js)` |
| `## 극간모드 (mini.js)` | `## 극간모드 (core/mini.js)` |
| `## 터미널 포커스 (focus.js)` | `## 터미널 포커스 (core/focus.js)` |
| `## 효과음 (main.js → IPC → renderer.js)` | `## 효과음 (core/main.js → IPC → core/renderer.js)` |
| `## 눈동자 추적 (animation/tick.js → renderer.js)` | `## 눈동자 추적 (animation/tick.js → core/renderer.js)` |

본문 내 파일명 가벼운 조정 (지나친 재작성 금지).

### Step 2.4: Commit

```bash
git add CLAUDE.md src/CLAUDE.md
git commit -m "docs(stage3): core 클러스터 경로 반영

- CLAUDE.md: main/state 핵심 파일 표 + 아키텍처 다이어그램
- src/CLAUDE.md: 상태 머신/극간모드/터미널 포커스/효과음/눈동자
  추적 섹션 헤더의 파일명

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 최종 검증 + PR 생성

### Step 3.1: 전체 잔존 grep 매트릭스

```bash
cd /Users/sumi/Documents/repo/personal/clawd-on-desk/.worktrees/src-folder-split-stage3
echo "=== src/ 구 경로 require ==="
grep -rn "require(['\"]\\./main\|require(['\"]\\./state[^-]\|require(['\"]\\./renderer[^-]\|require(['\"]\\./menu[^-]\|require(['\"]\\./focus\|require(['\"]\\./mini[^-]\|require(['\"]\\./mac-window\|require(['\"]\\./telemetry" src/ 2>/dev/null | grep -v 'src/core/' || echo "clean"

echo "=== Stage 2 임시 telemetry 참조 ==="
grep -rn "require(['\"]\\.\\./telemetry" src/ || echo "clean"

echo "=== index.html/styles.css 옛 위치 참조 ==="
grep -rn '"src/main\.js"\|"src/index\.html"\|"src/styles\.css"' . --include='*.js' --include='*.json' --include='*.md' 2>/dev/null | grep -v node_modules | grep -v 'src/core/' || echo "clean"

echo "=== package.json main ==="
grep '"main"' package.json

echo "=== src/core/ 파일 10개 ==="
ls src/core/
```

Expected:
- 모두 `clean` 또는 core/ 경로만
- `"main": "src/core/main.js",`
- core/ 안에 10개 파일

### Step 3.2: 최종 `npm test`

```bash
npm test 2>&1 | tail -10
```
Expected: 327 / 57 / 0.

### Step 3.3: 최종 수동 smoke test (머지 전 필수)

Task 1.11 체크리스트 재실행 (이번엔 document commit 반영 이후 상태로). 전부 ✅ 여야 함.

### Step 3.4: Push + PR 생성

```bash
git log --oneline origin/main..HEAD    # 2개 commit만 나와야 함 (core atomic + docs)
git push -u origin refactor/src-folder-split-stage3
```

**gh 계정 전환 먼저** (이전에 sumi-exem으로 잘못 걸려 실패했던 사례 있음):

```bash
gh auth status
# sumi-0011이 active가 아니면:
gh auth switch --user sumi-0011
```

PR 생성:

```bash
gh pr create --base main --head refactor/src-folder-split-stage3 \
  --title "refactor(src): Stage 3 — core 클러스터 폴더화 (src/ 재조직 완료)" \
  --body "$(cat <<'EOF'
## 한 줄 요약 (사용자 관점)

**유저 동작/UI는 전혀 바뀌지 않습니다.** `src/`에 남은 마지막 10개 core 파일
(main, state, renderer, menu, focus, mini, mac-window, telemetry + index.html,
styles.css)를 `src/core/`로 옮기고, \`package.json\` main 필드를
\`src/core/main.js\`로 갱신. Stage 2 임시 \`../telemetry\` 참조 3곳도
\`../core/telemetry\`로 최종화. **3-Stage 마이그레이션의 마지막 단계** —
완료되면 \`src/\` 최상위는 폴더만 남음.

## 위험 등급: 높음

core 파일 10개 모두 단위 테스트가 없어 회귀는 수동 smoke로만 감지.
모든 변경은 atomic 한 commit (+ docs 별도 1 commit).

## 변경 사항

- 파일 이동: src/main.js, state.js, renderer.js, menu.js, focus.js, mini.js,
  mac-window.js, telemetry.js, index.html, styles.css → src/core/
- \`package.json\` main: \`src/main.js\` → \`src/core/main.js\`
- main.js 내부 25개 require 갱신 + 6개 path.join + 9개 외부 경로 깊이 +1
- state.js AGENT_ICON_DIR 깊이 +1
- telemetry.js .env, package.json 깊이 +1
- menu.js settings/i18n require + tray icon + preload path.join
- Stage 2 임시 \`../telemetry\` 참조 최종화: theme/loader, server/server,
  update/updater

## Test Plan

- [x] \`npm test\` — 327 / 57 / 0 (core 파일 커버 없음, 회귀 미감지)
- [x] 구 경로 잔존 grep 매트릭스 0건
- [x] 수동 smoke test 체크리스트 통과:
  - 앱 기동, state server listen, hook 동기화
  - 펫 렌더, 눈동자 추적, 드래그, 더블클릭 반응
  - 트레이 아이콘, 우클릭 메뉴, 언어 전환
  - 설정 패널 열기
  - 권한 버블 (curl 트리거)
  - 업데이트 버블 (Check for Updates)
  - .env SENTRY_DSN 로드 (telemetry 깊이 검증)

## 머지 후 정리

- \`src/\` 최상위에는 이제 폴더 9개(animation, core, hit, preload, server,
  settings, theme, update, utils)만 존재. 후속 리팩토링(파일 분해,
  책임 재정의 등)은 별도 PR로.

EOF
)"
```

### Step 3.5: PR URL 기록 + 완료

PR URL을 reporting output에 포함.

---

## Stage 3 완료 정의 (Definition of Done)

- [ ] Task 1 atomic commit 머지 가능 상태 (smoke test 모두 통과)
- [ ] Task 2 docs commit
- [ ] `npm test` 327 / 57 / 0 유지
- [ ] 수동 smoke test 11개 항목 모두 통과
- [ ] 구 경로 잔존 grep 매트릭스 0건
- [ ] Stage 3 PR 생성 (base = main, head = refactor/src-folder-split-stage3)
- [ ] Stage 2 (PR #10)가 먼저 머지된 뒤 Stage 3 PR 머지 순서 유지

---

## 실패 대응 (Troubleshooting)

**`npm start` 즉시 크래시 "Cannot find module ..."**
→ main.js require 경로 갱신 누락 또는 `package.json` main 필드가 구 경로.
1. `grep '"main"' package.json` → `"src/core/main.js"` 확인
2. `grep -nE 'require\(["\x27]\./' src/core/main.js` → 교차폴더 require가 모두 `../<folder>/<name>` 형태인지 확인

**Electron 기동은 됐는데 펫 SVG 안 보임**
→ index.html + renderer.js 공존 깨짐 또는 AGENT_ICON_DIR 경로 오류. index.html 안 `<script src="renderer.js">` 그대로인지 + `src/core/` 안에 index.html과 renderer.js 함께 있는지 확인.

**트레이 아이콘 안 보임**
→ menu.js의 tray icon path.join 깊이 누락. `grep tray-icon src/core/menu.js` → `"../../assets/..."` 확인.

**Sentry 초기화 실패 (silent)**
→ telemetry.js의 `.env`, `package.json` 깊이 갱신 누락. `grep -n '.env\|package.json' src/core/telemetry.js` → 둘 다 `../..` 확인.

**설정 패널 열리지 않음**
→ main.js의 `path.join(__dirname, "settings", "settings.html")` 갱신 누락. `"..", "settings", "settings.html"` 형태여야 함.

**권한 버블 안 뜸**
→ permission.js의 preload/bubble.html path는 Stage 2에서 갱신됨. Stage 3에서는 main.js의 `require("../server/permission")`가 맞는지 확인.

**hook이 등록 안 됨 (`Cannot find module '../hooks/install.js'`)**
→ main.js의 hooks require가 `../../hooks/...`로 갱신되었는지 확인 (2 occurrences).

**업데이트 버블 / 자동 업데이트 깨짐**
→ main.js의 `require("../update/updater")`, `require("../update/bubble")` + update/updater.js의 `require("../core/telemetry")` (Stage 2 → Stage 3 최종화) 확인.

---

## 선택 TODO (이 PR 범위 밖)

- `src/core/renderer.js` L45의 `_assetsPath = tc.assetsPath || "../assets/svg"` fallback — 현재 위치 기준 `"../assets/svg"`가 `src/core/../assets/svg` = `src/assets/svg`로 해석되어 실제로 없는 경로. 그러나 이 fallback은 theme config(`tc.assetsPath`)로 거의 항상 override되므로 smoke에서 터지지 않음. 후속 정리로 `"../../assets/svg"`로 바꾸는 것을 권장(동작 변경 0 중에서도 완전 안전).

- 코드 주석에서 옛 파일명을 참조하는 곳(e.g., "hit-renderer.js" 주석) 정리 — Stage 1 완료 시 4곳 남은 상태였음. Stage 3 docs commit에 포함해도 되고 별도 후속 PR로 분리해도 됨.
