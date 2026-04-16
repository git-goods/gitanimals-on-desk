# src/ Folder Split — Stage 1 Implementation Plan

## 한 줄 요약 (사용자 관점)

**유저 동작/UI는 전혀 바뀌지 않습니다.** Stage 1은 `src/` 안의 33개 평탄한 파일 중 의존성이 가장 적은 15개 (preload 6, utils 2, hit 3, animation 1, settings 리프 3)를 6개 신규 폴더로 옮기고, 관련 테스트 4개도 같이 정리하는 내부 리팩토링입니다. 동작 변경 0, 새 기능 0, 단위 테스트 그대로 322개 통과 유지가 성공 기준입니다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/` 최상위 33개 flat 파일 중 **Stage 1 대상 15개**(preload/6, utils/2, hit/3, animation/1, settings leaves/3)를 기능별 서브폴더로 이동하고, 관련 테스트 4개와 `package.json` 테스트 스크립트를 같은 PR에서 원자적으로 업데이트한다.

**Architecture:** 파일 내부 리팩토링은 없다. 순수 디렉토리 재조직 + `require()` / `path.join()` / 문서 경로 갱신. 각 태스크는 하나의 폴더/파일을 이동하고 관련 caller를 같은 커밋에서 갱신해 **커밋마다 `npm test` 통과 상태 유지**. Stage 1 완료 시 main.js는 여전히 src/ 최상위에 남아 있다 (Stage 3에서 이동).

**Tech Stack:** Node.js (Electron main process), `node --test`(내장 러너), `git mv`, bash grep.

**스펙 참조:** `docs/superpowers/specs/2026-04-15-src-folder-split-design.md` — Stage 1 섹션

**작업 worktree:** `/Users/sumi/Documents/repo/personal/clawd-on-desk/.worktrees/src-folder-split/`
**브랜치:** `refactor/src-folder-split`

---

## File Structure

### 새로 생기는 디렉토리 (이 PR 내)

- `src/preload/` — 6개 preload 스크립트 이동
- `src/utils/` — work-area, log-rotate
- `src/hit/` — hit-geometry, hit-renderer, hit.html
- `src/animation/` — tick
- `src/settings/` — agent-gate, login-item, i18n (Stage 2에서 추가 파일 합류 예정, 이번엔 리프만)
- `test/utils/`, `test/settings/` — 4개 테스트 이동

### 건드리는 기존 파일 (이동 대상 아님)

- `src/main.js` — 9줄 require + 3개 path.join 갱신
- `src/permission.js` — 1줄 require + 1개 path.join
- `src/menu.js` — 1줄 require + 1개 path.join
- `src/update-bubble.js` — 1개 path.join
- `agents/gemini-log-monitor.js` — 1줄 require
- `package.json` — test 스크립트 1줄
- `src/CLAUDE.md` — 소수 섹션 파일명 언급

---

## 사전 준비

### Task 0: Baseline 확인

**Files:** (read-only verification)

- [ ] **Step 0.1:** worktree 경로 확인

```bash
cd /Users/sumi/Documents/repo/personal/clawd-on-desk/.worktrees/src-folder-split
pwd
git branch --show-current
```

Expected: `refactor/src-folder-split` 브랜치 출력.

- [ ] **Step 0.2:** 의존성 설치 상태 확인

```bash
test -d node_modules && echo "OK" || npm install
```

- [ ] **Step 0.3:** baseline `npm test` 통과 확인

```bash
npm test 2>&1 | tail -20
```

Expected: `# pass 28` 또는 그 이상 (추가된 테스트 있을 수 있음). 실패가 있다면 Stage 1 시작하지 말고 먼저 보고.

- [ ] **Step 0.4:** 구 경로 기준 레퍼런스 grep (baseline)

```bash
grep -rn "require(['\"]\.\./src/log-rotate" --include='*.js' agents/ hooks/ || true
grep -rn "require(['\"]\./log-rotate" src/ || true
grep -rn "require(['\"]\./hit-geometry" src/ || true
grep -rn "require(['\"]\./work-area" src/ || true
grep -rn "require(['\"]\./tick" src/ || true
grep -rn "require(['\"]\./agent-gate" src/ || true
grep -rn "require(['\"]\./login-item" src/ || true
grep -rn "require(['\"]\./i18n" src/ || true
grep -rn "path.join(__dirname, ['\"]preload" src/ || true
grep -rn "path.join(__dirname, ['\"]hit.html" src/ || true
```

