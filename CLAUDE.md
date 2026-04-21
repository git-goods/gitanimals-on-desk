# CLAUDE.md

## 프로젝트 개요

Clawd 데스크톱 펫 — Electron 기반 데스크톱 펫으로, hook 시스템과 로그 폴링으로 AI coding agent 작업 상태를 실시간 감지하여 SVG 애니메이션을 재생한다. 8개 에이전트 지원: **Claude Code**(command + HTTP hook), **Codex CLI**(JSONL 로그 폴링), **Copilot CLI**(command hook), **Cursor Agent**(stdin/stdout hook), **Gemini CLI**(session JSON 폴링 + command hook), **CodeBuddy**(command + HTTP hook), **Kiro CLI**(command hook), **opencode**(in-process plugin + 역방향 HTTP bridge). Windows, macOS, Linux 지원.

> npm 패키지명: `gitanimals-on-desk` / 빌드 제품명: `GitAnimals on Desk`

## 자주 쓰는 명령어

```bash
npm start              # Electron 앱 실행 (개발 모드)
npm run dev            # 개발 서버 (자동 재시작)
npm run dev:clean      # 캐시 정리 후 개발 서버
npm test               # 단위 테스트 (node --test test/*.test.js, 28개 파일)
npm run build          # Windows NSIS 패키징
npm run build:mac      # macOS DMG (x64 + arm64)
npm run build:linux    # Linux AppImage + deb
npm run build:all      # 전 플랫폼 패키징
node hooks/install.js          # Claude Code hooks → ~/.claude/settings.json
npm run install:cursor-hooks   # Cursor hooks → ~/.cursor/hooks.json
npm run install:gemini-hooks   # Gemini hooks → ~/.gemini/settings.json
npm run install:kiro-hooks     # Kiro hooks → ~/.kiro/agents/gitanimals.json
npm run clean-cache            # 테마 캐시 정리
npm run mock-server            # 테마 목 서버 (localhost:8765)
node scripts/validate-theme.js <dir>  # 테마 유효성 검사
```

수동 상태 테스트:

```bash
curl -X POST http://127.0.0.1:23333/state \
  -H "Content-Type: application/json" \
  -d '{"state":"working","svg":"clawd-working-building.svg"}'
```

Shell 테스트 스크립트 (개발용): `test-demo.sh`, `test-mini.sh`, `test-sleep.sh`, `test-bubble.sh`, `test-macos.sh`

## 아키텍처 & 데이터 흐름

```
공통 Hook 흐름 (Claude Code / Copilot / Cursor / Gemini / CodeBuddy / Kiro):
  Agent 이벤트 → hooks/*-hook.js (제로 의존성, stdin JSON → 상태 매핑)
    → HTTP POST 127.0.0.1:23333/state { state, session_id, event, source_pid, cwd }
    → src/server/server.js → src/core/state.js 상태 머신 (다중 세션 + 우선순위 + 수면 시퀀스)
    → IPC state-change → src/core/renderer.js (SVG 프리로드 + 페이드 전환 + 눈동자 추적)

Codex CLI (JSONL 로그 폴링, ~1.5s 지연):
  ~/.codex/sessions/ → agents/codex-log-monitor.js (증분 읽기 + 중복 제거) → 상태 머신

Gemini CLI (session JSON 폴링, ~1.5s + 4s 완료 지연):
  ~/.gemini/tmp/ → agents/gemini-log-monitor.js (메시지 배열 diff) → 상태 머신

opencode (in-process plugin, ~0ms):
  hooks/opencode-plugin/index.mjs (Bun) → fire-and-forget HTTP POST → 상태 머신

권한 결정 (Claude Code / CodeBuddy / opencode, 블로킹):
  POST /permission → bubble 윈도우 → Allow/Deny/suggestion → HTTP 응답

원격 SSH: SSH 터널 → 127.0.0.1:23333 (GITANIMALS_REMOTE=1)
```

