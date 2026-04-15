---
name: port-gitanimals-svg
description: >
  Use when creating or updating Clawd theme SVG assets — whether porting from GitAnimals templates,
  deriving new state poses from existing bases, or tuning hitBox/animation. Covers coordinate
  extraction from CSS keyframes, nested animation groups, z-order, keyframe prefix, viewBox
  alignment, eye variants (^^, X, closed), prop animations, walk/flip patterns, hitBox debugging,
  and Clawd eye-tracking conventions. Invoke whenever the user asks to create, update, or debug
  a Clawd theme pose SVG.
---

# GitAnimals SVG → Clawd 테마 에셋 이식 가이드

## 이 스킬을 쓰는 상황

- 사용자가 GitAnimals 스타일 `.svg` (템플릿 플레이스홀더 포함)를 제공하고 새 포즈 SVG를 만들도록 요청
- `themes/<name>/assets/` 에 새 상태 SVG(idle, working, typing, sleeping 등)를 추가

---

## Step 1 — 레퍼런스 분석

레퍼런스 SVG를 읽어 다음 두 가지를 **반드시 동시에** 확인:

### 1-a. CSS `@keyframes` 0% 값 (= 실제 표시 위치)

```css
@keyframes xxx-shadow-move {
  0% { transform: translate(3px, 9.5px) scaleX(1); }  /* ← 이 값이 정적 SVG의 실제 위치 */
}
@keyframes xxx-head-move {
  0% { transform: translate(0px, -2.5px) rotate(0deg); }
}
```

> **핵심**: CSS `transform` 이 SVG `transform` attribute 를 완전히 덮어씀.
> SVG `transform="translate(0, 0)"` 는 플레이스홀더일 뿐 — 0% 프레임 값이 진짜 위치.

### 1-b. 각 부위별 0% 좌표 표로 정리

| 부위 | SVG attr (무시) | CSS 0% (사용) |
|------|----------------|--------------|
| Shadow | translate(3, 12) | translate(3, 9.5) |
| Legs | translate(5, 10) / (8, 10) | translate(5, 7.5) / (8, 7.5) |
| Body | translate(-2, 4.5) | (attr 그대로, CSS 없음) |
| Head | translate(0, 0) | translate(0, -2.5) |
| Notebook | translate(8, 4.5) | (attr 그대로, CSS 없음) |

---

## Step 2 — SVG 구조 변환

### 2-a. 제거할 것

```
- *{id}, *{act}, *{contribution}, *{username}, *{level} 플레이스홀더
- GitAnimals UI 그룹: contributions-wrap, username-tag-wrap, username-wrap, level-tag-wrap, level-wrap
- 외부 <g transform="translate(100, 100)"> 래퍼
- 내부 <svg width="600" height="300" viewBox="0 0 200 100"> 래퍼
- <style> 내 GitAnimals *{id} 패턴 키프레임 전체
```

### 2-b. 루트 SVG

`theme.json` 의 `viewBox` 와 반드시 일치:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-15 -25 45 45">
```

### 2-c. 그룹 구조 (z-order = 문서 순서)

```xml
<!-- 1. Shadow (맨 아래) -->
<g id="dfox-POSE-shadow" transform="translate(3, 9.5)">
  ... shadow rects ...
</g>

<!-- 2. obj: 함께 움직이는 것들 -->
<g id="dfox-POSE-obj">

  <!-- 다리 -->
  <g id="dfox-POSE-leg-left" transform="translate(5, 7.5)">...</g>
  <g id="dfox-POSE-leg-right" transform="translate(8, 7.5)">...</g>

  <!-- 몸통 (CSS 없으면 attr 그대로) -->
  <g transform="translate(-2, 4.5)">...</g>

  <!-- 머리: 위치/애니메이션 반드시 중첩 분리 -->
  <g transform="translate(0, -2.5)">          <!-- 바깥: 위치만, CSS 없음 -->
    <g id="dfox-POSE-head-nod">               <!-- 안쪽: delta 애니만 -->
      ...
      <!-- 눈은 반드시 마지막 (최고 z) -->
      <rect x="8" y="4" width="1" height="2" fill="black"/>
      <rect x="11" y="4" width="1" height="2" fill="black"/>
    </g>
  </g>

