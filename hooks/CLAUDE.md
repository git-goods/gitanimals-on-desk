# hooks/ — Hook 스크립트 & 설치 인프라

루트 `CLAUDE.md`의 핵심 파일 맵과 함께 참조.

## 공유 유틸리티

### server-config.js
- 포트 상수: `DEFAULT_SERVER_PORT = 23333`, `SERVER_PORT_COUNT = 5` (23333-23337)
- `readRuntimeConfig()` / `writeRuntimeConfig()` → `~/.gitanimals/runtime.json`
- `discoverGitAnimalsPort()`: 포트 프로빙으로 실행 중인 서버 탐지
- `postStateToRunningServer()`: 직접 포트 → 후보 포트 순차 시도
- `resolveNodeBin()`: 패키징 빌드용 Node.js 바이너리 경로 탐지 (Homebrew, Volta, nvm, system)
- `readHostPrefix()`: `~/.claude/hooks/gitanimals-host-prefix` — 원격 모드 호스트 설정
- 서버 식별 헤더: `x-gitanimals-server: gitanimals-on-desk`

### shared-process.js
- `getPlatformConfig()`: 플랫폼별 터미널/에디터 프로세스명 + 시스템 경계 정의
- `createPidResolver()`: 팩토리 — ppid에서 프로세스 트리 탐색, 에디터/에이전트 프로세스 감지
  - Windows: WMIC, Unix: ps
  - "외층 터미널 우선" 전략 — Antigravity 등 Electron 터미널 대응
- `readStdinJson()`: 400ms 타임아웃 stdin 읽기, 부분 데이터 처리

### json-utils.js
- `writeJsonAtomic(filePath, data)`: 임시 파일 → rename으로 원자적 쓰기
- `asarUnpackedPath(p)`: `app.asar/` → `app.asar.unpacked/` 치환
- `extractExistingNodeBin()`: 기존 hook 명령에서 Node 바이너리 경로 추출

> **규칙**: 모든 hook 설치 스크립트는 `writeJsonAtomic()`으로 설정 파일 변경. 직접 `fs.writeFileSync()` 금지.

## Hook 스크립트

모든 hook 스크립트는 **제로 의존성** (Node 내장 + `server-config.js` + `shared-process.js`만).

### 공통 패턴
1. stdin에서 JSON 읽기 (session_id, event 등)
2. 에이전트별 이벤트명 → 상태 매핑 (각 에이전트 설정 모듈의 eventMap 참조)
3. `postStateToRunningServer()`로 HTTP POST
4. 비블로킹 — 에이전트 실행 차단 금지

### 에이전트별 차이점

| 스크립트 | 이벤트 형식 | 특이사항 |
|---------|-----------|---------|
| `gitanimals-hook.js` | PascalCase (Claude Code 표준) | 15+ 이벤트, 가장 완전한 매핑 |
| `copilot-hook.js` | camelCase | Claude Code와 동일 아키텍처 |
| `cursor-hook.js` | PascalCase (stdin JSON) | stdout JSON 반환 필수 (allow/continue), display_svg 도구 힌트 |
| `gemini-hook.js` | PascalCase | — |
| `codebuddy-hook.js` | PascalCase (Claude Code 호환) | PreToolUse 게이팅 포함 |
| `kiro-hook.js` | camelCase | 최소 이벤트 세트, session_id 없음 |

## 설치 스크립트

각 설치 스크립트는 **추가 방식(append-only)** — 기존 hook 배열에 추가, 절대 덮어쓰지 않음.

| 스크립트 | 대상 | 등록 위치 |
|---------|------|----------|
| `install.js` | Claude Code (command + HTTP) | `~/.claude/settings.json` |
| `cursor-install.js` | Cursor Agent | `~/.cursor/hooks.json` |
| `gemini-install.js` | Gemini CLI | `~/.gemini/settings.json` |
| `codebuddy-install.js` | CodeBuddy | `~/.codebuddy/settings.json` |
| `kiro-install.js` | Kiro CLI | `~/.kiro/agents/gitanimals.json` |
| `opencode-install.js` | opencode | `~/.config/opencode/opencode.json` (`"plugin"` 배열) |

## opencode Plugin 아키텍처 (opencode-plugin/index.mjs)

opencode는 유일하게 **in-process plugin** 형태로 통합. 다른 에이전트는 모두 hook 스크립트(fork 자식 프로세스). Plugin은 opencode 프로세스 내 Bun 런타임에서 실행, `ctx.client`·`ctx.serverUrl`·`ctx.directory` 등 컨텍스트 접근.

### 핵심 아키텍처 결정

- **프로세스 트리 walk은 `process.pid`부터** (ppid 아님) — plugin IS opencode; 다른 hook은 ppid부터 (spawn된 자식이므로). `getStablePid()`에서 구현, "외층 터미널 우선" 전략 포함

- **세션 생명주기 = 주 세션 + 다수 자식 세션**: opencode의 `task` 도구는 subtask part 대신 새 sessionID로 `session.created` 발생(agent=explore). Clawd 다중 세션 fanout 자연 동작: 1→typing / 2→juggling / 3+→building

- **Root 세션 게이팅**: `_rootSessionId`로 첫 세션 기록. root의 `session.idle`만 `attention/Stop` (happy 애니메이션) 매핑. 자식 세션의 `session.idle`은 `sleeping/SessionEnd`로 강등 → state.js Map에서 제거. 자식 완료마다 happy 깜빡임 방지

- **역방향 HTTP bridge**: opencode TUI는 외부 HTTP 바인딩 없음 (`ctx.serverUrl`은 phantom URL). 해결: plugin 시작 시 `Bun.serve({port: 0})` 랜덤 포트 bridge 생성, `randomBytes(32).toString("hex")` + `timingSafeEqual` 인증. Clawd → bridge POST → `ctx.client._client.post({url: "/permission/:id/reply"})` → opencode 내부 Hono 라우터

- **permission.ask hook은 죽은 hook**: opencode 1.3.13은 v2 `permission.asked` 이벤트명으로 이전했으나 SDK 1.1.51의 `permission.ask` hook 디스패치는 미이전. hook 0회 호출. event hook 경로만 가능

- **event hook은 fire-and-forget 필수**: plugin이 opencode 프로세스 내에서 실행되므로 fetch 블로킹 → TUI 지연. POST는 1000ms AbortController 타임아웃 + try-catch 흡수, await 금지

- **포트 자체 복구**: `_cachedPort`로 독립 유지. `~/.clawd/runtime.json` 실패 시 23333-23337 전 후보 스캔, `x-clawd-server` 헤더로 신원 확인

- **패키징 경로**: `opencode-install.js`가 `app.asar/` → `app.asar.unpacked/` 치환

## 기타

- `auto-start.js`: SessionStart hook — Electron 미실행 감지 시 detached spawn, <500ms 종료
- `codex-remote-monitor.js`: 원격 Codex 독립 데몬, SSH 터널 경유 JSONL 폴링 → HTTP POST
