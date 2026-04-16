# src/ 폴더 분할 설계 (Stage 1~3)

**작성일**: 2026-04-15
**브랜치**: `refactor/src-folder-split`
**worktree**: `.worktrees/src-folder-split/`

## Context

현재 `src/` 디렉토리는 33개 `.js` 파일(+ HTML/CSS)이 모두 최상위에 flat하게 배치되어 있다. 파일명 prefix(`settings-*`, `preload-*`, `hit-*`, `remote-theme-*`, `update-*`)로 논리 그룹을 암시하지만 실제 디렉토리 경계가 없어 다음 문제가 발생한다.

- 새 파일을 어디에 두어야 할지 모호하다.
- `main.js`가 20개 내부 파일을 require하여 조율자로 비대하다(약 1,700줄).
- 500줄 이상 파일 7개가 한 디렉토리에 섞여 있어 관심사 분리가 눈에 보이지 않는다.
- 대조적으로 `hooks/`, `agents/`는 이미 잘 정리되어 있다.

본 작업은 **파일 내부 리팩토링 없이 디렉토리 재조직만** 수행한다. 의도적으로 범위를 좁혀 리뷰 부담을 낮추고, 이후 파일 분해·책임 재정의 같은 추가 마이그레이션의 토대를 만든다. 사용자 메모리(계획 단계 분할 선호)에 맞춰 3-Stage로 쪼개 각 Stage를 독립 PR로 머지한다.

## Scope (확정)

- **축**: 기능/도메인별 폴더 (`core/`, `settings/`, `theme/`, `server/`, `update/`, `preload/`, `animation/`, `hit/`, `utils/`)
- **이름 규칙**: 폴더 prefix 중복 제거 (`settings-store.js` → `settings/store.js`)
- **단계**: 3-Stage 묶음, 각 Stage = 1 PR
- **테스트**: 각 Stage에 해당 `test/` 파일 같이 이동
- **문서**: 루트 CLAUDE.md, src/CLAUDE.md, `docs/*.md` 내 `src/<name>.js` 참조 갱신
- **path alias 도입 없음** (YAGNI, 상대경로 유지)

## 불변 조건

- **공존 강제**: HTML과 해당 렌더러는 같은 폴더에 있어야 한다 (HTML의 `<script src="...">`는 상대경로).
  - `index.html` + `renderer.js` + `styles.css` → `core/`
  - `hit.html` + `hit-renderer.js`(→ `renderer.js`) → `hit/`
  - `settings.html` + `settings-renderer.js`(→ `renderer.js`) → `settings/`
  - `bubble.html` → `server/` (permission.js와 동행)
  - `update-bubble.html`(→ `bubble.html`) → `update/`
- **`package.json`의 `build.files` `src/**/*` 패턴 유지**: 하위 폴더 자동 포함되어 추가 설정 불필요
- **`package.json`의 `asarUnpack`**: `hooks/**/*`, `extensions/**/*`만 — 변경 없음
- **Hook 제로 의존성 원칙**: `hooks/`는 `../src/`를 require하지 않으므로 영향 없음
- **순환 의존성 없음** (사전 분석 확인됨)

---

## Stage 1: Leaves & Preloads (리스크 낮음)

### 목표
자기 자신을 require하는 파일이 적고 외부로의 require 간선이 거의 없는 **리프 파일**과 `preload-*`(어디서도 require되지 않고 string path로만 참조됨)을 먼저 옮긴다.

### 이동 매핑 (15 파일)

| 기존 경로 | 신규 경로 |
|---|---|
| `src/preload.js` | `src/preload/preload.js` |
| `src/preload-bubble.js` | `src/preload/bubble.js` |
| `src/preload-hit.js` | `src/preload/hit.js` |
| `src/preload-prompt.js` | `src/preload/prompt.js` |
| `src/preload-settings.js` | `src/preload/settings.js` |
| `src/preload-update-bubble.js` | `src/preload/update-bubble.js` |
| `src/work-area.js` | `src/utils/work-area.js` |
| `src/log-rotate.js` | `src/utils/log-rotate.js` |
| `src/hit-geometry.js` | `src/hit/geometry.js` |
| `src/hit-renderer.js` | `src/hit/renderer.js` |
| `src/hit.html` | `src/hit/hit.html` |
| `src/tick.js` | `src/animation/tick.js` |
| `src/agent-gate.js` | `src/settings/agent-gate.js` |
| `src/login-item.js` | `src/settings/login-item.js` |
| `src/i18n.js` | `src/settings/i18n.js` |

