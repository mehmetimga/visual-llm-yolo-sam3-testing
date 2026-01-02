# Spec Testing Guide: iOS vs Android

This guide explains how to run BDD spec tests on iOS and Android devices using the orchestrator.

## Quick Start

### Run on iOS (default)
```bash
cd apps/orchestrator
pnpm run dev --spec specs/poker_session.feature --platform flutter --real
```

### Run on Android
```bash
cd apps/orchestrator
pnpm run dev --spec specs/poker_session.feature --platform flutter --device android --real
```

## Prerequisites

### iOS Requirements
- macOS with Xcode installed
- iOS Simulator booted (e.g., iPhone 16 Pro Max)
- Appium server running: `appium`
- Demo casino app installed on simulator

### Android Requirements
- Android emulator running (e.g., Pixel 7 Pro API 34)
- Appium server running with shell access: `appium --allow-insecure=uiautomator2:adb_shell`
- Demo casino app installed on emulator
- ADB available in PATH

### Common Requirements
- YOLO detector service running on `http://localhost:8001`
- Node.js and pnpm installed

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--spec <path>` | Path to .feature spec file | Required |
| `--platform <type>` | Platform: `web`, `flutter` | `web` |
| `--device <type>` | Device: `ios` or `android` | `ios` |
| `--real` | Enable real device execution | `false` |
| `--vgs` | Enable Vision Grounding Service | `false` |
| `--timeout <ms>` | Step timeout in milliseconds | `30000` |
| `--outDir <path>` | Output directory for artifacts | `./out` |

## Key Differences: iOS vs Android

### 1. Element Selectors

| Platform | Attribute | Example |
|----------|-----------|---------|
| iOS | `@label`, `@name` | `//XCUIElementTypeButton[@label="DEAL"]` |
| Android | `@content-desc`, `@text` | `//*[@content-desc="DEAL"]` |

### 2. Touch Interaction

**iOS:**
- Uses Appium pointer actions with 100ms pause
- Required for Rive buttons to register taps
```typescript
await driver.action('pointer')
  .move({ x, y })
  .down()
  .pause(100)
  .up()
  .perform();
```

**Android:**
- Uses ADB `input tap` command via mobile shell
- More reliable for Flutter/Rive buttons
```typescript
await driver.execute('mobile: shell', {
  command: 'input',
  args: ['tap', pixelX.toString(), pixelY.toString()],
});
```

### 3. Coordinate Scaling

| Platform | Scale Factor | Example |
|----------|--------------|---------|
| iOS | 1.0 (logical points) | Tap at (60, 680) |
| Android | 3.0 (density) | Tap at (180, 2040) pixels |

### 4. Keyboard Handling

**iOS:**
- Dismiss with `~Done` button
- Uses WebDriverAgent key events

**Android:**
- Dismiss with `KEYCODE_ESCAPE` (keyevent 111)
- Type text via ADB `input text`

### 5. Scrolling

**iOS:**
- Uses Appium pointer actions for swipe gestures

**Android:**
- Uses ADB `input swipe` command for reliability

## Calibrated Button Positions

### iOS Rive Button Positions (430x932 logical points)
```typescript
const RIVE_BUTTON_POSITIONS = {
  'btn_check': { x: 60, y: 680 },
  'btn_call': { x: 60, y: 680 },
  'btn_bet': { x: 190, y: 680 },
  'btn_raise': { x: 190, y: 680 },
  'btn_fold': { x: 60, y: 780 },
  'btn_allin': { x: 380, y: 680 },
};
```

### Android Rive Button Positions (logical, scale by 3.0 for pixels)
```typescript
const ANDROID_RIVE_POSITIONS = {
  'btn_check': { x: 57, y: 767 },
  'btn_call': { x: 57, y: 767 },
  'btn_bet': { x: 167, y: 767 },
  'btn_raise': { x: 167, y: 767 },
  'btn_fold': { x: 57, y: 817 },
  'btn_allin': { x: 350, y: 767 },
};
```

## Sample Scripts

### 1. Run Poker Session Test on iOS
```bash
#!/bin/bash
# scripts/run_poker_ios.sh

cd "$(dirname "$0")/../apps/orchestrator"

echo "Starting poker session test on iOS..."
pnpm run dev \
  --spec ../../specs/poker_session.feature \
  --platform flutter \
  --device ios \
  --real \
  --vgs \
  --timeout 60000

echo "Results saved to: ./out"
```