Expected hits (Stage 1 타깃; Task 종료 후 0이어야 함):

- `agents/gemini-log-monitor.js` : `require("../src/log-rotate")`
- `src/main.js` : 9+개 (위 require들 + path.join preload/hit)
- `src/permission.js` : 1 require (log-rotate) + 1 path.join (preload-bubble)
- `src/menu.js` : 1 require (i18n) + 1 path.join (preload-prompt)
- `src/update-bubble.js` : 1 path.join (preload-update-bubble)

**각 태스크가 이 그렙 리스트 중 해당 항목을 0으로 만들어야 한다.**

---

## Task 1: package.json 테스트 스크립트 디렉토리 재귀로 변경

**이유:** 이후 태스크에서 테스트를 `test/utils/`, `test/settings/` 서브폴더로 이동한다. 현재 `"test": "node --test test/*.test.js"` 글롭은 subdirectory를 매치하지 않아 이동된 테스트가 조용히 누락된다.

**스펙 정정 노트** (검증으로 확인됨):
- 원래 스펙안 `"node --test test/*.test.js test/*/*.test.js"`는 시점 의존적 결함이 있다. shell이 `test/*/*.test.js`를 unexpand 상태로 그대로 전달하면 `node --test`가 literal 경로로 해석해 exit 1이 된다 (Stage 1 시작 시점에는 서브폴더 테스트가 아직 0개라 unexpand 발생).
- 또한 `$(...)` 같은 shell substitution은 Windows `cmd.exe`에서 동작하지 않아 portability 깨짐.
- 채택안: **`"test": "node --test test/"`** — Node 18+ 내장 디렉토리 재귀 탐색. shell glob 비의존, Windows 포함 모든 셸 동일 동작. 현재 worktree Node v20.19.3에서 동일 baseline(322/55/0) 검증됨.

**Files:**
- Modify: `package.json`

- [ ] **Step 1.1:** 현재 `scripts.test` 확인

```bash
grep '"test"' package.json
```

Expected (정정 전 베이스): `"test": "node --test test/*.test.js",`

- [ ] **Step 1.2:** `package.json` 편집

`"test": "node --test test/*.test.js"` → `"test": "node --test test/"`

- [ ] **Step 1.3:** 디렉토리 재귀 동작 검증

```bash
node --test test/ 2>&1 | tail -10
```

Expected: `# pass 322 / # suites 55 / # fail 0` (baseline 그대로).

- [ ] **Step 1.4:** `npm test` 통과 확인

```bash
npm test 2>&1 | tail -10
```

Expected: 동일 322 pass / 55 suites / 0 fail.

- [ ] **Step 1.5:** Commit