</g>

<!-- 3. 고정 소품 (obj 바깥 = 몸 움직임과 독립) -->
<g id="dfox-POSE-notebook" transform="translate(8, 4.5)">
  ... notebook rects ...
</g>
```

---

## Step 3 — 애니메이션 규칙

### 키프레임 prefix 필수

같은 DOM 에 여러 상태 SVG 공존 가능 → 이름 충돌 방지:

```
idle   → dfox-base-*
typing → dfox-typing-*
sleep  → dfox-sleep-*
```

### 위치와 delta 분리 (목 분리 현상 방지)

> ⚠️ **절대 규칙**: head 그룹에 `id` + `animation` 을 직접 달지 말 것. 앉은 포즈·서있는 포즈 구분 없이 **항상** 중첩 분리 필수.

```css
/* ❌ 위치 + delta 혼합 → 부위 분리 현상 */
@keyframes bad-head {
  0%  { transform: translate(0, -5px); }           /* 위치값 포함 */
  50% { transform: translate(2px, -6px) rotate(10deg); } /* 위치 변경! */
}
/* → CSS가 SVG attr을 덮어쓰므로 0%→50% 사이 머리 위치 자체가 이동 = 목 분리 */

/* ✅ 바깥 그룹에 위치(CSS 없음), 안쪽 그룹에 delta만 */
/* 바깥 <g transform="translate(0, -5)"> 는 CSS animation 없음 */
@keyframes good-head-nod {
  0%  { transform: translate(0, 0) rotate(0deg); }      /* delta = 0 */
  50% { transform: translate(2px, -1px) rotate(10deg); } /* delta만 */
}
```

올바른 SVG 구조:
```xml
<g transform="translate(0, -5)">        <!-- 위치: CSS 없음, attr만 -->
  <g id="dfox-STATE-head-nod">          <!-- delta만, 0% 는 반드시 translate(0,0) -->
    ...head content, eyes at end...
  </g>
</g>
```

### 표준 애니메이션 파라미터 (base 기준)

| 이름 | duration | easing | 설명 |
|------|----------|--------|------|
| shadow | 2s | ease-in-out | scaleX 1→1.2→1 |
| obj (hop) | 2s | ease-in-out | y 0→-2.5px→0 (앉으면 -1px) |
| leg sway | 1s | ease-in-out | ±10deg 회전 |
| head nod | 1s | ease-in-out | delta (2px,-1px) + 10deg |
| prop vibrate | 0.3s | ease-in-out | y ±0.2px (타이핑 진동) |

---

## Step 4 — 아이 트래킹 활성화 시 (선택)

`eyeTracking.enabled: true` + `states: ["idle"]` 일 때:

```xml
<!-- #shadow-js, #body-js, #eyes-js 에는 CSS transform 걸면 안 됨 (JS가 덮어씀) -->
<!-- 애니메이션은 반드시 자식 요소에 -->

<g id="shadow-js" style="transform-origin: 7.5px 14px">
  <g id="dfox-base-shadow-anim">...</g>  <!-- 애니메이션은 자식에 -->
</g>

<g id="body-js">
  <g id="dfox-base-obj-anim">            <!-- obj hop → 자식 그룹에 -->
    ...legs, body, head...
  </g>
</g>

<g id="eyes-js">
  <!-- 눈 rect 2개만. JS가 translate(dx, dy) 주입 -->
  <rect x="8" y="4" width="1" height="2" fill="black"/>
  <rect x="11" y="4" width="1" height="2" fill="black"/>
