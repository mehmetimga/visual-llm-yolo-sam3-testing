#!/usr/bin/env npx tsx
/**
 * Capture Poker Screenshots
 * Flow: Lobby → DEBUG MODE → Select state → Play game (screenshots) → Back → Repeat
 */

import { remote } from 'webdriverio';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const CAPTURE_DIR = join(process.cwd(), 'services/detector/training_data/rive_poker_images');
const VERIFY_DIR = join(process.cwd(), 'services/detector/training_data/verify_yolo_rive');
const DETECTOR_URL = 'http://localhost:8001';
const SCREEN_SCALE = 3.0; // screenshot 1320x2868 vs Appium 440x956

const args = process.argv.slice(2);
const VERIFY_LOBBY_MODE = args.includes('--verify-lobby');
const SCREENSHOTS_PER_STATE = 125;
const STATES = ['CHECK', 'CALL', 'DEAL', 'FLOP', 'TURN', 'RIVER', 'RAISE', 'NORMAL'];

// Rive button coordinates (440x956 screen) - TESTED AND VERIFIED
const RIVE_BUTTONS = {
  check: { x: 60, y: 680 },    // Top left of action area
  call: { x: 60, y: 680 },     // Same as check
  bet: { x: 190, y: 680 },     // Center of action area
  raise: { x: 190, y: 680 },   // Same position as bet
  fold: { x: 60, y: 780 },     // Bottom left of action area
  allin: { x: 380, y: 680 },   // Top right shortcut
  pot: { x: 380, y: 740 },     // Middle right shortcut  
  deal: { x: 220, y: 550 },    // "Deal Again" center of screen
  back: { x: 32, y: 90 },      // Top left back arrow (verified)
};

if (!existsSync(CAPTURE_DIR)) {
  mkdirSync(CAPTURE_DIR, { recursive: true });
}
if (!existsSync(VERIFY_DIR)) {
  mkdirSync(VERIFY_DIR, { recursive: true });
}

let totalScreenshots = 0;

async function clickByLabel(driver: WebdriverIO.Browser, label: string, exact = false): Promise<boolean> {
  try {
    // Use contains for partial matching
    const selector = exact 
      ? `//*[@label="${label}"]`
      : `//*[contains(@label, "${label}")]`;
    
    const el = await driver.$(selector);
    if (await el.isExisting()) {
      await el.click();
      console.log(`   ✅ Clicked: "${label}"`);
      return true;
    }
  } catch {}
  console.log(`   ❌ Not found: "${label}"`);
  return false;
}

async function tapCoord(driver: WebdriverIO.Browser, x: number, y: number, name: string): Promise<void> {
  await driver.action('pointer')
    .move({ x, y })
    .down()
    .pause(100) // Crucial for Rive buttons
    .up()
    .perform();
  console.log(`   👆 Tap: ${name} (${x}, ${y})`);
}

async function screenshot(driver: WebdriverIO.Browser, name: string): Promise<void> {
  const ts = Date.now();
  const fn = `${name}_${ts}.png`;
  const ss = await driver.takeScreenshot();
  writeFileSync(join(CAPTURE_DIR, fn), ss, 'base64');
  totalScreenshots++;
  console.log(`   📸 [${totalScreenshots}] ${fn}`);
}

async function screenshotVerify(driver: WebdriverIO.Browser, name: string): Promise<string> {
  const ts = Date.now();
  const fn = `${name}_${ts}.png`;
  const ss = await driver.takeScreenshot();
  const fullPath = join(VERIFY_DIR, fn);
  writeFileSync(fullPath, ss, 'base64');
  console.log(`   📸 ${fn}`);
  return fullPath;
}

type YOLODet = {
  text?: string;
  type?: string;
  confidence?: number;
  bbox: { x: number; y: number; w: number; h: number };
};