```bash
git add package.json
git commit -m "chore(test): node --test test/ 디렉토리 재귀로 전환

Stage 1에서 test/ 일부가 서브폴더로 이동한다. shell glob 의존을
없애기 위해 Node 18+ 내장 디렉토리 재귀 탐색으로 변경. cmd.exe
포함 모든 셸에서 동일 동작.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: preload 디렉토리 이동

**Files:**
- Create: `src/preload/` (git mv로 자동 생성)
- Move: `src/preload.js` → `src/preload/preload.js`
- Move: `src/preload-bubble.js` → `src/preload/bubble.js`
- Move: `src/preload-hit.js` → `src/preload/hit.js`
- Move: `src/preload-prompt.js` → `src/preload/prompt.js`
- Move: `src/preload-settings.js` → `src/preload/settings.js`
- Move: `src/preload-update-bubble.js` → `src/preload/update-bubble.js`
- Modify: `src/main.js` (3 path.join)
- Modify: `src/permission.js` (1 path.join)
- Modify: `src/menu.js` (1 path.join)
- Modify: `src/update-bubble.js` (1 path.join)

**검증 포인트:** preload는 `require()`로 불리지 않고 오직 `path.join(__dirname, "<file>")`으로만 참조된다. require 경로 갱신이 아닌 문자열 리터럴 갱신임을 유의.

- [ ] **Step 2.1:** 파일 이동 (git이 rename으로 인식하도록 개별 이동)

```bash
mkdir -p src/preload
git mv src/preload.js               src/preload/preload.js
git mv src/preload-bubble.js        src/preload/bubble.js
git mv src/preload-hit.js           src/preload/hit.js
git mv src/preload-prompt.js        src/preload/prompt.js
git mv src/preload-settings.js      src/preload/settings.js
git mv src/preload-update-bubble.js src/preload/update-bubble.js
git status --short
```

Expected: 6개 `R` (rename) 엔트리.

- [ ] **Step 2.2:** `src/main.js`의 preload path.join 3개 갱신

`src/main.js`에서 다음 패턴을 찾아 교체:

| 찾기 | 바꾸기 |
|---|---|
| `path.join(__dirname, "preload.js")` | `path.join(__dirname, "preload", "preload.js")` |
| `path.join(__dirname, "preload-settings.js")` | `path.join(__dirname, "preload", "settings.js")` |
| `path.join(__dirname, "preload-hit.js")` | `path.join(__dirname, "preload", "hit.js")` |

검색 명령:

```bash
grep -n 'path.join(__dirname, "preload' src/main.js
```

Expected after edits: 3개 모두 `"preload", "<file>"` 2-인자 형태로 바뀜.

- [ ] **Step 2.3:** `src/permission.js`의 preload-bubble path.join 갱신

| 찾기 | 바꾸기 |
|---|---|
| `path.join(__dirname, "preload-bubble.js")` | `path.join(__dirname, "preload", "bubble.js")` |

```bash
grep -n 'path.join(__dirname, "preload' src/permission.js
```

Expected after edit: `"preload", "bubble.js"`.

- [ ] **Step 2.4:** `src/menu.js`의 preload-prompt path.join 갱신

| 찾기 | 바꾸기 |
|---|---|
| `path.join(__dirname, "preload-prompt.js")` | `path.join(__dirname, "preload", "prompt.js")` |

```bash
grep -n 'path.join(__dirname, "preload' src/menu.js
```

- [ ] **Step 2.5:** `src/update-bubble.js`의 preload-update-bubble path.join 갱신

| 찾기 | 바꾸기 |
|---|---|
| `path.join(__dirname, "preload-update-bubble.js")` | `path.join(__dirname, "preload", "update-bubble.js")` |

```bash
grep -n 'path.join(__dirname, "preload' src/update-bubble.js
```

- [ ] **Step 2.6:** 잔존 참조 0 확인

```bash
grep -rn 'path.join(__dirname, "preload\.js\|"preload-\(bubble\|hit\|prompt\|settings\|update-bubble\)\.js"' src/ || echo "clean"
```

Expected: `clean`.

- [ ] **Step 2.7:** 테스트 통과 확인 (preload는 직접 테스트 없음; 회귀 확인용)

```bash
npm test 2>&1 | tail -5
```

Expected: 28개 pass 유지.

- [ ] **Step 2.8:** Commit

```bash
git add -A
git commit -m "refactor(src): preload 스크립트를 src/preload/로 이동

prefix 중복 제거(preload-bubble.js → bubble.js 등). 이동 대상은
require()로 참조되지 않고 path.join()으로만 로드되므로 5개 caller
(main.js, permission.js, menu.js, update-bubble.js)의 문자열 경로만
갱신.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: utils/log-rotate 이동

**Files:**
- Move: `src/log-rotate.js` → `src/utils/log-rotate.js`
- Move: `test/log-rotate.test.js` → `test/utils/log-rotate.test.js`
- Modify: `src/main.js` (1 require)
- Modify: `src/permission.js` (1 require)
- Modify: `agents/gemini-log-monitor.js` (1 require, 외부)

- [ ] **Step 3.1:** 파일 이동

```bash
mkdir -p src/utils test/utils
git mv src/log-rotate.js src/utils/log-rotate.js
git mv test/log-rotate.test.js test/utils/log-rotate.test.js
```

- [ ] **Step 3.2:** `src/main.js` require 갱신

| 찾기 | 바꾸기 |
|---|---|
| `require("./log-rotate")` | `require("./utils/log-rotate")` |

- [ ] **Step 3.3:** `src/permission.js` require 갱신

| 찾기 | 바꾸기 |
|---|---|
| `require("./log-rotate")` | `require("./utils/log-rotate")` |

