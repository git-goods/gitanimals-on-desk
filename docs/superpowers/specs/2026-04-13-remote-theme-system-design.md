# Remote Theme System — Design Spec

**Date**: 2026-04-13
**Status**: Approved — ready for implementation plan
**Approach**: C — Extend existing `{userData}/theme-cache/` infrastructure

## Context

Clawd 데스크탑 펫의 테마 시스템을 server-driven으로 전환한다. 기존 빌트인 `clawd`/`fox` 테마는 그대로 유지하고, 추가 테마(첫 PoC: `dessert-fox` — fox의 사본)는 외부 HTTPS 서버에서 동적으로 가져온다.

**비전**:
- 로컬 앱 = "어떤 테마를 보여줄지 선택 + 받아온 에셋으로 렌더링"
- 외부 서버 = "어떤 테마가 있는지(목록), 각 테마가 어떻게 동작하는지(theme.json), 어떤 그림인지(SVG) 모두 책임"

**범위 (Phase 1+2)**:
- 원격 테마 목록 (registry) fetch + 캐시
- 각 테마의 `theme.json` + SVG 에셋 fetch + 캐시
- 24h TTL, 오프라인 시 캐시 유지
- 메뉴에 빌트인 + cached-remote 테마 모두 노출
- 환경변수로 서버 URL 오버라이드, 기본값은 코드 상수

**범위 외 (Phase 3+)**:
- 메뉴 로딩 인디케이터, 에러 토스트
- 사용자 정의 서버 URL UI
- 테마 미리보기 썸네일

## 원칙 — 기존 인프라 재사용

`src/theme-loader.js`에 이미 다음이 완성돼 있다:
- `themeCacheDir` = `{userData}/theme-cache/` (line 80)
- `_resolveExternalAssetsDir` (line 218-285) — 소스 dir → sanitize → cache → `pathToFileURL`
- `sanitizeSvg` (line 287+) — SVG 위생 처리
- `_assetsFileUrl` 컨벤션 (line 167) — `pathToFileURL(cacheDir).href`
- `discoverThemes` (line 102+) — builtin + user 머지
- `loadTheme` 분기 (line 143+) — builtin / external 분기
- `getRendererAssetsPath` (line 415+) — renderer URL prefix

**확장 원칙**:
- 새 디렉토리 생성 ❌ → `theme-cache/` 그대로 사용
- 새 cache meta 스키마 ❌ → 기존 `.cache-meta.json`에 `fetchedAt` 필드만 추가
- 새 SVG 처리 ❌ → `sanitizeSvg` 그대로
- 새 URL 변환 ❌ → `pathToFileURL` 그대로
- 새 분기 ✅ → discover/load에 cached-remote 케이스만 추가

## 디렉토리 레이아웃

```
themes/                            ← 빌트인 (변경 없음)
  ├─ clawd/{theme.json + assets/}
  └─ fox/{theme.json + assets/}    ← 디폴트

{userData}/themes/                 ← 사용자 직접 설치 (변경 없음)
  └─ <user-theme>/...

{userData}/theme-cache/            ← 확장
  ├─ .registry.json                ← 원격 테마 목록 + fetchedAt
  ├─ dessert-fox/                  ← 원격 테마 1
  │   ├─ theme.json                ← 서버 fetch
  │   ├─ .cache-meta.json          ← 기존 + fetchedAt
  │   └─ assets/                   ← sanitize된 SVG
  │       ├─ typing.svg
  │       └─ ...
  └─ another-theme/...
```

## 서버 계약

```
GET https://<base>/themes/index.json
  → [
      { "id": "dessert-fox", "name": "Dessert Fox", "version": "1.0.0" },
      ...
    ]

GET https://<base>/themes/<id>/theme.json
  → 전체 theme config (states, viewBox, hitBoxes, eyeTracking 등)

GET https://<base>/themes/<id>/<filename>.svg
  → raw SVG 바이트

(`<base>`: `process.env.CLAWD_THEME_REGISTRY_URL`이 있으면 해당 값 사용, 없으면 `src/remote-theme-sync.js` 상단 const)
```

