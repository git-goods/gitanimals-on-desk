# With-OMX 변종 — 작업 지시문

> 이 지시문은 OMX/OMC/superpowers 워크플로 *활성화* 상태에서 같은 task batch 를 수행하기 위한 것. 비교 대상은 `baseline.md` 변종.

## 사용 방법

1. 새 Claude 세션을 시작 (다른 세션의 컨텍스트를 가져오지 않음).
2. 작업 디렉토리: `.worktrees/exp/omx-vs-baseline-batch-01-with-omx`
3. 활성 브랜치: `exp/omx-vs-baseline-batch-01-with-omx` (이미 worktree 생성 시 체크아웃됨).
4. **OMX 활성화 규칙:**
   - 시작 시 `superpowers:using-superpowers` 가 자동 로드되도록 그대로 둘 것
   - 적용 가능한 OMC/superpowers skill 을 적극 호출:
     - `superpowers:brainstorming` (구현 시작 전 의도/요구사항 정리)
     - `superpowers:test-driven-development` (acceptance 게이트 + 단위 테스트)
     - `superpowers:writing-plans` (계획 문서)
     - `superpowers:systematic-debugging` (실패 디버깅)
     - `superpowers:verification-before-completion` (완료 주장 전 증거)
   - `.codex/skills/omx-pr-benchmark/SKILL.md` 의 워크플로 + KPI 캡처 규칙 준수
   - 필요 시 `subagent-driven-development`, `dispatching-parallel-agents` 등 메타 워크플로 활용
5. KPI 캡처를 위해 세션 시작 시각, 종료 시각, turn 수, tool call 수, 토큰 사용량을 메모.

## 수행할 작업

`docs/experiments/omx-vs-baseline-batch-01/task-manifest.json` 의 `task_batch` 4 개 — baseline 과 **완전히 동일**:

1. settings-react-001 — settings 패널 React 마이그레이션 경계 정의
2. settings-react-002 — 구현 전 acceptance 테스트 추가/강화
3. settings-react-003 — renderer 를 React JSX 또는 TSX 로 전환
4. settings-react-004 — 동작 파리티 확인 + 검증

상세 acceptance criteria 는 `docs/experiments/omx-vs-baseline-batch-01/acceptance-checklist.md` 와 `task-manifest.json` 그대로.

## 멈춤 조건 (baseline 과 동일)

- 4 개 task 모두 완료, 또는
- 90 분 (wall clock) 경과, 또는
- 동일 verification 명령이 3 회 연속 같은 실패

## 검증 명령 (양 변종 동일)

```bash
node --test test/experiments/*.test.js
node --test test/settings/*.test.js test/preload/settings-bridge.test.js test/settings/renderer-migration.test.js
npm run typecheck
```

## 결과 기록

```bash
npm run experiments:collect-kpi -- \
  --result docs/experiments/omx-vs-baseline-batch-01/results/with-omx.json \
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

1. `git add` + `git commit` (메시지에 OMX 워크플로 사용 사실 명시)
2. `git push -u origin exp/omx-vs-baseline-batch-01-with-omx`
3. `gh pr create --base main` 으로 PR 생성. PR 본문에 baseline 변종 PR 과 함께:
   - 어떤 OMX/OMC skill 을 어느 시점에 호출했는지
   - 각 skill 호출이 어떤 결정/품질에 기여했다고 판단하는지 (qualitative)
   - KPI 수치 + acceptance 게이트 통과 여부
4. `docs/experiments/omx-vs-baseline-batch-01/results/pr-summary.md` 에 baseline vs with-omx 비교 표 작성:
   - tasks_succeeded / 4
   - tests_passed / tests_total
   - wall_clock_minutes
   - turn_count, tool_call_count
   - input/output/total tokens
   - 파생: success_rate, test_pass_rate, token_per_success, time_per_success

## 절대 하지 말 것

- 이 변종에서 `baseline` worktree 의 결과를 보지 말 것
- 답을 알고 있는 `exp/settings-tsx-migration` 브랜치를 *복사* 하지 말 것 (참고 영감 정도는 가능하나, 직접 cherry-pick 은 OMX 워크플로 평가가 아니라 단순 cp 가 됨 — 그럴 거면 변종 의미 없음)

## 공정성 메모

- 모델/리즈닝 설정은 baseline 과 같아야 함 (Opus 4.7 권장)
- 같은 time budget (90 분)
- 같은 verification 명령
- 한 변종에서 발견된 acceptance 테스트 수정은 두 변종에 동일하게 반영 (혹은 모두 미반영) — 게이트 비대칭 금지