- [ ] **Step 3.4:** `agents/gemini-log-monitor.js` require 갱신

| 찾기 | 바꾸기 |
|---|---|
| `require("../src/log-rotate")` | `require("../src/utils/log-rotate")` |

- [ ] **Step 3.5:** `test/utils/log-rotate.test.js` 내부 require 갱신

기존 테스트는 보통 `require("../src/log-rotate")` 패턴. 이제 `test/utils/`로 옮겨졌으므로 `../../src/utils/log-rotate`가 된다.

```bash
grep -n "require" test/utils/log-rotate.test.js
```

모든 `require("../src/log-rotate")` → `require("../../src/utils/log-rotate")`.

- [ ] **Step 3.6:** 잔존 참조 0 확인

```bash
grep -rn 'require(["'\'']\..*log-rotate' --include='*.js' . | grep -v node_modules
```

Expected: 오직 `src/utils/log-rotate.js` 자신 또는 `test/utils/log-rotate.test.js`, `src/main.js`, `src/permission.js`, `agents/gemini-log-monitor.js`의 신규 경로만 나옴. 옛 `./log-rotate` 또는 `../src/log-rotate`는 0.

- [ ] **Step 3.7:** 테스트 통과 확인

```bash
npm test 2>&1 | tail -5
```

Expected: 28개 pass.

- [ ] **Step 3.8:** Commit

```bash
git add -A
git commit -m "refactor(src): log-rotate을 src/utils/로 이동

내부 2개 caller(main.js, permission.js) + 외부 1개 caller
(agents/gemini-log-monitor.js) + test 이동.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: utils/work-area 이동

**Files:**
- Move: `src/work-area.js` → `src/utils/work-area.js`
- Move: `test/work-area.test.js` → `test/utils/work-area.test.js`
- Modify: `src/main.js` (1 require)

- [ ] **Step 4.1:** 파일 이동

```bash
git mv src/work-area.js src/utils/work-area.js
git mv test/work-area.test.js test/utils/work-area.test.js
```

- [ ] **Step 4.2:** `src/main.js` require 갱신

| 찾기 | 바꾸기 |
|---|---|
| `require("./work-area")` | `require("./utils/work-area")` |

- [ ] **Step 4.3:** `test/utils/work-area.test.js` 내부 require 갱신

모든 `require("../src/work-area")` → `require("../../src/utils/work-area")`.

- [ ] **Step 4.4:** 잔존 참조 0 확인

```bash
grep -rn 'require(["'\'']\..*work-area' --include='*.js' . | grep -v node_modules | grep -v 'src/utils/work-area\|test/utils/work-area' || echo "clean"
```

Expected: `clean` 또는 `src/main.js`의 `./utils/work-area`만.

- [ ] **Step 4.5:** 테스트 통과 확인

```bash
npm test 2>&1 | tail -5
```

- [ ] **Step 4.6:** Commit

```bash
git add -A
git commit -m "refactor(src): work-area를 src/utils/로 이동

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: hit/ 디렉토리 이동

**Files:**
- Move: `src/hit-geometry.js` → `src/hit/geometry.js`
- Move: `src/hit-renderer.js` → `src/hit/renderer.js`
- Move: `src/hit.html` → `src/hit/hit.html`
- Modify: `src/main.js` (1 require + 1 path.join)
- Modify: `src/hit/hit.html` (1 `<script src>`)

**주의:** hit.html의 `<script src="hit-renderer.js">`는 이동 후 같은 폴더의 `renderer.js`를 가리켜야 하므로 `<script src="renderer.js">`로 변경.

- [ ] **Step 5.1:** 파일 이동

```bash
mkdir -p src/hit
git mv src/hit-geometry.js src/hit/geometry.js
git mv src/hit-renderer.js src/hit/renderer.js
git mv src/hit.html src/hit/hit.html
```

- [ ] **Step 5.2:** `src/hit/hit.html` script 태그 갱신

| 찾기 | 바꾸기 |
|---|---|
| `<script src="hit-renderer.js">` | `<script src="renderer.js">` |

```bash
grep -n 'script src=' src/hit/hit.html
```

Expected: `<script src="renderer.js">`.

- [ ] **Step 5.3:** `src/main.js` require 갱신