### 이중 윈도우 아키텍처 (입력/렌더 분리)

- **렌더 윈도우(win)**: 투명, `setIgnoreMouseEvents(true)` (click-through), SVG + 눈동자 추적만
- **입력 윈도우(hitWin)**: 소형 직사각형, `focusable: true`, 모든 pointer 이벤트 수신
- Windows `WS_EX_NOACTIVATE` + layered window + Chromium HWND 조합의 드래그 버그 해결 구조

### 멀티 에이전트 (agents/)

8개 에이전트, 각 설정 모듈이 이벤트 매핑·프로세스명·능력을 export:

| 에이전트     | 소스                     | 능력                                     |
| ------------ | ------------------------ | ---------------------------------------- |
| Claude Code  | command + HTTP hook      | 권한 버블, subagent, 터미널 포커스       |
| Codex CLI    | JSONL 로그 폴링          | 알림 버블 (비블로킹)                     |
| Copilot CLI  | command hook             | —                                        |
| Cursor Agent | stdin/stdout hook        | 도구 힌트 표시                           |
| Gemini CLI   | JSON 폴링 + command hook | —                                        |
| CodeBuddy    | command + HTTP hook      | 권한 버블                                |
| Kiro CLI     | command hook             | —                                        |
| opencode     | in-process plugin        | 권한 버블 (역방향 bridge), 터미널 포커스 |

상세: `agents/CLAUDE.md`

## 핵심 파일

| 파일                         | 역할                                                       |
| ---------------------------- | ---------------------------------------------------------- |
| `src/core/main.js`           | Electron 메인 프로세스: 윈도우, IPC, ctx, 앱 생명주기      |
| `src/core/state.js`          | 상태 머신: 다중 세션, 우선순위, 수면 시퀀스, DND           |
| `src/server/server.js`       | HTTP 서버: /state, /permission, 포트 디스커버리, hook 등록 |
| `src/theme/loader.js`        | 테마 로더: theme.json 파싱, SVG 해석 (9개 핫패스 참조)     |
| `src/settings/controller.js` | 설정 패널: 단일 쓰기 패턴 (prefs 변경의 유일 진입점)       |
| `agents/registry.js`         | 에이전트 레지스트리: 8개 에이전트 ID/프로세스명 조회       |
| `hooks/server-config.js`     | 공유: 포트 상수, 런타임 설정, HTTP 헬퍼, 서비스 디스커버리 |

디렉토리별 전체 파일 목록: `src/CLAUDE.md`, `hooks/CLAUDE.md`, `agents/CLAUDE.md`

## 상태 머신 (core/state.js)

- **다중 세션**: `sessions` Map — session_id별 독립 상태, `resolveDisplayState()` 최고 우선순위 선택
- **우선순위**: error(8) > notification(7) > sweeping(6) > attention(5) > carrying/juggling(4) > working(3) > thinking(2) > idle(1) > sleeping(0)
- **최소 표시 시간**: error 5s, attention/notification 4s, carrying 3s, sweeping 2s, working/thinking 1s
- **수면 시퀀스**: 마우스 정지 → idle-look → yawning → dozing → collapsing → sleeping; 이동 → waking → 복원
- **DND**: 모든 hook 이벤트 차단, 즉시 sleeping
- **working 서브**: 1세션→typing, 2→juggling, 3+→building / **juggling 서브**: 1 subagent→juggling, 2+→conducting
- 타이밍·SVG·수면 시퀀스는 **테마(theme.json)** 에서 구동

## 테마 시스템

- `theme-loader.js`: theme.json → SVG 경로·viewBox·hitBox·eyeTracking·타이밍 기본값 병합. 9개 핫패스 참조
- `remote-theme-sync.js`: HTTPS 레지스트리 + 로컬 캐시 (24h TTL)
- `themes/fox/`: 번들 테마 — `theme.json` (스키마 v1) + `assets/` (상태별 SVG)
- 테마 제작: `docs/guide-theme-creation-ko.md` 참조

