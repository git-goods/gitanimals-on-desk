#!/bin/bash
# Clawd 动画全播放测试脚本
# 用法: bash test-demo.sh [每个动画秒数，默认8]

DELAY=${1:-8}

SVGS=(
  "gitanimals-idle-living.svg"
  "gitanimals-sleeping.svg"
  "gitanimals-working-thinking.svg"
  "gitanimals-working-typing.svg"
  "gitanimals-working-juggling.svg"
  "gitanimals-working-sweeping.svg"
  "gitanimals-working-building.svg"
  "gitanimals-working-debugger.svg"
  "gitanimals-working-wizard.svg"
  "gitanimals-working-carrying.svg"
  "gitanimals-working-conducting.svg"
  "gitanimals-working-confused.svg"
  "gitanimals-working-overheated.svg"
  "gitanimals-error.svg"
  "gitanimals-working-ultrathink.svg"
  "gitanimals-happy.svg"
  "gitanimals-notification.svg"
  "clawd-disconnected.svg"
)

echo "=== Clawd Demo: ${#SVGS[@]} animations, ${DELAY}s each ==="
for i in "${!SVGS[@]}"; do
  svg="${SVGS[$i]}"
  echo "[$((i+1))/${#SVGS[@]}] $svg"
  curl -s -X POST http://127.0.0.1:23333/state \
    -H "Content-Type: application/json" \
    -d "{\"state\":\"working\",\"svg\":\"$svg\"}"
  sleep "$DELAY"
done
echo "=== DONE ==="