| 찾기 | 바꾸기 |
|---|---|
| `require("./hit-geometry")` | `require("./hit/geometry")` |

- [ ] **Step 5.4:** `src/main.js` path.join(hit.html) 갱신

| 찾기 | 바꾸기 |
|---|---|
| `path.join(__dirname, "hit.html")` | `path.join(__dirname, "hit", "hit.html")` |

```bash
grep -n 'hit-geometry\|hit\.html' src/main.js
```

Expected: 갱신 후 신규 경로만 보임.

- [ ] **Step 5.5:** 잔존 참조 0 확인

```bash
grep -rn 'hit-geometry\|hit-renderer\|"hit\.html"' --include='*.js' --include='*.html' src/ | grep -v 'src/hit/' || echo "clean"
```

Expected: `clean`.

- [ ] **Step 5.6:** 테스트 통과 확인

```bash
npm test 2>&1 | tail -5
```

- [ ] **Step 5.7:** Smoke: 히트박스 드래그 검증

```bash
# 터미널에서 `npm start` 실행 후 아래 확인:
# 1) 펫이 렌더링되는지 (index.html + renderer.js 건드리지 않음)
# 2) 펫을 마우스로 드래그할 수 있는지 (hit.html + hit/renderer.js 통합 검증)
# 3) 더블클릭 반응 동작
# 4) Ctrl+C로 종료
```

만약 드래그가 안 되면: `src/main.js`의 hit 윈도우 생성 코드 주변에서 `loadFile(path.join(__dirname, "hit", "hit.html"))` 인지 재확인.

- [ ] **Step 5.8:** Commit

```bash
git add -A
git commit -m "refactor(src): hit 모듈을 src/hit/로 이동

- hit-geometry.js → hit/geometry.js
- hit-renderer.js → hit/renderer.js
- hit.html → hit/hit.html (스크립트 src도 갱신)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: animation/tick 이동

**Files:**
- Move: `src/tick.js` → `src/animation/tick.js`
- Modify: `src/main.js` (1 require)

- [ ] **Step 6.1:** 파일 이동

```bash
mkdir -p src/animation
git mv src/tick.js src/animation/tick.js
```

- [ ] **Step 6.2:** `src/main.js` require 갱신

| 찾기 | 바꾸기 |
|---|---|
| `require("./tick")` | `require("./animation/tick")` |

- [ ] **Step 6.3:** 잔존 참조 0 확인

```bash
grep -rn 'require(["'\'']\./tick' --include='*.js' src/ | grep -v 'animation/tick' || echo "clean"
```

Expected: `clean`.

- [ ] **Step 6.4:** 테스트 통과 확인

```bash
npm test 2>&1 | tail -5
```

- [ ] **Step 6.5:** Smoke: 눈동자 추적 검증

```bash
# `npm start` 실행 후:
# 1) 마우스를 펫 주변 사방으로 움직여 눈동자가 따라오는지 확인
# 2) 마우스 정지 → 10초 후 sleep 시퀀스 진입하는지 확인
# 3) Ctrl+C로 종료
```

- [ ] **Step 6.6:** Commit

```bash
git add -A
git commit -m "refactor(src): tick.js를 src/animation/으로 이동

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: settings/agent-gate 이동

**Files:**
- Move: `src/agent-gate.js` → `src/settings/agent-gate.js`
- Move: `test/agent-gate.test.js` → `test/settings/agent-gate.test.js`
- Modify: `src/main.js` (1 require)

- [ ] **Step 7.1:** 파일 이동

```bash
mkdir -p src/settings test/settings
git mv src/agent-gate.js src/settings/agent-gate.js
git mv test/agent-gate.test.js test/settings/agent-gate.test.js
```

- [ ] **Step 7.2:** `src/main.js` require 갱신

| 찾기 | 바꾸기 |
|---|---|
| `require("./agent-gate")` | `require("./settings/agent-gate")` |

- [ ] **Step 7.3:** `test/settings/agent-gate.test.js` 내부 require 갱신

이 테스트는 agent-gate뿐 아니라 settings-actions, prefs도 require할 수 있다. **Stage 1 범위에서는 agent-gate 경로만** 갱신하고 나머지(아직 이동 안 된 것)는 그대로 둔다.

```bash
grep -n 'require' test/settings/agent-gate.test.js
```

