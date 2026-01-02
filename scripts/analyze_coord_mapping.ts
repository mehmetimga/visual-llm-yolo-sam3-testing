#!/usr/bin/env npx tsx
/**
 * Analyze Coordinate Mapping Between YOLO Training and Appium
 *
 * This script identifies the ROOT CAUSE of coordinate mismatch.
 */

console.log('='.repeat(70));
console.log('  COORDINATE MAPPING ROOT CAUSE ANALYSIS');
console.log('='.repeat(70));

// ============================================================================
// YOLO TRAINING LABELS (from fastLabel_rive.py)
// ============================================================================
console.log('\n1. YOLO TRAINING LABELS (fastLabel_rive.py)');
console.log('-'.repeat(50));

// Screen dimensions used in labeling
const LABEL_SCREEN = { width: 430, height: 932 };
console.log(`   Labeling screen size: ${LABEL_SCREEN.width} x ${LABEL_SCREEN.height}`);

// Rive button positions (NORMALIZED 0-1 coordinates)
const YOLO_NORMALIZED = {
  btn_fold:  { x: 0.82, y: 0.935, w: 0.14, h: 0.055 },
  btn_check: { x: 0.13, y: 0.88,  w: 0.14, h: 0.055 },
  btn_call:  { x: 0.13, y: 0.88,  w: 0.14, h: 0.055 },
  btn_raise: { x: 0.50, y: 0.935, w: 0.18, h: 0.055 },
  btn_deal:  { x: 0.50, y: 0.54,  w: 0.40, h: 0.055 },
};

console.log('\n   YOLO normalized positions (0-1):');
for (const [name, pos] of Object.entries(YOLO_NORMALIZED)) {
  console.log(`     ${name.padEnd(12)}: x=${pos.x}, y=${pos.y}`);
}

// Convert to pixel coordinates (430x932 screen)
console.log('\n   YOLO pixel positions (430x932 screen):');
for (const [name, pos] of Object.entries(YOLO_NORMALIZED)) {
  const px = Math.round(pos.x * LABEL_SCREEN.width);
  const py = Math.round(pos.y * LABEL_SCREEN.height);
  console.log(`     ${name.padEnd(12)}: (${px}, ${py})`);
}

// ============================================================================
// TEST DEVICE (Appium)
// ============================================================================
console.log('\n2. TEST DEVICE (Appium)');
console.log('-'.repeat(50));

const APPIUM_SCREEN = { width: 440, height: 956 };
console.log(`   Appium screen size: ${APPIUM_SCREEN.width} x ${APPIUM_SCREEN.height}`);

// YOLO normalized coords applied to actual screen
console.log('\n   YOLO positions scaled to Appium screen (440x956):');
for (const [name, pos] of Object.entries(YOLO_NORMALIZED)) {
  const px = Math.round(pos.x * APPIUM_SCREEN.width);
  const py = Math.round(pos.y * APPIUM_SCREEN.height);
  console.log(`     ${name.padEnd(12)}: (${px}, ${py})`);
}

// ============================================================================
// FALLBACK COORDINATES (from capture_poker_gameplay.ts)
// ============================================================================
console.log('\n3. FALLBACK COORDINATES (capture_poker_gameplay.ts)');
console.log('-'.repeat(50));
console.log('   These are the WORKING coordinates used for Appium taps:');

const FALLBACK_COORDS = {
  check: { x: 60, y: 680 },
  call:  { x: 60, y: 680 },
  bet:   { x: 190, y: 680 },
  raise: { x: 190, y: 680 },
  fold:  { x: 60, y: 780 },
  allin: { x: 380, y: 680 },
  deal:  { x: 220, y: 550 },
  back:  { x: 32, y: 90 },
};

for (const [name, pos] of Object.entries(FALLBACK_COORDS)) {
  console.log(`     ${name.padEnd(12)}: (${pos.x}, ${pos.y})`);
}

// ============================================================================
// YOLO DETECTION OUTPUT (from debug run)
// ============================================================================
console.log('\n4. ACTUAL YOLO DETECTION OUTPUT');
console.log('-'.repeat(50));
console.log('   These are coordinates YOLO returned (converted to Appium space):');

const YOLO_DETECTED = {
  CALL:  { x: 58, y: 841 },
  RAISE: { x: 219, y: 893 },
  FOLD:  { x: 360, y: 894 },
};

for (const [name, pos] of Object.entries(YOLO_DETECTED)) {
  console.log(`     ${name.padEnd(12)}: (${pos.x}, ${pos.y})`);
}

// ============================================================================
// COMPARISON
// ============================================================================
console.log('\n' + '='.repeat(70));
console.log('  COMPARISON: YOLO Label vs Fallback vs Detected');
console.log('='.repeat(70));

