# 릴리스 & 코드 서명 가이드

이 문서는 두 가지를 담습니다:
1. **현재 작동 중인 릴리스 방법** (테스트 게이트 포함)
2. **코드 서명 & 공증** — 나중에 착수할 때 바로 따라할 수 있는 체크리스트

---

## 1. 릴리스 하기 (현재 방식)

### 절차

```bash
npm version patch   # 0.0.1 → 0.0.2 (버그 수정)
# npm version minor # 0.0.1 → 0.1.0 (기능 추가)
# npm version major # 0.0.1 → 1.0.0 (큰 변경)
git push origin main --follow-tags
```

`npm version`이 package.json/package-lock.json bump + commit + annotated tag를 한 번에 처리합니다.
태그가 push되면 `Build & Release` 워크플로우가 자동 트리거됩니다.

### 내부 동작

```
[로컬]
  npm version <type>
    → package.json / package-lock.json bump
    → commit "vX.Y.Z"
    → annotated tag vX.Y.Z
  git push origin main --follow-tags
              │
              ▼ 태그 push 가 워크플로우 자동 트리거
[Build & Release 워크플로우]
  ├ npm test (안전장치)
  ├ Windows / macOS / Linux 병렬 빌드
  └ GitHub Releases 에 .exe / .dmg / .AppImage / .deb + latest*.yml 업로드
```

### 실패 시 대응

| 실패 지점 | 상태 | 복구 |
|---|---|---|
| `Build.*` (빌드 실패) | 태그는 이미 push 됨 | 태그 삭제 후 재시도: `git push origin :vX.Y.Z && git tag -d vX.Y.Z` |

### 파일

- `.github/workflows/build.yml` — 태그 감지 워크플로우 (test → 3-OS 빌드 → Releases)

---

## 2. 코드 서명 & 공증 (나중에 할 일)

> **지금 하지 않는 이유**: 인증서 비용 + Apple Developer 가입 등 선행 비용이 있고, 서명 없이도 릴리스는 잘 동작합니다. 다만 사용자 경험 측면에서 아래 제약이 있습니다.

### 2.1 서명 없을 때 영향

| 플랫폼 | 서명 없음 | 서명 후 |
|---|---|---|
| Windows | SmartScreen "알 수 없는 게시자" 경고 | 경고 없음 |
| macOS | Gatekeeper "확인되지 않은 개발자" 차단 (우클릭→열기 필요) | 정상 실행 |
| macOS 자동 업데이트 | 미지원 (릴리스 페이지 열기로 대체) | `electron-updater` 자동 다운로드/설치 |

### 2.2 macOS 서명 + 공증 체크리스트

#### A. 준비물 확보

- [ ] **Apple Developer Program** 가입 ($99/년) — https://developer.apple.com/programs/
- [ ] Xcode 또는 "Apple Development" 앱 설치 (인증서 관리용)
- [ ] Apple ID 2단계 인증 활성화

#### B. 인증서 발급

- [ ] Xcode → Settings → Accounts → Manage Certificates → "+" → **Developer ID Application** 선택
- [ ] "키체인 접근" 앱에서 방금 발급된 인증서 찾기
- [ ] 우클릭 → "내보내기" → `.p12` 포맷 → 강력한 비밀번호 설정
- [ ] `.p12` 파일을 **base64 로 변환**:
  ```bash
  base64 -i DeveloperIDApplication.p12 | pbcopy
  # 클립보드에 복사됨 — GitHub Secrets 에 붙여넣기
  ```

#### C. App-Specific Password 생성

- [ ] https://appleid.apple.com → 로그인 → "앱 암호" → "+" → `clawd-notarize` 등으로 생성
- [ ] 생성된 16자리 암호 복사 (xxxx-xxxx-xxxx-xxxx 형식)

#### D. Team ID 확인

- [ ] https://developer.apple.com/account → Membership → **Team ID** 복사 (예: `ABCD123456`)

#### E. GitHub Secrets 등록

GitHub 저장소 → Settings → Secrets and variables → Actions → New repository secret

| Secret 이름 | 값 |
|---|---|
| `MAC_CSC_LINK` | B 에서 얻은 base64 문자열 |
| `MAC_CSC_KEY_PASSWORD` | `.p12` export 시 설정한 비밀번호 |
| `APPLE_ID` | Apple 개발자 계정 이메일 |
| `APPLE_APP_SPECIFIC_PASSWORD` | C 의 16자리 암호 |
| `APPLE_TEAM_ID` | D 의 Team ID |

#### F. 프로젝트 설정 추가

`package.json` 의 `build.mac` 수정:

```json
"mac": {
  "icon": "assets/icon.png",
  "target": [
    { "target": "dmg", "arch": ["x64", "arm64"] }
  ],
  "category": "public.app-category.entertainment",
  "extendInfo": { "LSUIElement": true },
  "notarize": true,
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "build/entitlements.mac.plist",
  "entitlementsInherit": "build/entitlements.mac.plist"
}
```

