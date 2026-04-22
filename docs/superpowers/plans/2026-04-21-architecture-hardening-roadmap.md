# Architecture Hardening Roadmap

**작성일**: 2026-04-21
**브랜치**: `codex-step1-baseline-audit`
**목표**: 기능/성능 퇴보 없이 Clawd on Desk의 타입 안정성, 코드 안전성, 유지보수성, 확장성을 단계적으로 강화한다.

## 원칙

- 사용자 동작, 에이전트 감지 동작, 상태 전이, 권한 버블 동작은 유지한다.
- 한 번에 큰 전환을 하지 않는다.
- 각 단계는 독립 브랜치/커밋/PR 단위로 끊는다.
- React는 전면 도입하지 않고 renderer 일부에만 제한적으로 적용한다.
- TypeScript는 점진 도입한다. 초반에는 `allowJs` + `checkJs`로 시작한다.

## 현재 구조 기준선

### 강점

- `src/settings/prefs.js`는 스키마/마이그레이션/정규화 경계가 명확하다.
- `src/settings/controller.js`는 설정 단일 쓰기 경계를 제공한다.
- `src/core/state.js`는 다중 세션/우선순위/수면 시퀀스를 한곳에서 관리한다.
- `src/theme/loader.js`는 테마 검증과 기본값 병합을 담당한다.
- `agents/*.js` + `agents/registry.js`는 신규 에이전트 추가 지점을 비교적 명확하게 제공한다.

### 현재 리스크

- `src/core/main.js`가 composition root를 넘어 초기화, 서비스 조합, 런타임 상태 flush, OS 연동까지 과도하게 담당한다.
- `ctx` 기반 모듈 협력이 강하지만 계약이 암묵적이라 타입 누락/필드 오타를 정적으로 잡기 어렵다.
- settings/theme/agent/payload/session 구조가 런타임 관습에 많이 의존한다.
- renderer 복잡도보다 main process 및 integration 복잡도가 높아, React 전면 전환의 ROI가 낮다.
- 통합 테스트 일부가 포트 바인딩, 홈 디렉토리 쓰기, localhost listen 같은 환경 의존성 때문에 흔들린다.

## 테스트 기준선

2026-04-21 로컬 실행 기준:

- 명령: `node --test test/`
- 결과: `343` tests / `62` suites / `331` pass / `12` fail

실패 분류:

1. `test/auth-callback-server.test.js`
- 원인: auth callback 테스트용 포트 범위에서 free port를 찾지 못함
- 메시지: `no free auth callback port in range`

2. `test/cursor-install.test.js`
- 원인: `~/.cursor` 하위에 atomic temp 파일을 쓰는 과정에서 권한 오류
- 메시지: `EPERM: operation not permitted`

3. `test/theme/remote-sync.test.js`
- 원인: localhost bind 권한/환경 문제
- 메시지: `listen EPERM: operation not permitted 127.0.0.1`

해석:

- 순수 로직보다는 환경 의존 통합 테스트가 현재 실패 요인이다.
- 향후 단계에서 fs/path/network/port allocator를 주입 가능하게 만들어야 한다.

## React 도입 방향

- 전면 전환은 하지 않는다.
- 우선순위는 `TypeScript 계약화 -> main 분리 -> state 순수화 -> 테스트 안정화`다.
- React는 `settings` renderer부터 제한적으로 도입한다.
- `hooks`, `agents`, `server`, `main process`는 React 전환 대상이 아니다.

## 순차 작업 TODO

1. 기준선 문서화 및 실패 테스트 분류
2. TypeScript 최소 설정 추가 (`tsconfig.json`, `allowJs`, `checkJs`)
3. 공통 타입 계약 정의
4. settings 계층 타입화
5. theme 계층 타입화
6. agents 계약 통합 및 타입화
7. `src/core/main.js` 분해 설계 및 1차 분리
8. `src/core/state.js` 순수 계산 로직 1차 분리
9. 환경 의존 테스트 안정화
10. `settings` renderer React 도입 준비
11. `settings` renderer React 전환
12. 필요 시 preview/dashboard 계층 확장 검토

## 단계별 완료 조건

### Step 1

- 기준선 문서 추가
- 현재 실패 테스트와 원인 분류 완료
- 이후 단계의 TODO 고정

### Step 2

- `tsconfig.json` 추가
- 초기 안전 구간(`agents`, 일부 `hooks` 유틸, `settings` 순수 데이터 계층)에 타입체크 진입점 생성
- 빌드/런타임 동작 변화 없음

### Step 3

- 최소 공통 타입 계약 추가
- `src/types/contracts.d.ts` 기준의 공통 도메인 계약 도입
- settings/theme/agent/server/state 사이 암묵 계약 일부를 명시 계약으로 전환

### Step 4-6

- settings/theme/agents 계층에 타입 계약 연결
- 런타임 동작 변화 없이 구조 안전성 향상
- 우선순위는 `settings` data/controller 레이어 -> theme loader -> agent registry 순서

### Step 7-8

- `main.js` 책임 축소
- `state.js`에서 순수 계산을 테스트 가능한 함수로 분리

### Step 9

- 현재 flaky/integration test를 환경 독립적으로 재구성

### Step 10-11

- `settings` UI만 React로 제한 도입
- 기존 preload/IPC 경계 유지 또는 최소 변경
- 기능/성능 회귀 없음

## PR 운영 규칙

- 각 단계는 새 브랜치에서 진행한다.
- PR base는 `main`을 기본으로 한다.
- 이미 존재하는 사용자 변경사항은 절대 되돌리지 않는다.
- 단계가 끝날 때마다 테스트 가능한 범위에서 검증 후 커밋한다.
- PR을 열 수 없는 환경이면 브랜치/커밋까지 완료하고 사용자에게 즉시 보고한다.
