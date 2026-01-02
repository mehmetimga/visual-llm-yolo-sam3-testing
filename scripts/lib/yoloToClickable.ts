/**
 * YOLO to Clickable Coordinate Mapping
 *
 * This module provides utilities to convert YOLO-detected button positions
 * to actual clickable coordinates for Rive buttons.
 *
 * IMPORTANT: There are two approaches:
 *
 * 1. BUTTON TYPE MAPPING (Current - Works Now)
 *    YOLO detects button TYPE (CALL, FOLD, etc.) and we map to fixed positions.
 *    The YOLO coordinates are ignored; only the button label matters.
 *
 * 2. DIRECT COORDINATE MAPPING (After Retraining)
 *    Once YOLO is retrained with correct clickable positions (fastLabel_rive.py updated),
 *    YOLO coordinates can be used directly with scale conversion.
 */

// Screen dimensions
export const SCREEN = {
  // Appium coordinate space
  appium: { width: 440, height: 956 },
  // Screenshot pixel space (3x Retina)
  screenshot: { width: 1320, height: 2868 },
  // Scale factor
  scale: 3.0,
};

/**
 * Fixed clickable positions for Rive buttons (Appium coordinates)
 * These are the ACTUAL tap targets, tested and verified.
 */
export const CLICKABLE_POSITIONS: Record<string, { x: number; y: number }> = {
  CHECK: { x: 60, y: 680 },
  CALL: { x: 60, y: 680 },
  BET: { x: 190, y: 680 },
  RAISE: { x: 190, y: 680 },
  FOLD: { x: 60, y: 780 },
  ALLIN: { x: 380, y: 680 },
  DEAL: { x: 220, y: 550 },
  BACK: { x: 32, y: 90 },
};

/**
 * Approach 1: Button Type Mapping
 *
 * Given a button type detected by YOLO, return its fixed clickable position.
 * This ignores YOLO coordinates entirely - only the button label matters.
 *
 * @param buttonType - The button type (e.g., "CALL", "FOLD", "RAISE")
 * @returns Clickable coordinates in Appium space, or null if unknown
 */
export function getClickablePosition(buttonType: string): { x: number; y: number } | null {
  const key = buttonType.toUpperCase().replace('BTN_', '');
  return CLICKABLE_POSITIONS[key] || null;
}

/**
 * Approach 2: Convert YOLO coordinates to Appium coordinates
 *
 * This converts screenshot pixel coordinates (from YOLO bbox) to Appium coordinates.
 * Only use this AFTER retraining YOLO with correct clickable positions!
 *
 * @param yoloX - X coordinate in screenshot pixel space
 * @param yoloY - Y coordinate in screenshot pixel space
 * @returns Coordinates in Appium space
 */
export function yoloToAppium(yoloX: number, yoloY: number): { x: number; y: number } {
  return {
    x: Math.round(yoloX / SCREEN.scale),
    y: Math.round(yoloY / SCREEN.scale),
  };
}

/**
 * Convert YOLO bbox center to Appium coordinates
 *
 * @param bbox - YOLO bounding box { x, y, w, h } in screenshot pixels
 * @returns Center coordinates in Appium space
 */
export function yoloBboxToAppium(bbox: { x: number; y: number; w: number; h: number }): { x: number; y: number } {
  const centerX = bbox.x + bbox.w / 2;
  const centerY = bbox.y + bbox.h / 2;
  return yoloToAppium(centerX, centerY);
}

/**
 * Hybrid approach: Use YOLO detection with button type mapping
 *
 * Takes YOLO detections and returns clickable positions for each detected button.
 * Uses button TYPE to look up fixed positions (ignores YOLO coordinates).
 *
 * @param detections - Array of YOLO detections
 * @returns Map of button type to clickable position
 */
export function mapDetectionsToClickable(
  detections: Array<{ text?: string; type?: string; confidence?: number; bbox: { x: number; y: number; w: number; h: number } }>
): Record<string, { x: number; y: number; confidence: number }> {
  const result: Record<string, { x: number; y: number; confidence: number }> = {};

  for (const det of detections) {
    const label = (det.text || det.type || '').toLowerCase();
    if (!label.startsWith('btn_')) continue;

    const buttonType = label.replace('btn_', '').toUpperCase();
    const clickable = getClickablePosition(buttonType);

    if (clickable) {
      result[buttonType] = {
        ...clickable,
        confidence: det.confidence || 0,
      };
    }
  }

  return result;
}

/**
 * Summary of the coordinate mapping issue:
 *
 * PROBLEM:
 * - YOLO was trained on VISUAL button positions (where Rive draws them)
 * - But the CLICKABLE positions are different (where Flutter responds to taps)
 * - Visual layout:    CALL(left) | RAISE(center) | FOLD(right)
 * - Clickable layout: CALL/FOLD(left, stacked) | RAISE(center)
 *
 * SOLUTION:
 * - Use YOLO to detect WHICH buttons are visible
 * - Map button TYPE to FIXED clickable positions
 * - Ignore YOLO coordinates for now
 *
 * TO MAKE YOLO COORDS DIRECTLY USABLE:
 * 1. Update fastLabel_rive.py with correct clickable positions (done)
 * 2. Regenerate training labels
 * 3. Retrain YOLO model
 * 4. Then YOLO coordinates will match clickable positions
 */