async function detectButtonsFromScreenshotBase64(base64Png: string): Promise<Record<string, { x: number; y: number }>> {
  const res = await fetch(`${DETECTOR_URL}/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Png, threshold: 0.2 }),
  });

  if (!res.ok) {
    console.log(`   ⚠️ YOLO detector HTTP ${res.status}`);
    return {};
  }

  const json = await res.json();
  const detections: YOLODet[] = json.detections || [];

  const positions: Record<string, { x: number; y: number }> = {};
  for (const det of detections) {
    const label = (det.text || det.type || '').toLowerCase();
    if (!label.startsWith('btn_')) continue;

    const key = label.replace('btn_', '').toUpperCase(); // fold/check/call/raise/deal
    const cx = det.bbox.x + det.bbox.w / 2;
    const cy = det.bbox.y + det.bbox.h / 2;

    // Convert screenshot pixels -> Appium coordinate space
    const ax = Math.round(cx / SCREEN_SCALE);
    const ay = Math.round(cy / SCREEN_SCALE);
    positions[key] = { x: ax, y: ay };
  }

  const keys = Object.keys(positions);
  console.log(`   🎯 YOLO buttons: ${keys.length ? keys.join(', ') : 'none'}`);
  return positions;
}

function chooseActionFromDetected(pos: Record<string, { x: number; y: number }>): string | null {
  // Prefer safe actions to keep the game moving
  if (pos.DEAL) return 'DEAL';
  if (pos.CALL) return 'CALL';
  if (pos.CHECK) return 'CHECK';
  if (pos.RAISE) return 'RAISE';
  if (pos.FOLD) return 'FOLD';
  return null;
}

async function ensureLobby(driver: WebdriverIO.Browser): Promise<void> {
  // Try backing out up to 3 times (poker -> lobby etc.)
  for (let i = 0; i < 3; i++) {
    // If lobby buttons visible, stop
    const lobbyPlayPoker = await driver.$('//*[@label="PLAY POKER" or contains(@label, "PLAY POKER")]');
    const lobbyDebug = await driver.$('//*[@label="DEBUG MODE" or contains(@label, "DEBUG MODE")]');
    if (await lobbyPlayPoker.isExisting() || await lobbyDebug.isExisting()) {
      return;
    }
    await tapCoord(driver, RIVE_BUTTONS.back.x, RIVE_BUTTONS.back.y, 'back (ensure lobby)');
    await driver.pause(1200);
  }
}

async function goLobbyToPokerTable(driver: WebdriverIO.Browser): Promise<void> {
  console.log('\n➡️ Lobby → Poker Table');
  await ensureLobby(driver);

  // Prefer PLAY POKER button by label, fallback to test-id if it exists
  const selectors = [
    '//*[@label="PLAY POKER"]',
    '//*[contains(@label, "PLAY POKER")]',
    '~poker_table_play_button',
  ];

  for (const sel of selectors) {
    try {
      const el = await driver.$(sel);
      if (await el.isExisting()) {
        await el.click();
        console.log(`   ✅ Clicked: ${sel}`);
        await driver.pause(3000);
        return;
      }
    } catch {}
  }

  console.log('   ⚠️ Could not find PLAY POKER; attempting scroll and retry');
  await scrollDown(driver);
  for (const sel of selectors) {
    try {
      const el = await driver.$(sel);
      if (await el.isExisting()) {
        await el.click();
        console.log(`   ✅ Clicked after scroll: ${sel}`);
        await driver.pause(3000);
        return;
      }
    } catch {}
  }
}

async function verifyLobbyYoloRive(driver: WebdriverIO.Browser): Promise<void> {
  console.log('🧪 VERIFY MODE: Lobby → Poker → YOLO detect + Rive click → Back → repeat x5');
  console.log(`   Output screenshots: ${VERIFY_DIR}`);

  for (let round = 1; round <= 5; round++) {
    console.log(`\n==============================`);
    console.log(`🔁 ROUND ${round}/5`);
    console.log(`==============================`);

    await goLobbyToPokerTable(driver);
    await screenshotVerify(driver, `round_${round}_table_enter`);

    // Do a few actions using YOLO detections each time
    for (let step = 1; step <= 3; step++) {
      console.log(`\n   ▶️ Step ${step}/3`);
      const b64 = await driver.takeScreenshot(); // base64 png at 1320x2868
      const positions = await detectButtonsFromScreenshotBase64(b64);
      const action = chooseActionFromDetected(positions);

      if (!action) {
        console.log('   ⚠️ No btn_* detections. Taking screenshot and continuing...');
        await screenshotVerify(driver, `round_${round}_step_${step}_no_detections`);
        await driver.pause(1200);
        continue;
      }

      // Choose tap point: YOLO position if available, otherwise fallback
      const p = positions[action] || RIVE_BUTTONS[action.toLowerCase() as keyof typeof RIVE_BUTTONS] || null;
      if (!p) {
        console.log(`   ⚠️ No tap position for ${action}`);
        await driver.pause(1200);
        continue;
      }

      await screenshotVerify(driver, `round_${round}_step_${step}_before_${action}`);
      await tapCoord(driver, p.x, p.y, `${action} ${positions[action] ? '[YOLO]' : '[FALLBACK]'}`);
      await driver.pause(2500);
      await screenshotVerify(driver, `round_${round}_step_${step}_after_${action}`);
    }

    // Back to lobby
    console.log('\n⬅️ Back to lobby');
    await tapCoord(driver, RIVE_BUTTONS.back.x, RIVE_BUTTONS.back.y, 'back (table→lobby)');
    await driver.pause(2500);
    await screenshotVerify(driver, `round_${round}_lobby_back`);
  }
}

async function playGame(driver: WebdriverIO.Browser, state: string): Promise<void> {
  // Take initial screenshot
  await screenshot(driver, state.toLowerCase());
  
  // Play several rounds with different actions
  const actions = ['check', 'bet', 'fold', 'call', 'raise', 'allin', 'pot'];
  
  for (let i = 0; i < SCREENSHOTS_PER_STATE - 1; i++) {
    // Pick action - cycle through different buttons
    const action = actions[i % actions.length];
    const coord = RIVE_BUTTONS[action as keyof typeof RIVE_BUTTONS];
    
    if (!coord) {
      console.log(`   ⚠️ Unknown action: ${action}`);
      continue;
    }
    
    await tapCoord(driver, coord.x, coord.y, action);
    await driver.pause(2000);
    
    // Take screenshot after action
    await screenshot(driver, `${state.toLowerCase()}_${action}`);
    
    // Every few actions, try clicking deal in case game ended
    if (i % 3 === 2) {
      await tapCoord(driver, RIVE_BUTTONS.deal.x, RIVE_BUTTONS.deal.y, 'deal');
      await driver.pause(2000);
    }
  }
}

async function scrollDown(driver: WebdriverIO.Browser): Promise<void> {
  await driver.action('pointer')
    .move({ x: 220, y: 700 })
    .down()
    .move({ x: 220, y: 400, duration: 300 })
    .up()
    .perform();
  await driver.pause(500);
}

async function captureState(driver: WebdriverIO.Browser, state: string): Promise<void> {
  console.log(`\n${'='.repeat(40)}`);
  console.log(`🎯 STATE: ${state}`);
  console.log(`${'='.repeat(40)}`);
  
  // From LOBBY: Click DEBUG MODE
  console.log('\n📍 Step 1: Click DEBUG MODE');
  if (!await clickByLabel(driver, 'DEBUG MODE', true)) {
    // Try scrolling
    await scrollDown(driver);
    if (!await clickByLabel(driver, 'DEBUG MODE', true)) {
      console.log('   ❌ DEBUG MODE not found, skipping');
      return;
    }
  }
  await driver.pause(1500);
  
  // From DEBUG SCREEN: Click state (use contains for partial match)
  console.log(`\n📍 Step 2: Click ${state}`);
  // States have multi-line labels, use contains
  if (!await clickByLabel(driver, state, false)) {
    await scrollDown(driver);
    if (!await clickByLabel(driver, state, false)) {
      // Go back to lobby
      await tapCoord(driver, RIVE_BUTTONS.back.x, RIVE_BUTTONS.back.y, 'back');
      await driver.pause(1500);
      return;
    }
  }
  await driver.pause(2500); // Wait for poker table
  
  // POKER TABLE: Play and take screenshots
  console.log('\n📍 Step 3: Play game & capture screenshots');
  await playGame(driver, state);
  
  // Back to LOBBY (need to click back twice: poker → debug → lobby)
  console.log('\n📍 Step 4: Back to lobby');
  await tapCoord(driver, RIVE_BUTTONS.back.x, RIVE_BUTTONS.back.y, 'back (poker→debug)');
  await driver.pause(1500);
  await tapCoord(driver, RIVE_BUTTONS.back.x, RIVE_BUTTONS.back.y, 'back (debug→lobby)');
  await driver.pause(2000);
}

async function main() {
  if (VERIFY_LOBBY_MODE) {
    console.log('🧪 Poker YOLO+Rive Verify (from Lobby)');
    console.log(`Output: ${VERIFY_DIR}\n`);
  } else {
    console.log('🎰 Poker Screenshot Capture');
    console.log(`States: ${STATES.join(', ')}`);
    console.log(`Screenshots per state: ${SCREENSHOTS_PER_STATE}`);
    console.log(`Output: ${CAPTURE_DIR}\n`);
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
  
  console.log('✅ Connected to Appium\n');
  
  try {
    if (VERIFY_LOBBY_MODE) {
      await verifyLobbyYoloRive(driver);
    } else {
      // First make sure we're on lobby - click back if needed
      await tapCoord(driver, RIVE_BUTTONS.back.x, RIVE_BUTTONS.back.y, 'back (ensure lobby)');
      await driver.pause(1000);
      
      for (const state of STATES) {
        await captureState(driver, state);
      }
      
      console.log(`\n${'='.repeat(50)}`);
      console.log('✅ CAPTURE COMPLETE!');
      console.log(`   Total screenshots: ${totalScreenshots}`);
      console.log(`   Saved to: ${CAPTURE_DIR}`);
      console.log(`${'='.repeat(50)}`);
      console.log('\nNext steps:');
      console.log('  1. python services/detector/fastLabel_rive.py');
      console.log('  2. python services/detector/train_rive_poker.py');
    }
    
  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    await driver.deleteSession();
  }
}

main();
