#!/bin/bash
# Run poker session test on BOTH iOS and Android
#
# Prerequisites:
#   - iOS Simulator booted
#   - Android emulator running
#   - Appium server running: appium --allow-insecure=uiautomator2:adb_shell
#   - Demo casino app installed on both
#   - YOLO detector running on localhost:8001

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT/apps/orchestrator"

echo "========================================"
echo "  Poker Session Test - iOS & Android"
echo "========================================"
echo ""

# iOS Test
echo "=== iOS Test ==="
echo ""
pnpm run dev \
  --spec "$PROJECT_ROOT/specs/poker_session.feature" \
  --platform flutter \
  --device ios \
  --real \
  --vgs \
  --timeout 60000 \
  --outDir ./out/ios || true

echo ""
echo ""

# Android Test
echo "=== Android Test ==="
echo ""
pnpm run dev \
  --spec "$PROJECT_ROOT/specs/poker_session.feature" \
  --platform flutter \
  --device android \
  --real \
  --vgs \
  --timeout 60000 \
  --outDir ./out/android || true

echo ""
echo "========================================"
echo "  Results"
echo "========================================"
echo ""
echo "iOS:     $PROJECT_ROOT/apps/orchestrator/out/ios/report.html"
echo "Android: $PROJECT_ROOT/apps/orchestrator/out/android/report.html"