- HTTPS, 공개 읽기, 인증 없음
- 응답 헤더는 무시 (자체 TTL 사용)
- `index.json`의 `id`는 `[a-z0-9-]+` 컨벤션 강제 (path traversal 차단)

## 컴포넌트

### 1. `src/remote-theme-sync.js` (신규)

```js
// Public API
function getRemoteRegistryUrl()           // env || const default
function loadCachedRegistry()              // sync, returns array or []
function syncAll(opts)                     // async, fire-and-forget OK
function onSyncComplete(callback)          // callback after each successful theme sync

// Internal
function _httpsGetBuffer(url, timeoutMs)   // promise-based, 1 redirect, 10s timeout
function _syncRegistry()                   // fetch index.json → write .registry.json
function _syncTheme(themeId, baseUrl)      // fetch theme.json + all SVGs → cache
function _isStale(fetchedAt, ttlMs)        // TTL check
```

상수:
- `REMOTE_TTL_MS = 24 * 60 * 60 * 1000`
- `DEFAULT_REGISTRY_BASE_URL = "https://<TBD>"` (배포 직전 확정)
- `THEME_ID_RE = /^[a-z0-9][a-z0-9-]*$/` (검증)

`syncTheme` 동작:
1. theme.json fetch → JSON parse + 기본 검증 (states, viewBox 존재)
2. cache에 저장 (`{cache}/<id>/theme.json`)
3. theme의 모든 SVG 파일 목록 추출 (`states`, `reactions`, `workingTiers`, `jugglingTiers`, `miniMode.states`)
4. 각 SVG fetch → `sanitizeSvg` → cache 저장
5. 모두 성공 시 `.cache-meta.json`에 `{fetchedAt: now, files: {<name>: {size}}}` 기록
6. 일부 실패 → 캐시 파일 유지, `fetchedAt` 미갱신 (다음 시작에 재시도)

### 2. `src/theme-loader.js` (확장)

**`discoverThemes()` 수정**:
- 기존: builtin + user 머지
- 추가: `theme-cache/` 스캔하여 `theme.json` 존재하는 폴더를 source="remote"로 추가
- 충돌 시 우선순위: builtin > user > remote (id 동일하면 빌트인이 이김)

**`loadTheme(id)` 수정**:
- 기존 분기 (builtin / user) 앞 또는 뒤에 cached-remote 분기 추가
- cached-remote: `theme-cache/<id>/theme.json` 읽기 → `_assetsDir = theme-cache/<id>/assets/` → `_assetsFileUrl = pathToFileURL(...)` 
- 캐시 손상/누락 시 fox로 폴백 + warn

**helper 신규**: `_readCachedRemoteTheme(id)` — 캐시에서 theme.json 읽고 검증, 실패 시 null

### 3. `src/main.js` (최소 변경)

- `app.whenReady().then(...)` 안, 윈도우 생성 직후:
  ```js
  const remoteThemeSync = require("./remote-theme-sync");
  remoteThemeSync.onSyncComplete(() => {
    // 기존 메뉴 재빌드 hook 재사용
    if (typeof buildContextMenu === "function") buildContextMenu();
    if (typeof buildTrayMenu === "function") buildTrayMenu();
  });
  remoteThemeSync.syncAll();  // fire-and-forget
  ```

추가 변경 없음. CSP, IPC, 윈도우 옵션 모두 그대로.

### 4. 환경변수

- `CLAWD_THEME_REGISTRY_URL` — 서버 base URL 오버라이드 (예: `http://localhost:8000`)
- 미설정 시 `DEFAULT_REGISTRY_BASE_URL` 사용
- 개발/테스트 시 `CLAWD_THEME_REGISTRY_URL=http://localhost:8000 npm start`로 mock 서버 가리킴

## 데이터 흐름

### 부팅 시퀀스

