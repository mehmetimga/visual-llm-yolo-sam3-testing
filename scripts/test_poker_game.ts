#!/usr/bin/env npx tsx
/**
 * Poker Game Test - iOS & Android
 *
 * Plays poker on the Flutter demo casino app using YOLO detection for Rive buttons.
 * Supports both iOS Simulator and Android Emulator.
 *
 * Test Flow (repeats for specified rounds):
 * 1. Start at Casino Lobby
 * 2. Tap "PLAY POKER" to enter poker table
 * 3. Tap DEAL to start hand
 * 4. Play actions (CHECK/CALL/RAISE/FOLD) using YOLO detection
 * 5. Wait for hand to end (DEAL AGAIN button)
 * 6. Return to lobby
 *
 * Prerequisites:
 * - Appium server running on http://127.0.0.1:4723
 * - YOLO detector running on http://localhost:8001
 * - iOS: Simulator running with demo_casino app
 * - Android: Emulator running, Appium started with --allow-insecure=uiautomator2:adb_shell
 *
 * Usage:
 *   npx tsx scripts/test_poker_game.ts --platform=ios --rounds=5
 *   npx tsx scripts/test_poker_game.ts --platform=android --rounds=5
 */

import { remote } from 'webdriverio';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// =============================================================================
// Configuration
// =============================================================================

type Platform = 'ios' | 'android';

const args = process.argv.slice(2);
const PLATFORM = (args.find(a => a.startsWith('--platform='))?.split('=')[1] || 'ios') as Platform;
const NUM_ROUNDS = parseInt(args.find(a => a.startsWith('--rounds='))?.split('=')[1] || '5');
const ACTIONS_PER_ROUND = parseInt(args.find(a => a.startsWith('--actions='))?.split('=')[1] || '5');

const OUTPUT_DIR = join(process.cwd(), `apps/orchestrator/out/poker_test_${PLATFORM}`);
const DETECTOR_URL = 'http://localhost:8001';

// Platform-specific configurations
const PLATFORM_CONFIG = {
  ios: {
    screenScale: 3.0,
    clickablePositions: {
      CHECK: { x: 60, y: 680 },
      CALL: { x: 60, y: 680 },
      BET: { x: 190, y: 680 },
      RAISE: { x: 190, y: 680 },
      FOLD: { x: 60, y: 780 },
      BACK: { x: 32, y: 90 },
    },
    selectors: {
      playPoker: '//*[@label="PLAY POKER"]',
      deal: '//*[@label="DEAL"]',
      dealAgain: '//*[@label="DEAL AGAIN"]',
    },
    capabilities: {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      'appium:deviceName': 'iPhone 16 Pro',
      'appium:platformVersion': '18.1',
      'appium:bundleId': 'com.example.demoCasino',
      'appium:noReset': true,
      'appium:newCommandTimeout': 600,
    },
  },
  android: {
    screenScale: 3.0,
    clickablePositions: {
      CHECK: { x: 57, y: 767 },
      CALL: { x: 57, y: 767 },
      BET: { x: 167, y: 767 },
      RAISE: { x: 167, y: 767 },
      FOLD: { x: 57, y: 817 },
      BACK: { x: 33, y: 67 },
    },
    selectors: {
      playPoker: '//*[@content-desc="PLAY POKER"]',
      deal: '//*[@content-desc="DEAL"]',
      dealAgain: '//*[@content-desc="DEAL AGAIN"]',
    },
    capabilities: {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': 'emulator-5554',
      'appium:appPackage': 'com.example.demo_casino',
      'appium:appActivity': '.MainActivity',
      'appium:noReset': true,
      'appium:newCommandTimeout': 600,
    },
  },
};

const config = PLATFORM_CONFIG[PLATFORM];

// Stats tracking
const stats = {
  rounds: 0,
  handsPlayed: 0,
  yoloDetections: 0,
  tapsExecuted: 0,
  screenshots: 0,
};

// =============================================================================
// Setup
// =============================================================================

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

type YOLODetection = {
  text?: string;
  type?: string;
  confidence?: number;
  bbox: { x: number; y: number; w: number; h: number };
};