- `require("../src/agent-gate")` → `require("../../src/settings/agent-gate")` ✓ (Stage 1)
- `require("../src/settings-actions")` → `require("../../src/settings-actions")` ✓ (깊이만 +1 변경, 파일은 Stage 2까지 src/ 최상위)
- `require("../src/prefs")` → `require("../../src/prefs")` ✓ (동일)
- `require("../src/settings-store")` → `require("../../src/settings-store")` ✓ (동일)

**모든 require**를 `../src/...` → `../../src/...`로 깊이 조정해야 함.

- [ ] **Step 7.4:** 잔존 참조 0 확인

```bash
grep -rn 'require(["'\'']\./agent-gate' --include='*.js' src/ | grep -v 'settings/agent-gate' || echo "clean"
grep -rn 'require(["'\'']\.\./src/agent-gate' --include='*.js' test/ | grep -v 'settings/agent-gate' || echo "clean"
```

Expected: 둘 다 `clean`.

- [ ] **Step 7.5:** 테스트 통과 확인

```bash
npm test 2>&1 | tail -5
```

Expected: 28개 pass. 만약 test/settings/agent-gate.test.js에서 "Cannot find module" 오류가 나면 Step 7.3의 깊이 조정 누락. `grep require test/settings/agent-gate.test.js`로 한 번 더 점검.

- [ ] **Step 7.6:** Commit

```bash
git add -A
git commit -m "refactor(src): agent-gate를 src/settings/로 이동

- src/agent-gate.js → src/settings/agent-gate.js
- test/agent-gate.test.js → test/settings/agent-gate.test.js
  - 테스트 내 모든 ../src/*를 ../../src/*로 깊이 조정

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: settings/login-item 이동

**Files:**
- Move: `src/login-item.js` → `src/settings/login-item.js`
- Move: `test/menu-autostart.test.js` → `test/settings/menu-autostart.test.js`
- Modify: `src/main.js` (1 require)

- [ ] **Step 8.1:** 파일 이동

```bash
git mv src/login-item.js src/settings/login-item.js
git mv test/menu-autostart.test.js test/settings/menu-autostart.test.js
```

- [ ] **Step 8.2:** `src/main.js` require 갱신

| 찾기 | 바꾸기 |
|---|---|
| `require("./login-item")` | `require("./settings/login-item")` |

- [ ] **Step 8.3:** `test/settings/menu-autostart.test.js` 내부 require 깊이 조정

모든 `require("../src/<name>")` → `require("../../src/<name>")`, 그리고 login-item만 `require("../../src/settings/login-item")`.

```bash
grep -n 'require' test/settings/menu-autostart.test.js
```

검토 후 경로 갱신.

- [ ] **Step 8.4:** 잔존 참조 0 확인

```bash
grep -rn 'require(["'\'']\./login-item' --include='*.js' src/ | grep -v 'settings/login-item' || echo "clean"
```

Expected: `clean`.

- [ ] **Step 8.5:** 테스트 통과 확인

```bash
npm test 2>&1 | tail -5
```

- [ ] **Step 8.6:** Commit

```bash
git add -A
git commit -m "refactor(src): login-item을 src/settings/로 이동

테스트(menu-autostart.test.js)도 test/settings/로 이동하며 require
깊이 조정.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: settings/i18n 이동

**Files:**
- Move: `src/i18n.js` → `src/settings/i18n.js`
- Modify: `src/menu.js` (1 require)

**주의:** i18n.js의 소비자는 menu.js 단 한 곳이며, menu.js는 Stage 3에서 core/로 이동한다. 이번 Stage에서는 menu.js가 src/ 최상위에 있으므로 `require("./settings/i18n")` 형태가 된다. Stage 3에서 menu.js가 core/로 이동할 때 이 경로는 `require("../settings/i18n")`로 자동 조정된다.

- [ ] **Step 9.1:** 파일 이동

```bash
git mv src/i18n.js src/settings/i18n.js
```

- [ ] **Step 9.2:** `src/menu.js` require 갱신

| 찾기 | 바꾸기 |
|---|---|
| `require("./i18n")` | `require("./settings/i18n")` |

- [ ] **Step 9.3:** 잔존 참조 0 확인

```bash
grep -rn 'require(["'\'']\./i18n' --include='*.js' src/ | grep -v 'settings/i18n' || echo "clean"
```

