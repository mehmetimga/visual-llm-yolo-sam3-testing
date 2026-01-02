# YOLO vs Fallback Coordinate Analysis Report

## Executive Summary

**Finding**: YOLO coordinates do NOT match the fallback (working) coordinates for Rive buttons. The primary issue is a **large Y-axis offset** where YOLO detects buttons ~160-213 pixels lower than the fallback positions.

## Screen Dimensions

| Measurement | Value |
|-------------|-------|
| Screenshot Size | 1320 x 2868 pixels |
| Appium Window | 440 x 956 points |
| Scale Factor X | 3.0 |
| Scale Factor Y | 3.0 |

The scale factor is correct at 3.0 for both axes.

## Coordinate Comparison

| Button | YOLO (Appium) | Fallback (Appium) | Difference |
|--------|---------------|-------------------|------------|
| CALL   | (58, 841)     | (60, 680)         | (-2, +161) |
| RAISE  | (219, 893)    | (190, 680)        | (+29, +213)|
| FOLD   | (360, 894)    | (60, 780)         | (+300, +114)|

## Key Observations

### 1. X-Coordinate Issues

- **CALL**: X is nearly correct (-2 pixels off)
- **RAISE**: X is close (+29 pixels off)
- **FOLD**: X is completely wrong (+300 pixels off) - YOLO detects FOLD on the RIGHT side of screen, but fallback places it on the LEFT

### 2. Y-Coordinate Issues (Most Significant)

All buttons show a **large positive Y offset**:
- CALL: +161 pixels lower
- RAISE: +213 pixels lower
- FOLD: +114 pixels lower

Average Y difference: **+162.7 pixels**

This suggests YOLO is detecting buttons in the **Rive animation panel at the bottom of the screen**, while the fallback coordinates target the **actual clickable Rive button hitbox** which is higher up.

### 3. FOLD Position Mismatch

The FOLD button has the biggest X discrepancy:
- YOLO detects it at X=360 (right side)
- Fallback expects it at X=60 (left side)

This indicates the Rive button layout detected by YOLO is **different from the actual interactive layout**.

## Root Cause Analysis

```
Screen Layout (Appium 440x956):
┌────────────────────────────────┐ 0
│         Status Bar             │
├────────────────────────────────┤ ~60
│                                │
│         Poker Table            │
│         (Game Area)            │
│                                │
├────────────────────────────────┤ ~550 ← DEAL button (fallback y=550)
│                                │
│      Player's Cards Area       │
│                                │
├────────────────────────────────┤ ~680 ← CHECK/CALL/RAISE (fallback y=680)
│   ┌──────┐ ┌──────┐ ┌──────┐  │
│   │CHECK │ │RAISE │ │ALLIN │  │ ← Rive Action Buttons (visual)
│   │/CALL │ │      │ │      │  │
│   └──────┘ └──────┘ └──────┘  │
├────────────────────────────────┤ ~780 ← FOLD (fallback y=780)
│   ┌──────────────────────────┐│
│   │        FOLD              ││
│   └──────────────────────────┘│
├────────────────────────────────┤ ~840-900 ← YOLO detects buttons HERE
│   ┌──────┐ ┌──────┐ ┌──────┐  │
│   │ YOLO │ │ YOLO │ │ YOLO │  │ ← YOLO detection zone
│   │CALL  │ │RAISE │ │FOLD  │  │   (y=841-894)
│   └──────┘ └──────┘ └──────┘  │
└────────────────────────────────┘ 956
```

## Hypotheses

### Hypothesis 1: Rive Hitbox vs Visual Mismatch
The Rive animation renders buttons visually at one position, but the **actual interactive/clickable area** is at a different position. The fallback coordinates target the hitbox, while YOLO detects the visual rendering.

### Hypothesis 2: Training Data Issue
The YOLO model was trained on screenshots where buttons appear at the visual location, not the interactive location. This causes YOLO to detect the visual bounding box rather than the clickable area.

### Hypothesis 3: Rive Panel Offset
The Rive panel may have a transform or offset applied that shifts visual elements relative to their touch targets.

## Recommendations

### Option 1: Use YOLO for Detection, Fallback for Clicking (Current Approach)
- Use YOLO to **identify which buttons are available** (CALL, CHECK, RAISE, FOLD)
- Use **hardcoded fallback coordinates** to actually tap the buttons
- This is what currently works

### Option 2: Calculate Offset and Apply to YOLO Coordinates
```typescript
// Apply consistent Y offset to YOLO coordinates
const Y_OFFSET = -160; // Move up by ~160 pixels
const adjustedY = yoloY + Y_OFFSET;
```

### Option 3: Retrain YOLO on Hitbox Locations
Train YOLO to detect the actual clickable regions rather than the visual button locations.

### Option 4: Hybrid Approach
1. Use YOLO to detect button presence and type
2. Use YOLO X-coordinate (mostly accurate for CALL)
3. Use fallback Y-coordinate (much more accurate)

## Conclusion

**The fallback coordinates work because they target the actual Rive button hitbox areas, not the visual button locations detected by YOLO.**

The Y-axis offset of ~160 pixels represents the distance between:
- Where YOLO sees the button visually rendered
- Where the button actually responds to touch events

For production use, continue using the fallback coordinate approach with YOLO providing button availability detection.