</g>
```

---

## Step 5 — theme.json 업데이트

```json
"states": {
  "idle":    ["idle-follow.svg"],
  "working": ["typing.svg"],      // 신규 포즈 연결
  ...
}
```

아직 없는 상태는 임시로 `idle-follow.svg` 로 유지 (validator 통과 목적).

---

## Step 6 — 검증 및 반복

```bash
node scripts/validate-theme.js themes/<name>
```

검증 후 사용자에게 렌더 확인 요청. 렌더 문제 발생 시:

| 증상 | 원인 | 처방 |
|------|------|------|
| 부위들이 분리되어 있음 | CSS 0% 값 미적용, SVG attr 사용 | `@keyframes 0%` 값 읽어 좌표 수정 |
| 특정 부위가 아래로 쏠림 | 포즈 좌표 세트 혼용 | 동일 포즈의 좌표 세트 통째로 교체 |
| 목/허리 분리 현상 | 위치+delta 혼합 애니메이션 | 중첩 그룹으로 위치/delta 분리 |
| 눈이 다른 픽셀에 묻힘 | z-order 문제 | 눈 rect를 head 그룹 끝으로 이동 |
| 소품이 몸과 같이 움직임 | obj 안에 소품 배치 | obj 그룹 바깥으로 이동 |
| 아이 트래킹 깜빡임 | `#eyes-js`에 CSS transform | 자식 그룹으로 애니메이션 내리기 |
| hitBox 클릭 안 됨 | hitBox y 가 캐릭터보다 아래 | Debug Hitbox 켜서 확인 후 y 올리기 (Step 11) |
| scaleX 시 캐릭터 튕김 | transform-origin 미설정 (기본 0,0 기준 flip) | CSS `transform-origin: 7.5px 7px` 캐릭터 중심 설정 |
| 1-shot 애니 후 상태 안 바뀜 | wakeDuration 미설정 | theme.json `timings.wakeDuration` 추가 |

---

## Step 7 — 기존 베이스에서 상태 파생 (프롭 추가)

GitAnimals SVG 없이 완성된 베이스 SVG (idle-follow / typing 등) 에서 새 상태를 파생할 때.

### 7-a. 레퍼런스 풀

`assets/svg/clawd-*.svg` 에 기존 Clawd 캐릭터(클로드)의 모든 상태 SVG가 있음.
새 상태를 만들기 전에 대응하는 레퍼런스를 읽어 프롭/애니메이션 패턴을 차용:

| 만들 상태 | 레퍼런스 파일 | 차용 포인트 |
|----------|------------|----------|
| thinking | `clawd-working-thinking.svg` | 말풍선 구조 + loading dots |
| notification | `clawd-notification.svg` | 느낌표 말풍선 + scale 펄스 |
| attention (happy) | `clawd-happy.svg` | 반짝임 sparkle 패턴 |
| error | `clawd-error.svg` | 빨간 ! + shake 애니메이션 |
| sleeping | `clawd-sleeping.svg` | Zzz 프롭 상승 패턴 |
| waking | `clawd-wake.svg` | 기지개 / 1-shot 애니메이션 구조 |

### 7-b. 말풍선 (bubble) 구조

```xml
<!-- 말풍선: obj 그룹 바깥에 배치 (몸 움직임과 독립) -->
<!-- CSS가 attr을 덮어쓰므로 0% keyframe 값 = 실제 위치 -->
<g id="dfox-STATE-bubble" transform="translate(14, -12)">
  <!-- 흰 배경: main rect + 상하 확장 rect (soft-rounded 픽셀아트) -->
  <g fill="white" fill-opacity="0.92">
    <rect x="1" y="0" width="7" height="6"/>   <!-- 중앙 블록 -->
    <rect x="0" y="1" width="9" height="4"/>   <!-- 좌우 확장 -->
    <!-- 꼬리 (아래 방향, 캐릭터 쪽) -->
    <rect x="1" y="6" width="3" height="1"/>
    <rect x="0" y="7" width="1" height="1"/>
  </g>
  <!-- 내용 (dots / 글리프) -->
</g>
```

**말풍선 bob 애니메이션** (obj 와 독립 — CSS 0% = 초기 위치):
```css
@keyframes dfox-STATE-bubble {
  0%   { transform: translate(14px, -12px); }
  50%  { transform: translate(14px, -12.3px); }
  100% { transform: translate(14px, -12px); }
}
```

### 7-c. Loading dots (sequential opacity)

```css
@keyframes dfox-STATE-dot-1 {
  0%, 20%   { opacity: 0; }
  21%, 100% { opacity: 1; }
}
@keyframes dfox-STATE-dot-2 {
  0%, 40%   { opacity: 0; }
  41%, 100% { opacity: 1; }
}
@keyframes dfox-STATE-dot-3 {
  0%, 60%   { opacity: 0; }
  61%, 100% { opacity: 1; }
}
```