Expected: `clean`.

- [ ] **Step 9.4:** 테스트 통과 확인

```bash
npm test 2>&1 | tail -5
```

Expected: 28개 pass. i18n 전용 테스트는 없으므로 menu 관련 테스트(`test/settings/menu-autostart.test.js`)가 통과해야 한다.

- [ ] **Step 9.5:** Smoke: 트레이/우클릭 메뉴 언어 라벨 검증

```bash
# `npm start` 후:
# 1) 트레이 아이콘 우클릭 → 메뉴 항목 라벨이 언어(en/zh)에 맞게 표시되는지
# 2) Language 서브메뉴로 언어 전환 → 라벨이 바뀌는지
# 3) Ctrl+C
```

- [ ] **Step 9.6:** Commit

```bash
git add -A
git commit -m "refactor(src): i18n을 src/settings/로 이동

menu.js의 require 경로만 갱신(유일한 소비자).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: src/CLAUDE.md 문서 갱신

**Files:**
- Modify: `src/CLAUDE.md`

**이유:** Stage 1에서 이동된 파일들 중 src/CLAUDE.md가 이름으로 언급하는 것은 `agent-gate.js`, `i18n.js`, `tick.js`, `hit-renderer.js`. 루트 CLAUDE.md의 "핵심 파일" 표에는 이 네 파일이 없으므로 루트 문서는 수정 불필요.

- [ ] **Step 10.1:** 현재 참조 위치 확인

```bash
grep -n "agent-gate\|tick\.js\|hit-renderer\|i18n\.js" src/CLAUDE.md
```

- [ ] **Step 10.2:** 섹션 헤더 갱신 (예시)

아래 섹션 헤더들에 **경로**를 명시하는 형태로 업데이트:

| 기존 헤더 | 갱신 후 헤더 |
|---|---|
| `## 에이전트 게이트 (agent-gate.js)` | `## 에이전트 게이트 (settings/agent-gate.js)` |
| `## 눈동자 추적 (tick.js → renderer.js)` | `## 눈동자 추적 (animation/tick.js → renderer.js)` |
| `## 클릭 반응 (hit-renderer.js → main relay → renderer.js)` | `## 클릭 반응 (hit/renderer.js → main relay → renderer.js)` |
| `## i18n (i18n.js)` | `## i18n (settings/i18n.js)` |

또한 본문 내 첫 줄 언급도 경로 포함 형태로 조정 (2~3줄 수준의 가벼운 편집).

- [ ] **Step 10.3:** 변경 확인

```bash
git diff src/CLAUDE.md
```

편집 내용이 섹션 헤더/첫 문장 수준인지 검토.

- [ ] **Step 10.4:** Commit

```bash
git add src/CLAUDE.md
git commit -m "docs(src): Stage 1 이동 파일 경로 반영

agent-gate, tick, hit-renderer, i18n 섹션 헤더의 파일 경로를 새
위치에 맞춰 갱신.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: 최종 검증 및 요약

**Files:** (read-only)

- [ ] **Step 11.1:** Stage 1 전체 grep 매트릭스 (구 경로 잔존 검사)

```bash
set -e
echo "=== src 내부 구 경로 ==="
grep -rn 'require(["'\'']\./log-rotate\|["'\'']\./work-area\|["'\'']\./hit-geometry\|["'\'']\./tick\|["'\'']\./agent-gate\|["'\'']\./login-item\|["'\'']\./i18n' src/ || echo "clean"

echo "=== 외부에서 src 내부 구 경로 ==="
grep -rn 'require(["'\'']\.\./src/log-rotate\|["'\'']\.\./src/work-area\|["'\'']\.\./src/hit-geometry\|["'\'']\.\./src/tick\|["'\'']\.\./src/agent-gate\|["'\'']\.\./src/login-item\|["'\'']\.\./src/i18n' --include='*.js' agents/ hooks/ scripts/ tools/ 2>/dev/null || echo "clean"

echo "=== test/ 최상위 남은 Stage 1 대상 테스트 ==="
ls test/log-rotate.test.js test/work-area.test.js test/agent-gate.test.js test/menu-autostart.test.js 2>/dev/null && echo "STILL PRESENT" || echo "moved"