> 참고: `i18n.js`의 유일한 소비자인 `menu.js`는 Stage 3에서 이동하지만, 이번 PR에서 `menu.js`의 require 한 줄만 갱신한다.

### 소스 require/path 갱신 (Stage 1 내)

- `src/main.js` (이동하지 않음): 7 path 갱신
  - `require('./work-area')` → `require('./utils/work-area')`
  - `require('./log-rotate')` → `require('./utils/log-rotate')`
  - `require('./hit-geometry')` → `require('./hit/geometry')`
  - `require('./tick')` → `require('./animation/tick')`
  - `require('./agent-gate')` → `require('./settings/agent-gate')`
  - `require('./login-item')` → `require('./settings/login-item')`
  - preload 6개 + `hit.html`의 `path.join(__dirname, '<file>')` 경로 갱신
- `src/permission.js`: `require('./log-rotate')` → `require('./utils/log-rotate')`, `path.join('preload-bubble.js')` → `path.join('preload','bubble.js')`
- `src/menu.js`: `require('./i18n')` → `require('./settings/i18n')`, `path.join('preload-prompt.js')` → `path.join('preload','prompt.js')`
- `src/update-bubble.js`: `path.join('preload-update-bubble.js')` → `path.join('preload','update-bubble.js')`
- `src/hit/hit.html`의 `<script src="hit-renderer.js">` → `<script src="renderer.js">`
- **외부**: `agents/gemini-log-monitor.js`의 `require('../src/log-rotate')` → `require('../src/utils/log-rotate')`

### 테스트 이동 (Stage 1)

| 기존 | 신규 |
|---|---|
| `test/work-area.test.js` | `test/utils/work-area.test.js` |
| `test/log-rotate.test.js` | `test/utils/log-rotate.test.js` |
| `test/agent-gate.test.js` | `test/settings/agent-gate.test.js` |
| `test/menu-autostart.test.js` | `test/settings/menu-autostart.test.js` |

각 테스트 내부 `require('../src/<name>')` 경로는 `require('../../src/<folder>/<name>')`로 갱신.

### package.json test 스크립트 갱신 (Stage 1 필수)

`"test": "node --test test/*.test.js"` → `"test": "node --test test/"`
- Node 18+ 내장 디렉토리 재귀 탐색을 사용한다. shell glob 비의존이라 `cmd.exe` 포함 모든 셸에서 동일 동작.
- 처음 후보였던 `"test/*.test.js test/*/*.test.js"` 다중 글롭 안은 시점 의존성 결함이 있다 (서브폴더 테스트가 0개일 때 shell이 unexpand한 literal `test/*/*.test.js`를 node가 받아 exit 1). 검증 후 폐기.

### 문서 갱신 (Stage 1)

- `src/CLAUDE.md`: `agent-gate.js`, `tick.js`, `hit-renderer.js`, `i18n.js` 섹션 경로 언급 갱신
- 루트 `CLAUDE.md`: 변경 없음 (해당 파일들은 핵심 파일 표에 없음)

### Stage 1 검증

- `npm test` → 28개 테스트 동일하게 pass
- `grep -rn 'src/agent-gate\|src/log-rotate\|src/work-area\|src/hit-geometry\|src/hit-renderer\|src/preload\|src/tick\|src/login-item\|src/i18n' --include='*.js' --include='*.json' --include='*.md' .` → Stage 1 대상 파일의 옛 경로 참조 없음
- `npm start` smoke test: 앱 기동, 드래그, preload API 확인

---

## Stage 2: Mid-tier Clusters (리스크 중간)

### 이동 매핑 (16 파일)

