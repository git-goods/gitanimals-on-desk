# src/ — Electron 메인 프로세스 서브시스템

루트 `CLAUDE.md`의 핵심 파일 맵과 함께 참조.

## 권한 버블 (permission.js + server.js → bubble.html)

- **HTTP hook**: PermissionRequest는 `type: "http"` hook (블로킹, 600s 타임아웃)
- **`POST /permission`**: `{ tool_name, tool_input, session_id, permission_suggestions }` 수신
- **버블 윈도우**: 요청마다 독립 `BrowserWindow` (투명, 무테두리, alwaysOnTop), `bubble.html` 로드
- **스택 레이아웃**: 화면 우하단에서 위로 쌓임, `repositionBubbles()` 관리
- **동적 높이**: bubble이 IPC `bubble-height`로 실제 높이 보고 → 주 프로세스가 정확히 스택
- **결정 옵션**: Allow, Deny, suggestion 버튼 (`addRules` / `setMode` 두 유형)
- **전역 단축키**: `Ctrl+Shift+Y`(Allow) / `Ctrl+Shift+N`(Deny) — 최신 버블 조작, 버블 표시 시에만 등록
- **클라이언트 단절**: `res.on("close")`로 타임아웃/터미널 응답 감지 → 버블 자동 정리
- **DND**: 자동 deny, 버블 미표시
- **Codex 알림 버블**: JSONL 로그에서 `exec_approval_request` / `apply_patch_approval_request` 감지 → Dismiss 전용 버블 (30초 만료)

## 업데이트 버블 (update-bubble.js)

- 권한 버블과 별도의 `BrowserWindow` — 동적 높이 계산
- `bubbleFollowPet` 옵션: 화면 모서리 대신 펫 위치 추종
- `computeUpdateBubbleBounds()`: 펫 상대 위치 계산
- 액션 버튼 지원 (업데이트 설치, 무시 등)

## 설정 패널 (settings-controller/store/actions/renderer)

- **settings-controller.js**: 단일 쓰기 패턴 — prefs 변경의 유일한 진입점
  - `applyUpdate(key, value)`: 단일 설정 변경 (검증 + 효과)
  - `applyBulk(updates)`: 배치 변경
  - `applyCommand(name, args)`: 사이드이펙트 명령 (removeTheme, installHooks 등)
  - `hydrate()`: 외부 상태 임포트 (OS 로그인 항목 등), 효과 미트리거
- **settings-store.js**: 반응형 인메모리 스토어
  - `snapshot`: 현재 상태 스냅샷
  - `subscribe(fn)`: 변경 구독 (dedup으로 불필요한 호출 방지)
- **settings-actions.js**: 두 레지스트리
  - `updateRegistry`: 키별 유효성 검사 + 선택적 효과 함수
  - `commandRegistry`: 비동기 명령 (테마 제거, hook 설치 등)
- **settings-renderer.js + settings.html**: React-like UI — i18n 문자열 공유
- **preload-settings.js**: contextBridge (설정 IPC)

### prefs 스키마 주요 필드

- `agents: { [agentId]: { enabled, permissionsEnabled } }` — 에이전트별 토글
- `bubbleFollowPet: boolean` — 업데이트 버블 펫 추종
- `size: "S"|"M"|"L"|"P:N"` — 레거시 S/M/L → 비례값 마이그레이션
- `showSessionId: boolean` — 세션 ID 표시
- `openAtLoginHydrated: boolean` — OS 로그인 항목 동기화 상태

## 테마 로더 (theme-loader.js)

- `loadTheme(themeDir)`: theme.json 파싱 → SVG 경로 해석 → 기본값 병합
- 핫 테마 전환: state.js가 `refreshThemeState(theme)`로 SVG 맵/타이밍/수면 시퀀스 갱신
- theme.json 스키마 v1: `states`, `timings`, `hitBoxes`, `eyeTracking`, `viewBox`, `layout`
- 9개 핫패스에서 참조 — 변경 시 영향 범위 주의

## 에이전트 게이트 (settings/agent-gate.js)

- 순수 게이트 함수: `isAgentEnabled(snapshot, agentId)` / `isAgentPermissionsEnabled(snapshot, agentId)`
- 미등록 에이전트 기본 true (하위 호환)
- `server.js`의 `shouldBypassCCBubble()` / `shouldBypassOpencodeBubble()`에서 사용

## 극간모드 (mini.js)

캐릭터가 화면 오른쪽 가장자리에 숨고, 윈도우 절반이 화면 밖으로 밀려나 자연스럽게 가려짐.

