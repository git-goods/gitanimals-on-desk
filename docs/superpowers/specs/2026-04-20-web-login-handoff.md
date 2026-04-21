# Web ↔ Desktop 로그인 핸드오프 명세

> **대상:** 웹팀 + 백엔드팀  
> **작성일:** 2026-04-20  
> **관련 문서:** [`gitanimals-api-contract.md`](./2026-04-20-gitanimals-api-contract.md)

---

## 배경

데스크톱 앱은 GitHub OAuth를 직접 처리하지 않는다. 웹 서비스가 OAuth 흐름 전체를 담당하고, 완료된 토큰을 데스크톱 앱의 로컬 콜백 서버로 **리디렉트** 방식으로 전달한다. 데스크톱은 이 토큰을 `safeStorage`에 암호화 저장하고 이후 API 호출에 사용한다.

---

## 데스크톱 측 동작 (참고용)

1. 앱 기동 시 토큰 없음 → 로그인 창 표시
2. 유저가 "GitAnimals로 로그인" 클릭 → 아래 URL을 기본 브라우저로 오픈:

```
https://gitanimals.org/auth/desktop
  ?redirect_uri=http://127.0.0.1:{PORT}/auth/callback
  &state={64자 hex nonce}
```

- `PORT`: 23338–23342 범위에서 앱이 동적으로 선택한 포트
- `state`: 앱이 매 로그인 시도마다 새로 생성하는 CSRF nonce

3. 브라우저에서 로그인 완료 → 웹이 `redirect_uri`로 리디렉트
4. 앱의 로컬 HTTP 서버가 콜백 수신 → 토큰 저장 → 로그인 창 닫힘 → 펫 등장

---

## 웹팀이 구현해야 할 것

### 1. `/auth/desktop` 페이지

**경로:** `GET /auth/desktop`

**Query params:**

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `redirect_uri` | string (required) | 데스크톱 앱의 로컬 콜백 URL |
| `state` | string (required) | CSRF nonce (64자 hex) — 반드시 콜백에 그대로 전달 |

**동작:**
1. `redirect_uri` 화이트리스트 검사 (아래 참조) — 실패 시 400 에러 페이지
2. `state` 파라미터 세션에 저장
3. 이미 로그인된 세션이면 → 즉시 콜백 리디렉트 (재인증 불필요)
4. 미로그인 → GitAnimals 로그인 UI 표시 (기존 웹 로그인 흐름 그대로)
5. 로그인 완료 → 콜백 리디렉트

**`redirect_uri` 화이트리스트 패턴:**

```
http://127.0.0.1:{23338..23342}/auth/callback
```

정규식으로 검증:

```js
/^http:\/\/127\.0\.0\.1:(2333[8-9]|2334[0-2])\/auth\/callback$/.test(redirectUri)
```

> **주의:** `localhost`는 허용하지 않음. IPv4 `127.0.0.1`만 허용.

---

### 2. 콜백 리디렉트

로그인 완료 후 다음 URL로 리디렉트:

```
{redirect_uri}?token={ACCESS_TOKEN}&state={ORIGINAL_STATE}
```

**예시:**

```
http://127.0.0.1:23338/auth/callback?token=eyJhb...&state=a3f2b1...
```

**규칙:**
- `state`는 `/auth/desktop` 수신 시 그대로 **에코** (변경 금지)
- `token`은 query param으로 전달 (fragment `#` 사용 금지 — 데스크톱 서버는 URL query만 파싱)
- HTTP 302 리디렉트 사용 (301 금지 — 브라우저 캐시 문제)

---

### 3. 토큰 요구사항

| 항목 | 요구사항 |
|---|---|
| 형식 | 불투명 문자열 또는 JWT — 데스크톱은 내용을 파싱하지 않음 |
| 만료 | 30일 권장 (refresh token 없음, 만료 시 재로그인) |
| 인증 헤더 | `Authorization: Bearer {token}` — 모든 API 엔드포인트 공통 |
| 401 시 | 데스크톱이 토큰 폐기 + 재로그인 창 표시 |

---

### 4. 에러 케이스 처리

| 케이스 | 처리 |
|---|---|
| `redirect_uri` 화이트리스트 불일치 | 400 에러 페이지 (리디렉트 금지) |
| `state` 누락 | 400 에러 페이지 |
| 로그인 취소/실패 | 콜백 리디렉트 없음 (데스크톱은 5분 타임아웃 후 에러 표시) |
| 토큰 발급 실패 | `/auth/desktop` 페이지에서 에러 메시지 표시, 재시도 유도 |

---

## 전체 시퀀스 다이어그램

```
Desktop App          Browser              Web (gitanimals.org)     GitAnimals API
     │                   │                        │                      │
     │  openExternal()   │                        │                      │
     │──/auth/desktop────▶                        │                      │
     │   ?redirect_uri   │  GET /auth/desktop     │                      │
     │   &state=nonce    │───────────────────────▶│                      │
     │                   │  Login UI              │                      │
     │                   │◀───────────────────────│                      │
     │                   │                        │                      │
     │                   │  User logs in          │                      │
     │                   │───────────────────────▶│                      │
     │                   │  302 redirect          │                      │
     │  GET /auth/callback?token=T&state=nonce    │                      │
     │◀───────────────────────────────────────────│                      │
     │  state check ✓    │                        │                      │
     │  token stored     │                        │                      │
     │                   │  200 "로그인 완료"     │                      │
     │  Pet appears      │                        │                      │
     │──────────────────────────────────────────────── GET /users/me ───▶│
     │                   │                        │◀──────────────────── │
```

---

## 보안 체크리스트

- [ ] `redirect_uri` 화이트리스트 — `127.0.0.1:23338–23342` 외 거부
- [ ] `state` 에코 — 변환 없이 그대로 반환
- [ ] 콜백은 query param 방식 (`?token=...`) — fragment 금지
- [ ] `redirect_uri` 검증 실패 시 해당 URL로 리디렉트하지 않음 (open redirect 방지)
- [ ] 토큰은 HTTPS 발급 (로컬 콜백은 http 허용 — 127.0.0.1 한정)

---

## 구현 확인 방법

데스크톱 앱 개발 모드에서:

```bash
# 1. 앱 실행 (로그인 게이트 활성화)
GITANIMALS_API_BASE_URL=https://gitanimals.org npm start

# 2. 로그인 창 뜨면 "GitAnimals로 로그인" 클릭
# 3. 브라우저에서 로그인 완료
# 4. 데스크톱 앱에 펫이 등장하면 성공
```

로컬 개발용 mock (데스크톱 개발자용):

```bash
# /auth/desktop?redirect_uri=...&state=... 요청 시
# 즉시 redirect_uri?token=mock-token-001&state={state} 로 리디렉트하는 페이지 필요
```