초기 `opacity: 0` 을 CSS 규칙에도 명시해야 첫 프레임 깜빡임 없음:
```css
#dfox-STATE-d1 { opacity: 0; animation: dfox-STATE-dot-1 2s ease-in-out infinite; }
```

### 7-d. 눈 변형 룩업 테이블 (실전 검증 데이터)

> ⚠️ **중심 정렬 절대 규칙**: 눈 변형 시 **변형 도형의 기하학적 중심 = 원래 눈 중심**.
> 기본 fox 눈 중심: **왼쪽 (8.5, 5)** / **오른쪽 (11.5, 5)** (rect `x=8 y=4 w=1 h=2` / `x=11 y=4 w=1 h=2` 기준).
> X 눈처럼 회전 도형은 **rect 중심 = 회전 중심 = 눈 중심** 3개 일치 필수.

| 상태 | 구현 | 비고 |
|------|------|------|
| 기본 (normal) | `x=8 y=4 w=1 h=2` / `x=11 y=4 w=1 h=2` | 세로 rect |
| 감긴 (sleeping) | `x=7.6 y=4.6 w=1.8 h=0.8` / `x=10.6 y=4.6 w=1.8 h=0.8` | 두꺼운 대시 (─). 1×1 은 너무 얇아 안 보임 |
| 반눈 (waking) | `x=8 y=5 w=1 h=1` + `x=8 y=4 w=1 h=1 opacity=0.3` (양쪽) | 아래 절반만 진하게 |
| X 눈 (error) | **아래 X 눈 공식 참조** | rotated rect 2개/눈 |
| `^^` 반달 (happy) | **아래 `^^` 공식 참조** | 5-pixel arc/눈 |

#### ❌ 함정: `^^` 를 가로선 1개로 만들면 안 됨

`x=8 y=4 w=2 h=1` 같은 가로 막대는 `^^` 가 아닌 `ㅡㅡ` 로 보임. 실제로 `^^` 아치를 만들려면 5픽셀 호가 필요.

#### ✅ `^^` 공식 (5-pixel arc, overlap 연속 stroke)

각 눈 중심 (cx, cy) 기준으로:
```
스텝:   (cx-0.5, cy)       ← bottom-left
        (cx-0.25, cy-0.6)  ← upper-left
        (cx, cy-1)         ← peak
        (cx+0.25, cy-0.6)  ← upper-right
        (cx+0.5, cy)       ← bottom-right
각 rect: width=0.52 height=0.52 fill=black
```

왼쪽 눈(cx=8.5, cy=5) 예:
```xml
<rect x="8.0"  y="5.0" width="0.52" height="0.52" fill="black"/>
<rect x="8.25" y="4.4" width="0.52" height="0.52" fill="black"/>
<rect x="8.5"  y="4.0" width="0.52" height="0.52" fill="black"/>
<rect x="8.75" y="4.4" width="0.52" height="0.52" fill="black"/>
<rect x="9.0"  y="5.0" width="0.52" height="0.52" fill="black"/>
```
오른쪽 눈은 cx=11.5 로 +3 이동.

**overlap 원리**: 픽셀 크기(0.52) > 스텝 간격(0.25) → 0.27 겹침 → 연속 stroke 느낌.
- 크기 줄이면 (0.5): 분리되어 점 5개로 보임
- 크기 키우면 (0.65+): 너무 두꺼움

#### ✅ X 눈 공식 (rotated rect 2개/눈)

각 눈 중심 (cx, cy) 기준으로:
```
공통: rect w=0.5 h=2.4
    x = cx - 0.25 (= rect 중심이 cx)
    y = cy - 1.2  (= rect 중심이 cy)
    rotation 중심 = (cx, cy)
rect1: transform="rotate(45 cx cy)"
rect2: transform="rotate(-45 cx cy)"
```

