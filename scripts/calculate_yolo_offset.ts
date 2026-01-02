#!/usr/bin/env npx tsx
/**
 * Calculate YOLO to Clickable Coordinate Offset
 *
 * Goal: Find a mathematical transformation to convert YOLO detected coordinates
 * to actual clickable coordinates, so YOLO can be the source of truth.
 */

console.log('='.repeat(70));
console.log('  YOLO → CLICKABLE COORDINATE OFFSET CALCULATION');
console.log('='.repeat(70));

// Known data points: YOLO detected vs Working fallback coordinates
const dataPoints = [
  { button: 'CALL',  yolo: { x: 58, y: 841 },  fallback: { x: 60, y: 680 } },
  { button: 'RAISE', yolo: { x: 219, y: 893 }, fallback: { x: 190, y: 680 } },
  { button: 'FOLD',  yolo: { x: 360, y: 894 }, fallback: { x: 60, y: 780 } },
];

console.log('\nData Points:');
console.log('-'.repeat(50));
for (const dp of dataPoints) {
  console.log(`  ${dp.button}: YOLO (${dp.yolo.x}, ${dp.yolo.y}) → Fallback (${dp.fallback.x}, ${dp.fallback.y})`);
}

// Analyze Y-offset (most consistent)
console.log('\n1. Y-OFFSET ANALYSIS');
console.log('-'.repeat(50));

const yOffsets = dataPoints.map(dp => dp.yolo.y - dp.fallback.y);
console.log(`  Y offsets: ${yOffsets.join(', ')}`);

const avgYOffset = yOffsets.reduce((a, b) => a + b, 0) / yOffsets.length;
console.log(`  Average Y offset: ${avgYOffset.toFixed(1)}`);

const yVariance = yOffsets.reduce((sum, y) => sum + Math.pow(y - avgYOffset, 2), 0) / yOffsets.length;
console.log(`  Y offset variance: ${yVariance.toFixed(1)}`);

// Analyze X-offset
console.log('\n2. X-OFFSET ANALYSIS');
console.log('-'.repeat(50));

const xOffsets = dataPoints.map(dp => dp.yolo.x - dp.fallback.x);
console.log(`  X offsets: ${xOffsets.join(', ')}`);

// FOLD has a completely different X - it's a layout difference, not an offset
console.log(`\n  Note: FOLD has X offset of +300 - this is a LAYOUT difference`);
console.log(`  The Rive visual shows FOLD on RIGHT, but clickable is on LEFT`);

// For CALL and RAISE, X is close
const callRaiseXOffsets = [xOffsets[0], xOffsets[1]]; // CALL and RAISE only
const avgXOffset = callRaiseXOffsets.reduce((a, b) => a + b, 0) / callRaiseXOffsets.length;
console.log(`\n  CALL/RAISE average X offset: ${avgXOffset.toFixed(1)}`);

// Screen dimensions
const SCREEN = { width: 440, height: 956 };

// The Rive panel occupies the bottom portion of the screen
// Visual buttons are at y ≈ 840-894 (near bottom)
// Clickable buttons are at y ≈ 680-780 (higher up)
// This suggests the Rive panel has a vertical offset

console.log('\n3. RIVE PANEL ANALYSIS');
console.log('-'.repeat(50));

// From fastLabel_rive.py:
// RIVE_PANEL_Y_START = SCREEN_HEIGHT - RIVE_PANEL_HEIGHT = 932 - 286 = 646
// But our screen is 956, so: 956 - 286 = 670

const RIVE_PANEL_HEIGHT = 286;
const RIVE_PANEL_Y_START = SCREEN.height - RIVE_PANEL_HEIGHT;
console.log(`  Rive panel height: ${RIVE_PANEL_HEIGHT}`);
console.log(`  Rive panel Y start: ${RIVE_PANEL_Y_START}`);

// The visual buttons are rendered relative to the Rive artboard
// But the hit testing might be relative to the panel's top

console.log('\n4. PROPOSED TRANSFORMATION');
console.log('-'.repeat(50));

// For Y: The offset is roughly constant at ~160-213
// Let's use a fixed offset based on the Rive panel position
const Y_OFFSET = 160; // Average offset to subtract from YOLO Y

console.log(`\n  Y Transformation: clickable_y = yolo_y - ${Y_OFFSET}`);
console.log(`  X Transformation: More complex - need button-specific mapping`);

// Test the transformation
console.log('\n5. TESTING Y TRANSFORMATION');
console.log('-'.repeat(50));