```
1. main.js 모듈 로드:
   themeLoader.loadTheme(prefs.theme || "fox")
     → builtin 분기 (fox)
     → activeTheme 세팅, 동기 반환
     → 윈도우 즉시 렌더 가능

2. app.whenReady → 윈도우 생성:
   themeLoader.getRendererConfig() → renderer에 주입
   펫 정상 표시 (fox)

3. 윈도우 생성 후 (백그라운드):
   remoteThemeSync.syncAll()
     ├─ syncRegistry()
     │    ├─ TTL ok? skip
     │    └─ stale? fetch /themes/index.json → .registry.json 저장
     ├─ for each theme in registry:
     │    syncTheme(id)
     │      ├─ TTL ok? skip
     │      └─ stale? theme.json + SVGs fetch → sanitize → cache
     └─ onSyncComplete → buildContextMenu(): 메뉴 갱신
```

### 사용자 테마 변경

```
사용자: 메뉴에서 "Dessert Fox" 클릭
  → 기존 theme switch 핸들러:
    themeLoader.loadTheme("dessert-fox")
      → cached-remote 분기
      → theme-cache/dessert-fox/theme.json 읽음 → activeTheme
      → _assetsFileUrl = pathToFileURL(theme-cache/dessert-fox/assets/)
    → 기존 IPC: sendToRenderer("theme-config", getRendererConfig())
    → renderer가 새 _assetsPath로 SVG 다시 로드
```

## 에러 및 엣지 케이스

| 상황 | 동작 |
|---|---|
| 첫 실행 + 서버 불능 | 메뉴에 fox만. 백그라운드 sync 실패. 다음 시작에 재시도. |
| 첫 실행 + 서버 OK | 부팅엔 fox. 백그라운드 sync 후 메뉴 재빌드로 dessert-fox 등장. |
| TTL 이내 재실행 | 네트워크 요청 0건. 캐시에서 모든 것. |
| TTL 만료 + 오프라인 | 캐시 그대로 사용. fetchedAt 미갱신. |
| TTL 만료 + 일부 SVG 실패 | 해당 SVG만 캐시 유지, theme.json은 갱신 가능 시 갱신. |
| theme.json 손상 | parse 실패 → warn → 해당 테마 메뉴에서 숨김 → 다음 sync 시 복구 시도. |
| 사용자가 cached-remote 선택 직후 cache 삭제됨 | loadTheme이 fox로 폴백 + warn (`if (themeId !== "fox") return loadTheme("fox")` 패턴). |
| 악성 SVG (script 태그 등) | `sanitizeSvg`가 차단. |
| `id` path traversal (`../`) | `THEME_ID_RE` 검증으로 차단. |
| 서버가 manifest 외 SVG도 보냄 | 우리는 theme.json에서 추출한 파일명만 fetch. 그 외 무시. |
| registry에 빌트인과 동일 id | 빌트인 우선. 원격 theme.json은 cache에 있어도 discover에서 무시. |

## 보안

- HTTPS 강제 (개발 시 env로 http 허용 — 명시적 opt-in)
- `sanitizeSvg` 모든 원격 SVG에 적용 (기존 함수 그대로)
- `THEME_ID_RE`로 디렉토리 이름 검증 (path traversal)
- timeout 10s, 응답 크기 상한 (예: 5MB) — 무한 대기/메모리 폭주 차단
- redirect 최대 1회 (open redirect 악용 방지)

## 테스트 전략

### Unit (`test/remote-theme-sync.test.js` 신규)

- registry fetch 성공/실패 분기
- TTL 만료 시 재요청, 이내면 skip
- theme sync: theme.json + SVG fetch 시퀀스 (https mock)
- 일부 SVG 실패 시 캐시 유지 + fetchedAt 미갱신
- `THEME_ID_RE` 위반 id 거부
- timeout/redirect 상한 검증

### Unit (`test/theme-loader.test.js` 확장)

