# src/ Folder Split — Stage 2 Implementation Plan

## 한 줄 요약 (사용자 관점)

**유저 동작/UI는 전혀 바뀌지 않습니다.** Stage 2는 `src/` 안의 중간 의존성 클러스터 4개(settings 6 / theme 2 / server 3 / update 3 = 14개 파일)를 각자의 도메인 폴더로 옮깁니다. 관련 테스트 11개 같이 정리. main.js의 require 경로 갱신 + 클러스터 내부 require 갱신 + 깊이 변경(`../hooks` → `../../hooks`) 등 수반. 동작 변경 0, 새 기능 0, 단위 테스트 322개 그대로 통과 유지가 성공 기준.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/` 안의 settings, theme, server, update 4개 클러스터(총 14개 파일 + 11개 테스트)를 신규 폴더로 이동하고, 클러스터 내/외부 require 경로, 깊이 변경된 외부(hooks/) 경로, 임시 telemetry 경로를 모두 같은 PR에서 원자적으로 갱신한다.

**Architecture:** 각 클러스터를 한 commit으로 atomic하게 이동(클러스터 내 intra-cluster require + main.js require + 테스트 require + 외부 hooks 경로 깊이 + telemetry 임시 경로). main.js는 여전히 src/ 최상위 (Stage 3에서 이동). telemetry.js도 여전히 src/ 최상위 (Stage 3에서 core/로). 따라서 server/, theme/, update/의 `require("./telemetry")`는 임시로 `require("../telemetry")`가 됨 (Stage 3에서 `../core/telemetry`로 최종화).

**Tech Stack:** Node.js (Electron main process), `node --test`, `git mv`.

**스펙 참조:** `docs/superpowers/specs/2026-04-15-src-folder-split-design.md` — Stage 2 섹션
**전제:** Stage 1 (PR git-goods/gitaniamals-on-desk#8) 완료된 브랜치 위에서 진행
**작업 worktree:** `/Users/sumi/Documents/repo/personal/clawd-on-desk/.worktrees/src-folder-split-stage2/`
**브랜치:** `refactor/src-folder-split-stage2` (base = `refactor/src-folder-split`)

---

## File Structure (Stage 2 종료 후 src/ 트리)

```
src/
├── animation/              (Stage 1)
│   └── tick.js
├── hit/                    (Stage 1)
│   ├── geometry.js
│   ├── hit.html
│   └── renderer.js
├── preload/                (Stage 1)
│   ├── bubble.js
│   ├── hit.js
│   ├── preload.js
│   ├── prompt.js
│   ├── settings.js
│   └── update-bubble.js
├── server/                 ★ Stage 2 신규
│   ├── bubble.html
│   ├── permission.js
│   └── server.js
├── settings/               ★ Stage 2 (확장: Stage 1 리프 3개 + Stage 2 신규 6개)
│   ├── actions.js          ← settings-actions.js
│   ├── agent-gate.js       (Stage 1)
│   ├── controller.js       ← settings-controller.js
│   ├── i18n.js             (Stage 1)
│   ├── login-item.js       (Stage 1)
│   ├── prefs.js
│   ├── renderer.js         ← settings-renderer.js
│   ├── settings.html
│   └── store.js            ← settings-store.js
├── theme/                  ★ Stage 2 신규
│   ├── loader.js           ← theme-loader.js
│   └── remote-sync.js      ← remote-theme-sync.js
├── update/                 ★ Stage 2 신규
│   ├── bubble.html         ← update-bubble.html
│   ├── bubble.js           ← update-bubble.js
│   └── updater.js
├── utils/                  (Stage 1)
│   ├── log-rotate.js
│   └── work-area.js
│
│  ─── 아래는 Stage 3에서 core/로 이동 ───
├── focus.js
├── index.html
├── main.js
├── mac-window.js
├── menu.js
├── mini.js
├── renderer.js
├── state.js
├── styles.css
└── telemetry.js
```

### 건드리는 기존 파일 (이동 대상 아님, Stage 2 내내 src/ 최상위 유지)

- `src/main.js` — 8 require + 1 path.join 갱신
- `src/CLAUDE.md`, `CLAUDE.md`, `docs/release-and-signing.md`, `docs/macos-signing-setup.md` — 경로 언급 갱신

---

## 사전 준비

### Task 0: Baseline 확인

**Files:** (read-only verification)

- [ ] **Step 0.1:** worktree + 브랜치 확인

```bash
cd /Users/sumi/Documents/repo/personal/clawd-on-desk/.worktrees/src-folder-split-stage2
pwd
git branch --show-current
```
Expected: `refactor/src-folder-split-stage2` 브랜치.

- [ ] **Step 0.2:** baseline `npm test`

```bash
npm test 2>&1 | tail -10
```
Expected: `# pass 322 / # suites 55 / # fail 0`.

- [ ] **Step 0.3:** 스펙 및 plan 원본 확인

