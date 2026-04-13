---
name: port-gitanimals-svg
description: >
  Use when porting GitAnimals-style character SVGs (templates with *{id}, *{act}, *{contribution}
  placeholders) to Clawd theme asset files. Covers coordinate extraction from CSS keyframes,
  nested animation groups, z-order, keyframe prefix, viewBox alignment, and Clawd eye-tracking
  conventions. Invoke whenever the user provides a reference .svg file and asks you to create
  or update a Clawd theme pose.
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
| 감긴 (sleeping) | `x=8 y=5 w=1 h=1` / `x=11 y=5 w=1 h=1` | 가로선 1px (─) |
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
