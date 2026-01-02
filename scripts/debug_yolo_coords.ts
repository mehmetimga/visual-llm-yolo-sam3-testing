#!/usr/bin/env npx tsx
/**
 * Debug YOLO Coordinates vs Fallback Coordinates
 *
 * This script investigates why YOLO coordinates don't match fallback positions for Rive buttons.
 */

import { remote } from 'webdriverio';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'apps/orchestrator/out/yolo_coord_debug');
const DETECTOR_URL = 'http://localhost:8001';

// Known working fallback coordinates (440x956 Appium screen)
const RIVE_BUTTONS = {
  check: { x: 60, y: 680 },
  call: { x: 60, y: 680 },
  raise: { x: 190, y: 680 },
  fold: { x: 60, y: 780 },
  deal: { x: 220, y: 550 },
};

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

type YOLODet = {
  text?: string;
  type?: string;
  confidence?: number;
  bbox: { x: number; y: number; w: number; h: number };
};

interface CoordComparison {
  button: string;
  yolo: { x: number; y: number; rawX: number; rawY: number; confidence: number } | null;
  fallback: { x: number; y: number };
  diff: { x: number; y: number } | null;
  screenshotSize: { width: number; height: number };
  appiumSize: { width: number; height: number };
  scale: { x: number; y: number };
}