```bash
ls docs/superpowers/specs/ docs/superpowers/plans/
```
Expected: spec, Stage 1 plan, Stage 2 plan(이 파일) 모두 보임.

- [ ] **Step 0.4:** 시작 시점 grep matrix (Stage 2 대상 파일이 모두 src/ 최상위에 있는지)

```bash
ls src/prefs.js src/settings-store.js src/settings-actions.js src/settings-controller.js src/settings-renderer.js src/settings.html src/theme-loader.js src/remote-theme-sync.js src/server.js src/permission.js src/bubble.html src/updater.js src/update-bubble.js src/update-bubble.html
```
Expected: 14개 파일 모두 정상 출력.

---

## Task 1: theme/ 클러스터 이동 (가장 작은 클러스터, 자신감용 첫 단계)

**Files:**
- Move: `src/theme-loader.js` → `src/theme/loader.js`
- Move: `src/remote-theme-sync.js` → `src/theme/remote-sync.js`
- Move: `test/remote-theme-sync.test.js` → `test/theme/remote-sync.test.js`
- Modify: `src/main.js` (2 require)
- Modify: `src/theme/remote-sync.js` (intra-cluster require)
- Modify: `src/theme/loader.js` (telemetry 경로 임시 조정)
- Modify: `test/theme/remote-sync.test.js` (require 깊이 +1)

### Step 1.1: 파일 이동

```bash
mkdir -p src/theme test/theme
git mv src/theme-loader.js src/theme/loader.js
git mv src/remote-theme-sync.js src/theme/remote-sync.js
git mv test/remote-theme-sync.test.js test/theme/remote-sync.test.js
git status --short
```
Expected: 3개 `R` (rename) 엔트리.

### Step 1.2: src/theme/loader.js 내부 telemetry 경로 갱신

`src/theme/loader.js`의 7행 즈음:

| 찾기 | 바꾸기 |
|---|---|
| `try { return require("./telemetry"); }` | `try { return require("../telemetry"); }` |

**이유**: telemetry.js는 아직 src/ 최상위에 있고 loader.js는 src/theme/로 이동했으므로 한 단계 위로 올라가야 함. (Stage 3에서 telemetry가 core/로 옮겨지면 `../core/telemetry`로 다시 갱신.)

검증:
```bash
grep -n 'require.*telemetry' src/theme/loader.js
```
Expected: `require("../telemetry")`만 보임.

### Step 1.3: src/theme/remote-sync.js 내부 require 갱신

`src/theme/remote-sync.js`가 `theme-loader`를 require하는 줄이 있다면:

| 찾기 | 바꾸기 |
|---|---|
| `require("./theme-loader")` | `require("./loader")` |

검증:
```bash
grep -n 'require.*theme-loader\|require.*loader' src/theme/remote-sync.js
```
Expected: `./loader`만 보임 (있는 경우). 만약 require 자체가 없다면 출력 없음 — 그래도 OK.

### Step 1.4: src/main.js require 갱신

| 찾기 | 바꾸기 |
|---|---|
| `require("./theme-loader")` | `require("./theme/loader")` |
| `require("./remote-theme-sync")` | `require("./theme/remote-sync")` |

검증:
```bash
grep -n 'theme-loader\|remote-theme-sync\|theme/loader\|theme/remote-sync' src/main.js
```
Expected: 신규 경로(`./theme/loader`, `./theme/remote-sync`)만 보임.

### Step 1.5: test/theme/remote-sync.test.js 내부 require 깊이 조정

```bash
grep -n 'require' test/theme/remote-sync.test.js
```

모든 `require("../src/<X>")` → `require("../../src/<X>")`. 그 중:
- `require("../src/remote-theme-sync")` → `require("../../src/theme/remote-sync")`
- 기타 src 모듈을 require한다면 (예: theme-loader, prefs) 깊이 +1만 적용 (e.g., `require("../../src/theme-loader")` ← 단, theme-loader도 이동됐으니 `require("../../src/theme/loader")`로). prefs는 아직 src/ 최상위 → `require("../../src/prefs")`.

### Step 1.6: 잔존 참조 0 확인

```bash
echo "=== src 내부 옛 경로 ==="
grep -rn "require(['\"]\\./theme-loader\|require(['\"]\\./remote-theme-sync" src/ || echo "clean"
echo "=== test 내부 옛 경로 ==="
grep -rn "require(['\"]\\.\\./src/theme-loader\|require(['\"]\\.\\./src/remote-theme-sync" test/ || echo "clean"
```
Both expected: `clean`.

### Step 1.7: 테스트 통과 확인

```bash
npm test 2>&1 | tail -10
```
Expected: 322 / 55 / 0.

### Step 1.8: Commit