| 기존 경로 | 신규 경로 |
|---|---|
| `src/prefs.js` | `src/settings/prefs.js` |
| `src/settings-store.js` | `src/settings/store.js` |
| `src/settings-actions.js` | `src/settings/actions.js` |
| `src/settings-controller.js` | `src/settings/controller.js` |
| `src/settings-renderer.js` | `src/settings/renderer.js` |
| `src/settings.html` | `src/settings/settings.html` |
| `src/theme-loader.js` | `src/theme/loader.js` |
| `src/remote-theme-sync.js` | `src/theme/remote-sync.js` |
| `src/server.js` | `src/server/server.js` |
| `src/permission.js` | `src/server/permission.js` |
| `src/bubble.html` | `src/server/bubble.html` |
| `src/updater.js` | `src/update/updater.js` |
| `src/update-bubble.js` | `src/update/bubble.js` |
| `src/update-bubble.html` | `src/update/bubble.html` |

### 주요 require 갱신

- **클러스터 내부 (intra-folder)**:
  - `settings/controller.js`: `./settings-store` → `./store`, `./settings-actions` → `./actions`, `./prefs` 그대로
  - `settings/actions.js`: `./prefs` 그대로
  - `theme/remote-sync.js`: `./theme-loader` → `./loader`
- **`src/main.js`에서 (이동 안 함, Stage 3에서 이동)**:
  - `require('./prefs')` → `require('./settings/prefs')`
  - `require('./settings-controller')` → `require('./settings/controller')`
  - `require('./theme-loader')` → `require('./theme/loader')`
  - `require('./remote-theme-sync')` → `require('./theme/remote-sync')`
  - `require('./server')` → `require('./server/server')`
  - `require('./permission')` → `require('./server/permission')`
  - `require('./updater')` → `require('./update/updater')`
  - `require('./update-bubble')` → `require('./update/bubble')`
  - `path.join('settings.html')` → `path.join('settings','settings.html')`
- **깊이 변화로 인한 경로 조정**:
  - `server/server.js`, `server/permission.js`: `require('../hooks/server-config')` → `require('../../hooks/server-config')`
  - `server/server.js`: `require('../hooks/install.js')`(있으면) 동일 패턴
  - `server/permission.js`: `require('./log-rotate')` → `require('../utils/log-rotate')` (Stage 1에서 이미 이동됨)
  - `server/permission.js`: `path.join(__dirname,'preload-bubble.js')`는 Stage 1에서 이미 `path.join('preload','bubble.js')`로 바뀌었지만, 이제 `__dirname`이 `src/server/`이므로 `path.join('..','preload','bubble.js')`로 재조정
  - `server/permission.js`: `loadFile(path.join(__dirname,'bubble.html'))` — 같은 폴더이므로 그대로
  - `update/bubble.js`: `path.join(__dirname,'..','preload','update-bubble.js')`로 재조정, `loadFile('bubble.html')`(rename으로 단순화)
- **임시 telemetry 참조** (Stage 3에서 최종화):
  - `theme/loader.js`: `require('./telemetry')` → `require('../telemetry')` (Stage 3에서 `../core/telemetry`)
  - `update/updater.js`: 동일
  - `server/server.js`: 동일

### 테스트 이동 (Stage 2)

| 기존 | 신규 |
|---|---|
| `test/prefs.test.js` | `test/settings/prefs.test.js` |
| `test/settings-store.test.js` | `test/settings/store.test.js` |
| `test/settings-actions.test.js` | `test/settings/actions.test.js` |
| `test/settings-controller.test.js` | `test/settings/controller.test.js` |
| `test/remote-theme-sync.test.js` | `test/theme/remote-sync.test.js` |
| `test/server-permission-subgate.test.js` | `test/server/permission-subgate.test.js` |
| `test/permission-reposition.test.js` | `test/server/permission-reposition.test.js` |
| `test/codex-notify-subgate.test.js` | `test/server/codex-notify-subgate.test.js` |
| `test/updater.test.js` | `test/update/updater.test.js` |
| `test/update-bubble-position.test.js` | `test/update/bubble-position.test.js` |
| `test/update-bubble-style.test.js` | `test/update/bubble-style.test.js` |

- `test/update/bubble-style.test.js` 내부의 `path.join(__dirname, '..', 'src', 'update-bubble.html')` → `path.join(__dirname, '..', '..', 'src', 'update', 'bubble.html')` 갱신
- `test/update/updater.test.js`의 `require('../src/updater')` 3~4회 등장 → `require('../../src/update/updater')`로 전부 교체

