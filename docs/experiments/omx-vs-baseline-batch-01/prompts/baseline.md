# Baseline 변종 — 작업 지시문

> 이 지시문은 OMX/OMC/superpowers 워크플로 *없이* 같은 task batch를 수행하기 위한 것. 비교 대상은 `with-omx.md` 변종.

## 사용 방법

1. 새 Claude/Codex 세션을 시작 (다른 세션의 컨텍스트를 가져오지 않음).
2. 작업 디렉토리: `.worktrees/exp/omx-vs-baseline-batch-01-baseline`
3. 활성 브랜치: `exp/omx-vs-baseline-batch-01-baseline` (이미 worktree 생성 시 체크아웃됨).
4. **다음 행동 규칙을 엄격히 지킬 것:**
   - OMC/superpowers/codex/OMX 관련 어떤 skill 도 invoke 하지 않을 것
   - brainstorming, TDD, systematic-debugging 같은 메타 워크플로 skill 사용 금지
   - 외부 sub-agent dispatch, 멀티 에이전트 워크플로 금지
   - 그냥 평범하게 코드를 읽고 작성하고 테스트 돌리는 방식만 사용
5. KPI 캡처를 위해 세션 시작 시각, 종료 시각, 본인이 인지하는 turn 수, tool call 수를 메모할 것 (Claude 의 경우 토큰 사용량은 세션 종료 시 UI 에서 확인 가능).

## 수행할 작업

`docs/experiments/omx-vs-baseline-batch-01/task-manifest.json` 의 `task_batch` 4 개를 모두 완료:

1. **settings-react-001** — settings 패널 React 마이그레이션 경계 정의
   - `src/settings/settings.html`, `src/settings/renderer.js`, `src/preload/settings-bridge.ts` 가 주요 마이그레이션 앵커
   - 두 변종에서 같은 마이그레이션 범위 + 멈춤 조건 유지
   - 무관한 settings 아키텍처 변경 끼워넣지 않을 것
2. **settings-react-002** — 구현 전에 acceptance 테스트 추가 또는 강화
   - 이미 `test/settings/renderer-migration.test.js` 가 TDD 게이트로 존재 (이 변종 시작 시점 2/3 실패)
   - 필요하다면 추가 task-specific 테스트 도입
   - 기존 settings + preload bridge 테스트는 보존
3. **settings-react-003** — renderer 를 React-managed JSX 또는 TSX 로 전환
   - 한 덩어리 ad hoc 스크립트 → React 컴포넌트 기반
   - 4 개 탭 (general / agents / theme / about) 동작 보존
   - `src/settings/settings.html` 은 그대로 사용
4. **settings-react-004** — 동작 파리티 확인 + 검증
   - 기존 settings IPC 흐름 (`window.settingsAPI`) 동작
   - settings bridge 회귀 없음
   - 검증 결과를 결과 JSON 에 기록

## 멈춤 조건

- 4 개 task 모두 완료, 또는
- 90 분 (wall clock) 경과, 또는
- 동일 verification 명령이 3 회 연속 같은 실패 (진척 불가 판정)

## 검증 명령 (양 변종 동일)

```bash
node --test test/experiments/*.test.js
node --test test/settings/*.test.js test/preload/settings-bridge.test.js test/settings/renderer-migration.test.js
npm run typecheck
```

## 결과 기록

세션 종료 시 (또는 다음 세션에서) 다음 명령으로 KPI 채우기:

```bash
npm run experiments:collect-kpi -- \
  --result docs/experiments/omx-vs-baseline-batch-01/results/baseline.json \
  --base-ref exp/omx-vs-baseline-batch-01-harness \
  --token-source manual \
  --tasks-total 4 \
  --tasks-succeeded <0..4> \
  --tests-passed <N> \
  --tests-total <N> \
  --wall-clock-minutes <분> \
  --turn-count <N> \
  --tool-call-count <N> \
  --input-tokens <N> \
  --output-tokens <N> \
  --verification-command "node --test test/experiments/*.test.js" \
  --verification-command "node --test test/settings/*.test.js test/preload/settings-bridge.test.js test/settings/renderer-migration.test.js" \
  --verification-command "npm run typecheck"
```

토큰 수가 명확하지 않으면 `--token-source manual` + null 유지 (날조 금지).

## 마무리 (별도 단계)

1. `git add` + `git commit` (커밋 메시지 자유, 변경 이력 한눈에 보이게)
2. `git push -u origin exp/omx-vs-baseline-batch-01-baseline`
3. `gh pr create --base main` 으로 PR 생성. PR 본문에는:
   - 어떤 task 가 완료/실패했는지
   - results/baseline.json 의 KPI 요약
   - acceptance 게이트 통과 여부
   - 알려진 한계 및 qualitative_notes
4. 본 PR 과 with-omx PR 의 KPI 를 `docs/experiments/omx-vs-baseline-batch-01/results/pr-summary.md` 에 통합

## 절대 하지 말 것

- 이 변종에서는 `with-omx` worktree 의 결과를 보거나 참고하지 말 것
- OMX/OMC/superpowers skill 호출 금지 (테스트 결과를 봤다고 의심받을 행동 금지)
- 답을 알고 있는 `.worktrees/.../with-omx`, `exp/settings-tsx-migration` 브랜치 참조 금지