```bash
git add -A
git commit -m "refactor(src): theme 클러스터를 src/theme/로 이동

- theme-loader.js → theme/loader.js
- remote-theme-sync.js → theme/remote-sync.js
- 테스트(remote-theme-sync.test.js)도 test/theme/로 이동
- intra-cluster require 갱신(remote-sync → loader)
- 임시 telemetry 경로: ./telemetry → ../telemetry (Stage 3에서 ../core/telemetry로 최종화)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: settings/ 클러스터 확장 (가장 큰 클러스터)

이 클러스터는 prefs ← actions ← controller, 그리고 store도 controller가 사용. 모두 같은 폴더로 이동하므로 intra-cluster require들이 일관되게 갱신됨.

**Files:**
- Move: `src/prefs.js` → `src/settings/prefs.js`
- Move: `src/settings-store.js` → `src/settings/store.js`
- Move: `src/settings-actions.js` → `src/settings/actions.js`
- Move: `src/settings-controller.js` → `src/settings/controller.js`
- Move: `src/settings-renderer.js` → `src/settings/renderer.js`
- Move: `src/settings.html` → `src/settings/settings.html`
- Move: `test/prefs.test.js` → `test/settings/prefs.test.js`
- Move: `test/settings-store.test.js` → `test/settings/store.test.js`
- Move: `test/settings-actions.test.js` → `test/settings/actions.test.js`
- Move: `test/settings-controller.test.js` → `test/settings/controller.test.js`
- Modify: `src/main.js` (2 require + 1 path.join)
- Modify: `src/settings/controller.js` (intra-cluster requires)
- Modify: `src/settings/actions.js` (intra-cluster requires)
- Modify: 4개 신규 위치 테스트 (require 깊이 +1, 일부 추가 폴더 prefix)
- Modify: 기존 `test/settings/agent-gate.test.js`, `test/settings/menu-autostart.test.js` (require 경로 — 이미 깊이 `../../src/...`이지만 일부 모듈이 src/settings/로 이동했으므로 prefix 추가)

### Step 2.1: 파일 이동

```bash
git mv src/prefs.js                src/settings/prefs.js
git mv src/settings-store.js       src/settings/store.js
git mv src/settings-actions.js     src/settings/actions.js
git mv src/settings-controller.js  src/settings/controller.js
git mv src/settings-renderer.js    src/settings/renderer.js
git mv src/settings.html           src/settings/settings.html

git mv test/prefs.test.js               test/settings/prefs.test.js
git mv test/settings-store.test.js      test/settings/store.test.js
git mv test/settings-actions.test.js    test/settings/actions.test.js
git mv test/settings-controller.test.js test/settings/controller.test.js

