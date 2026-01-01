#!/usr/bin/env npx tsx
/**
 * Capture Poker Screenshots
 * Flow: Lobby → DEBUG MODE → Select state → Play game (screenshots) → Back → Repeat
 */

import { remote } from 'webdriverio';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const CAPTURE_DIR = join(process.cwd(), 'services/detector/training_data/rive_poker_images');
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
  console.log('🎰 Poker Screenshot Capture');
  console.log(`States: ${STATES.join(', ')}`);
  console.log(`Screenshots per state: ${SCREENSHOTS_PER_STATE}`);
  console.log(`Output: ${CAPTURE_DIR}\n`);
  
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
    
  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    await driver.deleteSession();
  }
}

main();
