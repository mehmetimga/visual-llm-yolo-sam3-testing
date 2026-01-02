# Rive Button YOLO Test Results

**Test Date:** January 1, 2026
**Test Script:** `scripts/test_rive_yolo_mapping.ts`
**Status:** ✅ PASSED

---

## Summary

| Metric | Value |
|--------|-------|
| Rounds completed | 5/5 |
| Screenshots captured | 42 |
| Test duration | ~3 minutes |

---

## Test Flow

1. **Casino Lobby → Poker Table**: Click "PLAY POKER" button (Flutter)
2. **Start Game**: Click DEAL button (Flutter button via label selector)
3. **Play Poker**: Use YOLO detection to identify buttons, map to clickable coordinates, tap
4. **Return to Lobby**: Click back button (coordinate tap)
5. **Repeat**: 5 rounds total

---

## Key Finding: YOLO → Clickable Mapping

The YOLO → Clickable mapping approach works reliably:

- **YOLO detects** button TYPE (CALL, RAISE, FOLD)
- **We map** to fixed clickable positions

### Clickable Position Map

```typescript
const CLICKABLE_POSITIONS = {
  CHECK: { x: 60, y: 680 },
  CALL:  { x: 60, y: 680 },
  RAISE: { x: 190, y: 680 },
  FOLD:  { x: 60, y: 780 },
  DEAL:  { x: 220, y: 550 },
  BACK:  { x: 32, y: 90 },
};
```

### Sample Output

```
🎯 YOLO detected: RAISE(98%) YOLO:(220,893)→Click:(190,680), CALL(97%) YOLO:(58,841)→Click:(60,680), FOLD(94%) YOLO:(360,894)→Click:(60,780)
✨ Action: CALL → tapping at (60, 680)
👆 Tapped CALL at (60, 680)
```

---

## Why Direct YOLO Coordinates Don't Work

### The Problem

YOLO coordinates don't match clickable positions because Rive renders buttons at different locations than where they respond to taps.

| Button | YOLO Visual Position | Clickable Position | Difference |
|--------|---------------------|-------------------|------------|
| CALL   | (58, 841)           | (60, 680)         | Y: -161px  |
| RAISE  | (219, 893)          | (190, 680)        | Y: -213px  |
| FOLD   | (360, 894)          | (60, 780)         | X: -300px! |

### Layout Mismatch

```
Visual layout (YOLO sees):     CALL(left) | RAISE(center) | FOLD(right)
Clickable layout (tap works):  CALL/FOLD(left, stacked) | RAISE(center)
```

The FOLD button is visually on the RIGHT but clickable on the LEFT.

---

## Solution Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    YOLO Detection                           │
│  Detects: btn_call, btn_raise, btn_fold                     │
│  Returns: Visual coordinates (NOT usable for tapping)       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Button Type Mapping                            │
│  Input:  "btn_call" → Output: { x: 60, y: 680 }            │
│  Input:  "btn_fold" → Output: { x: 60, y: 780 }            │
│  Input:  "btn_raise" → Output: { x: 190, y: 680 }          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Coordinate Tap                                 │
│  driver.action('pointer')                                   │
│    .move({ x, y })                                          │
│    .down()                                                  │
│    .pause(100)  // CRUCIAL for Rive                         │
│    .up()                                                    │
│    .perform()                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Critical Implementation Details

### 1. Rive Button Tap Pattern

Standard Appium clicks don't work on Rive buttons. Must use:

```typescript
await driver.action('pointer')
  .move({ x, y })
  .down()
  .pause(100)  // 100ms pause is CRUCIAL
  .up()
  .perform();
```

### 2. Screenshot Before Tap

Taking a screenshot before tapping helps with Rive timing:

```typescript
await driver.takeScreenshot();  // Helps sync Rive state
await tapRiveButton(driver, x, y, name);
```

### 3. DEAL Button

Use Flutter label selector for DEAL button (more reliable):

```typescript
const dealSelectors = [
  '//*[@label="DEAL"]',
  '//*[contains(@label, "DEAL")]',
];
```

---

## Files

| File | Purpose |
|------|---------|
| `scripts/test_rive_yolo_mapping.ts` | Test script with YOLO mapping |
| `scripts/test_rive_e2e.ts` | Original E2E test (working) |
| `scripts/lib/yoloToClickable.ts` | Coordinate mapping utilities |
| `services/detector/fastLabel_rive.py` | Updated with clickable positions |
| `docs/YOLO_COORDINATE_ANALYSIS.md` | Root cause analysis |

---

## Future: Make YOLO Coordinates Directly Usable

To make YOLO coordinates match clickable positions:

1. **Already Done**: Updated `fastLabel_rive.py` with correct clickable positions
2. **Next Step**: Regenerate training labels with new positions
3. **Final Step**: Retrain YOLO model

After retraining, YOLO coordinates will directly match tap targets.

---

## Test Output Location

Screenshots saved to:
```
apps/orchestrator/out/rive_yolo_mapping_test/
```

Files include:
- `round_N_table_*.png` - Poker table state
- `before_CALL_*.png` - Screenshots before CALL taps
- `round_N_complete_*.png` - Round completion confirmation