echo "=== preload 구 경로 ==="
grep -rn '"preload\.js"\|"preload-bubble\.js"\|"preload-hit\.js"\|"preload-prompt\.js"\|"preload-settings\.js"\|"preload-update-bubble\.js"\|"hit\.html"' src/ | grep -v 'src/preload/\|src/hit/' || echo "clean"
```

Expected: 모두 `clean` 또는 `moved`.

- [ ] **Step 11.2:** 전체 테스트 재실행

```bash
npm test 2>&1 | tail -10
```

Expected: `# pass 28` (또는 그 이상, 기존 baseline과 동일).

- [ ] **Step 11.3:** Smoke test 종합

```bash
# `npm start` 실행 후:
# [ ] 펫 렌더링
# [ ] 마우스 눈동자 추적 (tick)
# [ ] 드래그 가능 (hit)
# [ ] 더블클릭 반응 (hit)
# [ ] 트레이 우클릭 메뉴 (menu, i18n)
# [ ] 언어 전환 동작
# [ ] 10초 유휴 → sleep 시퀀스
# [ ] Ctrl+C 정상 종료
```

- [ ] **Step 11.4:** 로그 출력에 preload 관련 에러 없음 확인

```bash
# `npm start` stderr에 "Unable to load preload script" / "Cannot find module" 없어야 함
```

- [ ] **Step 11.5:** 커밋 로그 점검

```bash
git log --oneline origin/main..HEAD
```

Expected: Task 1~10 각각 독립 커밋 + spec 커밋. 각 커밋이 독립적으로 `npm test` 통과 상태.

- [ ] **Step 11.6 (선택):** Stage 1 완료 브랜치 push

```bash
# 사용자 승인 후에만:
# git push -u origin refactor/src-folder-split
```

---

## 실패 대응 (Troubleshooting)

**`npm test` 에서 "Cannot find module '.../src/<name>'"**
→ 해당 테스트 파일의 `require` 경로가 깊이 조정되지 않음. `grep require test/<path>.test.js`로 확인 후 `../src/` → `../../src/` 교체. 이동된 파일은 추가로 서브폴더 경로.

**`npm start` 에서 "Failed to load URL: file:///.../hit.html"**
→ `src/main.js`의 hit 윈도우 `loadFile()` path.join 이 `hit.html` 그대로 남아 있음. `path.join(__dirname, "hit", "hit.html")`로 수정.

**`npm start` 에서 "Unable to load preload script"**
→ 해당 BrowserWindow 생성 블록의 `webPreferences.preload` 값이 구 경로. Task 2의 매핑 표대로 `"preload", "<file>"` 2-인자로 교체.

**펫 드래그가 안 됨**
→ `src/hit/hit.html`의 `<script src="hit-renderer.js">`를 `<script src="renderer.js">`로 변경 누락. HTML은 **상대경로**로 로드되므로 같은 폴더의 renderer.js를 가리켜야 함.

**눈동자 추적이 안 됨**
→ `src/main.js`에 `require("./tick")` 잔존. `require("./animation/tick")`로 수정.

---

## Stage 1 완료 정의 (Definition of Done)

- [ ] 11개 태스크 모두 완료 (체크박스 전부 체크)
- [ ] 15개 src/ 파일이 5개 신규 서브폴더로 이동됨
- [ ] 4개 test 파일이 test/utils/, test/settings/로 이동됨
- [ ] `package.json` test 글롭이 `test/*.test.js test/*/*.test.js`로 확장됨
- [ ] `npm test` 28개 pass (baseline과 동일)
- [ ] `npm start` smoke test 체크리스트 모두 통과
- [ ] Task 11.1의 grep 매트릭스에서 구 경로 참조 0
- [ ] 각 커밋이 독립적으로 green (선택 검증: `git rebase -i HEAD~10 exec 'npm test'`)
- [ ] Stage 2, 3는 후속 PR로 분리 (이 PR 범위 외)

---

## Stage 2, 3 이후 계획

Stage 1 PR이 머지된 후:
1. Stage 2 plan 작성 (`docs/superpowers/plans/2026-04-??-src-folder-split-stage2.md`)
2. Stage 2 대상: settings 클러스터 + theme + server + update
3. Stage 3 plan: core 클러스터 + package.json main 필드 + telemetry/state depth