### 문서 갱신 (Stage 2)

- 루트 `CLAUDE.md` 핵심 파일 표:
  - `src/server.js` → `src/server/server.js`
  - `src/theme-loader.js` → `src/theme/loader.js`
  - `src/settings-controller.js` → `src/settings/controller.js`
- 루트 아키텍처 다이어그램: `src/server.js → src/state.js` 의 server 부분만 먼저 `src/server/server.js`로 (state는 Stage 3)
- `src/CLAUDE.md`: settings, theme, permission, update-bubble 섹션 파일명 언급 갱신
- `docs/release-and-signing.md` L246: `src/updater.js` → `src/update/updater.js`
- `docs/macos-signing-setup.md` L125: 동일

### Stage 2 검증

- `npm test` → 28개 pass
- `grep -rn 'src/settings-\|src/prefs\|src/theme-loader\|src/remote-theme\|src/server\.js\|src/permission\|src/updater\|src/update-bubble' --include='*.js' --include='*.json' --include='*.md' .` → 대상 파일 구 경로 참조 0
- `npm start` smoke: 설정 패널 열기, 테마 변경 반영, 권한 버블 표시, 업데이트 버블 표시

---

## Stage 3: Core (리스크 높음)

### 이동 매핑 (10 파일)

| 기존 경로 | 신규 경로 |
|---|---|
| `src/main.js` | `src/core/main.js` |
| `src/state.js` | `src/core/state.js` |
| `src/renderer.js` | `src/core/renderer.js` |
| `src/menu.js` | `src/core/menu.js` |
| `src/focus.js` | `src/core/focus.js` |
| `src/mini.js` | `src/core/mini.js` |
| `src/mac-window.js` | `src/core/mac-window.js` |
| `src/telemetry.js` | `src/core/telemetry.js` |
| `src/index.html` | `src/core/index.html` |
| `src/styles.css` | `src/core/styles.css` |

### 주요 require/path 갱신

- **`package.json`**: `"main": "src/main.js"` → `"main": "src/core/main.js"` (**핵심**)
- **`src/core/main.js`** (깊이가 `src/` → `src/core/`로 +1):
  - `core/` 내부 참조: `./state`, `./menu`, `./focus`, `./mini`, `./mac-window`, `./telemetry` 그대로
  - 다른 폴더: `../settings/prefs`, `../settings/controller`, `../settings/agent-gate`, `../settings/login-item`, `../theme/loader`, `../theme/remote-sync`, `../server/server`, `../server/permission`, `../update/updater`, `../update/bubble`, `../animation/tick`, `../hit/geometry`, `../utils/work-area`, `../utils/log-rotate`
  - 외부: `../../hooks/install.js`, `../../agents/registry`, `../../agents/codex-log-monitor`, `../../agents/codex`, `../../agents/gemini-log-monitor`, `../../agents/gemini-cli`
  - preload path.join: `path.join(__dirname, '..', 'preload', '<file>')`
  - HTML path.join: `path.join(__dirname, 'index.html')`(co-located, 유지), `path.join(__dirname, '..', 'settings', 'settings.html')`, `path.join(__dirname, '..', 'hit', 'hit.html')`
- **`src/core/telemetry.js`**:
  - `require('../package.json')` → `require('../../package.json')`
  - `path.resolve(__dirname, '..', '.env')` → `path.resolve(__dirname, '..', '..', '.env')`
- **`src/core/state.js`**:
  - `path.join(__dirname, '..', 'assets', 'icons', 'agents')` → `path.join(__dirname, '..', '..', 'assets', 'icons', 'agents')`
  - `require('./telemetry')` 그대로(intra-core)
- **`src/core/menu.js`**:
  - `require('../settings/i18n')` 그대로 (Stage 1에서 이미 경로 갱신됨, 깊이만 +1 반영)
  - `path.join(__dirname, '..', 'preload', 'prompt.js')` 재조정