왼쪽 X(cx=8.5, cy=5) 예:
```xml
<rect x="8.25" y="3.8" width="0.5" height="2.4" transform="rotate(45 8.5 5)"  fill="black"/>
<rect x="8.25" y="3.8" width="0.5" height="2.4" transform="rotate(-45 8.5 5)" fill="black"/>
```
높이 2.4 = 2×2 박스의 대각선 길이 √8.

### 7-e. 눈 상태 교대 (normal ↔ variant toggle)

`^^` 같은 변형 눈 **하나만** 보여주면 표정이 고정되어 어색함("찌질해 보임"). 일반 눈과 교대 전환하면 자연스러운 표정 변화.

```xml
<g id="dfox-STATE-eyes-n">   <!-- 일반 눈 -->
  <rect x="8"  y="4" width="1" height="2" fill="black"/>
  <rect x="11" y="4" width="1" height="2" fill="black"/>
</g>
<g id="dfox-STATE-eyes-a" opacity="0">  <!-- 변형 눈, 초기 숨김 -->
  ...^^ arc 또는 X...
</g>
```

```css
@keyframes dfox-STATE-eyes-normal {
  0%, 20%    { opacity: 1; }
  25%        { opacity: 0; }
  65%        { opacity: 0; }
  70%, 100%  { opacity: 1; }
}
@keyframes dfox-STATE-eyes-variant {
  0%, 20%    { opacity: 0; }
  25%        { opacity: 1; }
  65%        { opacity: 1; }
  70%, 100%  { opacity: 0; }
}
#dfox-STATE-eyes-n { animation: dfox-STATE-eyes-normal 1.5s steps(1, end) infinite; }
#dfox-STATE-eyes-a { animation: dfox-STATE-eyes-variant 1.5s steps(1, end) infinite; }
```

> `steps(1, end)` 사용 — 픽셀아트는 순간 전환이 더 자연스러움 (보간 없음).

### 7-f. 파생 워크플로우

1. 기존 완성 베이스 SVG 를 복사해 새 파일로 시작
2. `dfox-BASE-*` → `dfox-STATE-*` 전체 rename (keyframe 이름 + id)
3. 눈 변형 필요 시 head 그룹 끝에 원본 눈 제거하고 공식대로 재작성
   - 교대 전환 쓰는 경우 일반+변형 두 그룹 모두 유지
4. 프롭 그룹 추가 (`obj` 바깥, SVG 문서 끝)
5. 프롭 애니메이션 keyframe 추가 (CSS 0% = 실제 위치)
6. obj/shadow 애니 필요 시 Step 8 카탈로그 참조
7. validator → 시각 검수 → 반복

---

## Step 8 — 몸 / 그림자 애니메이션 카탈로그

상태별 몸·그림자 애니는 감정 톤을 가장 크게 좌우. 검증된 타임라인:

### 8-a. 숨쉬기 bob (idle / thinking, 2s)

```css
@keyframes dfox-STATE-obj {
  0%, 30%, 100% { transform: translate(0, 0); }
  15%           { transform: translate(0, -2.5px); }
}
@keyframes dfox-STATE-shadow {
  0%, 30%, 100% { transform: translate(3px, 7px) scaleX(1); }
  15%           { transform: translate(3px, 7px) scaleX(1.2); }
}
```

### 8-b. 큰 점프 + squash (happy, 1.5s)

```css
@keyframes dfox-STATE-obj {
  0%, 15%, 100% { transform: translate(0, 0) scaleY(1); }
  20%  { transform: translate(0, 0) scaleY(0.9); }     /* squash 준비 */
  40%  { transform: translate(0, -10px) scaleY(1.05); }/* 공중 stretch */
  50%  { transform: translate(0, -12px) scaleY(1); }   /* 피크 */
  60%  { transform: translate(0, -10px) scaleY(1.05); }/* 낙하 */
  80%  { transform: translate(0, 0) scaleY(0.9); }     /* 착지 squash */
  85%  { transform: translate(0, 0) scaleY(1); }       /* 복귀 */
}
@keyframes dfox-STATE-shadow {
  0%, 15%, 100% { transform: translate(3px, 7px) scaleX(1);    opacity: 0.8; }
  20%  { transform: translate(3px, 7px) scaleX(1.1);  opacity: 0.9; }
  40%  { transform: translate(3px, 7px) scaleX(0.55); opacity: 0.25; }
  50%  { transform: translate(3px, 7px) scaleX(0.5);  opacity: 0.2; }
  60%  { transform: translate(3px, 7px) scaleX(0.55); opacity: 0.25; }
  80%  { transform: translate(3px, 7px) scaleX(1.1);  opacity: 0.9; }
  85%  { transform: translate(3px, 7px) scaleX(1);    opacity: 0.8; }
}
```