git status --short
```
Expected: 10개 `R` 엔트리.

### Step 2.2: src/settings/controller.js 내부 require 갱신

`src/settings/controller.js`가 store, actions, prefs를 같은 폴더에서 require하도록:

| 찾기 | 바꾸기 |
|---|---|
| `require("./settings-store")` | `require("./store")` |
| `require("./settings-actions")` | `require("./actions")` |
| `require("./prefs")` | `require("./prefs")` (변경 없음 — 같은 폴더) |

검증:
```bash
grep -n 'require' src/settings/controller.js | head -10
```
Expected: store/actions는 신규 단축 이름, prefs 그대로.

### Step 2.3: src/settings/actions.js 내부 require 갱신

`src/settings/actions.js`가 prefs를 require하는 줄:

| 찾기 | 바꾸기 |
|---|---|
| `require("./prefs")` | `require("./prefs")` (변경 없음 — 같은 폴더) |

검증:
```bash
grep -n 'require' src/settings/actions.js | head -10
```
Expected: 모든 src-internal require는 같은 폴더 상대경로.

### Step 2.4: src/main.js require/path.join 갱신

| 찾기 | 바꾸기 |
|---|---|
| `require("./prefs")` | `require("./settings/prefs")` |
| `require("./settings-controller")` | `require("./settings/controller")` |
| `path.join(__dirname, "settings.html")` | `path.join(__dirname, "settings", "settings.html")` |

검증:
```bash
grep -n 'require.*prefs\|require.*settings-\|require.*settings/\|"settings\.html"\|"settings", "settings\.html"' src/main.js
```
Expected: 신규 경로만.

### Step 2.5: 신규 위치 테스트 require 깊이 조정

각 테스트(`test/settings/{prefs,store,actions,controller}.test.js`):

| 기존 (test/ 최상위 시점) | 신규 (test/settings/ 시점) |
|---|---|
| `require("../src/prefs")` | `require("../../src/settings/prefs")` |
| `require("../src/settings-store")` | `require("../../src/settings/store")` |
| `require("../src/settings-actions")` | `require("../../src/settings/actions")` |
| `require("../src/settings-controller")` | `require("../../src/settings/controller")` |
| `require("../src/<other-stage1-or-stage3>")` | `require("../../src/<other-stage1-or-stage3>")` |

각 파일 검토:
```bash
grep -n 'require' test/settings/prefs.test.js
grep -n 'require' test/settings/store.test.js
grep -n 'require' test/settings/actions.test.js
grep -n 'require' test/settings/controller.test.js
```

테스트 내부 require들을 위 매핑대로 일괄 교체.

### Step 2.6: 기존 settings/ 테스트의 require도 신규 폴더 경로로

Stage 1에서 이미 옮긴 `test/settings/agent-gate.test.js`, `test/settings/menu-autostart.test.js`는 require 깊이가 이미 `../../src/...`이지만, 그 중 `prefs`, `settings-actions` 같은 모듈을 require하면 경로의 prefix가 바뀌어야 함:

```bash
grep -n 'require' test/settings/agent-gate.test.js test/settings/menu-autostart.test.js
```

다음 매핑 적용 (해당 줄이 있는 경우만):

| 찾기 | 바꾸기 |
|---|---|
| `require("../../src/prefs")` | `require("../../src/settings/prefs")` |
| `require("../../src/settings-actions")` | `require("../../src/settings/actions")` |
| `require("../../src/settings-store")` | `require("../../src/settings/store")` |
| `require("../../src/settings-controller")` | `require("../../src/settings/controller")` |

### Step 2.7: 잔존 참조 0 확인

```bash
echo "=== src 내부 옛 경로 ==="
grep -rn "require(['\"]\\./prefs\|require(['\"]\\./settings-store\|require(['\"]\\./settings-actions\|require(['\"]\\./settings-controller\|require(['\"]\\./settings-renderer" src/ | grep -v 'src/settings/' || echo "clean"
echo "=== test 내부 옛 경로 ==="
grep -rn "require(['\"]\\.\\./src/prefs\|require(['\"]\\.\\./src/settings-store\|require(['\"]\\.\\./src/settings-actions\|require(['\"]\\.\\./src/settings-controller\|require(['\"]\\.\\./src/settings-renderer" test/ || echo "clean"
echo "=== test 내부 깊이 미조정 흔적 ==="
grep -rn "require(['\"]\\.\\./\\.\\./src/prefs[^/]" test/ || echo "clean (모든 prefs 경로가 settings/ 아래에 있음)"
echo "=== src/main.js의 settings.html 경로 ==="
grep -n 'settings\.html' src/main.js
```
- 1번, 2번: `clean`
- 3번: `clean (모든 ...)`
- 4번: `path.join(__dirname, "settings", "settings.html")`만 보임

### Step 2.8: 테스트 통과 확인

```bash
npm test 2>&1 | tail -10
```
Expected: 322 / 55 / 0.

만약 "Cannot find module" 에러가 나면 Step 2.5/2.6의 require 경로 수정 누락. 정확히 어느 테스트에서 어느 require가 깨졌는지 grep으로 추적.

### Step 2.9: Commit

```bash
git add -A
git commit -m "refactor(src): settings 클러스터를 src/settings/로 확장 이동

Stage 1에서 이미 이동한 agent-gate, login-item, i18n 옆에 prefs,
store(←settings-store), actions(←settings-actions),
controller(←settings-controller), renderer(←settings-renderer),
settings.html을 합류시킴.

- intra-cluster require 갱신(controller → store/actions/prefs)
- main.js의 prefs/controller require + settings.html path.join
- 신규 4개 테스트 require 깊이 +1 + 폴더 prefix
- Stage 1 settings 테스트 2개의 require도 신규 경로로 정정

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: server/ 클러스터 이동 (외부 require 깊이 변경 다수)

이 클러스터는 hooks/ 외부 require가 server.js에 7개, permission.js에 1개 있어 깊이 변화가 가장 많음. 또한 permission.js의 `./utils/log-rotate`가 `../utils/log-rotate`가 됨(Stage 1에서 이미 utils/로 이동된 log-rotate에 대한 깊이 변화).