// =============================================================================
// Core Functions
// =============================================================================

async function screenshot(driver: WebdriverIO.Browser, name: string): Promise<string> {
  const ss = await driver.takeScreenshot();
  const filename = `${name}_${Date.now()}.png`;
  writeFileSync(join(OUTPUT_DIR, filename), ss, 'base64');
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
      const clickable = config.clickablePositions[buttonType as keyof typeof config.clickablePositions];

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
  if (PLATFORM === 'android') {
    // Android: Use ADB input tap (Appium pointer actions don't work with Flutter/Rive)
    const pixelX = Math.round(x * config.screenScale);
    const pixelY = Math.round(y * config.screenScale);
    await driver.execute('mobile: shell', {
      command: 'input',
      args: ['tap', pixelX.toString(), pixelY.toString()],
    });
  } else {
    // iOS: Use Appium pointer actions with 100ms pause (required for Rive)
    await driver.action('pointer')
      .move({ x: Math.round(x), y: Math.round(y) })
      .down()
      .pause(100)
      .up()
      .perform();
  }

  stats.tapsExecuted++;
  console.log(`   Tapped ${name} at (${x}, ${y})`);
}

async function findElement(driver: WebdriverIO.Browser, selector: string): Promise<boolean> {
  try {
    const el = await driver.$(selector);
    return await el.isExisting();
  } catch {
    return false;
  }
}

async function clickElement(driver: WebdriverIO.Browser, selector: string): Promise<boolean> {
  try {
    const el = await driver.$(selector);
    if (await el.isExisting()) {
      await el.click();
      return true;
    }
  } catch {}
  return false;
}

async function ensureAtLobby(driver: WebdriverIO.Browser): Promise<boolean> {
  // Check if already at lobby
  if (await findElement(driver, config.selectors.playPoker)) {
    return true;
  }

  // Try pressing back multiple times
  for (let i = 0; i < 5; i++) {
    await tap(driver, config.clickablePositions.BACK.x, config.clickablePositions.BACK.y, 'back');
    await driver.pause(1500);

    if (await findElement(driver, config.selectors.playPoker)) {
      return true;
    }
  }
  return false;
}

function chooseAction(buttons: Record<string, { x: number; y: number; confidence: number }>): string | null {
  // Priority: CHECK > CALL > RAISE > FOLD
  if (buttons.CHECK) return 'CHECK';
  if (buttons.CALL) return 'CALL';
  if (buttons.RAISE) return 'RAISE';
  if (buttons.FOLD) return 'FOLD';
  return null;
}

async function waitForDealAgain(driver: WebdriverIO.Browser, maxWait = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    if (await clickElement(driver, config.selectors.dealAgain)) {
      return true;
    }
    await driver.pause(1000);
  }
  return false;
}

// =============================================================================
// Game Logic
// =============================================================================

async function playHand(driver: WebdriverIO.Browser, handNum: number): Promise<void> {
  console.log(`   Hand ${handNum}...`);

  for (let action = 1; action <= ACTIONS_PER_ROUND; action++) {
    const ss = await driver.takeScreenshot();
    const buttons = await detectButtons(ss);

    if (Object.keys(buttons).length === 0) {
      // No buttons - hand might have ended
      await driver.pause(1500);
      continue;
    }

    const actionName = chooseAction(buttons);
    if (actionName) {
      const pos = buttons[actionName];
      console.log(`      Action ${action}: ${actionName} (${Math.round(pos.confidence * 100)}%)`);
      await tap(driver, pos.x, pos.y, actionName);
      await driver.pause(2000);
    }
  }

  stats.handsPlayed++;
}