- `discoverThemes`가 cached-remote 머지하는지 (fixture: `theme-cache/foo/theme.json` 만들어두고 검증)
- builtin/user/remote id 충돌 시 우선순위
- `loadTheme(remote-id)`가 cache의 theme.json 사용하는지
- 캐시 손상 시 fox 폴백

### 수동 (E2E)

```bash
# 1. mock 서버 띄우기 (themes/fox 그대로 dessert-fox로 서빙)
mkdir -p /tmp/clawd-mock/themes/dessert-fox
cp themes/fox/theme.json /tmp/clawd-mock/themes/dessert-fox/
cp -r themes/fox/assets/* /tmp/clawd-mock/themes/dessert-fox/
echo '[{"id":"dessert-fox","name":"Dessert Fox","version":"1.0.0"}]' \
  > /tmp/clawd-mock/themes/index.json
cd /tmp/clawd-mock && python3 -m http.server 8000 &

# 2. 앱 실행
CLAWD_THEME_REGISTRY_URL=http://localhost:8000 npm start

# 3. 검증
#  - 첫 실행: 펫 fox로 렌더, 5초 뒤 메뉴에 dessert-fox 등장
#  - dessert-fox 선택 → 정상 렌더
#  - {userData}/theme-cache/dessert-fox/{theme.json + assets/*.svg + .cache-meta.json} 확인
#  - 앱 종료 후 mock 서버 죽이고 재시작 → 메뉴에 dessert-fox 그대로, 선택 가능
#  - .cache-meta.json의 fetchedAt 25시간 전으로 수정 → 재시작 → 백그라운드 재요청 (mock 서버 안 떴으므로 캐시 유지)
```

## 구현 순서

1. `src/remote-theme-sync.js` 신규: `_httpsGetBuffer`, `getRemoteRegistryUrl`, `_isStale`
2. `_syncRegistry` + 캐시 저장 (`.registry.json`)
3. `_syncTheme` + theme.json/SVG fetch + sanitize
4. `syncAll` + `onSyncComplete` 콜백
5. `theme-loader.js`: `_readCachedRemoteTheme`, `discoverThemes` 머지, `loadTheme` cached-remote 분기
6. `main.js`: `syncAll()` 호출 + 콜백 등록
7. 환경변수 처리 + 디폴트 const
8. 단위 테스트
9. mock 서버로 E2E 수동 검증
10. `DEFAULT_REGISTRY_BASE_URL`을 실제 운영 URL로 확정 (배포 전)

## 변경 파일 요약

| 파일 | 변경 종류 | 추정 LOC |
|---|---|---|
| `src/remote-theme-sync.js` | 신규 | ~200 |
| `src/theme-loader.js` | 확장 (3-4 함수 수정 + 1 helper 추가) | ~50 |
| `src/main.js` | 추가 (5줄) | ~5 |
| `test/remote-theme-sync.test.js` | 신규 | ~200 |
| `test/theme-loader.test.js` | 확장 | ~80 |

## 트레이드오프 수용

- **메뉴에 새 테마가 부팅 직후엔 안 보임 (백그라운드 sync 완료 후 등장)**: 첫 실행 이후엔 캐시로 즉시 노출되므로 acceptable.
- **개별 테마 실패 시 메뉴에서 사라짐**: 부분 실패 처리는 PoC 범위 외. 전체 실패 시 fox만 보임.
- **사용자 정의 서버 URL UI 없음**: 환경변수로 충분 (PoC).
- **테마 메타정보(썸네일/설명) 없음**: registry에 id+name+version만. 추후 확장 가능.

## 후속 작업 (Phase 3+)

- 메뉴 로딩 인디케이터
- 에러 발생 시 tray 알림
- 사용자 설정 UI (서버 URL, 자동 sync on/off)
- 테마 썸네일 (registry에 thumbnailUrl 추가)
- 버전 비교 (캐시된 version vs 서버 version) → 강제 갱신
- 테마 삭제 (캐시 정리) UI