### 2. Run Poker Session Test on Android
```bash
#!/bin/bash
# scripts/run_poker_android.sh

cd "$(dirname "$0")/../apps/orchestrator"

echo "Starting poker session test on Android..."
pnpm run dev \
  --spec ../../specs/poker_session.feature \
  --platform flutter \
  --device android \
  --real \
  --vgs \
  --timeout 60000

echo "Results saved to: ./out"
```

### 3. Run Both Platforms Sequentially
```bash
#!/bin/bash
# scripts/run_poker_both.sh

cd "$(dirname "$0")/../apps/orchestrator"

echo "=== iOS Test ==="
pnpm run dev \
  --spec ../../specs/poker_session.feature \
  --platform flutter \
  --device ios \
  --real \
  --outDir ./out/ios

echo ""
echo "=== Android Test ==="
pnpm run dev \
  --spec ../../specs/poker_session.feature \
  --platform flutter \
  --device android \
  --real \
  --outDir ./out/android

echo ""
echo "Results:"
echo "  iOS:     ./out/ios/report.html"
echo "  Android: ./out/android/report.html"
```

### 4. Quick YOLO Rive Button Test (Android)
```bash
#!/bin/bash
# scripts/test_rive_android.sh

npx tsx scripts/test_rive_yolo_mapping_android.ts --rounds=3 --actions=5
```

### 5. Quick YOLO Rive Button Test (iOS)
```bash
#!/bin/bash
# scripts/test_rive_ios.sh

npx tsx scripts/test_rive_yolo_mapping.ts --rounds=3 --actions=5
```

## Test Results Summary

### Latest Test Results (poker_session.feature)

| Platform | Passed | Failed | Total | Success Rate |
|----------|--------|--------|-------|--------------|
| iOS | 87 | 4 | 91 | 95.6% |
| Android | 90 | 1 | 91 | 98.9% |

### What Gets Tested
- Login (type username/password, tap login)
- Navigation (scroll, tap play button)
- Poker gameplay (5 hands with CALL actions)
- Wait for game end (DEAL AGAIN button)
- Return to lobby
- Logout

## Troubleshooting

### iOS Issues

**Problem:** Taps not registering on Rive buttons
**Solution:** Ensure 100ms pause between pointer down/up actions

**Problem:** Keyboard blocking elements
**Solution:** Tap `~Done` button to dismiss keyboard before interacting

**Problem:** Simulator not found
**Solution:** Boot simulator first: `xcrun simctl boot "iPhone 16 Pro Max"`

### Android Issues

**Problem:** ADB shell commands fail
**Solution:** Start Appium with `--allow-insecure=uiautomator2:adb_shell`

**Problem:** Coordinates not matching
**Solution:** Scale logical coordinates by 3.0 for pixel coordinates

**Problem:** Element not found by content-desc
**Solution:** Try uppercase version: `"DEAL"` instead of `"deal"`

### Common Issues

**Problem:** YOLO detector not responding
**Solution:** Start detector: `cd services/detector && python -m uvicorn main:app --port 8001`

**Problem:** Timeout waiting for element
**Solution:** Increase timeout: `--timeout 60000`

## Output Artifacts

After running a test, the following files are generated in the output directory:

```
out/
├── run.json          # Raw test results with step details
├── report.html       # Visual HTML report
├── junit.xml         # JUnit format for CI integration
└── steps/
    └── ios/          # or android/
        ├── step_001.png
        ├── step_002.png
        └── ...       # Screenshots for each step
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  .feature spec  │────▶│   Orchestrator  │
└─────────────────┘     └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌─────────┐  ┌─────────┐  ┌─────────┐
              │   iOS   │  │ Android │  │   Web   │
              │ Appium  │  │ Appium  │  │Playwright│
              └────┬────┘  └────┬────┘  └─────────┘
                   │            │
                   ▼            ▼
              ┌─────────┐  ┌─────────┐
              │Simulator│  │Emulator │
              └─────────┘  └─────────┘
                   │            │
                   ▼            ▼
              ┌──────────────────────┐
              │    YOLO Detector     │
              │  (Vision Fallback)   │
              └──────────────────────┘
```

## See Also

- [RIVE_YOLO_TEST_RESULTS.md](./RIVE_YOLO_TEST_RESULTS.md) - Detailed Rive button calibration data
- [specs/poker_session.feature](../specs/poker_session.feature) - Full poker session spec
