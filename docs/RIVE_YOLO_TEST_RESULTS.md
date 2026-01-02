# Rive Button YOLO Test Results

**Test Date:** January 1, 2026
**Status:** iOS ✅ PASSED | Android ✅ PASSED

---

## Overview

This document describes automated testing of Rive button clicking using YOLO detection in a Flutter poker game app. YOLO detects button types (CALL, RAISE, FOLD, etc.), which are then mapped to calibrated clickable coordinates.

### Key Insight

YOLO visual coordinates don't match clickable positions. The solution is to use YOLO for button **type detection only**, then map to pre-calibrated tap coordinates.

---

## Quick Start

### Prerequisites

- YOLO detector running on `http://localhost:8001`
- Appium server running on `http://127.0.0.1:4723`
- Demo casino app installed on device/simulator

### Run Tests

```bash
# iOS (start Simulator first)
open -a Simulator
appium
npx tsx scripts/test_poker_game.ts --platform=ios --rounds=5

# Android (start Emulator first, use special Appium flag)
emulator -avd <avd_name>
appium --allow-insecure=uiautomator2:adb_shell
npx tsx scripts/test_poker_game.ts --platform=android --rounds=5
```

### Command Line Options

| Option | Default | Description |
|--------|---------|-------------|
| `--platform=` | `ios` | Platform: `ios` or `android` |
| `--rounds=` | `5` | Number of lobby→poker→lobby cycles |
| `--actions=` | `5` | Max actions per hand |

---

## Test Flow

1. **Casino Lobby → Poker Table**: Click "PLAY POKER" button
2. **Start Game**: Click DEAL button
3. **Play Hands**: YOLO detects buttons → map to clickable coords → tap
4. **Wait for Hand End**: Detect "DEAL AGAIN" button, click to continue
5. **Return to Lobby**: Tap back button
6. **Repeat**: For specified number of rounds (3 hands per round)

---

## iOS vs Android: Key Differences

| Aspect | iOS | Android |
|--------|-----|---------|
| **Tap Method** | Appium pointer actions | ADB `input tap` via `mobile: shell` |
| **Coordinate System** | Points (1x scale) | Pixels / 3 (density 480 dpi) |
| **Screen Size** | 440 x 956 | 448 x 997 |
| **Flutter Selector** | `@label` | `@content-desc` |
| **Appium Config** | Standard | Requires `--allow-insecure=uiautomator2:adb_shell` |
| **Y-Offset** | ~161-213 px | ~370 px |

### iOS Tap Implementation

```typescript
await driver.action('pointer')
  .move({ x, y })
  .down()
  .pause(100)  // 100ms pause is CRUCIAL for Rive
  .up()
  .perform();
```

### Android Tap Implementation

```typescript
// Appium pointer actions don't work on Android Flutter/Rive
// Must use ADB input tap
const pixelX = Math.round(x * 3.0);
const pixelY = Math.round(y * 3.0);

await driver.execute('mobile: shell', {
  command: 'input',
  args: ['tap', pixelX.toString(), pixelY.toString()],
});
```

---

## Calibrated Clickable Positions

### iOS

```typescript
const CLICKABLE_POSITIONS = {
  CHECK: { x: 60, y: 680 },
  CALL:  { x: 60, y: 680 },
  BET:   { x: 190, y: 680 },
  RAISE: { x: 190, y: 680 },
  FOLD:  { x: 60, y: 780 },
  BACK:  { x: 32, y: 90 },
};
```

### Android

```typescript
const CLICKABLE_POSITIONS = {
  CHECK: { x: 57, y: 767 },
  CALL:  { x: 57, y: 767 },
  BET:   { x: 167, y: 767 },
  RAISE: { x: 167, y: 767 },
  FOLD:  { x: 57, y: 817 },
  BACK:  { x: 33, y: 67 },
};
```

---

## Test Results

### iOS Results

| Metric | Value |
|--------|-------|
| Rounds completed | 5/5 |
| Screenshots captured | 42 |
| Test duration | ~3 minutes |

### Android Results

| Metric | Value |
|--------|-------|
| Rounds completed | 5/5 |
| YOLO detections | 89 |
| Taps executed | 30 |

---

## YOLO Detection

### Visual Positions Detected

**iOS:**
```
CALL:  (58, 841)  - 97% confidence
RAISE: (219, 893) - 98% confidence
FOLD:  (360, 894) - 94% confidence
```

**Android:**
```
CALL:  (58, 890)  - 96% confidence
RAISE: (224, 936) - 92-94% confidence
FOLD:  (368, 944) - 95% confidence
```

### Why YOLO Coordinates Don't Work Directly

Rive renders buttons visually at different locations than where they respond to taps:

| Button | YOLO Visual | Clickable | Offset |
|--------|------------|-----------|--------|
| CALL   | (58, 841)  | (60, 680) | Y: -161px |
| FOLD   | (360, 894) | (60, 780) | X: -300px! |

The FOLD button is visually on the RIGHT but clickable on the LEFT.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│            YOLO Detection                    │
│  Detects: btn_call, btn_raise, btn_fold     │
│  Returns: Button TYPE (not coordinates)      │
└─────────────────────┬───────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│          Button Type → Position Map          │
│  "btn_call"  → { x: 60, y: 680 }  (iOS)     │
│  "btn_call"  → { x: 57, y: 767 }  (Android) │
└─────────────────────┬───────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│           Platform-Specific Tap              │
│  iOS: Appium pointer actions                 │
│  Android: ADB input tap                      │
└─────────────────────────────────────────────┘
```

---

## Files

| File | Description |
|------|-------------|
| `scripts/test_poker_game.ts` | Unified iOS/Android test script |

---

## Output Locations

- **iOS:** `apps/orchestrator/out/poker_test_ios/`
- **Android:** `apps/orchestrator/out/poker_test_android/`