### 8-c. 깜짝 점프 + 감쇠 바운스 (notification, 3.5s)

```css
@keyframes dfox-STATE-obj {
  0%          { transform: translate(0, 0); }
  10%         { transform: translate(0, 1px); }
  20%         { transform: translate(0, -9px); }   /* 첫 점프 (큰) */
  28%         { transform: translate(0, 1.5px); }
  35%         { transform: translate(0, -5px); }   /* 두 번째 */
  42%         { transform: translate(0, 1px); }
  48%         { transform: translate(0, -2px); }   /* 세 번째 (작음) */
  53%         { transform: translate(0, 0); }
  /* 후반부: 정상 idle bob */
  72%         { transform: translate(0, -2.5px); }
  80%, 100%   { transform: translate(0, 0); }
}
```
Shadow 는 공중(20%, 35%)에서 scaleX 축소, 착지(28%, 42%)에서 확장.

### 8-d. 좌우 shake + 감쇠 (error, 3s)

```css
@keyframes dfox-STATE-obj {
  0%        { transform: translate(0, 0); }
  7%        { transform: translate(-1.5px, 0); }  /* 강한 좌 */
  14%       { transform: translate(1.5px, 0); }   /* 강한 우 */
  21%       { transform: translate(-1.5px, 0); }
  28%       { transform: translate(1.5px, 0); }
  35%       { transform: translate(-1px, 0); }    /* 감쇠 */
  42%       { transform: translate(1px, 0); }
  49%       { transform: translate(-0.5px, 0); }
  56%       { transform: translate(0.5px, 0); }
  63%, 100% { transform: translate(0, 0); }       /* 정지 */
}
```

> ⚠️ **shadow x 역방향 동기화 필수**: obj 가 `-1.5px` 이동하면 shadow x 값도 같은 만큼 변경되어야 발 밑에 붙어 있어 보임.
```css
@keyframes dfox-STATE-shadow {
  0%  { transform: translate(3px, 7px) scaleX(1); }   /* 정위치 */
  7%  { transform: translate(1.5px, 7px) scaleX(1); } /* obj -1.5 → shadow 3-1.5=1.5 */
  14% { transform: translate(4.5px, 7px) scaleX(1); } /* obj +1.5 → shadow 3+1.5=4.5 */
  ...
}
```

### 8-e. 좌우 걸음 + 제자리 flip (waking, 1-shot)

> ⚠️ 픽셀아트에서 scaleY stretch/squash 같은 복잡한 변형은 깨지기 쉬움. 단순 translate 이동 + scaleX flip 이 가장 안전.

**1-shot 설정**:
```css
#dfox-wake-obj {
  transform-origin: 7.5px 7px;  /* ⚠️ 반드시 CSS 로 (SVG attr 은 CSS animation 이 무시) */
  animation: dfox-wake-obj 5s ease-in-out forwards 1;
}
```
- `iteration-count: 1` + `fill-mode: forwards` → 한 번 재생 후 최종 프레임 유지
- `theme.json` 에 `timings.wakeDuration: 5000` 설정 (상태 유지 시간 = 애니 duration)