**Files:**
- Move: `src/server.js` → `src/server/server.js`
- Move: `src/permission.js` → `src/server/permission.js`
- Move: `src/bubble.html` → `src/server/bubble.html`
- Move: `test/server-permission-subgate.test.js` → `test/server/permission-subgate.test.js`
- Move: `test/permission-reposition.test.js` → `test/server/permission-reposition.test.js`
- Move: `test/codex-notify-subgate.test.js` → `test/server/codex-notify-subgate.test.js`
- Modify: `src/main.js` (2 require)
- Modify: `src/server/server.js` (7 hooks/* 깊이 + 1 telemetry 깊이)
- Modify: `src/server/permission.js` (1 hooks/server-config 깊이 + 1 utils/log-rotate 깊이 + 1 preload path.join 깊이)
- Modify: 3개 신규 위치 테스트 (require 깊이 +1)

### Step 3.1: 파일 이동

```bash
mkdir -p src/server test/server
git mv src/server.js                    src/server/server.js
git mv src/permission.js                src/server/permission.js
git mv src/bubble.html                  src/server/bubble.html

git mv test/server-permission-subgate.test.js test/server/permission-subgate.test.js
git mv test/permission-reposition.test.js     test/server/permission-reposition.test.js
git mv test/codex-notify-subgate.test.js      test/server/codex-notify-subgate.test.js

git status --short
```
Expected: 6개 `R`.

### Step 3.2: src/server/server.js 외부 require 깊이 갱신

`src/server/server.js`가 `../hooks/...`로 require하던 7개 경로가 모두 한 단계 더 위로 가야 함:

| 찾기 | 바꾸기 |
|---|---|
| `require("../hooks/server-config")` | `require("../../hooks/server-config")` |
| `require("../hooks/install.js")` | `require("../../hooks/install.js")` |
| `require("../hooks/gemini-install.js")` | `require("../../hooks/gemini-install.js")` |
| `require("../hooks/codebuddy-install.js")` | `require("../../hooks/codebuddy-install.js")` |
| `require("../hooks/kiro-install.js")` | `require("../../hooks/kiro-install.js")` |
| `require("../hooks/cursor-install.js")` | `require("../../hooks/cursor-install.js")` |
| `require("../hooks/opencode-install.js")` | `require("../../hooks/opencode-install.js")` |

`require("./telemetry")` 1개:

| 찾기 | 바꾸기 |
|---|---|
| `require("./telemetry")` | `require("../telemetry")` |

검증:
```bash
grep -n 'require.*hooks\|require.*telemetry' src/server/server.js
```
Expected: 모든 `../hooks/...`이 `../../hooks/...`로, 모든 `./telemetry`가 `../telemetry`로.

### Step 3.3: src/server/permission.js 외부 require 깊이 갱신

```bash
grep -n 'require\|path\.join' src/server/permission.js | head -20
```

| 찾기 | 바꾸기 |
|---|---|
| `require("../hooks/server-config")` | `require("../../hooks/server-config")` |
| `require("./utils/log-rotate")` | `require("../utils/log-rotate")` |

`path.join` 갱신:

| 찾기 | 바꾸기 |
|---|---|
| `path.join(__dirname, "preload", "bubble.js")` | `path.join(__dirname, "..", "preload", "bubble.js")` |

`bubble.html`은 같은 폴더에 동행 이동했으므로 변경 없음:
- `loadFile(path.join(__dirname, "bubble.html"))` 그대로.

검증:
```bash
grep -n 'require\|path\.join' src/server/permission.js
```
Expected: hooks는 `../../`, log-rotate는 `../utils/`, preload는 `..", "preload"`, bubble.html은 그대로.

### Step 3.4: src/main.js require 갱신

| 찾기 | 바꾸기 |
|---|---|
| `require("./server")` | `require("./server/server")` |
| `require("./permission")` | `require("./server/permission")` |

검증:
```bash
grep -n 'require.*server\|require.*permission' src/main.js
```
Expected: 신규 경로만.

### Step 3.5: 신규 위치 테스트 require 깊이 조정

3개 테스트의 모든 `../src/<X>` → `../../src/<X>`. 그 중:
- `require("../src/server")` → `require("../../src/server/server")`
- `require("../src/permission")` → `require("../../src/server/permission")`

```bash
grep -n 'require' test/server/permission-subgate.test.js
grep -n 'require' test/server/permission-reposition.test.js
grep -n 'require' test/server/codex-notify-subgate.test.js
```

각각 검토 후 매핑 적용.

### Step 3.6: 잔존 참조 0 확인

```bash
echo "=== src 내부 옛 경로 ==="
grep -rn "require(['\"]\\./server[^/]\|require(['\"]\\./permission" src/ | grep -v 'server/' || echo "clean"
echo "=== test 내부 옛 경로 ==="
grep -rn "require(['\"]\\.\\./src/server[^/]\|require(['\"]\\.\\./src/permission" test/ | grep -v 'server/' || echo "clean"
echo "=== server 내부 깊이 미조정 외부 require ==="
grep -rn "require(['\"]\\.\\./hooks" src/server/ || echo "clean (모든 hooks가 ../../)"
```
모두 `clean`.

### Step 3.7: 테스트 통과 확인

```bash
npm test 2>&1 | tail -10
```
Expected: 322 / 55 / 0.

### Step 3.8: Commit

```bash
git add -A
git commit -m "refactor(src): server 클러스터를 src/server/로 이동

- server.js, permission.js, bubble.html → src/server/
- 7개 hooks/* require + 1개 utils/log-rotate require + 1개
  preload path.join 모두 한 단계 깊이 조정 (../ → ../../)
- 임시 telemetry 경로: ./telemetry → ../telemetry
- 테스트 3개 test/server/ 이동 + require 깊이 조정

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: update/ 클러스터 이동 (파일 이름 + path.join 변경)

update-bubble.js와 update-bubble.html 모두 `bubble.js`, `bubble.html`로 prefix 제거. 따라서 update-bubble.js의 `loadFile` 인자도 `bubble.html`로 단축.

**Files:**
- Move: `src/updater.js` → `src/update/updater.js`
- Move: `src/update-bubble.js` → `src/update/bubble.js`
- Move: `src/update-bubble.html` → `src/update/bubble.html`
- Move: `test/updater.test.js` → `test/update/updater.test.js`
- Move: `test/update-bubble-position.test.js` → `test/update/bubble-position.test.js`
- Move: `test/update-bubble-style.test.js` → `test/update/bubble-style.test.js`
- Modify: `src/main.js` (2 require)
- Modify: `src/update/updater.js` (telemetry 깊이)
- Modify: `src/update/bubble.js` (preload path.join 깊이 + loadFile 인자 단축)
- Modify: 3개 신규 위치 테스트 (require 깊이, html path.join 깊이)

### Step 4.1: 파일 이동

```bash
mkdir -p src/update test/update
git mv src/updater.js                src/update/updater.js
git mv src/update-bubble.js          src/update/bubble.js
git mv src/update-bubble.html        src/update/bubble.html

git mv test/updater.test.js              test/update/updater.test.js
git mv test/update-bubble-position.test.js test/update/bubble-position.test.js
git mv test/update-bubble-style.test.js    test/update/bubble-style.test.js

git status --short
```
Expected: 6개 `R`.

### Step 4.2: src/update/updater.js 내부 telemetry 갱신

| 찾기 | 바꾸기 |
|---|---|
| `try { return require("./telemetry"); }` | `try { return require("../telemetry"); }` |

검증:
```bash
grep -n 'require.*telemetry' src/update/updater.js
```
Expected: `require("../telemetry")`만.

### Step 4.3: src/update/bubble.js 내부 path.join 갱신

먼저 현재 상태 확인:
```bash
grep -n 'path\.join\|loadFile' src/update/bubble.js
```

다음 매핑 적용:

| 찾기 | 바꾸기 |
|---|---|
| `path.join(__dirname, "preload", "update-bubble.js")` | `path.join(__dirname, "..", "preload", "update-bubble.js")` |
| `path.join(__dirname, "update-bubble.html")` | `path.join(__dirname, "bubble.html")` |

**유의**: 위 두 변경은 별개. preload 경로는 깊이 +1, html은 같은 폴더라 `bubble.html`로 단축.

검증:
```bash
grep -n 'path\.join\|loadFile' src/update/bubble.js
```
Expected: `"..", "preload", "update-bubble.js"`, `"bubble.html"`.

### Step 4.4: src/main.js require 갱신

| 찾기 | 바꾸기 |
|---|---|
| `require("./updater")` | `require("./update/updater")` |
| `require("./update-bubble")` | `require("./update/bubble")` |

검증:
```bash
grep -n 'require.*updater\|require.*update-bubble\|require.*update/' src/main.js
```
Expected: 신규 경로만.

### Step 4.5: 신규 위치 테스트 require 깊이 + html path 갱신

`test/update/updater.test.js`:
- 모든 `require("../src/<X>")` → `require("../../src/<X>")`
- 그 중 `require("../src/updater")` → `require("../../src/update/updater")` (3~4 occurrences in this file)

`test/update/bubble-position.test.js`:
- `require("../src/update-bubble")` → `require("../../src/update/bubble")`
- 그 외 `../src/<X>` → `../../src/<X>`

`test/update/bubble-style.test.js`:
- `path.join(__dirname, "..", "src", "update-bubble.html")` → `path.join(__dirname, "..", "..", "src", "update", "bubble.html")`
- 그 외 require들 깊이 +1

```bash
grep -n 'require\|path\.join.*update' test/update/updater.test.js
grep -n 'require\|path\.join.*update' test/update/bubble-position.test.js
grep -n 'require\|path\.join.*update' test/update/bubble-style.test.js
```

검토 후 매핑 적용.

### Step 4.6: 잔존 참조 0 확인

```bash
echo "=== src 내부 옛 경로 ==="
grep -rn "require(['\"]\\./updater\|require(['\"]\\./update-bubble" src/ | grep -v 'update/' || echo "clean"
echo "=== test 내부 옛 경로 ==="
grep -rn "require(['\"]\\.\\./src/updater\|require(['\"]\\.\\./src/update-bubble" test/ | grep -v 'update/' || echo "clean"
echo "=== update-bubble.html 옛 경로 ==="
grep -rn '"update-bubble\.html"' src/ test/ || echo "clean"
```
모두 `clean`.

### Step 4.7: 테스트 통과 확인

```bash
npm test 2>&1 | tail -10
```
Expected: 322 / 55 / 0.

### Step 4.8: Commit

```bash
git add -A
git commit -m "refactor(src): update 클러스터를 src/update/로 이동

- updater.js, update-bubble.js → bubble.js, update-bubble.html → bubble.html
- 임시 telemetry 경로: ./telemetry → ../telemetry
- bubble.js의 preload path.join 깊이 조정 + html 인자 단축
- 테스트 3개 test/update/ 이동 + require/path 깊이 조정

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 문서 갱신 (CLAUDE.md, src/CLAUDE.md, docs/*)

Stage 2에서 이동된 파일들의 경로를 문서에 반영.

**Files:**
- Modify: `CLAUDE.md` (핵심 파일 표 + 아키텍처 다이어그램)
- Modify: `src/CLAUDE.md` (settings, theme, server, update 섹션)
- Modify: `docs/release-and-signing.md`
- Modify: `docs/macos-signing-setup.md`

### Step 5.1: 현재 참조 위치 확인

```bash
grep -n 'src/server\.js\|src/permission\|src/theme-loader\|src/remote-theme-sync\|src/settings-controller\|src/settings-store\|src/settings-actions\|src/settings-renderer\|src/prefs\|src/updater\|src/update-bubble' CLAUDE.md src/CLAUDE.md docs/release-and-signing.md docs/macos-signing-setup.md 2>/dev/null
```

### Step 5.2: CLAUDE.md 핵심 파일 표 갱신

기존 표 (라인 ~88-96):

| 파일 | 신규 경로 |
|---|---|
| `src/server.js` | `src/server/server.js` |
| `src/theme-loader.js` | `src/theme/loader.js` |
| `src/settings-controller.js` | `src/settings/controller.js` |

또한 아키텍처 다이어그램(라인 ~41-46):

| 기존 | 신규 |
|---|---|
| `src/server.js → src/state.js` | `src/server/server.js → src/state.js` (state는 Stage 3에서 갱신) |

### Step 5.3: src/CLAUDE.md 섹션 헤더 갱신

| 기존 헤더 | 신규 헤더 |
|---|---|
| `## 권한 버블 (permission.js + server.js → bubble.html)` | `## 권한 버블 (server/permission.js + server/server.js → server/bubble.html)` |
| `## 업데이트 버블 (update-bubble.js)` | `## 업데이트 버블 (update/bubble.js)` |
| `## 설정 패널 (settings-controller/store/actions/renderer)` | `## 설정 패널 (settings/controller·store·actions·renderer)` |
| `## 테마 로더 (theme-loader.js)` | `## 테마 로더 (theme/loader.js)` |
| `## 자동 업데이트 (updater.js)` | `## 자동 업데이트 (update/updater.js)` |

본문 내 파일명 직접 언급들도 자연스럽게 경로 포함 형태로 가볍게 조정.

### Step 5.4: docs/release-and-signing.md 갱신

L246 즈음:

| 찾기 | 바꾸기 |
|---|---|
| `src/updater.js` | `src/update/updater.js` |

### Step 5.5: docs/macos-signing-setup.md 갱신

L125 즈음:

| 찾기 | 바꾸기 |
|---|---|
| `src/updater.js` | `src/update/updater.js` |

### Step 5.6: 변경 확인

```bash
git diff CLAUDE.md src/CLAUDE.md docs/release-and-signing.md docs/macos-signing-setup.md
```

편집이 표/섹션 헤더 + 본문 가벼운 수준인지 검토.

### Step 5.7: Commit

```bash
git add CLAUDE.md src/CLAUDE.md docs/release-and-signing.md docs/macos-signing-setup.md
git commit -m "docs(stage2): 이동 파일 경로를 문서에 반영

- CLAUDE.md: 핵심 파일 표 + 아키텍처 다이어그램
- src/CLAUDE.md: settings/theme/server/update 섹션 헤더
- docs/release-and-signing.md, docs/macos-signing-setup.md:
  src/updater.js → src/update/updater.js

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 최종 검증

**Files:** (read-only)

### Step 6.1: 구 경로 잔존 grep 매트릭스

```bash
echo "=== src 내부 ==="
grep -rn "require(['\"]\\./prefs[^/]\|require(['\"]\\./settings-store\|require(['\"]\\./settings-actions\|require(['\"]\\./settings-controller\|require(['\"]\\./settings-renderer\|require(['\"]\\./theme-loader\|require(['\"]\\./remote-theme-sync\|require(['\"]\\./server[^/]\|require(['\"]\\./permission\|require(['\"]\\./updater\|require(['\"]\\./update-bubble" src/ || echo "clean"

echo "=== test 내부 ==="
grep -rn "require(['\"]\\.\\./src/prefs[^/]\|require(['\"]\\.\\./src/settings-store\|require(['\"]\\.\\./src/settings-actions\|require(['\"]\\.\\./src/settings-controller\|require(['\"]\\.\\./src/settings-renderer\|require(['\"]\\.\\./src/theme-loader\|require(['\"]\\.\\./src/remote-theme-sync\|require(['\"]\\.\\./src/server[^/]\|require(['\"]\\.\\./src/permission\|require(['\"]\\.\\./src/updater\|require(['\"]\\.\\./src/update-bubble" test/ || echo "clean"

echo "=== 옛 settings.html, bubble.html, update-bubble.html literal ==="
grep -rn '"settings\.html"\|"update-bubble\.html"' src/ test/ | grep -v 'src/settings/\|src/update/' || echo "clean"

echo "=== test/ 최상위 남은 Stage 2 대상 테스트 ==="
ls test/prefs.test.js test/settings-store.test.js test/settings-actions.test.js test/settings-controller.test.js test/remote-theme-sync.test.js test/server-permission-subgate.test.js test/permission-reposition.test.js test/codex-notify-subgate.test.js test/updater.test.js test/update-bubble-position.test.js test/update-bubble-style.test.js 2>&1 | grep -c "No such" || echo "0"
```
Expected: 모두 `clean`. 마지막은 `11` (모든 11개 테스트 이동 완료).

### Step 6.2: 전체 테스트 재실행

```bash
npm test 2>&1 | tail -10
```
Expected: 322 / 55 / 0.

### Step 6.3: Smoke 보조 확인

```bash
echo "=== src/ Stage 2 폴더 트리 ==="
ls src/settings/ src/theme/ src/server/ src/update/

echo "=== test/ Stage 2 폴더 트리 ==="
ls test/settings/ test/theme/ test/server/ test/update/

echo "=== src/main.js의 Stage 2 require 모두 신규 경로? ==="
grep -nE "require\\(['\"]\\./(settings|theme|server|update)/" src/main.js
```

### Step 6.4: (선택) `npm start` 수동 smoke

worktree 격리 하에 `npm start` 실행 시 단일 인스턴스 락에 막힐 수 있음. 머지 전 메인 체크아웃에서 다음 검증 권장:
- [ ] 펫 렌더링
- [ ] 설정 패널 열기 (settings/settings.html 로드 + settings/renderer.js)
- [ ] 권한 버블 표시 (`curl -X POST http://127.0.0.1:23333/permission ...`로 트리거)
- [ ] 업데이트 버블 표시
- [ ] 테마 리로드 (메뉴 → Theme)
- [ ] 모든 hook이 정상 등록(`updated 15` 출력)

### Step 6.5: 커밋 로그 점검

```bash
git log --oneline refactor/src-folder-split..HEAD
```
Expected: 5개 commit (Task 1~5). 각 atomic하게 npm test green.

---

## 실패 대응 (Troubleshooting)

**`Cannot find module '.../prefs'` 등 require 실패**
→ 해당 caller에서 require 경로 갱신 누락. `grep -rn require src/ test/`로 확인 후 매핑 적용.

**`bubble.html` 찾을 수 없음**
→ `src/server/permission.js`의 `loadFile(path.join(__dirname, "bubble.html"))`이 그대로 유지되었는지 확인. server/ 내부 동행 이동이므로 변경 없음이 정답.

**`update-bubble.html` 찾을 수 없음**
→ `src/update/bubble.js`의 loadFile 인자가 `"bubble.html"`로 단축되었는지 확인 (Step 4.3).

**preload script 로드 실패 (server 또는 update 윈도우)**
→ permission.js / update/bubble.js의 path.join이 `"..", "preload", "<file>"` 형태로 깊이 +1 되었는지 확인.

**hook 등록 실패 (`Cannot find module '../hooks/install.js'`)**
→ `src/server/server.js`의 모든 hooks 경로가 `../../hooks/...`로 갱신됐는지 확인 (Step 3.2).

**텔레메트리 import 실패 (try-catch이라 silent)**
→ Sentry 로그가 출력 안 되면 `require("../telemetry")` 갱신 누락 가능. theme/loader.js, server/server.js, update/updater.js 모두 확인.

---

## Stage 2 완료 정의 (Definition of Done)

- [ ] 6개 태스크 모두 완료 (체크박스 전부 체크)
- [ ] 14개 Stage 2 src/ 파일이 4개 신규 서브폴더(settings/ 확장, theme/ 신규, server/ 신규, update/ 신규)로 이동됨
- [ ] 11개 Stage 2 test 파일이 test/{settings,theme,server,update}/로 이동됨
- [ ] `npm test` 322개 pass (baseline 동일)
- [ ] Task 6.1의 grep 매트릭스 모두 `clean`
- [ ] 각 commit이 독립적으로 green
- [ ] Stage 2 PR 작성 (base = `refactor/src-folder-split`, head = `refactor/src-folder-split-stage2`) — 머지 순서: Stage 1 → Stage 2 → Stage 3

---

## Stage 3 이후 계획

Stage 2 PR이 머지된 후:
1. Stage 3 plan 작성 (`docs/superpowers/plans/2026-04-15-src-folder-split-stage3.md`)
2. Stage 3 대상: core/ 클러스터 (main, state, renderer, menu, focus, mini, mac-window, telemetry, index.html, styles.css)
3. Stage 3는 가장 위험 (수동 smoke test 필수, package.json `main` 필드 갱신 등)
4. Stage 2 임시 telemetry 경로(`../telemetry`)는 Stage 3에서 `../core/telemetry`로 최종화
