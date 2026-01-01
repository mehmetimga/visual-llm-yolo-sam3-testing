#!/usr/bin/env npx tsx
/**
 * Capture Debug States Script
 * Uses test-ids to navigate through the app and capture screenshots
 * 
 * Flow:
 * 1. Login if needed
 * 2. Navigate to lobby
 * 3. Click DEBUG MODE button (test-id: debug_poker_button)
 * 4. For each state (CHECK, CALL, DEAL, FLOP, TURN, RIVER, RAISE):
 *    - Click state card (test-id: debug_state_STATE)
 *    - Take N screenshots on poker table
 *    - Click back button (test-id: poker_back_button) → goes to lobby
 *    - Click DEBUG MODE again
 * 5. Repeat for all states
 */

import { remote } from 'webdriverio';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Configuration
const CAPTURE_DIR = join(process.cwd(), 'services/detector/training_data/debug_states');
const SCREENSHOTS_PER_STATE = 10;
const STATES = ['CHECK', 'CALL', 'DEAL', 'FLOP', 'TURN', 'RIVER', 'RAISE'];

// Create capture directory
if (!existsSync(CAPTURE_DIR)) {
  mkdirSync(CAPTURE_DIR, { recursive: true });
}

let totalScreenshots = 0;

async function findByLabel(driver: WebdriverIO.Browser, label: string): Promise<WebdriverIO.Element | null> {
  // Try exact label match first
  try {
    const element = await driver.$(`//*[@label="${label}"]`);
    if (await element.isExisting()) {
      return element;
    }
  } catch {}
  
  // Try by name attribute
  try {
    const element = await driver.$(`//*[@name="${label}"]`);
    if (await element.isExisting()) {
      return element;
    }
  } catch {}
  
  // Try by label containing the text
  try {
    const element = await driver.$(`//*[contains(@label, "${label}")]`);
    if (await element.isExisting()) {
      return element;
    }
  } catch {}
  
  // Try accessibility id
  try {
    const element = await driver.$(`~${label}`);
    if (await element.isExisting()) {
      return element;
    }
  } catch {}
  
  return null;
}

async function clickByLabel(driver: WebdriverIO.Browser, label: string, description: string): Promise<boolean> {
  console.log(`   🔍 Looking for: ${description} ("${label}")`);
  
  const element = await findByLabel(driver, label);
  if (element) {
    await element.click();
    console.log(`   ✅ Clicked: ${description}`);
    return true;
  }
  
  console.log(`   ⚠️ Not found: "${label}"`);
  return false;
}

async function login(driver: WebdriverIO.Browser): Promise<void> {
  console.log('\n🔐 Logging in...');
  
  const textFields = await driver.$$('XCUIElementTypeTextField');
  if (textFields.length >= 2) {
    await textFields[0].click();
    await driver.pause(300);
    await textFields[0].setValue('demo');
    
    await textFields[1].click();
    await driver.pause(300);
    await textFields[1].setValue('pw');
    
    // Find and click LOGIN button
    const loginBtn = await driver.$('//*[@label="LOG IN"]');
    if (await loginBtn.isExisting()) {
      await loginBtn.click();
      console.log('   ✅ Logged in');
      await driver.pause(2000);
    }
  }
}

async function scrollToDebugMode(driver: WebdriverIO.Browser): Promise<void> {
  const { width, height } = await driver.getWindowRect();
  
  // Scroll down to find DEBUG MODE button
  for (let i = 0; i < 3; i++) {
    await driver.action('pointer')
      .move({ x: width / 2, y: height * 0.7 })
      .down()
      .move({ x: width / 2, y: height * 0.3, duration: 300 })
      .up()
      .perform();
    await driver.pause(300);
  }
}

async function captureState(driver: WebdriverIO.Browser, stateName: string): Promise<void> {
  console.log(`\n📸 Capturing state: ${stateName}`);
  
  // Click on the state card by its name label (CHECK, CALL, DEAL, etc.)
  const clicked = await clickByLabel(driver, stateName, `${stateName} state card`);
  
  if (!clicked) {
    // Try scrolling in the debug screen
    const { width, height } = await driver.getWindowRect();
    await driver.action('pointer')
      .move({ x: width / 2, y: height * 0.7 })
      .down()
      .move({ x: width / 2, y: height * 0.4, duration: 200 })
      .up()
      .perform();
    await driver.pause(300);
    
    // Try again
    const retriedClick = await clickByLabel(driver, stateName, `${stateName} state card (retry)`);
    if (!retriedClick) {
      console.log(`   ❌ Could not find ${stateName} state card`);
      return;
    }
  }
  
  await driver.pause(2500); // Wait for poker table to load
  
  // Take screenshots
  for (let i = 1; i <= SCREENSHOTS_PER_STATE; i++) {
    const timestamp = Date.now();
    const filename = `${stateName.toLowerCase()}_${timestamp}_${i}.png`;
    const screenshot = await driver.takeScreenshot();
    writeFileSync(join(CAPTURE_DIR, filename), screenshot, 'base64');
    console.log(`   [${i}/${SCREENSHOTS_PER_STATE}] ${filename}`);
    totalScreenshots++;
    await driver.pause(200);
  }
  
  // Click back button - use fallback coordinates since back button doesn't have a text label
  console.log('   ⬅️ Going back to lobby...');
  await driver.action('pointer').move({ x: 40, y: 100 }).down().up().perform();
  await driver.pause(1500);
}

async function main() {
  console.log('🎯 Debug State Capture Script');
  console.log('==============================');
  console.log(`States to capture: ${STATES.join(', ')}`);
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
      'appium:newCommandTimeout': 300,
    },
  });
  
  console.log('✅ Connected to Appium\n');
  
  try {
    // Check if we need to login
    const loginBtn = await driver.$('//*[@label="LOG IN"]');
    if (await loginBtn.isExisting()) {
      await login(driver);
    }
    
    // Process each state
    for (const state of STATES) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`Processing: ${state}`);
      console.log('='.repeat(50));
      
      // Scroll to find DEBUG MODE button
      await scrollToDebugMode(driver);
      
      // Click DEBUG MODE button (search by button text)
      const debugClicked = await clickByLabel(driver, 'DEBUG MODE', 'DEBUG MODE button');
      if (!debugClicked) {
        console.log('   ❌ Could not find DEBUG MODE button in lobby');
        continue;
      }
      await driver.pause(1500);
      
      // Capture the state
      await captureState(driver, state);
    }
    
    console.log(`\n${'='.repeat(50)}`);
    console.log('📷 CAPTURE COMPLETE!');
    console.log('='.repeat(50));
    console.log(`Total screenshots: ${totalScreenshots}`);
    console.log(`Saved to: ${CAPTURE_DIR}`);
    console.log('\nNext steps:');
    console.log('  1. python services/detector/fastLabel_rive.py');
    console.log('  2. python services/detector/train_rive_poker.py');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await driver.deleteSession();
  }
}

main().catch(console.error);