**scaleX squeeze-through-zero** (자연스러운 2D 턴):
```css
@keyframes dfox-wake-obj {
  0%, 4%     { transform: translate(0, 0)     scaleX(1); }    /* 중앙 정지 */
  42%        { transform: translate(3px, 0)   scaleX(1); }    /* 우측으로 걸음 */
  /* 제자리 turn — x 고정, scaleX 만 0 통과 */
  44%        { transform: translate(3px, 0)   scaleX(0.3); }
  47%        { transform: translate(3px, 0)   scaleX(0); }    /* 세로선 (턴 순간) */
  48%        { transform: translate(3px, 0)   scaleX(-0.3); }
  50%        { transform: translate(3px, 0)   scaleX(-1); }   /* 반대 방향 */
  82%        { transform: translate(-3px, 0)  scaleX(-1); }   /* 좌측으로 걸음 */
  /* 다시 제자리 turn */
  84%        { transform: translate(-3px, 0)  scaleX(-0.3); }
  87%        { transform: translate(-3px, 0)  scaleX(0); }
  88%        { transform: translate(-3px, 0)  scaleX(1); }
  100%       { transform: translate(0, 0)     scaleX(1); }    /* 중앙 복귀 */
}
```

핵심: **flip 구간에서 translate x 는 고정** → "이동 중 튕기기" 없이 제자리에서 도는 것처럼 보임.

**다리/머리: 걸음 구간에만 sway, 중앙 정지 시 static**:
```css
/* 1-shot forwards — 시작/끝 정지, 걸음 구간만 sway */
@keyframes dfox-wake-leg-left {
  0%, 4%     { transform: translate(5px, 5px); }
  10%        { transform: translate(5px, 5px) rotate(10deg); }  /* sway 1 */
  17%        { transform: translate(5px, 5px); }
  /* ...walk 구간 반복... */
  82%, 100%  { transform: translate(5px, 5px); }               /* 정지 */
}
```

**눈 전환 (open → closed → open)**:
```css
/* 걸음 중 감김, 중앙 정지 시 뜸 */
@keyframes dfox-wake-eyes-closed {
  0%, 15% { opacity: 0; } 20%, 80% { opacity: 1; } 85%, 100% { opacity: 0; }
}
@keyframes dfox-wake-eyes-open {
  0%, 15% { opacity: 1; } 20%, 80% { opacity: 0; } 85%, 100% { opacity: 1; }
}
```

---

## Step 9 — 프롭 애니메이션 카탈로그

### 9-a. 팝인 (notification `!`, carrying 아이템 등)

```css
@keyframes dfox-STATE-prop {
  0%    { transform: translate(Xpx, Ypx) scale(0);   opacity: 0; }
  8%    { transform: translate(Xpx, Ypx) scale(1.3); opacity: 1; }  /* 과장 팝 */
  14%   { transform: translate(Xpx, Ypx) scale(1);   opacity: 1; }  /* 정착 */
  65%   { transform: translate(Xpx, Ypx) scale(1);   opacity: 1; }  /* 유지 */
  75%   { transform: translate(Xpx, Ypx) scale(0.7); opacity: 0; }  /* 페이드 */
  100%  { transform: translate(Xpx, Ypx) scale(0);   opacity: 0; }  /* 대기 */
}
```

### 9-b. 깜빡임 (error `!`, 경고 사인)

```css
@keyframes dfox-STATE-flash {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.15; }
}
/* 0.8s 사이클 권장 — 너무 빠르면 피로감, 너무 느리면 emergency 느낌 약함 */
```

### 9-c. 반짝임 (happy sparkles)

`<defs>` 재사용 + `<use>` 로 여러 위치 배치 + CSS 변수로 개별 delay:

```xml
<defs>
  <g id="STATE-px-sparkle">
    <rect class="STATE-spark-c" x="-0.5" y="-0.5" width="1" height="1"/>
    <g class="STATE-spark-o">
      <rect x="-0.5" y="-1.5" width="1" height="1"/>
      <rect x="-0.5" y="0.5"  width="1" height="1"/>
      <rect x="-1.5" y="-0.5" width="1" height="1"/>
      <rect x="0.5"  y="-0.5" width="1" height="1"/>
    </g>
  </g>
</defs>

<use href="#STATE-px-sparkle" x="-4" y="-10" fill="#FFD700" style="--d: 0.0s"/>
<use href="#STATE-px-sparkle" x="19" y="-8"  fill="#FFA000" style="--d: 0.3s"/>
<!-- ...개당 0.3s 스태거 -->
```
```css
@keyframes STATE-spark-center {
  0% { opacity: 0; } 10% { opacity: 1; } 30% { opacity: 0; } 100% { opacity: 0; }
}
@keyframes STATE-spark-outer {
  0% { opacity: 0; } 20% { opacity: 1; } 40% { opacity: 0; } 100% { opacity: 0; }
}
.STATE-spark-c { opacity: 0; animation: STATE-spark-center 1.5s infinite step-end; animation-delay: var(--d, 0s); }
.STATE-spark-o { opacity: 0; animation: STATE-spark-outer  1.5s infinite step-end; animation-delay: var(--d, 0s); }
```
타임라인: center 점 먼저 → outer 십자 추가 (별 완성) → 전체 소멸.