async function playRound(driver: WebdriverIO.Browser, roundNum: number): Promise<boolean> {
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Round ${roundNum}/${NUM_ROUNDS}`);
  console.log('='.repeat(40));

  // Navigate to poker table
  console.log('Navigating to poker table...');
  if (!await clickElement(driver, config.selectors.playPoker)) {
    console.log('   ERROR: Could not find PLAY POKER button');
    return false;
  }
  await driver.pause(2000);

  // Start first hand
  console.log('Starting game...');
  if (!await clickElement(driver, config.selectors.deal)) {
    console.log('   ERROR: Could not find DEAL button');
    return false;
  }
  await driver.pause(2000);

  // Play hands until we need to return to lobby
  let handsInRound = 0;
  const maxHands = 3; // Play up to 3 hands per round

  while (handsInRound < maxHands) {
    handsInRound++;
    await playHand(driver, handsInRound);

    // Wait for hand to end
    console.log('   Waiting for hand to end...');
    const dealAgainClicked = await waitForDealAgain(driver, 15000);

    if (!dealAgainClicked) {
      console.log('   Hand ended without DEAL AGAIN (likely all-in or fold)');
      break;
    }

    // DEAL AGAIN was clicked, continue to next hand
    await driver.pause(2000);
  }

  // Take screenshot at end of round
  await screenshot(driver, `round_${roundNum}_end`);

  // Return to lobby
  console.log('Returning to lobby...');
  const backToLobby = await ensureAtLobby(driver);
  if (backToLobby) {
    stats.rounds++;
    console.log(`Round ${roundNum} COMPLETE (${handsInRound} hands played)`);
  } else {
    console.log(`Round ${roundNum} - could not return to lobby`);
  }

  return backToLobby;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('');
  console.log('╔' + '═'.repeat(48) + '╗');
  console.log('║' + '  Poker Game Test'.padEnd(48) + '║');
  console.log('╠' + '═'.repeat(48) + '╣');
  console.log('║' + `  Platform: ${PLATFORM.toUpperCase()}`.padEnd(48) + '║');
  console.log('║' + `  Rounds: ${NUM_ROUNDS}`.padEnd(48) + '║');
  console.log('║' + `  Actions per hand: ${ACTIONS_PER_ROUND}`.padEnd(48) + '║');
  console.log('║' + `  Output: ${OUTPUT_DIR.split('/').slice(-2).join('/')}`.padEnd(48) + '║');
  console.log('╚' + '═'.repeat(48) + '╝');

  const driver = await remote({
    hostname: '127.0.0.1',
    port: 4723,
    path: '/',
    capabilities: config.capabilities as WebdriverIO.Capabilities,
  });

  console.log(`\nConnected to ${PLATFORM.toUpperCase()}\n`);

  try {
    // Ensure at lobby first
    console.log('Ensuring at lobby...');
    if (!await ensureAtLobby(driver)) {
      console.log('ERROR: Could not navigate to lobby');
      return;
    }
    console.log('At lobby\n');

    await screenshot(driver, 'initial');

    // Run rounds
    for (let round = 1; round <= NUM_ROUNDS; round++) {
      await playRound(driver, round);
      await driver.pause(1000);
    }

    // Print results
    console.log('');
    console.log('╔' + '═'.repeat(48) + '╗');
    console.log('║' + '  Results'.padEnd(48) + '║');
    console.log('╠' + '═'.repeat(48) + '╣');
    console.log('║' + `  Rounds completed: ${stats.rounds}/${NUM_ROUNDS}`.padEnd(48) + '║');
    console.log('║' + `  Hands played:     ${stats.handsPlayed}`.padEnd(48) + '║');
    console.log('║' + `  YOLO detections:  ${stats.yoloDetections}`.padEnd(48) + '║');
    console.log('║' + `  Taps executed:    ${stats.tapsExecuted}`.padEnd(48) + '║');
    console.log('║' + `  Screenshots:      ${stats.screenshots}`.padEnd(48) + '║');
    console.log('╚' + '═'.repeat(48) + '╝');

    if (stats.rounds === NUM_ROUNDS) {
      console.log('\n✅ TEST PASSED\n');
      process.exitCode = 0;
    } else {
      console.log('\n❌ TEST INCOMPLETE\n');
      process.exitCode = 1;
    }

  } catch (err) {
    console.error('\nERROR:', err);
    process.exitCode = 1;
  } finally {
    await driver.deleteSession();
  }
}

main().catch(console.error);
