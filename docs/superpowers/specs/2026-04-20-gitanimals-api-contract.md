# GitAnimals API Contract (Desktop Client ↔ Backend)

> 상태: **초안 — 백엔드/웹팀 리뷰 필요**  
> 작성: 2026-04-20  
> 대상 독자: 데스크톱 앱 팀, GitAnimals 백엔드 팀, 웹 프론트엔드 팀

---

## 1. 인증 헤더

모든 엔드포인트에 공통 적용:

```
Authorization: Bearer <token>
```

토큰 없이 보호된 엔드포인트 호출 시 `401 Unauthorized` 반환.

---

## 2. 엔드포인트

### 2.1 `GET /users/{username}`

유저 계정에 귀속된 페르소나 목록을 반환한다.

**Query params:**

| 파라미터 | 기본값 | 설명 |
|---|---|---|
| `filter-animation` | `false` | `true` 시 데스크톱 앱이 쓸 수 없는 애니메이션 전용 타입을 제외 |

> 데스크톱 클라이언트는 **항상 `filter-animation=true`** 로 고정 호출한다.

**응답 (`200 OK`):**

```json
{
  "username": "sumi",
  "personas": [
    {
      "type": "DESSERT_FOX",
      "name": "사막여우",
      "previewUrl": "https://api.gitanimals.org/assets/images?personaType=DESSERT_FOX&emotion=idle"
    },
    {
      "type": "LITTLE_CHICK",
      "name": "병아리",
      "previewUrl": "https://api.gitanimals.org/assets/images?personaType=LITTLE_CHICK&emotion=idle"
    }
  ]
}
```

**에러:**

| 코드 | 의미 |
|---|---|
| `401` | 토큰 없음 / 만료 |
| `404` | 유저명이 존재하지 않음 |

---

### 2.2 `GET /assets?personaType={type}`

특정 페르소나의 전체 메타데이터를 반환한다.  
**응답 스키마는 현재 `themes/<id>/theme.json` 스키마(v1)와 1:1 호환해야 한다.**

핵심 요구사항:

- `states` 필드의 모든 파일 참조는 **절대 URL** 로 반환 (클라이언트가 `emotion` 어휘를 알 필요 없게).
- 클라이언트는 URL을 그대로 받아 로컬에 캐싱한다 (`/assets/images` 직접 조합 금지).

**Query params:**

| 파라미터 | 필수 | 예시 |
|---|---|---|
| `personaType` | ✅ | `DESSERT_FOX` |

**응답 (`200 OK`) — 예시 (`DESSERT_FOX`):**

```json
{
  "schemaVersion": 1,
  "name": "Dessert Fox",
  "version": "1.0.0",
  "description": "...",

  "viewBox": { "x": -15, "y": -25, "width": 45, "height": 45 },
  "layout": {
    "contentBox": { "x": -2, "y": -2, "width": 20, "height": 18 },
    "centerX": 7.5,
    "baselineY": 15
  },

  "states": {
    "idle":         ["https://cdn.gitanimals.org/assets/DESSERT_FOX/idle.svg"],
    "thinking":     ["https://cdn.gitanimals.org/assets/DESSERT_FOX/thinking.svg"],
    "working":      ["https://cdn.gitanimals.org/assets/DESSERT_FOX/typing.svg"],
    "error":        ["https://cdn.gitanimals.org/assets/DESSERT_FOX/error.svg"],
    "attention":    ["https://cdn.gitanimals.org/assets/DESSERT_FOX/happy.svg"],
    "notification": ["https://cdn.gitanimals.org/assets/DESSERT_FOX/notification.svg"],
    "sleeping":     ["https://cdn.gitanimals.org/assets/DESSERT_FOX/sleeping.svg"],
    "waking":       ["https://cdn.gitanimals.org/assets/DESSERT_FOX/waking.svg"]
  },

  "timings": {
    "minDisplay": {
      "attention": 4000,
      "error": 5000,
      "notification": 2500,
      "working": 1000,
      "thinking": 1000
    },
    "autoReturn": {
      "attention": 4000,
      "error": 5000,
      "notification": 2500
    },
    "mouseIdleTimeout": 20000,
    "mouseSleepTimeout": 60000,
    "wakeDuration": 5000
  },

  "hitBoxes": {
    "default":  { "x": -3, "y": -8, "w": 22, "h": 20 },
    "sleeping": { "x": -3, "y": -5, "w": 22, "h": 18 }
  },
  "sleepingHitboxFiles": ["sleeping.svg"],

  "eyeTracking": { "enabled": false }
}
```

