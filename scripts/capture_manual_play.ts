#!/usr/bin/env npx tsx
/**
 * Capture screenshots while YOU play manually
 * 
 * This script takes screenshots every 2 seconds while you play poker.
 * Play normally and it will capture different game states automatically.
 */

import { remote } from 'webdriverio';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const CAPTURE_DIR = join(process.cwd(), 'services/detector/training_data/rive_poker_images');
const CAPTURE_INTERVAL_MS = 2000; // Screenshot every 2 seconds
const MAX_SCREENSHOTS = 200;

if (!existsSync(CAPTURE_DIR)) {
  mkdirSync(CAPTURE_DIR, { recursive: true });
}

let count = 0;

async function main() {
  console.log('🎮 Manual Play Screenshot Capture');
  console.log('==================================');
  console.log('');
  console.log('📸 Taking screenshots every 2 seconds while you play');
  console.log(`📁 Saving to: ${CAPTURE_DIR}`);
  console.log(`🎯 Target: ${MAX_SCREENSHOTS} screenshots`);
  console.log('');
  console.log('👆 PLAY THE GAME MANUALLY on your simulator!');
  console.log('   Press Ctrl+C to stop capturing');
  console.log('');
  
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
  
  console.log('✅ Connected! Start playing...\n');
  
  const startTime = Date.now();
  
  // Handle Ctrl+C gracefully
  process.on('SIGINT', async () => {
    console.log('\n\n⏹️ Stopping capture...');
    console.log(`📊 Total screenshots: ${count}`);
    console.log(`⏱️ Duration: ${Math.round((Date.now() - startTime) / 1000)}s`);
    await driver.deleteSession();
    process.exit(0);
  });
  
  while (count < MAX_SCREENSHOTS) {
    try {
      const ss = await driver.takeScreenshot();
      const filename = `poker_${Date.now()}.png`;
      writeFileSync(join(CAPTURE_DIR, filename), ss, 'base64');
      count++;
      
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      process.stdout.write(`\r📸 [${count}/${MAX_SCREENSHOTS}] ${filename} (${elapsed}s elapsed)`);
      
      await new Promise(r => setTimeout(r, CAPTURE_INTERVAL_MS));
    } catch (e) {
      console.log('\n⚠️ Screenshot error, retrying...');
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  console.log('\n\n✅ Capture complete!');
  console.log(`📊 Total screenshots: ${count}`);
  await driver.deleteSession();
}

main().catch(console.error);