- **`src/core/mini.js`**, **`src/core/updater.js`** 등: `require('./telemetry')` → intra-core 그대로
- **Stage 2 임시 참조 최종화** (이번 Stage에 포함):
  - `src/theme/loader.js`: `require('../telemetry')` → `require('../core/telemetry')`
  - `src/update/updater.js`: `require('../telemetry')` → `require('../core/telemetry')`
  - `src/server/server.js`: `require('../telemetry')` → `require('../core/telemetry')`

### 테스트 이동 (Stage 3)

- **없음** (core 파일용 단위 테스트가 현재 존재하지 않음: state/main/telemetry/focus/mini/menu/renderer/mac-window 모두 테스트 파일 없음)
- 검증은 전적으로 **수동 smoke test** 의존

### 문서 갱신 (Stage 3)

- 루트 `CLAUDE.md` 핵심 파일 표: `src/main.js` → `src/core/main.js`, `src/state.js` → `src/core/state.js`
- 루트 아키텍처 다이어그램 `src/state.js`, `src/renderer.js` 표기 갱신
- `src/CLAUDE.md`: `mini.js`, `focus.js`, `renderer.js` 섹션 경로/언급 최신화
- 상태 머신 섹션 `(state.js)` 헤더는 의미상 유지

### Stage 3 검증

- `npm test` → 28개 pass (core 파일 테스트 없음 → 이전과 동일)
- **수동 smoke test (필수 체크리스트)**:
  - [ ] `npm start` 앱 기동 (package.json main 경로 검증)
  - [ ] 펫 SVG 렌더링 (index.html + renderer.js 공존 검증)
  - [ ] 마우스 추적/눈동자 동작 (tick.js 경로 검증)
  - [ ] 히트박스 드래그 (hit.html + renderer.js 공존 검증)
  - [ ] 설정 패널 열기/변경 (settings.html + renderer.js 공존 검증)
  - [ ] 권한 버블 (bubble.html + permission.js 검증): `curl -X POST http://127.0.0.1:23333/permission ...`
  - [ ] 업데이트 버블 (update-bubble 경로 검증)
  - [ ] 트레이 메뉴 + 에이전트 아이콘 표시 (state.js의 `../../assets/icons/agents` depth 검증)
  - [ ] `.env`에 `SENTRY_DSN` 넣고 앱 기동 → telemetry 로그 확인 (telemetry.js depth 검증)
  - [ ] 테마 리로드 (remote-theme-sync + theme-loader 검증)
  - [ ] 미니 모드 토글
- `npm run build` dry-run으로 electron-builder 패키징 성공 여부 확인

---

## 각 Stage 공통 사후 검사 (commit 전)

각 Stage PR에서 머지 전 반드시 실행:

```bash
# 1. 구 경로 잔존 검색
grep -rn '\.\./src/<이동-대상-파일-기본명>' --include='*.js' --include='*.json' --include='*.md' --include='*.sh' .
grep -rn "require(['\"]\\./<이동-대상-파일-기본명>" src/

# 2. 테스트
npm test

# 3. 빌드 가능성 (Stage 3는 smoke 포함)
npm start  # Stage 1,2: 기본 동작 확인; Stage 3: 전체 체크리스트
```

## Out of Scope (이 작업에 포함 안 됨)

- 파일 내부 분해 (state.js를 state+session+sleep으로 쪼개는 등) — 별도 마이그레이션
- main.js 역할 재정의 — 별도 마이그레이션
- path alias 도입 — YAGNI
- test/ 중 hooks/agents를 대상으로 하는 10개 test의 폴더화 — 이번 범위는 src/ 관련만
- 새 기능 추가, 동작 변경

## 참조 파일

- `/Users/sumi/Documents/repo/personal/clawd-on-desk/src/main.js` — Stage 3에서 가장 큰 diff
- `/Users/sumi/Documents/repo/personal/clawd-on-desk/package.json` — Stage 1, 3 수정
- `/Users/sumi/Documents/repo/personal/clawd-on-desk/src/telemetry.js` — Stage 3에서 `../package.json`, `.env` depth 갱신
- `/Users/sumi/Documents/repo/personal/clawd-on-desk/CLAUDE.md`, `src/CLAUDE.md` — 3 Stage 모두에서 갱신
- `/Users/sumi/Documents/repo/personal/clawd-on-desk/agents/gemini-log-monitor.js` — Stage 1에서 `require('../src/log-rotate')` 갱신