> `eyeTracking`, `miniMode`, `accessories`, `variants`, `reactions`,  
> `workingTiers`, `jugglingTiers` 등 선택적 필드는 생략 가능.  
> 클라이언트는 `mergeDefaults()`로 기본값을 보충한다.

**에러:**

| 코드 | 의미 |
|---|---|
| `401` | 토큰 없음 / 만료 |
| `404` | 해당 `personaType` 없음 |

---

### 2.3 `GET /assets/images?personaType={type}&emotion={emotion}`

특정 페르소나의 특정 감정 상태 SVG 이미지를 반환한다.

**클라이언트 사용 방침:**  
직접 URL을 조합하지 말고 `/assets` 응답의 `states` 필드에 포함된 URL을 사용할 것.  
이 엔드포인트는 2.2의 URL이 내부적으로 가리키는 리소스이며, 클라이언트가 `emotion` 어휘를 직접 알 필요는 없다.

**응답:** `image/svg+xml`

---

## 3. 인증 플로우 (`/auth/desktop`)

데스크톱 앱은 GitHub OAuth를 직접 구현하지 않는다.  
웹 서비스가 OAuth를 처리하고, 완료 후 토큰을 로컬 콜백으로 전달한다.

### 3.1 플로우 순서

```
1. 앱이 state nonce 생성 (cryptographically random, 32 bytes hex)
2. 앱이 127.0.0.1:23338/auth/callback 리슨 시작
3. 앱이 기본 브라우저로 아래 URL 열기:
   https://gitanimals.org/auth/desktop
     ?redirect_uri=http://127.0.0.1:23338/auth/callback
     &state=<nonce>
4. 유저가 웹에서 GitHub 로그인 완료
5. 웹이 아래로 리디렉트:
   http://127.0.0.1:23338/auth/callback?token=<token>&state=<nonce>
6. 앱이 state 검증 (CSRF 방지) → 토큰 저장 → 콜백 서버 셧다운
```

### 3.2 웹 팀 요구사항

`/auth/desktop` 페이지:

- `redirect_uri` 쿼리 파라미터를 받아서 로그인 완료 시 해당 URI로 리디렉트한다.
- **화이트리스트**: `redirect_uri`는 `http://127.0.0.1:{port}/auth/callback` 패턴만 허용 (`127.0.0.1` 고정, 포트는 23338–23342 범위).
- `state` 파라미터를 그대로 전달받아 `redirect_uri`에 포함해 돌려준다.
- HTTPS 서빙 필수 (브라우저가 mixed-content 경고 없이 HTTP callback으로 리디렉트 가능).

### 3.3 토큰 포맷

```
redirect_uri?token=<opaque-token>&state=<nonce>
```

- `token`: opaque string. 앱은 포맷을 해석하지 않고 그대로 `Authorization: Bearer` 헤더에 사용.
- `state`: 앱이 보낸 nonce와 일치해야 함. 불일치 시 앱이 토큰을 거부하고 재시도 요청.

---

## 4. 토큰 수명 & 오류 처리

| 항목 | 제안 |
|---|---|
| Access token TTL | 30일 |
| Refresh token | 없음 (만료 시 재로그인) |
| 만료 감지 | API 응답 `401` |
| 클라이언트 동작 | 토큰 폐기 → 토스트 "세션 만료, 다시 로그인하세요" → 로그인 창 오픈 |

---

## 5. 공통 에러 응답 포맷

```json
{
  "error": "human-readable description",
  "code": "MACHINE_READABLE_CODE"
}
```

예시 코드: `UNAUTHORIZED`, `NOT_FOUND`, `INVALID_PERSONA_TYPE`, `RATE_LIMITED`

---

## 6. 미결 사항 (백엔드 확인 필요)

| # | 질문 | 기본 가정 |
|---|---|---|
| 1 | `/assets` 응답 `states` 값이 절대 URL인가, 파일명인가? | **절대 URL** (클라이언트가 emotion 어휘 불필요) |
| 2 | `personaType` 값 포맷은? (`DESSERT_FOX`, `dessert-fox`, …) | `UPPER_SNAKE_CASE` |
| 3 | `/users/{username}` 의 `{username}` 은 토큰 소유자만 조회 가능? | 예 (타인 조회 시 403) |
| 4 | `filter-animation=true` 의 정확한 의미와 필터링 기준 | 클라이언트가 쓸 수 없는 타입 제외 |
| 5 | 토큰 TTL 및 refresh 정책 | 30일 재로그인 (위 제안 확인 요청) |
| 6 | `redirect_uri` 포트 허용 범위 | 23338–23342 (협의 필요) |