interface Comparison {
  button: string;
  yoloLabel: { x: number; y: number };
  fallback: { x: number; y: number };
  yoloDetected: { x: number; y: number } | null;
}

const comparisons: Comparison[] = [
  {
    button: 'CALL/CHECK',
    yoloLabel: { x: Math.round(0.13 * 440), y: Math.round(0.88 * 956) },
    fallback: { x: 60, y: 680 },
    yoloDetected: YOLO_DETECTED.CALL,
  },
  {
    button: 'RAISE',
    yoloLabel: { x: Math.round(0.50 * 440), y: Math.round(0.935 * 956) },
    fallback: { x: 190, y: 680 },
    yoloDetected: YOLO_DETECTED.RAISE,
  },
  {
    button: 'FOLD',
    yoloLabel: { x: Math.round(0.82 * 440), y: Math.round(0.935 * 956) },
    fallback: { x: 60, y: 780 },
    yoloDetected: YOLO_DETECTED.FOLD,
  },
];

console.log('\n   Button       | YOLO Label  | Fallback    | YOLO Detect | Label-Fallback');
console.log('   ' + '-'.repeat(75));

for (const c of comparisons) {
  const labelStr = `(${c.yoloLabel.x}, ${c.yoloLabel.y})`.padEnd(12);
  const fallbackStr = `(${c.fallback.x}, ${c.fallback.y})`.padEnd(12);
  const detectStr = c.yoloDetected ? `(${c.yoloDetected.x}, ${c.yoloDetected.y})`.padEnd(12) : 'N/A'.padEnd(12);
  const diffX = c.yoloLabel.x - c.fallback.x;
  const diffY = c.yoloLabel.y - c.fallback.y;
  const diffStr = `(${diffX > 0 ? '+' : ''}${diffX}, ${diffY > 0 ? '+' : ''}${diffY})`;

  console.log(`   ${c.button.padEnd(12)} | ${labelStr} | ${fallbackStr} | ${detectStr} | ${diffStr}`);
}

// ============================================================================
// ROOT CAUSE
// ============================================================================
console.log('\n' + '='.repeat(70));
console.log('  ROOT CAUSE IDENTIFIED');
console.log('='.repeat(70));

console.log(`
1. YOLO TRAINING LABELS vs RIVE BUTTON HITBOX

   The YOLO labels in fastLabel_rive.py define button positions as:
   - btn_call/check: y = 0.88 (normalized) → ${Math.round(0.88 * 956)} pixels
   - btn_raise:      y = 0.935 (normalized) → ${Math.round(0.935 * 956)} pixels
   - btn_fold:       y = 0.935 (normalized) → ${Math.round(0.935 * 956)} pixels

   But the WORKING fallback coordinates use:
   - call/check: y = 680
   - raise:      y = 680
   - fold:       y = 780

2. THE MISMATCH

   YOLO labels are based on VISUAL button positions in the Rive animation.
   Fallback coords are based on WHERE BUTTONS ACTUALLY RESPOND TO TAPS.

   Visual position (YOLO):  y ≈ 840-894 (near bottom of screen)
   Clickable position:      y ≈ 680-780 (higher up on screen)

   DIFFERENCE: ~160-200 pixels!

3. WHY THIS HAPPENS

   The Rive animation panel renders buttons at the BOTTOM of the screen,
   but Flutter's GestureDetector (or Rive's hit testing) responds to
   taps at a DIFFERENT location - likely where the button's logical
   position is in the widget tree, not where Rive draws them.

4. BUTTON X-POSITION ISSUE (FOLD)

   YOLO trained with btn_fold at x = 0.82 (RIGHT side: x=${Math.round(0.82 * 440)})
   Fallback uses fold at x = 60 (LEFT side)

   This means the YOLO training labels have FOLD on the WRONG SIDE!
   The Rive animation visually shows FOLD on the right, but the
   clickable button is on the left.

5. CONCLUSION

   YOLO is correctly detecting WHERE buttons APPEAR VISUALLY.
   But the CLICKABLE AREAS are in DIFFERENT POSITIONS.

   The fallback coordinates represent the ACTUAL TAP TARGETS,
   not the visual button locations.
`);

console.log('='.repeat(70));
console.log('  RECOMMENDATION');
console.log('='.repeat(70));

console.log(`
Option A: Keep current approach
   - Use YOLO to detect WHAT buttons exist
   - Use fallback coordinates to TAP
   - This is reliable and works now

Option B: Fix YOLO training labels
   - Update fastLabel_rive.py to use ACTUAL clickable positions
   - Retrain the model
   - This would make YOLO coords usable for tapping

Option C: Calculate offset dynamically
   - Measure offset between YOLO and clickable areas
   - Apply offset when converting YOLO coords to tap coords
   - Risk: offset may vary by button/screen size
`);