**진입 방식**:
- 드래그 → 오른쪽 가장자리 (SNAP_TOLERANCE=30px) → 슬라이드 + mini-enter 애니메이션
- 우클릭 "Mini Mode" → 게걸음 → 포물선 점프 → 진입

**핵심 메커니즘**:
- `miniMode` 최상위 플래그, `applyState()` 가로챔: notification→mini-alert, attention→mini-happy
- `miniTransitioning` 전환 보호 — 게걸음/진입 중 hook 이벤트 + peek 차단
- `checkMiniModeSnap()`: 모든 디스플레이 오른쪽 가장자리 + 중심 XY 범위
- Peek hover: `mouseOverPet` + `currentState === "mini-peek"` 으로 슬라이드 아웃/백
- `miniIdleNow`: 눈동자 추적만, idle-look/sleep 시퀀스 건너뜀
- 윈도우 애니메이션: `animateWindowX()` (슬라이드) + `animateWindowParabola()` (포물선, `setPosition()` DPI 드리프트 방지)

**Mini 상태 → SVG**:
| 상태 | 용도 |
|------|------|
| mini-idle | 대기: 호흡+눈깜빡+팔 흔들기+눈동자 추적 |
| mini-enter | 진입: 슬라이드 바운스→팔 펼치기→정지 |
| mini-peek | Hover 탐색: 손흔들기 3회 |
| mini-alert | 알림: 느낌표 + >< 찡그림 |
| mini-happy | 완료: 꽃+별 + ^^ 눈 |
| mini-crabwalk | 우클릭 진입 시 게걸음 |
| mini-enter-sleep | DND 상태 진입 애니메이션 |
| mini-sleep | DND 수면: Zzz + hover 시 탐색 (미각성) |

## 터미널 포커스 (focus.js)

- hook 스크립트가 `getStablePid()` → 프로세스 트리 탐색으로 터미널 PID 찾기
- `source_pid`가 상태 업데이트와 함께 전송 → session 기록 저장
- 우클릭 Sessions 서브메뉴 → `focusTerminalWindow()`: PowerShell(Win) / osascript(Mac)
- 알림 상태(attention/notification) 시 해당 세션 터미널 자동 포커스

## 눈동자 추적 (animation/tick.js → renderer.js)

- animation/tick.js: 50ms(~20fps) 커서 위치 폴링 → 눈동자 오프셋 계산 (MAX_OFFSET=3px, 0.5px 양자화)
- IPC `eye-move` `{dx, dy}` → renderer SVG DOM: `#eyes-js` translate + `#body-js` 미세 오프셋 + `#shadow-js` 스트레칭
- dedup: 마우스 미이동 시 전송 건너뜀. idle-look → idle-follow 복귀 시 `forceEyeResend` 필요

## 클릭 반응 (hit/renderer.js → main relay → renderer.js)

- 더블클릭 → 찌르기 반응 (좌/우, 2.5s)
- 4연타 → 양손 박수 (3.5s)
- 드래그 → 드래그 반응 (놓을 때까지)
- DRAG_THRESHOLD=3px 초과 시 드래그, 이하는 클릭
- 반응 중 눈동자 추적 detach, 종료 후 reattach

## 효과음 (main.js → IPC → renderer.js)

- `autoplay-policy: "no-user-gesture-required"` — Chromium autoplay 제한 해제
- `playSound(name)`: soundMuted·DND·10초 쿨다운 검사 → IPC `play-sound`
- renderer.js `_audioCache`로 Audio 객체 캐시
- attention/mini-happy → complete.mp3, notification/mini-alert → confirm.mp3
- 메뉴 "음효" 체크박스 → `gitanimals-prefs.json` 저장

## i18n (settings/i18n.js)

- en / zh 지원, 우클릭/트레이 Language에서 전환
- 언어 설정 `gitanimals-prefs.json` 저장
- 권한 버블 버튼 문구도 언어 설정 반영

## 자동 업데이트 (updater.js)

- **Git 모드** (비패키징): `git fetch` → HEAD 비교 → `git pull` + `npm install` → `app.relaunch()`
- **electron-updater** (패키징, Windows): NSIS 업데이트, `autoInstallOnAppQuit = true`
- 트레이 "Check for Updates"로 수동 트리거

## 에셋 규칙

- 테마 SVG는 `themes/<name>/assets/`에 위치 (테마 시스템 도입 후 `assets/svg/` 대신)
- 레퍼런스 에셋: `reference/clawd/`, `reference/calico/`, `reference/template/`
- SVG는 `<object type="image/svg+xml">`로 렌더 — 내부 DOM 접근(눈동자 추적)에 필수
- SVG 내부 약속 ID: `#eyes-js`(눈동자), `#body-js`(몸체), `#shadow-js`(그림자)