## 설정 패널

- `settings-controller.js`: 단일 쓰기 패턴 — prefs 변경의 유일한 진입점
- `settings-store.js`: 반응형 인메모리 스토어 (snapshot + subscribe + 변경 dedup)
- `settings-actions.js`: `updateRegistry` (유효성 검사) + `commandRegistry` (사이드이펙트)

## 에이전트 게이트

- `agent-gate.js`: `isAgentEnabled()` / `isAgentPermissionsEnabled()` — 미등록 에이전트 기본 true
- `server.js`가 HTTP 라우팅 시 게이트 체크, 설정 패널에서 on/off 제어

## 핵심 Electron 설정

- `win.setFocusable(false)` — 렌더 윈도우 포커스 금지
- `hitWin.focusable: true` — 입력 윈도우 활성화 (드래그 버그 수정 핵심)
- `win.showInactive()` — 사용자 입력 방해 금지
- `frame: false`, `transparent: true`, `alwaysOnTop: true` — 투명 무테두리 플로팅
- `app.requestSingleInstanceLock()` — 중복 실행 방지
- 위치 저장: `gitanimals-prefs.json` / 다중 디스플레이 클램프: `clampToScreen()`

## 개발 규범

- **PR 베이스 브랜치는 `main`** (origin/HEAD가 `remote-img`로 잡혀 있더라도 PR/머지 타깃은 `main`)
- 민감 정보는 `.env`만, 하드코딩 금지
- Hook 등록 시 기존 배열에 **추가** (덮어쓰기 금지)
- HTTP 포트 `127.0.0.1:23333-23337`, 런타임 포트 `~/.clawd/runtime.json` 기록, 종료 시 정리
- Hook 스크립트: Node 내장 모듈 + `server-config.js`만 의존 (3rd party 금지)
- 새 hook은 `shared-process.js`, `json-utils.js` 재사용
- main.js 시작 시 `registerHooks({ silent: true })` 자동 등록
- PermissionRequest = HTTP hook (블로킹), 나머지 = command hook (비블로킹)
- 극간모드 전환 중(`miniTransitioning`) 모든 윈도우 위치 경로는 플래그 체크 필수
- 테마 배포 전 `node scripts/validate-theme.js <dir>` 실행

## 외부 문서

| 문서                              | 내용                                 |
| --------------------------------- | ------------------------------------ |
| `docs/known-limitations.md`       | 에이전트별 제한사항 전체 목록        |
| `docs/state-mapping.md`           | 상태→애니메이션 매핑 (GIF 포함)      |
| `docs/guide-theme-creation-ko.md` | 테마 제작 가이드 (한국어)            |
| `docs/setup-guide.md`             | 설치 가이드                          |
| `docs/release-and-signing.md`     | 릴리스 & 코드 서명                   |
| `src/CLAUDE.md`                   | Electron 서브시스템 상세             |
| `hooks/CLAUDE.md`                 | Hook 인프라 & opencode 플러그인 상세 |
| `agents/CLAUDE.md`                | 에이전트 설정 모듈 & 모니터링 상세   |

## ⚠️ 건드리지 말 것

### Language 서브메뉴 잘림 버그

우클릭 메뉴 Language 서브메뉴 하단 2-4px 잘림. Electron transparent + alwaysOnTop과 Windows DWM의 저수준 호환 문제. **사용에 지장 없음.** 3시간+ 시도 후 결론: win의 투명 영역이 DWM z-order에서 메뉴 하단을 가리는 것. JS로 해결 불가.

### `win.setAlwaysOnTop(false)` 절대 금지

이 윈도우는 transparent + unfocusable + skipTaskbar. topmost에서 빠지면 바탕화면 아래로 가라앉아 보이지도, 닫을 수도 없게 됨.
