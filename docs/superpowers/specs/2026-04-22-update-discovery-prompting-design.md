# Update Discovery & Prompting — Design Spec

**유저 관점 요약:** 앱이 백그라운드에서 새 버전을 자동으로 확인하고, 업데이트가 있으면 버블로 알려준다. "Later"를 누르면 24시간 뒤에 다시 알려주고, DND/미니 모드 중이면 해제 후 알려준다. Settings에서 자동 확인을 끌 수 있다.

## 결정 사항

| 항목 | 결정 |
|------|------|
| 내부 상태 저장 | `gitanimals-prefs.json` SCHEMA 확장 (UI 미노출) |
| user-facing 설정 | `autoCheckForUpdates` 1개만 |
| 버블 억제 조건 | DND, mini mode만 (`hideBubbles`는 업데이트 버블 억제 안 함) |
| auto-check 대상 | 패키징 빌드만 (`app.isPackaged`) |
| 스누즈 만료 감지 | 12시간 주기 체크가 겸함 (별도 타이머 없음) |
| 구현 접근법 | updater.js 클로저 내부 확장 (모듈 분리 없음) |

## 1. prefs 스키마 확장

`prefs.ts` SCHEMA에 4개 필드 추가:

| 필드 | 타입 | 기본값 | UI 노출 |
|------|------|--------|---------|
| `autoCheckForUpdates` | boolean | `true` | Settings > General 토글 |
| `lastUpdateCheckAt` | number | `0` | 없음 |
| `updateSnoozeUntil` | number | `0` | 없음 |
| `pendingUpdateVersion` | string | `""` | 없음 |

- `actions.ts`의 `updateRegistry`에 `autoCheckForUpdates: requireBoolean(...)` 추가.
- 나머지 3개는 `requireFiniteNumber` / `requireString` 검증만.
- `migrate()`: 기존 파일에 필드 없으면 default로 로드 (별도 마이그레이션 불필요).

## 2. updater.js 내부 확장

기존 `initUpdater(ctx)` 클로저 안에 추가. 외부에 3개 함수 노출.

### 2.1 스케줄러

```
startScheduler():
  if (!app.isPackaged) return
  setTimeout(30s) → firstCheck()
  setInterval(12h) → periodicCheck()

firstCheck() / periodicCheck():
  if (!ctx.autoCheckForUpdates) return    // 설정 꺼져 있으면 스킵
  if (updateStatus === "checking" || "downloading") return
  checkForUpdates(false)                  // manual=false

stopScheduler():
  clearTimeout / clearInterval
```

### 2.2 디퍼 (DND/mini 중 발견된 업데이트)

기존 동작 변경:

| 조건 | 기존 | 변경 후 |
|------|------|---------|
| 새 버전 발견 + `isSilentMode()` | `updateStatus = "idle"`, 버림 | `pendingUpdateVersion` + `lastUpdateCheckAt` 저장, `updateStatus = "available"`, 메뉴 라벨 반영 |

`reevaluateDeferred()`:
- `pendingUpdateVersion`이 있고 + `!isSilentMode()` + 스누즈 만료(`Date.now() >= updateSnoozeUntil`) → `promptAvailableUpdate()` 실행.
- DND 해제, mini 해제 시 main.js에서 호출.

### 2.3 스누즈

`promptAvailableUpdate()`에서 Later 선택 시:

| 기존 | 변경 후 |
|------|---------|
| `updateStatus = "idle"` | `updateSnoozeUntil = Date.now() + 24h` |
| `pendingUpdateVersion` 없음 | `pendingUpdateVersion` 유지, `updateStatus = "available"` |

다음 주기 체크에서:
- 같은 버전 + 스누즈 미만료 → 프롬프트 스킵, 메뉴 라벨은 "available" 유지.
- 같은 버전 + 스누즈 만료 → 다시 프롬프트.
- 더 새로운 버전 → 스누즈 리셋, 새 프롬프트.

### 2.4 메뉴 확장

`getUpdateMenuLabel()`:
- `updateStatus === "available"` → `"Update Available (v{version})"`.

`getUpdateMenuItem()`:
- `available` 상태에서 클릭 → `promptAvailableUpdate()` (수동 다운로드 진입).

### 2.5 반환 인터페이스

```js
return {
  setupAutoUpdater,
  checkForUpdates,
  getUpdateMenuItem,
  getUpdateMenuLabel,
  startScheduler,      // new
  stopScheduler,       // new
  reevaluateDeferred,  // new
};
```

