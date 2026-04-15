# macOS 코드 서명 & 공증 설정 가이드

GitAnimals on Desk의 macOS DMG에 Apple 코드 서명 + 공증(notarization)을 적용하는 단계별 가이드입니다.

완료하면:
- Gatekeeper 차단 없이 DMG 실행 가능
- `electron-updater` 자동 다운로드/설치 활성화 (Windows와 동일)

**선행 조건**: Apple Developer Program 가입 ($99/년)

---

## 1단계: Developer ID Application 인증서 발급

macOS 배포용은 **Developer ID Application** 인증서입니다.
(App Store 배포용 "Mac App Store" 인증서와 다름 — 혼동 주의)

### 방법 A: Xcode 사용 (가장 쉬움)

```
1. Xcode 실행 (없으면 App Store에서 설치)
2. Xcode → Settings (⌘,) → Accounts 탭
3. 좌측 하단 "+" → Apple ID 로그인
4. 팀 선택 → "Manage Certificates..." 클릭
5. 좌측 하단 "+" → "Developer ID Application" 선택
6. 잠시 후 목록에 Developer ID Application 인증서 생성됨
```

### 방법 B: Apple Developer 웹 사이트

```
1. https://developer.apple.com/account → Certificates, IDs & Profiles
2. Certificates → "+" 버튼
3. Software → "Developer ID Application" 선택 → Continue
4. CSR 파일 생성:
   - "키체인 접근" 앱 열기
   - 메뉴: 키체인 접근 → 인증서 지원 → 인증 기관에서 인증서 요청
   - 이메일/이름 입력 → "디스크에 저장" 선택
   - CertificateSigningRequest.certSigningRequest 저장
5. 웹에서 그 CSR 파일 업로드 → Continue
6. .cer 파일 다운로드 → 더블클릭하면 키체인에 자동 등록됨
```

---

## 2단계: 인증서를 .p12 파일로 내보내기

```
1. "키체인 접근" 앱 실행
2. 좌측 "로그인" 키체인 → "내 인증서" 카테고리
3. "Developer ID Application: 이름 (팀ID)" 항목을 찾아 펼치기
   ▸ 반드시 개인키(🔑)가 같이 있어야 함
   ▸ 개인키가 없으면 1단계를 다시 하세요 (다른 Mac에서 발급했을 가능성)
4. 인증서 우클릭 → "내보내기..."
5. 파일 포맷: "개인 정보 교환 (.p12)" 선택
6. 저장 → 강력한 비밀번호 설정 (이거 기억 필수!)
7. 로그인 키체인 암호 한 번 더 입력
```

---

## 3단계: .p12 파일을 base64로 변환

```bash
cd ~/Downloads  # .p12 저장한 위치로 이동
base64 -i DeveloperIDApplication.p12 -o cert.p12.b64
cat cert.p12.b64 | pbcopy   # 클립보드 복사
```

> ⚠️ macOS의 `base64`는 기본적으로 줄바꿈을 넣는데, `-o` 옵션으로 파일 저장하면 그대로 써도 GitHub Secrets에서 정상 처리됩니다. `pbcopy`로 클립보드에 넣으면 그대로 복사 가능.

---

## 4단계: App-Specific Password 생성 (공증용)

공증(notarization) 과정에서 Apple에 앱을 제출할 때 필요합니다. 본인 Apple ID 비밀번호가 아닌 전용 암호를 써야 합니다.

```
1. https://appleid.apple.com → 로그인
2. 로그인 및 보안 → "앱 암호" 클릭
3. "+" → 라벨: "clawd-notarize" (아무 이름이나 OK)
4. 생성된 xxxx-xxxx-xxxx-xxxx 형식 암호 복사
```

> ⚠️ 이 암호는 **생성 직후 한 번만 표시**됩니다. 즉시 복사해두세요.

---

## 5단계: Team ID 확인

```
https://developer.apple.com/account → Membership
→ Team ID (10자리 영숫자, 예: ABCD123456) 복사
```

---

## 6단계: GitHub Secrets 등록

저장소 → Settings → Secrets and variables → Actions → **New repository secret**

| Secret 이름 | 값 | 출처 |
|---|---|---|
| `MAC_CSC_LINK` | base64 문자열 | 3단계 |
| `MAC_CSC_KEY_PASSWORD` | .p12 비밀번호 | 2단계 |
| `APPLE_ID` | Apple 개발자 계정 이메일 | — |
| `APPLE_APP_SPECIFIC_PASSWORD` | 16자리 앱 암호 | 4단계 |
| `APPLE_TEAM_ID` | Team ID | 5단계 |

---

## 7단계: 프로젝트 코드 변경 (개발자 작업)

GitHub Secrets 등록이 완료되면, 다음 파일들이 변경되어야 합니다:

1. **`build/entitlements.mac.plist`** 신규 생성 (JIT + 서명 허용 권한)
2. **`package.json`** `build.mac` 섹션에 서명/공증 옵션 추가:
   - `notarize: true`
   - `hardenedRuntime: true`
   - `gatekeeperAssess: false`
   - `entitlements`, `entitlementsInherit` 경로 지정
3. **`.github/workflows/build.yml`** `build-mac` job에 환경변수 추가:
   - `CSC_LINK`, `CSC_KEY_PASSWORD`
   - `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
4. **`src/updater.js`** macOS 분기 제거 → Windows와 동일하게 `autoUpdater.downloadUpdate()` 통합

---

## 8단계: 검증

릴리스 한 번 찍고 DMG 다운로드 후:

```bash
# 코드 서명 유효성 확인
codesign --verify --deep --strict --verbose=2 "/Applications/GitAnimals on Desk.app"

# 공증 확인 (DMG)
spctl -a -vv /path/to/downloaded.dmg
# → "accepted" + "source=Notarized Developer ID" 가 나와야 정상
```

Gatekeeper 경고 없이 DMG가 열리면 성공.

---

## 트러블슈팅

### 공증 실패 로그 확인

```bash
xcrun notarytool log <submission-id> \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$APPLE_TEAM_ID"
```

흔한 원인:
- `hardenedRuntime: true` 누락
- entitlements에 `allow-jit` 등 필요 권한 빠짐
- stapling 실패 → `xcrun stapler staple dist/*.dmg` 수동 실행

### 여전히 Gatekeeper가 차단

공증은 성공했지만 stapling이 안 된 경우:

```bash
xcrun stapler staple dist/*.dmg
xcrun stapler validate dist/*.dmg
```

### `.p12`에 개인키가 없음

키체인에서 인증서를 펼쳤는데 개인키(🔑)가 안 보이면, 그 인증서는 다른 Mac에서 발급되었을 가능성이 큽니다. 발급한 Mac에서 내보내거나, 현재 Mac에서 1단계를 다시 진행하세요.

### `CSC_LINK` base64 디코딩 실패

줄바꿈이 섞인 base64는 실패할 수 있습니다. 다음 중 하나로 변환:

```bash
# macOS BSD base64 — 파일 저장
base64 -i cert.p12 -o cert.p12.b64

# Linux coreutils — 줄바꿈 제거
base64 -w 0 cert.p12
```

---

## 참고 링크

- electron-builder 코드 서명: https://www.electron.build/code-signing
- macOS 공증 공식 문서: https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution
- Apple Developer ID 개요: https://developer.apple.com/developer-id/
