#!/bin/bash
# Run poker session test on iOS Simulator
#
# Prerequisites:
#   - iOS Simulator booted
#   - Appium server running: appium
#   - Demo casino app installed
#   - YOLO detector running on localhost:8001

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT/apps/orchestrator"

echo "========================================"
echo "  Poker Session Test - iOS"
echo "========================================"
echo ""

pnpm run dev \
  --spec "$PROJECT_ROOT/specs/poker_session.feature" \
  --platform flutter \
  --device ios \
  --real \
  --vgs \
  --timeout 60000

echo ""
echo "Results saved to: $PROJECT_ROOT/apps/orchestrator/out"
echo "  - report.html (visual report)"
echo "  - run.json (raw results)"
echo "  - junit.xml (CI report)"