## 3. main.js 배선

### 3.1 시작/종료

```
app.whenReady → ... → setupAutoUpdater() → startScheduler()
app "before-quit" → stopScheduler()
```

### 3.2 ctx 확장

`_updaterCtx`에 추가:

```js
get autoCheckForUpdates() { return _settingsController.get("autoCheckForUpdates"); },
getPendingUpdateVersion() { return _settingsController.get("pendingUpdateVersion"); },
savePendingState(partial) { _settingsController.applyBulk(partial); },
```

### 3.3 settings subscriber 확장

`_settingsController.subscribe(({ changes }) => { ... })` 내부:

- DND false 전환 시 → `reevaluateDeferred()`
- mini 해제 시 → `reevaluateDeferred()`

### 3.4 Settings UI

General 탭 Startup 섹션, `rowStartWithClaude` 아래에 토글 추가:
- "Automatically check for updates" / `autoCheckForUpdates`

### 3.5 i18n

- `rowAutoCheckUpdates`: "Automatically check for updates"
- `rowAutoCheckUpdatesDesc`: "Check for new versions in the background every 12 hours."
- `updateAvailableMenu`: "Update Available (v{version})"
- en, zh, ko 3개 언어.

## 4. 상태 전이 다이어그램

```
                  ┌─────────┐
        app start │  idle   │◄──── autoCheck=false (스킵)
                  └────┬────┘
                       │ checkForUpdates()
                  ┌────▼────┐
                  │checking │
                  └────┬────┘
              ┌────────┼────────┐
              │        │        │
         up-to-date  error   new version
              │        │        │
              ▼        ▼        ▼
            idle     error  ┌──────────┐
                            │available │
                            └────┬─────┘
                          ┌──────┼──────┐
                     silent?    │    prompt shown
                       │        │        │
                  defer+menu  Later   Download
                       │        │        │
                       │   snooze 24h    ▼
                       │        │    ┌──────────┐
                       │        │    │downloading│
                       │        │    └─────┬────┘
                       │        │          │
                       │        │          ▼
                       │        │    ┌──────────┐
                       │        │    │  ready   │
                       │        │    └─────┬────┘
                       │        │     Restart / Later
                       │        │          │
                       ▼        ▼          ▼
                  reevaluate  next check  install+relaunch
                  on DND/mini  (12h)
                  change
```

## 5. 테스트 계획

### updater 스케줄러/스누즈

- `app.isPackaged = false` → `startScheduler()` 후 체크 안 돌음
- `autoCheckForUpdates = false` → 타이머 발동해도 체크 스킵
- checking/downloading 중 → 중복 체크 방지
- 새 버전 + DND → `pendingUpdateVersion` 저장, 버블 미표시
- DND 해제 → `reevaluateDeferred()` → 프롬프트
- Later → snooze 세팅, 미만료 시 재프롬프트 스킵
- 스누즈 만료 → 재프롬프트
- 더 새로운 버전 → 스누즈 리셋

### prefs

- 새 필드 validate/migrate/defaults 정상
- 기존 파일 호환 (필드 없어도 default)

### settings

- `autoCheckForUpdates` 토글 → `settings:update` IPC 라우팅

### 회귀

- 수동 "Check for Updates" 그대로 동작
- git 모드 경로 변경 없음

## 6. 엣지 케이스 명시

- **`ready` 상태 Later**: 다운로드 완료 후 "Later" → 스누즈 없음. `updateStatus = "ready"` 유지, 메뉴에서 "Restart Now" 접근 가능. 앱 종료 시 `autoInstallOnAppQuit`로 자동 설치.
- **`lastUpdateCheckAt` 갱신 시점**: `checkForUpdates()` 진입 직후 (결과와 무관하게). 중복 체크 방지와 스케줄 판정에 사용.
- **앱 재시작 후 pending 복원**: `pendingUpdateVersion`이 prefs에 남아 있으면 첫 auto-check에서 재확인. 해당 버전이 여전히 최신이면 프롬프트, 이미 설치된 버전이면 `pendingUpdateVersion = ""` 초기화.

## 7. 스코프 외 (이 iteration에 포함 안 함)

- `notifyOnUpdateAvailable` 별도 설정
- "Skip this version" 액션
- 자동 다운로드 (silent background download)
- git 모드 auto-check
