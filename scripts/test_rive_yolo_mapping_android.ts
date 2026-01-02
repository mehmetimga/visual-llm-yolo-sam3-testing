#!/usr/bin/env npx tsx
/**
 * Test Rive Button Clicking with YOLO Detection on Android
 *
 * Uses YOLO to detect button TYPES and maps them to calibrated clickable positions.
 * Taps are performed via ADB `input tap` command (Appium pointer actions don't work
 * reliably with Flutter/Rive buttons on Android).
 *
 * Flow:
 * 1. Start at Casino Lobby
 * 2. Click "PLAY POKER" to enter poker table
 * 3. Click DEAL to start game
 * 4. Play poker actions using YOLO detection + coordinate mapping
 * 5. Wait for "DEAL AGAIN" button, then return to lobby
 * 6. Repeat for specified number of rounds
 *
 * Prerequisites:
 * - Android emulator running with demo_casino app
 * - Appium server started with: appium --allow-insecure=uiautomator2:adb_shell
 * - YOLO detector running on http://localhost:8001
 *
 * Run: npx tsx scripts/test_rive_yolo_mapping_android.ts
 */

import { remote } from 'webdriverio';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'apps/orchestrator/out/rive_yolo_android');
const DETECTOR_URL = 'http://localhost:8001';

const ANDROID_SCREEN = {
  width: 448,
  height: 997,
  scale: 3.0,
};

// Parse command line args
const args = process.argv.slice(2);
const NUM_ROUNDS = parseInt(args.find(a => a.startsWith('--rounds='))?.split('=')[1] || '3');
const ACTIONS_PER_ROUND = parseInt(args.find(a => a.startsWith('--actions='))?.split('=')[1] || '5');

/**
 * Calibrated clickable positions for Android
 * Found by testing ADB input tap and observing state changes.
 * YOLO visual Y ~2670 pixels -> Clickable Y ~2300 pixels (offset ~370px)
 */
const CLICKABLE_POSITIONS: Record<string, { x: number; y: number }> = {
  CHECK: { x: 57, y: 767 },
  CALL: { x: 57, y: 767 },
  BET: { x: 167, y: 767 },
  RAISE: { x: 167, y: 767 },
  FOLD: { x: 57, y: 817 },
  BACK: { x: 33, y: 67 },
};

const stats = {
  rounds: 0,
  yoloDetections: 0,
  tapsExecuted: 0,
  screenshots: 0,
};

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

type YOLODetection = {
  text?: string;
  type?: string;
  confidence?: number;
  bbox: { x: number; y: number; w: number; h: number };
};

async function screenshot(driver: WebdriverIO.Browser, name: string): Promise<string> {
  const ss = await driver.takeScreenshot();
  writeFileSync(join(OUTPUT_DIR, `${name}_${Date.now()}.png`), ss, 'base64');
  stats.screenshots++;
  return ss;
}