---

## Step 10 — 감정별 다리 속도 가이드

다리 애니메이션 duration 만 바꿔도 감정 톤이 크게 달라짐:

| Duration | 상태 예시 | 톤 |
|----------|---------|---|
| 1.0s | idle / thinking | 차분, 편안 |
| 0.8s | happy / attention | 활기, 기분 좋음 |
| 0.6s | error | 스트레스, 불안정 |
| 0.5s | notification | 놀람, 당황 (종종거림) |
| 0s (정지) | sleeping / typing | 휴식 |

---

## Step 11 — hitBox 설정 및 디버깅

### hitBox 좌표 이해

hitBox 는 **viewBox 좌표계** 로 정의 (스크린 픽셀 아님):
```json
"hitBoxes": {
  "default":  { "x": -3, "y": -8, "w": 22, "h": 20 },
  "sleeping": { "x": -3, "y": -5, "w": 22, "h": 18 }
}
```

`hit-geometry.js` 의 `getHitRectScreen()` 가 viewBox → 스크린 변환:
```
top  = artRect.y + (hitBox.y - viewBox.y) * (artRect.h / viewBox.height)
left = artRect.x + (hitBox.x - viewBox.x) * (artRect.w / viewBox.width)
```

> ⚠️ **normalized layout 함정**: `contentBox` + `visibleHeightRatio` 를 쓰는 테마는 artRect 이 윈도우보다 **훨씬 크게** 스케일됨 (예: 1.45 × 윈도우 높이). 이 때문에 hitBox y 값이 직관과 다르게 배치될 수 있음. 반드시 디버그 모드로 시각 확인.

### 디버그 모드 사용법

1. `.env` 에 `GITANIMALS_DEBUG=1` 설정 (launch.js 가 process.env 에 주입)
2. 앱 시작 → 우클릭 → **Debug** 서브메뉴 → **Show Hitbox** 체크
3. 시각 확인:
   - **빨간 반투명** = hitWin (실제 클릭 영역)
   - **파란 반투명 배경** = 이미지 렌더 영역 (SVG object/img 경계)
4. 상태 변경 (sleeping, waking 등) 시 hitBox 크기/위치 변화 확인
5. `GITANIMALS_DEBUG` 미설정 시 Debug 메뉴 자체가 노출되지 않음

### hitBox 설정 가이드

1. **캐릭터 실제 범위 측정**: SVG 에서 가장 위(귀 끝)~아래(다리/그림자) 의 y 좌표, 가장 왼쪽~오른쪽 x 좌표 확인
2. **여유 마진 추가**: 귀 위 2~3px, 다리 아래 2~3px 여유
3. **sleeping 전용 hitBox**: 앉은/누운 포즈는 서있을 때와 범위가 다름 → `sleepingHitboxFiles` 에 해당 SVG 등록 필수
4. **디버그로 확인**: Show Hitbox 켜고 빨간 영역이 캐릭터를 충분히 감싸는지 검증
5. **반복 조정**: hitBox 값 변경 → 앱 재시작 → 시각 확인 (hot-reload 안 됨)

### 자주 하는 실수

| 실수 | 결과 | 해결 |
|------|------|------|
| hitBox y 를 양수로만 설정 | 머리/귀 클릭 불가 | 캐릭터 최상단 y 에 마진 더해 설정 |
| sleeping hitBox 미설정 | sleeping 시 클릭 불가 | `hitBoxes.sleeping` + `sleepingHitboxFiles` 추가 |
| normalized layout 무시 | 스크린에서 hitBox 위치 예측 실패 | 반드시 Debug Hitbox 로 시각 확인 |