for (const dp of dataPoints) {
  const predictedY = dp.yolo.y - Y_OFFSET;
  const actualY = dp.fallback.y;
  const error = predictedY - actualY;
  console.log(`  ${dp.button}: yolo_y=${dp.yolo.y} - ${Y_OFFSET} = ${predictedY}, actual=${actualY}, error=${error > 0 ? '+' : ''}${error}`);
}

// For X, we need a different approach - the layout is different
console.log('\n6. X TRANSFORMATION (Button Layout Mapping)');
console.log('-'.repeat(50));

// Looking at the Rive layout vs Clickable layout:
// Rive visual (left to right): CALL(x=58), RAISE(x=219), FOLD(x=360)
// Clickable (left to right):   CALL(x=60), RAISE(x=190), FOLD(x=60)
//
// Wait - FOLD clickable is at x=60, same as CALL!
// This means the clickable layout is:
//   Left column (x≈60): CALL/CHECK, FOLD (stacked vertically)
//   Center (x≈190): RAISE
//
// But Rive visual layout is:
//   Left: CALL
//   Center: RAISE
//   Right: FOLD

console.log(`  Rive visual layout:    CALL(left) | RAISE(center) | FOLD(right)`);
console.log(`  Clickable layout:      CALL/FOLD(left, stacked) | RAISE(center)`);
console.log(`\n  This means X transformation is NOT a simple offset!`);
console.log(`  We need to MAP button positions based on button TYPE.`);

// Proposed solution: Use YOLO to detect button TYPE, then use fixed clickable positions
console.log('\n' + '='.repeat(70));
console.log('  PROPOSED SOLUTION: BUTTON TYPE MAPPING');
console.log('='.repeat(70));

const CLICKABLE_POSITIONS = {
  CALL:  { x: 60, y: 680 },
  CHECK: { x: 60, y: 680 },
  RAISE: { x: 190, y: 680 },
  FOLD:  { x: 60, y: 780 },
  DEAL:  { x: 220, y: 550 },
};

console.log(`
Since the visual layout differs from the clickable layout,
we CANNOT simply apply an offset to YOLO coordinates.

Instead, we should:
1. Use YOLO to detect WHICH buttons are visible
2. Map each detected button to its FIXED clickable position

const CLICKABLE_POSITIONS = {
  CALL:  { x: 60,  y: 680 },
  CHECK: { x: 60,  y: 680 },
  RAISE: { x: 190, y: 680 },
  FOLD:  { x: 60,  y: 780 },
  DEAL:  { x: 220, y: 550 },
};

function yoloToClickable(buttonType: string): { x: number, y: number } | null {
  return CLICKABLE_POSITIONS[buttonType] || null;
}
`);

console.log('='.repeat(70));
console.log('  ALTERNATIVE: Retrain YOLO with Clickable Positions');
console.log('='.repeat(70));

console.log(`
To make YOLO coordinates directly usable for tapping:

1. Update fastLabel_rive.py to use ACTUAL clickable positions:

   RIVE_BUTTONS = {
       "btn_fold":  {"x": 0.136, "y": 0.816, ...},  # x=60/440, y=780/956
       "btn_call":  {"x": 0.136, "y": 0.711, ...},  # x=60/440, y=680/956
       "btn_raise": {"x": 0.432, "y": 0.711, ...},  # x=190/440, y=680/956
   }

2. Retrain the YOLO model with correct labels

3. Then YOLO coordinates will match clickable positions!
`);

// Calculate the correct normalized positions for fastLabel_rive.py
console.log('\n' + '='.repeat(70));
console.log('  CORRECT NORMALIZED POSITIONS FOR fastLabel_rive.py');
console.log('='.repeat(70));

console.log('\nReplace RIVE_BUTTONS in fastLabel_rive.py with:');
console.log(`
RIVE_BUTTONS = {
    "btn_fold":  {"x": ${(60/440).toFixed(4)}, "y": ${(780/956).toFixed(4)}, "w": 0.14, "h": 0.055},
    "btn_check": {"x": ${(60/440).toFixed(4)}, "y": ${(680/956).toFixed(4)}, "w": 0.14, "h": 0.055},
    "btn_call":  {"x": ${(60/440).toFixed(4)}, "y": ${(680/956).toFixed(4)}, "w": 0.14, "h": 0.055},
    "btn_raise": {"x": ${(190/440).toFixed(4)}, "y": ${(680/956).toFixed(4)}, "w": 0.18, "h": 0.055},
}
`);