async function detectButtons(base64Png: string): Promise<Record<string, { x: number; y: number; confidence: number }>> {
  try {
    const res = await fetch(`${DETECTOR_URL}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Png, threshold: 0.2 }),
    });

    if (!res.ok) return {};

    const json = await res.json() as { detections?: YOLODetection[] };
    const result: Record<string, { x: number; y: number; confidence: number }> = {};

    for (const det of json.detections || []) {
      const label = (det.text || det.type || '').toLowerCase();
      if (!label.startsWith('btn_')) continue;

      stats.yoloDetections++;
      const buttonType = label.replace('btn_', '').toUpperCase();
      const clickable = CLICKABLE_POSITIONS[buttonType];

      if (clickable) {
        result[buttonType] = {
          ...clickable,
          confidence: det.confidence || 0,
        };
      }
    }

    return result;
  } catch {
    return {};
  }
}

async function tap(driver: WebdriverIO.Browser, x: number, y: number, name: string): Promise<void> {
  const pixelX = Math.round(x * ANDROID_SCREEN.scale);
  const pixelY = Math.round(y * ANDROID_SCREEN.scale);

  await driver.execute('mobile: shell', {
    command: 'input',
    args: ['tap', pixelX.toString(), pixelY.toString()],
  });

  stats.tapsExecuted++;
  console.log(`   Tapped ${name} at (${x}, ${y})`);
}

async function clickFlutterButton(driver: WebdriverIO.Browser, selectors: string[], click = true): Promise<boolean> {
  for (const sel of selectors) {
    try {
      const el = await driver.$(sel);
      if (await el.isExisting()) {
        if (click) await el.click();
        return true;
      }
    } catch {}
  }
  return false;
}

async function ensureAtLobby(driver: WebdriverIO.Browser): Promise<boolean> {
  // Check if already at lobby
  const atLobby = await clickFlutterButton(driver, ['//*[@content-desc="PLAY POKER"]'], false);
  if (atLobby) return true;

  // Try pressing back multiple times
  for (let i = 0; i < 5; i++) {
    await tap(driver, CLICKABLE_POSITIONS.BACK.x, CLICKABLE_POSITIONS.BACK.y, 'back');
    await driver.pause(1500);

    const found = await clickFlutterButton(driver, ['//*[@content-desc="PLAY POKER"]'], false);
    if (found) return true;
  }
  return false;
}

function chooseAction(buttons: Record<string, { x: number; y: number; confidence: number }>): string | null {
  if (buttons.CHECK) return 'CHECK';
  if (buttons.CALL) return 'CALL';
  if (buttons.RAISE) return 'RAISE';
  if (buttons.FOLD) return 'FOLD';
  return null;
}

async function waitForDealAgain(driver: WebdriverIO.Browser, maxWait = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const found = await clickFlutterButton(driver, [
      '//*[@content-desc="DEAL AGAIN"]',
      '//*[contains(@content-desc, "DEAL AGAIN")]',
    ]);
    if (found) return true;
    await driver.pause(1000);
  }
  return false;
}

async function playRound(driver: WebdriverIO.Browser, roundNum: number): Promise<boolean> {
  console.log(`\n--- Round ${roundNum}/${NUM_ROUNDS} ---`);

  // Navigate to poker table
  console.log('Navigating to poker table...');
  const pokerClicked = await clickFlutterButton(driver, [
    '//*[@content-desc="PLAY POKER"]',
  ]);
  if (!pokerClicked) {
    console.log('Could not find PLAY POKER button');
    return false;
  }
  await driver.pause(2000);

  // Click DEAL to start game
  console.log('Starting game...');
  const dealClicked = await clickFlutterButton(driver, [
    '//*[@content-desc="DEAL"]',
  ]);
  if (!dealClicked) {
    console.log('Could not find DEAL button');
    return false;
  }
  await driver.pause(2000);

  // Play poker actions
  console.log('Playing poker...');
  for (let action = 1; action <= ACTIONS_PER_ROUND; action++) {
    const ss = await driver.takeScreenshot();
    const buttons = await detectButtons(ss);
    const buttonNames = Object.keys(buttons);

    if (buttonNames.length === 0) {
      // No buttons detected - game might have ended
      await driver.pause(1500);
      continue;
    }

    const actionName = chooseAction(buttons);
    if (actionName) {
      const pos = buttons[actionName];
      console.log(`   Action ${action}: ${actionName} (${Math.round(pos.confidence * 100)}%)`);
      await tap(driver, pos.x, pos.y, actionName);
      await driver.pause(2000);
    }
  }

  // Wait for DEAL AGAIN button (game end)
  console.log('Waiting for game to end...');
  await waitForDealAgain(driver, 15000);
  await screenshot(driver, `round_${roundNum}_end`);

  // Return to lobby
  console.log('Returning to lobby...');
  const backToLobby = await ensureAtLobby(driver);
  if (backToLobby) {
    stats.rounds++;
    console.log(`Round ${roundNum} complete`);
  } else {
    console.log(`Round ${roundNum} - could not return to lobby`);
  }
  return backToLobby;
}

async function main() {
  console.log('='.repeat(50));
  console.log('  Android Rive Button Test');
  console.log('='.repeat(50));
  console.log(`Rounds: ${NUM_ROUNDS}, Actions per round: ${ACTIONS_PER_ROUND}`);
  console.log(`Output: ${OUTPUT_DIR}`);

  const driver = await remote({
    hostname: '127.0.0.1',
    port: 4723,
    path: '/',
    capabilities: {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': 'emulator-5554',
      'appium:appPackage': 'com.example.demo_casino',
      'appium:appActivity': '.MainActivity',
      'appium:noReset': true,
      'appium:newCommandTimeout': 600,
    },
  });

  console.log('\nConnected to Android\n');

  try {
    // Ensure at lobby first
    console.log('Ensuring at lobby...');
    const atLobby = await ensureAtLobby(driver);
    if (!atLobby) {
      console.log('Could not navigate to lobby');
      return;
    }
    console.log('At lobby');

    await screenshot(driver, 'initial');

    // Run rounds
    for (let round = 1; round <= NUM_ROUNDS; round++) {
      await playRound(driver, round);
      await driver.pause(1000);
    }

    // Results
    console.log('\n' + '='.repeat(50));
    console.log('  Results');
    console.log('='.repeat(50));
    console.log(`  Rounds completed: ${stats.rounds}/${NUM_ROUNDS}`);
    console.log(`  YOLO detections:  ${stats.yoloDetections}`);
    console.log(`  Taps executed:    ${stats.tapsExecuted}`);
    console.log(`  Screenshots:      ${stats.screenshots}`);
    console.log('='.repeat(50));

    if (stats.rounds === NUM_ROUNDS) {
      console.log('\nTEST PASSED');
    } else {
      console.log('\nTEST INCOMPLETE');
    }

  } catch (err) {
    console.error('\nError:', err);
  } finally {
    await driver.deleteSession();
  }
}

main().catch(console.error);
