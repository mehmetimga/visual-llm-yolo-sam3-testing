#!/usr/bin/env npx tsx
/**
 * Test Rive Button Clicking with YOLO → Clickable Coordinate Mapping
 *
 * This test uses YOLO to detect button TYPES and maps them to known clickable positions.
 * YOLO is the source of truth for WHAT buttons exist, but we use fixed positions for WHERE to tap.
 *
 * Flow (5 rounds):
 * 1. Start at Casino Lobby
 * 2. Click "PLAY POKER" to enter poker table
 * 3. Click DEAL to start game (Flutter button)
 * 4. Use YOLO to detect available buttons, map to clickable coords, tap
 * 5. Return to lobby
 */

import { remote } from 'webdriverio';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'apps/orchestrator/out/rive_yolo_mapping_test');
const DETECTOR_URL = 'http://localhost:8001';
const SCREEN_SCALE = 3.0;

// Parse args
const args = process.argv.slice(2);
const NUM_ROUNDS = parseInt(args.find(a => a.startsWith('--rounds='))?.split('=')[1] || '5');
const ACTIONS_PER_ROUND = parseInt(args.find(a => a.startsWith('--actions='))?.split('=')[1] || '5');

/**
 * CLICKABLE POSITIONS - The actual tap targets for Rive buttons
 * These are derived from tested working coordinates.
 * YOLO detects button TYPE, then we look up the clickable position here.
 */
const CLICKABLE_POSITIONS: Record<string, { x: number; y: number }> = {
  CHECK: { x: 60, y: 680 },
  CALL: { x: 60, y: 680 },
  BET: { x: 190, y: 680 },
  RAISE: { x: 190, y: 680 },
  FOLD: { x: 60, y: 780 },
  ALLIN: { x: 380, y: 680 },
  DEAL: { x: 220, y: 550 },
  BACK: { x: 32, y: 90 },
};

