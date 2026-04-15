# agents/ — 에이전트 설정 & 모니터링

루트 `CLAUDE.md`의 멀티 에이전트 섹션과 함께 참조.

## 에이전트 설정 모듈

각 모듈은 `module.exports`로 다음을 export:
- `id`: 에이전트 식별자 (세션 추적, 아이콘, 게이트에 사용)
- `processNames`: `{ win: [...], mac: [...], linux: [...] }` — 프로세스 생존 검사용
- `eventMap`: 이벤트명 → `{ state, svg }` 매핑
- `capabilities`: 에이전트 능력 선언

### 에이전트별 상세

| 모듈 | ID | 이벤트 형식 | 이벤트 수 | 주요 능력 |
|------|-----|-----------|----------|----------|
| `claude-code.js` | claude-code | PascalCase | 15+ | httpHook, permissionApproval, subagent, terminalFocus |
| `codex.js` | codex | logEventMap (JSONL 전용) | 10 | 알림 버블 (비블로킹) |
| `copilot-cli.js` | copilot-cli | camelCase | 7 | — |
| `cursor-agent.js` | cursor-agent | PascalCase | 10 | display_svg 도구 힌트 |
| `gemini-cli.js` | gemini-cli | PascalCase | 8 | — |
| `codebuddy.js` | codebuddy | PascalCase (CC 호환) | 8 | httpHook, permissionApproval |
| `kiro-cli.js` | kiro-cli | camelCase | 5 | — |
| `opencode.js` | opencode | PascalCase (plugin 이벤트) | 8 | plugin, permissionApproval (역방향 bridge), terminalFocus |

### 이벤트 매핑 패턴

Hook 기반 에이전트 (Claude Code, Copilot, Cursor, Gemini, CodeBuddy, Kiro):
- hook 스크립트가 stdin JSON에서 이벤트명 추출
- 에이전트 설정 모듈의 `eventMap[eventName]` 조회 → `{ state, svg }` 반환
- HTTP POST `/state`로 전송

로그 폴링 에이전트 (Codex, Gemini):
- 모니터가 로그 파일 변경 감지
- `logEventMap[logEventType]` 조회 → 동일한 `{ state, svg }` 형식
- HTTP POST `/state`로 전송

Plugin 에이전트 (opencode):
- plugin이 opencode 이벤트 수신
- `translateEvent()` → PascalCase Clawd 이벤트명 변환
- 에이전트 설정의 eventMap 조회 → HTTP POST

## 레지스트리 (registry.js)

- `AGENTS` 배열: 8개 에이전트 설정 모듈 로드
- `AGENT_MAP`: ID → 설정 모듈 조회
- `getAllAgents()`: 전체 에이전트 목록
- `getAgent(id)`: ID로 조회
- `getAllProcessNames()`: 플랫폼별 전체 에이전트 프로세스명 집계 — `detectRunningAgentProcesses()` 사용

## Codex 로그 모니터 (codex-log-monitor.js)

- **JSONL 증분 폴링**: `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`
- ~1.5s 폴링 간격, 파일 감시(fs.watch) + 증분 읽기
- 오프셋 추적으로 이미 처리한 이벤트 건너뜀
- 이벤트 중복 제거: 동일 이벤트 반복 전송 방지
- `codex.js`의 `logEventMap` 참조하여 JSONL 이벤트 타입 → 상태 매핑
- Codex 권한 요청 (`exec_approval_request` / `apply_patch_approval_request`) 감지 → 알림 버블 (Dismiss 전용, 30초 만료)

## Gemini 로그 모니터 (gemini-log-monitor.js)

- **Session JSON 폴링**: `~/.gemini/tmp/<project>/chats/session-*.json`
- ~1.5s 폴링 간격 + **4초 완료 지연 윈도우** — 도구 완료 신호 배칭
- 메시지 배열 diff: 이전 스냅샷과 비교하여 새 메시지/도구 호출 감지
- `gemini-cli.js`의 eventMap 참조
- Gemini는 진행 중 도구 실행을 기록하지 않음 → thinking→happy/error 직행 (working 상태 없음)