`build/entitlements.mac.plist` 신규 생성:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
</dict>
</plist>
```

#### G. 워크플로우 수정

`.github/workflows/build.yml` 의 `build-mac` job `env` 추가:

```yaml
  build-mac:
    needs: test
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npx electron-builder --mac --publish never
        env:
          CSC_LINK: ${{ secrets.MAC_CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.MAC_CSC_KEY_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
      - uses: actions/upload-artifact@v4
        # ... 기존 그대로
```

#### H. 검증

Release 한 번 찍고 `.dmg` 다운로드 후 로컬에서:

```bash
# 코드 서명 유효성 확인
codesign --verify --deep --strict --verbose=2 /Applications/Clawd\ on\ Desk.app

# 공증 확인
spctl -a -vv /path/to/downloaded.dmg
# → "accepted" + "source=Notarized Developer ID" 가 떠야 정상
```

---

### 2.3 Windows 서명 체크리스트

#### A. 인증서 선택

| 방식 | 연간 비용 | CI 호환성 | 비고 |
|---|---|---|---|
| **SSL.com eSigner** (OV, cloud) | ~$240 | ⭐⭐⭐ | 추천 — CI 에서 바로 쓰기 좋음 |
| Certum OV 인증서 | ~$60 | ⭐⭐ | 가장 저렴, `.p12` 기반 |
| Azure Trusted Signing | ~$10/월 | ⭐⭐⭐ | MS 생태계, 비교적 새로움 |
| EV 인증서 (USB 토큰) | ~$300+ | ⭐ | SmartScreen 평판 즉시 획득하지만 CI 복잡 |

개인 프로젝트 기준 추천: **Certum OV** (비용) 또는 **SSL.com eSigner** (편의).

#### B. GitHub Secrets 등록 (Certum OV / .p12 기준)

| Secret | 값 |
|---|---|
| `WIN_CSC_LINK` | .p12 base64 문자열 (`base64 -i cert.p12 \| pbcopy`) |
| `WIN_CSC_KEY_PASSWORD` | .p12 비밀번호 |

#### C. `package.json` 수정

```json
"win": {
  "icon": "assets/icon.ico",
  "signAndEditExecutable": true,   // false → true 로 변경
  "artifactName": "Clawd-on-Desk-Setup-${version}.${ext}",
  "target": [{ "target": "nsis", "arch": ["x64"] }]
}
```

#### D. `.github/workflows/build.yml` `build-windows` job `env` 추가

```yaml
  build-windows:
    needs: test
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npx electron-builder --win --publish never
        env:
          WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
      # ...
```

#### E. 검증

```powershell
signtool verify /pa /v "C:\path\to\Clawd-on-Desk-Setup-X.Y.Z.exe"
# → "Successfully verified" 떠야 정상
```

---

### 2.4 서명 완료 후 후속 작업

#### macOS 자동 업데이트 활성화

현재 `src/updater.js:489-506` 의 macOS 분기는 GitHub 릴리스 페이지를 여는 것으로 대체되어 있습니다:

```js
if (isMac) {
  shell.openExternal("https://github.com/rullerzhou-afk/clawd-on-desk/releases/latest");
  // ...
}
```

서명 + 공증 완료 후에는 Windows 분기와 동일하게 `autoUpdater.downloadUpdate()` 를 호출하도록 바꿉니다. 구체적으로는 `isMac` 분기를 제거하고 통합 경로로 합치면 됩니다.

---

## 3. 트러블슈팅

### macOS 공증 실패

```bash
xcrun notarytool log <submission-id> \
  --apple-id $APPLE_ID \
  --password $APPLE_APP_SPECIFIC_PASSWORD \
  --team-id $APPLE_TEAM_ID
```

흔한 원인:
- `hardenedRuntime: true` 없음
- entitlements 누락 (JIT 필요한데 `allow-jit` 없음)
- stapling 실패 → `xcrun stapler staple dist/*.dmg` 수동 실행

### `CSC_LINK` base64 디코딩 실패

`.p12` base64 에 줄바꿈이 섞이면 실패합니다. macOS `base64` 는 기본적으로 줄바꿈을 넣으니 `pbcopy` 로 복사할 때만 안전합니다. 파일로 저장할 때는:

```bash
base64 -i cert.p12 -o cert.p12.b64   # macOS BSD base64
# 또는
base64 -w 0 cert.p12                 # Linux coreutils
```

### Gatekeeper 가 여전히 차단

공증 후에도 차단되면 stapling 이 안 된 경우:
```bash
xcrun stapler staple dist/*.dmg
xcrun stapler validate dist/*.dmg
```

### Windows SmartScreen 평판

OV 인증서는 처음 몇 주/몇 달간 "이 발행자 평판이 없음" 경고가 뜹니다. EV 인증서는 즉시 평판 획득. 평판은 다운로드 수가 쌓이면서 자연스럽게 해결됩니다.

---

## 4. 참고 링크

- electron-builder 코드 서명: https://www.electron.build/code-signing
- macOS 공증: https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution
- Apple Developer ID: https://developer.apple.com/developer-id/
- Certum OV 인증서: https://shop.certum.eu/data-safety/code-signing-certificates/open-source-code-signing.html
- SSL.com eSigner: https://www.ssl.com/esigner/