async function main() {
  console.log('='.repeat(70));
  console.log('  YOLO vs FALLBACK COORDINATE ANALYSIS');
  console.log('='.repeat(70));

  const driver = await remote({
    hostname: '127.0.0.1',
    port: 4723,
    path: '/',
    capabilities: {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:udid': '4502FBC7-E7FA-4F70-8040-4B5844B6AEDA',
      'appium:bundleId': 'com.example.demoCasino',
      'appium:noReset': true,
      'appium:newCommandTimeout': 600,
    },
  });

  console.log('Connected to Appium\n');

  try {
    // Get Appium window size
    const windowRect = await driver.getWindowRect();
    const appiumSize = { width: windowRect.width, height: windowRect.height };
    console.log(`Appium Window Size: ${appiumSize.width} x ${appiumSize.height}`);

    // Navigate to poker table
    console.log('\nNavigating to poker table...');
    const playPoker = await driver.$('//*[@label="PLAY POKER"]');
    if (await playPoker.isExisting()) {
      await playPoker.click();
      await driver.pause(3000);
    }

    // Click DEAL to start game
    const dealBtn = await driver.$('//*[@label="DEAL"]');
    if (await dealBtn.isExisting()) {
      await dealBtn.click();
      await driver.pause(3000);
      console.log('Game started!\n');
    }

    // Take screenshot and get dimensions
    const b64 = await driver.takeScreenshot();
    const screenshotPath = join(OUTPUT_DIR, 'poker_table.png');
    writeFileSync(screenshotPath, b64, 'base64');

    // Decode PNG to get dimensions (first 24 bytes contain header)
    const pngBuffer = Buffer.from(b64, 'base64');
    const screenshotWidth = pngBuffer.readUInt32BE(16);
    const screenshotHeight = pngBuffer.readUInt32BE(20);
    console.log(`Screenshot Size: ${screenshotWidth} x ${screenshotHeight}`);

    // Calculate actual scale factors
    const scaleX = screenshotWidth / appiumSize.width;
    const scaleY = screenshotHeight / appiumSize.height;
    console.log(`Scale Factors: X=${scaleX.toFixed(3)}, Y=${scaleY.toFixed(3)}`);
    console.log(`Expected Scale: 3.0 (used in code)`);

    // Get YOLO detections
    console.log('\nFetching YOLO detections...');
    const res = await fetch(`${DETECTOR_URL}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: b64, threshold: 0.2 }),
    });

    if (!res.ok) {
      console.log(`YOLO detector error: HTTP ${res.status}`);
      return;
    }

    const json = await res.json() as { detections?: YOLODet[] };
    const detections: YOLODet[] = json.detections || [];

    console.log(`\nYOLO Detections: ${detections.length} total`);
    console.log('-'.repeat(70));

    // Build comparison report
    const comparisons: CoordComparison[] = [];

    for (const det of detections) {
      const label = (det.text || det.type || '').toLowerCase();
      if (!label.startsWith('btn_')) continue;

      const buttonName = label.replace('btn_', '');
      const fallback = RIVE_BUTTONS[buttonName as keyof typeof RIVE_BUTTONS];

      // Raw YOLO coordinates (screenshot space)
      const rawCenterX = det.bbox.x + det.bbox.w / 2;
      const rawCenterY = det.bbox.y + det.bbox.h / 2;

      // Converted to Appium space using SCREEN_SCALE = 3.0
      const yoloAppiumX = Math.round(rawCenterX / 3.0);
      const yoloAppiumY = Math.round(rawCenterY / 3.0);

      // Also calculate with actual scale
      const yoloActualX = Math.round(rawCenterX / scaleX);
      const yoloActualY = Math.round(rawCenterY / scaleY);

      console.log(`\n${buttonName.toUpperCase()} (${Math.round((det.confidence || 0) * 100)}% confidence):`);
      console.log(`  YOLO bbox: x=${det.bbox.x}, y=${det.bbox.y}, w=${det.bbox.w}, h=${det.bbox.h}`);
      console.log(`  YOLO center (screenshot): (${rawCenterX.toFixed(0)}, ${rawCenterY.toFixed(0)})`);
      console.log(`  YOLO → Appium (scale 3.0): (${yoloAppiumX}, ${yoloAppiumY})`);
      console.log(`  YOLO → Appium (actual ${scaleX.toFixed(2)}): (${yoloActualX}, ${yoloActualY})`);

      if (fallback) {
        const diffX = yoloAppiumX - fallback.x;
        const diffY = yoloAppiumY - fallback.y;
        console.log(`  Fallback position: (${fallback.x}, ${fallback.y})`);
        console.log(`  DIFFERENCE: (${diffX > 0 ? '+' : ''}${diffX}, ${diffY > 0 ? '+' : ''}${diffY})`);

        comparisons.push({
          button: buttonName,
          yolo: {
            x: yoloAppiumX,
            y: yoloAppiumY,
            rawX: rawCenterX,
            rawY: rawCenterY,
            confidence: det.confidence || 0
          },
          fallback,
          diff: { x: diffX, y: diffY },
          screenshotSize: { width: screenshotWidth, height: screenshotHeight },
          appiumSize,
          scale: { x: scaleX, y: scaleY },
        });
      } else {
        console.log(`  Fallback position: NOT DEFINED`);
      }
    }

    // Summary report
    console.log('\n' + '='.repeat(70));
    console.log('  COORDINATE ANALYSIS SUMMARY');
    console.log('='.repeat(70));

    console.log(`\nScreen Dimensions:`);
    console.log(`  Screenshot: ${screenshotWidth} x ${screenshotHeight}`);
    console.log(`  Appium:     ${appiumSize.width} x ${appiumSize.height}`);
    console.log(`  Scale X:    ${scaleX.toFixed(4)} (code uses 3.0)`);
    console.log(`  Scale Y:    ${scaleY.toFixed(4)} (code uses 3.0)`);

    if (comparisons.length > 0) {
      console.log(`\nCoordinate Differences (YOLO - Fallback):`);
      console.log('-'.repeat(50));

      let totalDiffX = 0;
      let totalDiffY = 0;

      for (const c of comparisons) {
        if (c.diff) {
          totalDiffX += Math.abs(c.diff.x);
          totalDiffY += Math.abs(c.diff.y);
          console.log(`  ${c.button.padEnd(8)}: YOLO (${c.yolo?.x}, ${c.yolo?.y}) vs Fallback (${c.fallback.x}, ${c.fallback.y}) → Δ(${c.diff.x > 0 ? '+' : ''}${c.diff.x}, ${c.diff.y > 0 ? '+' : ''}${c.diff.y})`);
        }
      }

      const avgDiffX = totalDiffX / comparisons.length;
      const avgDiffY = totalDiffY / comparisons.length;
      console.log(`\n  Average absolute difference: X=${avgDiffX.toFixed(1)}, Y=${avgDiffY.toFixed(1)}`);

      // Check if Y difference is consistent (suggesting offset issue)
      const yDiffs = comparisons.filter(c => c.diff).map(c => c.diff!.y);
      const avgYDiff = yDiffs.reduce((a, b) => a + b, 0) / yDiffs.length;
      const yDiffVariance = yDiffs.reduce((sum, y) => sum + Math.pow(y - avgYDiff, 2), 0) / yDiffs.length;

      console.log(`\n  Y-offset analysis:`);
      console.log(`    Average Y diff: ${avgYDiff.toFixed(1)}`);
      console.log(`    Y diff variance: ${yDiffVariance.toFixed(1)}`);

      if (yDiffVariance < 100) {
        console.log(`    → Consistent Y offset detected! Likely a coordinate system offset issue.`);
      }
    }

    // Hypothesis
    console.log('\n' + '='.repeat(70));
    console.log('  HYPOTHESIS');
    console.log('='.repeat(70));
    console.log(`
The YOLO coordinates are in screenshot pixel space (${screenshotWidth}x${screenshotHeight}).
The fallback coordinates are in Appium coordinate space (${appiumSize.width}x${appiumSize.height}).

Possible issues:
1. Scale factor mismatch: Code uses 3.0, actual is ${scaleX.toFixed(4)}
2. YOLO bbox might be using different coordinate origin
3. The Rive animation panel might have its own coordinate system
4. Status bar / safe area offset not accounted for

To fix: Either recalibrate fallback positions from YOLO, or investigate
why YOLO detects buttons at different Y positions.
`);

    // Save report
    const reportPath = join(OUTPUT_DIR, 'coord_analysis.json');
    writeFileSync(reportPath, JSON.stringify({
      screenshotSize: { width: screenshotWidth, height: screenshotHeight },
      appiumSize,
      scale: { x: scaleX, y: scaleY },
      comparisons,
    }, null, 2));
    console.log(`Report saved to: ${reportPath}`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await driver.deleteSession();
  }
}

main().catch(console.error);