// Stats
const stats = {
  rounds: 0,
  yoloDetections: 0,
  buttonsMapped: 0,
  tapsExecuted: 0,
  screenshots: 0,
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

/**
 * Map YOLO button type to clickable position
 * This is the key function - YOLO tells us WHAT, we know WHERE
 */
function mapButtonToClickable(buttonType: string): { x: number; y: number } | null {
  const key = buttonType.toUpperCase().replace('BTN_', '');
  return CLICKABLE_POSITIONS[key] || null;
}

async function screenshot(driver: WebdriverIO.Browser, name: string): Promise<string> {
  const ts = Date.now();
  const fn = `${name}_${ts}.png`;
  const ss = await driver.takeScreenshot();
  writeFileSync(join(OUTPUT_DIR, fn), ss, 'base64');
  stats.screenshots++;
  console.log(`   📸 ${fn}`);
  return ss;
}

async function detectAndMapButtons(base64Png: string): Promise<Record<string, { x: number; y: number; confidence: number; yoloCoords: { x: number; y: number } }>> {
  try {
    const res = await fetch(`${DETECTOR_URL}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Png, threshold: 0.2 }),
    });

    if (!res.ok) {
      console.log(`   ⚠️ YOLO detector HTTP ${res.status}`);
      return {};
    }

    const json = await res.json() as { detections?: YOLODet[] };
    const detections: YOLODet[] = json.detections || [];

    const result: Record<string, { x: number; y: number; confidence: number; yoloCoords: { x: number; y: number } }> = {};

    for (const det of detections) {
      const label = (det.text || det.type || '').toLowerCase();
      if (!label.startsWith('btn_')) continue;

      stats.yoloDetections++;
      const buttonType = label.replace('btn_', '').toUpperCase();

      // Get YOLO's detected coordinates (for logging)
      const yoloCenterX = Math.round((det.bbox.x + det.bbox.w / 2) / SCREEN_SCALE);
      const yoloCenterY = Math.round((det.bbox.y + det.bbox.h / 2) / SCREEN_SCALE);

      // Map to clickable position
      const clickable = mapButtonToClickable(buttonType);
      if (clickable) {
        stats.buttonsMapped++;
        result[buttonType] = {
          ...clickable,
          confidence: det.confidence || 0,
          yoloCoords: { x: yoloCenterX, y: yoloCenterY },
        };
      }
    }

    return result;
  } catch (err) {
    console.log(`   ⚠️ YOLO error: ${err}`);
    return {};
  }
}

async function tapRiveButton(driver: WebdriverIO.Browser, x: number, y: number, name: string): Promise<void> {
  // Take screenshot before tap (helps with Rive timing)
  await screenshot(driver, `before_${name}`);

  // Tap with 100ms pause (crucial for Rive buttons)
  await driver.action('pointer')
    .move({ x, y })
    .down()
    .pause(100)
    .up()
    .perform();

  stats.tapsExecuted++;
  console.log(`   👆 Tapped ${name} at (${x}, ${y})`);
}

async function clickFlutterButton(driver: WebdriverIO.Browser, selectors: string[]): Promise<boolean> {
  for (const sel of selectors) {
    try {
      const el = await driver.$(sel);
      if (await el.isExisting()) {
        await el.click();
        console.log(`   ✅ Clicked Flutter: ${sel}`);
        return true;
      }
    } catch {}
  }
  return false;
}

function chooseAction(buttons: Record<string, { x: number; y: number; confidence: number; yoloCoords: { x: number; y: number } }>): string | null {
  // Priority: DEAL > CHECK > CALL > RAISE > FOLD
  if (buttons.DEAL) return 'DEAL';
  if (buttons.CHECK) return 'CHECK';
  if (buttons.CALL) return 'CALL';
  if (buttons.RAISE) return 'RAISE';
  if (buttons.FOLD) return 'FOLD';
  return null;
}

async function ensureAtLobby(driver: WebdriverIO.Browser): Promise<boolean> {
  const lobbySelectors = [
    '//*[@label="PLAY POKER"]',
    '//*[contains(@label, "PLAY POKER")]',
    '//*[contains(@label, "Casino Lobby")]',
  ];

  for (const sel of lobbySelectors) {
    try {
      const el = await driver.$(sel);
      if (await el.isExisting()) {
        return true;
      }
    } catch {}
  }

  // Try pressing back
  for (let i = 0; i < 3; i++) {
    await tapRiveButton(driver, CLICKABLE_POSITIONS.BACK.x, CLICKABLE_POSITIONS.BACK.y, 'back');
    await driver.pause(1500);

    for (const sel of lobbySelectors) {
      try {
        const el = await driver.$(sel);
        if (await el.isExisting()) return true;
      } catch {}
    }
  }
  return false;
}

async function playRound(driver: WebdriverIO.Browser, roundNum: number): Promise<void> {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🎮 ROUND ${roundNum}/${NUM_ROUNDS}`);
  console.log('='.repeat(50));

  // Navigate to poker table
  console.log('\n➡️ Navigating to Poker Table');
  const playPokerClicked = await clickFlutterButton(driver, [
    '//*[@label="PLAY POKER"]',
    '//*[contains(@label, "PLAY POKER")]',
  ]);

  if (!playPokerClicked) {
    console.log('   ⚠️ Could not find PLAY POKER button');
    return;
  }
  await driver.pause(3000);

  // Take screenshot of poker table
  await screenshot(driver, `round_${roundNum}_table`);

  // Click DEAL to start game (Flutter button)
  console.log('\n🎴 Starting game - clicking DEAL');
  const dealClicked = await clickFlutterButton(driver, [
    '//*[@label="DEAL"]',
    '//*[contains(@label, "DEAL")]',
  ]);

  if (dealClicked) {
    await driver.pause(3000);
  } else {
    // Fallback to coordinate tap
    await tapRiveButton(driver, CLICKABLE_POSITIONS.DEAL.x, CLICKABLE_POSITIONS.DEAL.y, 'DEAL_fallback');
    await driver.pause(3000);
  }

  // Play actions using YOLO detection + coordinate mapping
  console.log('\n🃏 Playing poker actions');
  for (let action = 1; action <= ACTIONS_PER_ROUND; action++) {
    console.log(`\n   Action ${action}/${ACTIONS_PER_ROUND}`);

    // Detect buttons with YOLO
    const b64 = await driver.takeScreenshot();
    const buttons = await detectAndMapButtons(b64);
    const buttonNames = Object.keys(buttons);

    if (buttonNames.length > 0) {
      console.log(`   🎯 YOLO detected: ${buttonNames.map(b => {
        const btn = buttons[b];
        return `${b}(${Math.round(btn.confidence * 100)}%) YOLO:(${btn.yoloCoords.x},${btn.yoloCoords.y})→Click:(${btn.x},${btn.y})`;
      }).join(', ')}`);
    } else {
      console.log('   ⚠️ No buttons detected');
      await driver.pause(2000);
      continue;
    }

    // Choose action
    const actionName = chooseAction(buttons);
    if (!actionName) {
      console.log('   ⚠️ No actionable button found');
      await driver.pause(2000);
      continue;
    }

    // Get clickable position (mapped from YOLO detection)
    const pos = buttons[actionName];
    console.log(`   ✨ Action: ${actionName} → tapping at (${pos.x}, ${pos.y})`);

    await tapRiveButton(driver, pos.x, pos.y, actionName);
    await driver.pause(2500);
  }

  // Return to lobby
  console.log('\n⬅️ Returning to lobby');
  await tapRiveButton(driver, CLICKABLE_POSITIONS.BACK.x, CLICKABLE_POSITIONS.BACK.y, 'back_to_lobby');
  await driver.pause(2000);

  // Verify we're at lobby
  if (await ensureAtLobby(driver)) {
    stats.rounds++;
    console.log(`   ✅ Round ${roundNum} complete!`);
  } else {
    console.log(`   ⚠️ Could not verify lobby`);
  }

  await screenshot(driver, `round_${roundNum}_complete`);
}

async function main() {
  console.log('='.repeat(60));
  console.log('  RIVE BUTTON TEST: YOLO → CLICKABLE MAPPING');
  console.log('='.repeat(60));
  console.log(`\nConfiguration:`);
  console.log(`  Rounds: ${NUM_ROUNDS}`);
  console.log(`  Actions per round: ${ACTIONS_PER_ROUND}`);
  console.log(`  Output: ${OUTPUT_DIR}`);
  console.log(`  YOLO Detector: ${DETECTOR_URL}`);
  console.log(`\nClickable Position Mapping:`);
  for (const [btn, pos] of Object.entries(CLICKABLE_POSITIONS)) {
    console.log(`  ${btn.padEnd(8)}: (${pos.x}, ${pos.y})`);
  }

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

  console.log('\n✅ Connected to Appium\n');

  try {
    // Check if we need to login
    const textFields = await driver.$$('XCUIElementTypeTextField');
    if (textFields.length >= 2) {
      console.log('📝 Login required...');
      // Simple login
      await textFields[0].click();
      await driver.pause(500);
      for (const c of 'demo') await driver.keys([c]);

      const pwFields = await driver.$$('XCUIElementTypeSecureTextField');
      if (pwFields.length >= 1) {
        await pwFields[0].click();
        await driver.pause(500);
        for (const c of 'pw') await driver.keys([c]);
      }

      await clickFlutterButton(driver, ['//*[contains(@label, "LOG IN")]']);
      await driver.pause(3000);
    }

    // Ensure at lobby
    await ensureAtLobby(driver);
    await screenshot(driver, 'initial_lobby');

    // Run rounds
    for (let round = 1; round <= NUM_ROUNDS; round++) {
      await playRound(driver, round);
      await driver.pause(1000);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('  TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`  Rounds completed:    ${stats.rounds}/${NUM_ROUNDS}`);
    console.log(`  YOLO detections:     ${stats.yoloDetections}`);
    console.log(`  Buttons mapped:      ${stats.buttonsMapped}`);
    console.log(`  Taps executed:       ${stats.tapsExecuted}`);
    console.log(`  Screenshots:         ${stats.screenshots}`);
    console.log(`  Output:              ${OUTPUT_DIR}`);
    console.log('='.repeat(60));

    if (stats.rounds === NUM_ROUNDS) {
      console.log('\n✅ TEST PASSED: YOLO detection + coordinate mapping works!');
    } else {
      console.log('\n⚠️ TEST INCOMPLETE: Some rounds did not complete');
    }

  } catch (err) {
    console.error('\n❌ Error:', err);
  } finally {
    await driver.deleteSession();
  }
}

main().catch(console.error);
