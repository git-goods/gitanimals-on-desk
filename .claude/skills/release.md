---
name: release
description: >
  Use when the user wants to release, publish, deploy, cut a tag, or bump the version
  of Clawd / gitanimals-on-desk. Triggers: "릴리즈", "배포", "새 버전", "릴리스", "버전 올려",
  "태그 찍어", /release. Analyzes commits since the last tag, recommends patch/minor/major
  via conventional commits, handles package.json ↔ git-tag version drift, and executes
  `npm version` + `git push --follow-tags` with user confirmation at each step.
---

# Clawd 릴리즈 스킬

## 이 스킬을 쓰는 상황

- 사용자가 "릴리즈해줘", "배포 한 번 찍어줄래", "새 버전 내고 싶어" 같은 말을 할 때
- `/release` 슬래시 커맨드를 호출했을 때
- 선택적으로 힌트(`patch` / `minor` / `major` / `0.6.0`)를 인자로 받을 수 있음

---

## Step 1 — 사전 점검

다음 3가지를 **순서대로** Bash로 확인한다. 어느 하나라도 실패하면 작업을 중단하고 사용자에게 안내한다.

```bash
# 1-a. 브랜치 확인
git rev-parse --abbrev-ref HEAD
```
`main` 이 아니면: "현재 브랜치가 `<branch>`입니다. `main`에서 릴리즈하는 것이 원칙입니다. 계속할까요?"라고 물어본다.

```bash
# 1-b. 워킹 트리 청결도
git status --porcelain
```
출력이 있으면: "커밋되지 않은 변경사항이 있습니다. 먼저 커밋하거나 스태시하세요." 안내 후 중단.

```bash
# 1-c. 원격과 동기화 여부
git fetch origin main --quiet && git status -sb
```
`behind` 가 포함되어 있으면: "`origin/main`보다 뒤처져 있습니다. `git pull` 후 다시 시도하세요." 안내 후 중단.

---

## Step 2 — 버전 드리프트 계산

```bash
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
PKG_VER=$(node -p "require('./package.json').version")
echo "최신 태그: $LAST_TAG | package.json: $PKG_VER"
```

두 값이 다르면 사용자에게 다음과 같이 고지한다:

> `package.json`은 `0.0.3`이지만 최신 태그는 `v0.5.10`입니다.
> 별도 동기화 커밋 없이, 다음 버전을 **명시적 버전 문자열**로 직접 bump합니다.

내부적으로 bump 계산의 기준을 `package.json.version` 이 아닌 **`LAST_TAG`** 로 설정한다.

---

## Step 3 — 커밋 분석 & 추천

```bash
git log ${LAST_TAG}..HEAD --pretty=format:"%s"
```

커밋 메시지를 수집해 분류한다:

| 패턴 | 분류 |
|---|---|
| `!:` 또는 `BREAKING CHANGE` 포함 | **major** |
| `feat` 으로 시작 | **minor** |
| `fix` / `refactor` / `perf` / `chore` / `docs` / `test` | **patch** |

결과를 다음 형식으로 표시한다:

```
v0.5.10 이후 N개 커밋
feat: X개 / fix: X개 / refactor: X개 / chore: X개 / docs: X개 / 기타: X개
→ 추천: patch (v0.5.11)
```

사용자가 힌트를 인자로 넘겼다면 그것을 우선한다 (추천보다 명시 인자가 높은 우선순위).

---

## Step 4 — 사용자 버전 선택 (AskUserQuestion)

`LAST_TAG`를 파싱해 각 후보 버전을 계산한 뒤 AskUserQuestion으로 묻는다:

```
어떤 버전으로 릴리즈할까요?

1. patch → v0.5.11  (추천 — fix/chore 커밋만 있음)
2. minor → v0.6.0
3. major → v1.0.0
4. 커스텀 (직접 입력)
```

커스텀 선택 시 사용자가 타이핑한 버전 문자열을 그대로 사용한다 (예: `0.6.1-beta.1`).

---

## Step 5 — npm version 실행

선택된 버전이 예: `0.5.11` 이면:

```bash
npm version 0.5.11 -m "chore(release): %s"
```

이 명령은 자동으로:
- `package.json` + `package-lock.json` 버전 업데이트
- `"chore(release): 0.5.11"` 커밋 생성
- `v0.5.11` annotated 태그 생성

실행 후 결과를 보여준다:
```bash
git log -1 --oneline
git tag --points-at HEAD
```

---

## Step 6 — 푸시 확인 후 실행

사용자에게 확인:

> 위 커밋과 태그 `v0.5.11`을 `origin/main`에 push하면 **GitHub Actions 빌드가 자동으로 시작**됩니다.
> Windows / macOS / Linux 세 플랫폼 빌드 완료 후 GitHub Releases에 자산이 올라갑니다.
> 계속할까요?

승인하면:

```bash
git push origin main --follow-tags
```

---

## Step 7 — 후처리 안내

push 성공 후:

- Actions 모니터링 링크: `https://github.com/git-goods/gitanimals-on-desk/actions`
- 빌드 완료(보통 15~20분 후) 확인: `https://github.com/git-goods/gitanimals-on-desk/releases`

**실패 시 롤백:**

```bash
# 태그만 취소
git push origin :v0.5.11 && git tag -d v0.5.11

# bump 커밋까지 되돌릴 때 (로컬 only)
git reset --hard HEAD~1
```

자세한 릴리즈 & 서명 정책: [`docs/release-and-signing.md`](../docs/release-and-signing.md)
