#!/usr/bin/env npx tsx
/**
 * Smart Poker AI Player
 * Uses YOLO detection + Ollama LLM to play poker intelligently
 * 
 * Flow:
 * 1. Take screenshot
 * 2. Use YOLO to detect cards, buttons, game state
 * 3. Send detected info to LLM for decision
 * 4. Execute the recommended action
 * 5. Repeat for each hand
 * 
 * Usage:
 *   pnpm tsx scripts/smart_poker_ai.ts                    # Normal play
 *   pnpm tsx scripts/smart_poker_ai.ts --capture          # Capture mode for YOLO training
 *   pnpm tsx scripts/smart_poker_ai.ts --capture --hands=200  # Capture 200 hands
 *   pnpm tsx scripts/smart_poker_ai.ts --capture-states   # Capture all debug states systematically
 */

import { remote } from 'webdriverio';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const OLLAMA_URL = 'http://localhost:11434';
const DETECTOR_URL = 'http://localhost:8001';
const OUTPUT_DIR = join(process.cwd(), 'apps/orchestrator/out/poker_ai');

// Parse command line arguments
const args = process.argv.slice(2);
const CAPTURE_MODE = args.includes('--capture');
const CAPTURE_STATES_MODE = args.includes('--capture-states');
const handsArg = args.find(a => a.startsWith('--hands='));
const NUM_HANDS_ARG = handsArg ? parseInt(handsArg.split('=')[1]) : 10;

// Debug states to capture (matches Flutter DebugState.trainingStates)
const DEBUG_STATES = ['CHECK', 'CALL', 'DEAL', 'FLOP', 'TURN', 'RIVER', 'RAISE', 'NORMAL'];
const SCREENSHOTS_PER_STATE = 30; // Capture 30 screenshots per state

// Training data capture directory
const CAPTURE_DIR = join(process.cwd(), 'services/detector/training_data/rive_poker_images');

// Ensure output directories exist
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (CAPTURE_MODE && !existsSync(CAPTURE_DIR)) {
  mkdirSync(CAPTURE_DIR, { recursive: true });
}

// Screenshot counter for unique naming
let screenshotCounter = 0;

interface GameState {
  phase: 'pre_deal' | 'pre_flop' | 'flop' | 'turn' | 'river' | 'showdown' | 'unknown';
  myCards: string[];
  communityCards: string[];
  pot: number;
  myChips: number;
  availableActions: string[];
  currentBet: number;
}

interface YOLODetection {
  id: string;
  type: string;
  text: string;
  role: string;
  bbox: { x: number; y: number; w: number; h: number };
  confidence: number;
}

// Global detection state for YOLO dynamic coordinates
let detectedPositions: Record<string, { x: number; y: number }> = {};
const SCREEN_SCALE = 3.0; // 1320 (screenshot) / 440 (Appium) = 3.0

// NEW Rive button fallback positions (calibrated for 440x956 screen)
const BUTTON_POSITIONS = {
  deal: { x: 220, y: 550 },       // Center, above Rive panel
  fold: { x: 60, y: 780 },        // Bottom left of action area
  check: { x: 60, y: 680 },       // Top left of action area
  call: { x: 60, y: 680 },        // Same as check
  raise: { x: 190, y: 680 },      // Center of action area
  all_in: { x: 380, y: 680 },     // Top right shortcut
};

async function takeScreenshot(driver: WebdriverIO.Browser, name: string): Promise<string> {
  const screenshot = await driver.takeScreenshot();
  const path = join(OUTPUT_DIR, `${name}.png`);
  writeFileSync(path, screenshot, 'base64');
  console.log(`📸 Screenshot saved: ${name}.png`);
  
  // In capture mode, also save to training directory with unique timestamp
  if (CAPTURE_MODE) {
    screenshotCounter++;
    const timestamp = Date.now();
    const captureName = `rive_${name}_${timestamp}_${screenshotCounter}`;
    const capturePath = join(CAPTURE_DIR, `${captureName}.png`);
    writeFileSync(capturePath, screenshot, 'base64');
    console.log(`   📷 Training capture: ${captureName}.png`);
  }
  
  return path;
}

async function detectWithYOLO(screenshotPath: string): Promise<YOLODetection[]> {
  try {
    const imageData = readFileSync(screenshotPath);
    const base64 = imageData.toString('base64');
    
    const response = await fetch(`${DETECTOR_URL}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64,
        threshold: 0.2 // Use lower threshold for more reliable detection
      })
    });
    
    if (!response.ok) {
      console.log('   ⚠️ YOLO detection failed');
      return [];
    }
    
    const result = await response.json();
    const detections = result.detections || [];
    console.log(`   🔍 YOLO detected ${detections.length} elements`);
    
    // Clear old positions
    detectedPositions = {};
    
    // Map detections to scaled coordinates
    for (const det of detections) {
      const class_name = det.text || det.type || '';
      const actionKey = class_name.replace('btn_', '').toUpperCase();
      
      // Calculate center coordinate and scale to Appium space
      const appiumX = Math.round((det.bbox.x + det.bbox.w / 2) / SCREEN_SCALE);
      const appiumY = Math.round((det.bbox.y + det.bbox.h / 2) / SCREEN_SCALE);
      
      detectedPositions[actionKey] = { x: appiumX, y: appiumY };
      console.log(`      📍 ${actionKey}: [${appiumX}, ${appiumY}] (${Math.round(det.confidence * 100)}%)`);
    }
    
    return detections;
  } catch (error) {
    console.log('   ⚠️ YOLO service error');
    return [];
  }
}

async function analyzeWithVLM(screenshotPath: string): Promise<GameState> {
  try {
    const imageData = readFileSync(screenshotPath);
    const base64 = imageData.toString('base64');
    
    const prompt = `Analyze this poker game screenshot and respond ONLY with a JSON object (no markdown):

{
  "phase": "pre_deal|pre_flop|flop|turn|river|showdown",
  "myCards": ["card1", "card2"] or [] if face down,
  "communityCards": ["card1", ...] or [] if none,
  "pot": estimated pot amount as number,
  "myChips": my chip count as number,
  "availableActions": ["DEAL", "FOLD", "CHECK", "CALL", "RAISE", "ALL IN"],
  "currentBet": current bet to call as number
}

Look for:
- Yellow DEAL button = pre_deal phase
- Cards shown at bottom = my cards
- Cards in center = community cards
- Buttons at bottom: FOLD, CHECK, CALL, RAISE, ALL IN
- Player badge shows chip count`;

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llava:latest',
        prompt: prompt,
        images: [base64],
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error('VLM request failed');
    }
    
    const result = await response.json();
    const text = result.response || '';
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const gameState = JSON.parse(jsonMatch[0]);
      console.log(`   🎴 Game State: ${gameState.phase}, Actions: ${gameState.availableActions?.join(', ')}`);
      return gameState;
    }
    
    throw new Error('Could not parse game state');
  } catch (error) {
    console.log(`   ⚠️ VLM analysis failed: ${error}`);
    // Return default state based on common scenarios
    return {
      phase: 'unknown',
      myCards: [],
      communityCards: [],
      pot: 0,
      myChips: 1000,
      availableActions: ['DEAL', 'CHECK', 'FOLD'],
      currentBet: 0
    };
  }
}

async function askLLMForAction(gameState: GameState): Promise<string> {
  try {
    const prompt = `You are a poker AI. Given this game state, choose the best action.

Game State:
- Phase: ${gameState.phase}
- My Cards: ${gameState.myCards.length > 0 ? gameState.myCards.join(', ') : 'face down'}
- Community Cards: ${gameState.communityCards.length > 0 ? gameState.communityCards.join(', ') : 'none yet'}
- Pot: $${gameState.pot}
- My Chips: $${gameState.myChips}
- Current Bet to Call: $${gameState.currentBet}
- Available Actions: ${gameState.availableActions.join(', ')}

Respond with ONLY ONE WORD - the action to take: DEAL, FOLD, CHECK, CALL, RAISE, or ALL_IN

Strategy tips:
- If DEAL is available, always DEAL to start a new hand
- CHECK is free, prefer CHECK over FOLD when available
- FOLD if you have very weak cards and facing a big bet
- CALL with decent hands
- RAISE with strong hands

Your action:`;

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:3b',
        prompt: prompt,
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error('LLM request failed');
    }
    
    const result = await response.json();
    const text = (result.response || '').toUpperCase().trim();
    
    // Extract action from response
    const actions = ['DEAL', 'FOLD', 'CHECK', 'CALL', 'RAISE', 'ALL_IN', 'ALL IN'];
    for (const action of actions) {
      if (text.includes(action)) {
        const normalizedAction = action.replace(' ', '_').replace('ALL_IN', 'ALL IN');
        console.log(`   🤖 LLM Decision: ${normalizedAction}`);
        return normalizedAction;
      }
    }
    
    // Default to CHECK or DEAL if available
    if (gameState.availableActions.includes('DEAL')) return 'DEAL';
    if (gameState.availableActions.includes('CHECK')) return 'CHECK';
    return 'FOLD';
  } catch (error) {
    console.log(`   ⚠️ LLM decision failed: ${error}`);
    // Smart fallback
    if (gameState.availableActions.includes('DEAL')) return 'DEAL';
    if (gameState.availableActions.includes('CHECK')) return 'CHECK';
    return 'FOLD';
  }
}

async function executeAction(driver: WebdriverIO.Browser, action: string): Promise<void> {
  const actionKey = action.toUpperCase().replace(' ', '_');
  
  // Use detected position if available, otherwise fallback to calibrated ones
  let pos = detectedPositions[actionKey];
  let usedYolo = !!pos;
  
  if (!pos) {
    const fallbackKey = action.toLowerCase().replace(' ', '_');
    pos = BUTTON_POSITIONS[fallbackKey as keyof typeof BUTTON_POSITIONS];
  }
  
  if (!pos) {
    console.log(`   ⚠️ Unknown action position: ${action}, trying text search`);
    // ... rest of the code for text search fallback
    try {
      const element = await driver.$(`//*[contains(@label, "${action}") or contains(@name, "${action}")]`);
      if (await element.isExisting()) {
        await element.click();
        console.log(`   ✅ Executed ${action} via text search`);
        return;
      }
    } catch {}
    return;
  }
  
  console.log(`   👆 Tapping ${action} at (${pos.x}, ${pos.y})${usedYolo ? ' [YOLO]' : ' [FALLBACK]'} with 100ms pause...`);
  await driver.action('pointer')
    .move({ x: pos.x, y: pos.y })
    .down()
    .pause(100) // Crucial for Rive buttons
    .up()
    .perform();
  
  console.log(`   ✅ Executed ${action} at (${pos.x}, ${pos.y})`);
}

async function playPokerHand(driver: WebdriverIO.Browser, handNumber: number): Promise<void> {
  console.log(`\n🃏 ===== HAND ${handNumber} =====`);
  
  // Take screenshot and analyze with VLM
  const screenshotPath = await takeScreenshot(driver, `hand_${handNumber}_start`);
  const analysis = await analyzeScreenshotWithLLM(screenshotPath);
  
  // Check if we have any poker actions available
  const hasActions = analysis.availableActions.length > 0;
  
  if (!analysis.onPokerTable && !hasActions) {
    console.log('   ⚠️ Not on poker table and no actions - waiting...');
    await driver.pause(2000);
    return;
  }
  
  // If DEAL is suggested or available, start the hand
  if (analysis.suggestion === 'DEAL' || analysis.availableActions.includes('DEAL')) {
    console.log('   🎲 Starting new hand - clicking DEAL');
    await executeAction(driver, 'DEAL');
    await driver.pause(3000); // Wait for cards to be dealt
    
    // Take screenshot after deal
    const postDealPath = await takeScreenshot(driver, `hand_${handNumber}_dealt`);
    const postDealAnalysis = await analyzeScreenshotWithLLM(postDealPath);
    
    // Now make a strategic decision
    const action = postDealAnalysis.suggestion || 'CHECK';
    console.log(`   🤖 AI decision: ${action}`);
    await executeAction(driver, action);
  } else if (hasActions) {
    // Already in a hand, use AI suggestion
    const action = analysis.suggestion || 'CHECK';
    console.log(`   🤖 AI decision: ${action}`);
    await executeAction(driver, action);
  } else {
    console.log('   ⚠️ No actions available - waiting...');
  }
  
  // Wait for AI opponents to play
  console.log('   ⏳ Waiting for AI opponents...');
  await driver.pause(4000);
  
  // Take final screenshot
  await takeScreenshot(driver, `hand_${handNumber}_end`);
}

async function login(driver: WebdriverIO.Browser): Promise<void> {
  console.log('\n🔐 Logging in...');
  
  // Use same approach as runManager.ts for Flutter login
  
  // Type USERNAME
  await typeIntoField(driver, 'Username', 'demo');
  
  // Type PASSWORD  
  await typeIntoField(driver, 'Password', 'pw');
  
  // Dismiss keyboard
  try {
    const doneBtn = await driver.$('~Done');
    if (await doneBtn.isExisting()) {
      await doneBtn.click();
      await driver.pause(500);
    }
  } catch {}
  
  // Tap LOG IN button
  let tapped = false;
  
  // Try multiple ways to find and tap login button
  try {
    const loginBtn = await driver.$('//XCUIElementTypeButton[@label="LOG IN" or @name="LOG IN"]');
    if (await loginBtn.isExisting()) {
      await loginBtn.click();
      tapped = true;
      console.log('   ✅ Tapped LOG IN button via XPath');
    }
  } catch {}
  
  if (!tapped) {
    try {
      const loginBtn = await driver.$(`//*[contains(@label, "LOG IN") or contains(@name, "LOG IN")]`);
      if (await loginBtn.isExisting()) {
        await loginBtn.click();
        tapped = true;
        console.log('   ✅ Tapped LOG IN button via contains');
      }
    } catch {}
  }
  
  if (!tapped) {
    // Use hardcoded position for login button
    await driver.action('pointer')
      .move({ x: 215, y: 470 })
      .down()
      .up()
      .perform();
    console.log('   ⚡ Tapped LOG IN via hardcoded position');
  }
  
  console.log('   ✅ Logged in successfully');
  await driver.pause(2000);
}

async function typeIntoField(driver: WebdriverIO.Browser, fieldLabel: string, text: string): Promise<void> {
  console.log(`   📝 Typing "${text}" into ${fieldLabel}...`);
  
  // Dismiss any existing keyboard first
  try {
    const doneBtn = await driver.$('~Done');
    if (await doneBtn.isExisting()) {
      await doneBtn.click();
      await driver.pause(800);
    }
  } catch {}
  
  // Find all TextFields - retry a few times
  let attempts = 3;
  while (attempts > 0) {
    try {
      const allTextFields = await driver.$$('XCUIElementTypeTextField');
      console.log(`   🔍 Found ${allTextFields.length} TextFields (looking for "${fieldLabel}")`);
      
      let targetElement = null;
      
      // Find the field by matching label
      for (const field of allTextFields) {
        try {
          const label = await field.getAttribute('label');
          if (label === fieldLabel) {
            targetElement = field;
            console.log(`   📍 Found field by label: "${label}"`);
            break;
          }
        } catch {}
      }
      
      if (!targetElement) {
        console.log(`   ⚠️ Could not find field with label "${fieldLabel}"`);
        return;
      }
      
      // Click the field to focus it
      await targetElement.click();
      await driver.pause(1000); // Wait for keyboard to appear
      
      // Clear existing content
      try {
        const currentValue = await targetElement.getAttribute('value');
        const charsToDelete = currentValue ? currentValue.length : 0;
        
        if (charsToDelete > 0) {
          console.log(`   🧹 Clearing ${charsToDelete} characters...`);
          // Delete characters using backspace
          for (let i = 0; i < charsToDelete; i++) {
            await driver.keys(['\uE003']); // Backspace key
          }
          await driver.pause(100);
          console.log(`   🧹 Field cleared successfully`);
        } else {
          console.log(`   🧹 Field already empty`);
        }
      } catch (err) {
        console.log(`   ⚠️ Error clearing field: ${err}`);
      }
      
      await driver.pause(300);
      
      // Type each character using keys (same as working runManager.ts)
      for (const char of text) {
        await driver.keys([char]);
        await driver.pause(50);
      }
      
      console.log(`   ✅ Typed "${text}" into ${fieldLabel} field`);
      await driver.pause(300);
      return;
      
    } catch (err: any) {
      attempts--;
      const errMsg = err?.toString() || '';
      if (errMsg.includes('stale') && attempts > 0) {
        console.log(`   ⚠️ Stale element, retrying (${attempts} attempts left)...`);
        await driver.pause(500);
      } else {
        console.log(`   ⚠️ Could not interact with field: ${err}`);
        return;
      }
    }
  }
}

async function navigateToPoker(driver: WebdriverIO.Browser): Promise<void> {
  console.log('\n➡️ Navigating from Lobby to Poker Table...');
  
  // Try to find the PLAY POKER button by label or test ID
  const selectors = [
    '//*[@label="PLAY POKER"]',
    '~poker_table_play_button',
    '//*[contains(@label, "PLAY POKER")]',
    '//*[contains(@label, "Poker Table")]'
  ];

  for (const selector of selectors) {
    try {
      const playBtn = await driver.$(selector);
      if (await playBtn.isExisting()) {
        await playBtn.click();
        console.log(`   ✅ Clicked Poker Table via: ${selector}`);
        await driver.pause(3000);
        return;
      }
    } catch (e) {}
  }

  // Fallback to scrolling if not found
  console.log('   📜 Scrolling to find Poker Table...');
  const { width, height } = await driver.getWindowRect();
  for (let i = 0; i < 2; i++) {
    await driver.action('pointer')
      .move({ x: width / 2, y: height * 0.7 })
      .down()
      .move({ x: width / 2, y: height * 0.3, duration: 300 })
      .up()
      .perform();
    await driver.pause(1000);
    
    // Try selectors again after scrolling
    for (const selector of selectors) {
      try {
        const playBtn = await driver.$(selector);
        if (await playBtn.isExisting()) {
          await playBtn.click();
          console.log(`   ✅ Clicked Poker Table via: ${selector}`);
          await driver.pause(3000);
          return;
        }
      } catch (e) {}
    }
  }

  console.log('   ⚠️ Could not find PLAY POKER button, assuming already on table');
}

async function navigateToDebugSetup(driver: WebdriverIO.Browser): Promise<void> {
  console.log('\n🎯 Navigating to Debug Setup Screen...');
  
  // Scroll down to find Debug button
  const { width, height } = await driver.getWindowRect();
  for (let i = 0; i < 3; i++) {
    await driver.action('pointer')
      .move({ x: width / 2, y: height * 0.7 })
      .down()
      .move({ x: width / 2, y: height * 0.3, duration: 300 })
      .up()
      .perform();
    await driver.pause(500);
  }
  
  // Tap DEBUG MODE button
  try {
    const debugBtn = await driver.$('//*[contains(@label, "DEBUG MODE") or contains(@name, "DEBUG MODE")]');
    if (await debugBtn.isExisting()) {
      await debugBtn.click();
      console.log('   ✅ Found and tapped DEBUG MODE button');
      await driver.pause(2000);
      return;
    }
  } catch {}
  
  // Fallback: Try to find by accessibility id
  try {
    const debugBtn = await driver.$('~debug_poker_button');
    if (await debugBtn.isExisting()) {
      await debugBtn.click();
      console.log('   ✅ Tapped debug button via accessibility id');
      await driver.pause(2000);
      return;
    }
  } catch {}
  
  console.log('   ⚠️ Could not find DEBUG MODE button - make sure app is in debug mode');
  throw new Error('Debug mode not available');
}

async function selectDebugState(driver: WebdriverIO.Browser, stateName: string): Promise<void> {
  console.log(`\n🎯 Selecting debug state: ${stateName}`);
  
  await driver.pause(500);
  
  // Try to find and tap the state by label
  try {
    const stateBtn = await driver.$(`//*[contains(@label, "${stateName}") or contains(@name, "${stateName}")]`);
    if (await stateBtn.isExisting()) {
      await stateBtn.click();
      console.log(`   ✅ Selected state: ${stateName}`);
      await driver.pause(2000);
      return;
    }
  } catch {}
  
  // Fallback: Scroll and try again
  const { width, height } = await driver.getWindowRect();
  await driver.action('pointer')
    .move({ x: width / 2, y: height * 0.7 })
    .down()
    .move({ x: width / 2, y: height * 0.4, duration: 200 })
    .up()
    .perform();
  await driver.pause(500);
  
  try {
    const stateBtn = await driver.$(`//*[contains(@label, "${stateName}") or contains(@name, "${stateName}")]`);
    if (await stateBtn.isExisting()) {
      await stateBtn.click();
      console.log(`   ✅ Selected state: ${stateName} (after scroll)`);
      await driver.pause(2000);
      return;
    }
  } catch {}
  
  console.log(`   ⚠️ Could not find state: ${stateName}`);
}

async function goBackToLobby(driver: WebdriverIO.Browser): Promise<void> {
  console.log('   ⬅️ Going back to lobby...');
  
  // Tap back button (usually at top-left)
  try {
    const backBtn = await driver.$('~BackButton');
    if (await backBtn.isExisting()) {
      await backBtn.click();
      await driver.pause(1000);
      return;
    }
  } catch {}
  
  // Fallback: tap at top-left corner
  await driver.action('pointer')
    .move({ x: 30, y: 60 })
    .down()
    .up()
    .perform();
  await driver.pause(1000);
}

async function captureAllDebugStates(driver: WebdriverIO.Browser): Promise<void> {
  console.log('\n📷 ===== CAPTURING ALL DEBUG STATES =====\n');
  console.log(`   States to capture: ${DEBUG_STATES.join(', ')}`);
  console.log(`   Screenshots per state: ${SCREENSHOTS_PER_STATE}`);
  console.log(`   Total expected: ${DEBUG_STATES.length * SCREENSHOTS_PER_STATE} screenshots\n`);
  
  for (const state of DEBUG_STATES) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📸 Capturing state: ${state}`);
    console.log('='.repeat(50));
    
    // Navigate to debug setup screen
    await goBackToLobby(driver);
    await driver.pause(500);
    await navigateToDebugSetup(driver);
    
    // Select the state
    await selectDebugState(driver, state);
    
    // Capture screenshots
    for (let i = 1; i <= SCREENSHOTS_PER_STATE; i++) {
      const timestamp = Date.now();
      const name = `${state.toLowerCase()}_${timestamp}_${i}`;
      await takeScreenshot(driver, name);
      
      // For interactive states, perform some actions to capture variations
      if (state !== 'DEAL' && state !== 'NORMAL') {
        // Wait briefly between captures
        await driver.pause(500);
        
        // Every 5 screenshots, try to interact (if not in DEAL state)
        if (i % 5 === 0 && i < SCREENSHOTS_PER_STATE - 5) {
          console.log(`   🎲 Performing action for variation...`);
          try {
            // Tap a random button for variation
            const actions = ['CHECK', 'CALL', 'FOLD'];
            const randomAction = actions[Math.floor(Math.random() * actions.length)];
            await executePokerAction(driver, randomAction);
            await driver.pause(1000);
            
            // After action, we might be in a new state - go back and re-enter
            await goBackToLobby(driver);
            await navigateToDebugSetup(driver);
            await selectDebugState(driver, state);
          } catch {}
        }
      } else {
        await driver.pause(300);
      }
    }
    
    console.log(`   ✅ Captured ${SCREENSHOTS_PER_STATE} screenshots for ${state}`);
  }
  
  console.log(`\n${'='.repeat(50)}`);
  console.log('📷 STATE CAPTURE COMPLETE!');
  console.log('='.repeat(50));
  console.log(`   Total screenshots captured: ${screenshotCounter}`);
  console.log(`   Saved to: ${CAPTURE_DIR}`);
}

async function analyzeScreenshotWithLLM(screenshotPath: string): Promise<{ onPokerTable: boolean; availableActions: string[]; suggestion: string }> {
  // YOLO-first approach: Try YOLO detection, fall back to VLM only if needed
  
  // Step 1: Try YOLO detection
  const yoloDetections = await detectWithYOLO(screenshotPath);
  
  if (yoloDetections.length > 0) {
    // Parse YOLO detections into buttons
    const detectedButtons: string[] = [];
    let hasDealButton = false;
    
    for (const det of yoloDetections) {
      const type = det.text || det.type || '';
      if (type.includes('fold')) detectedButtons.push('FOLD');
      if (type.includes('check')) detectedButtons.push('CHECK');
      if (type.includes('call')) detectedButtons.push('CALL');
      if (type.includes('raise')) detectedButtons.push('RAISE');
      if (type.includes('deal')) {
        detectedButtons.push('DEAL');
        hasDealButton = true;
      }
    }
    
    // Remove duplicates
    const uniqueButtons = [...new Set(detectedButtons)];
    
    // If we see CALL or RAISE, FOLD is always available too (even if not detected)
    if ((uniqueButtons.includes('CALL') || uniqueButtons.includes('RAISE')) && !uniqueButtons.includes('FOLD')) {
      uniqueButtons.push('FOLD');
    }
    
    // Note: YOLO labels btn_check and btn_call at same position
    // The actual button shows CHECK when canCheck=true, CALL when there's a bet
    // For now, we assume if CALL is detected, CHECK might also be available
    // The game logic handles this - clicking the same position works for both
    
    if (uniqueButtons.length > 0) {
      // Determine suggestion based on detected buttons
      let suggestion = 'CHECK';
      if (hasDealButton) {
        suggestion = 'DEAL';
      } else if (uniqueButtons.includes('CHECK')) {
        suggestion = 'CHECK';
      } else if (uniqueButtons.includes('CALL')) {
        suggestion = 'CALL';
      } else if (uniqueButtons.includes('FOLD')) {
        suggestion = 'FOLD';
      }
      
      console.log(`   🎯 YOLO: buttons=${uniqueButtons.join(', ')}, suggestion=${suggestion}`);
      return {
        onPokerTable: true,
        availableActions: uniqueButtons,
        suggestion
      };
    }
  }
  
  // Step 2: Fall back to VLM if YOLO didn't find buttons
  console.log('   📡 Falling back to VLM...');
  try {
    const imageData = readFileSync(screenshotPath);
    const base64 = imageData.toString('base64');
    
    const prompt = `Look at this poker game screenshot and tell me:
1. Is this a poker table screen? (yes/no)
2. What buttons are visible at the bottom? List them (e.g., DEAL, FOLD, CHECK, CALL, RAISE, ALL IN)
3. Based on what you see, what action would you recommend?

Respond in this EXACT format (JSON only, no markdown):
{"onPokerTable": true, "buttons": ["FOLD", "CHECK", "RAISE", "ALL IN"], "suggestion": "CHECK"}

If you see a yellow DEAL button in the center, respond:
{"onPokerTable": true, "buttons": ["DEAL"], "suggestion": "DEAL"}

If it's a login screen, respond:
{"onPokerTable": false, "buttons": [], "suggestion": "LOGIN"}`;

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llava:latest',
        prompt: prompt,
        images: [base64],
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error('VLM request failed');
    }
    
    const result = await response.json();
    const text = result.response || '';
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const buttons = parsed.buttons || [];
      
      // If we detect poker buttons, we're on the poker table
      const pokerButtons = ['FOLD', 'CHECK', 'CALL', 'RAISE', 'ALL IN', 'DEAL'];
      const hasPokerButtons = buttons.some((b: string) => pokerButtons.includes(b.toUpperCase()));
      const onPokerTable = parsed.onPokerTable === true || hasPokerButtons;
      
      console.log(`   🔍 VLM: buttons=${buttons.join(', ') || 'none'}, suggestion=${parsed.suggestion}, onTable=${onPokerTable}`);
      return {
        onPokerTable,
        availableActions: buttons,
        suggestion: parsed.suggestion || 'CHECK'
      };
    }
    
    throw new Error('Could not parse VLM response');
  } catch (error) {
    console.log(`   ⚠️ VLM failed: ${error}`);
    // Default - assume we're on poker table with basic actions
    return {
      onPokerTable: true,
      availableActions: ['CHECK', 'FOLD'],
      suggestion: 'CHECK'
    };
  }
}

async function detectGameStateFromScreenshot(screenshotPath: string): Promise<GameState> {
  const analysis = await analyzeScreenshotWithLLM(screenshotPath);
  
  return {
    phase: analysis.availableActions.includes('DEAL') ? 'pre_deal' : 'pre_flop',
    myCards: [],
    communityCards: [],
    pot: 0,
    myChips: 1000,
    availableActions: analysis.availableActions,
    currentBet: 0
  };
}

async function main() {
  console.log('🤖 Smart Poker AI Player Starting...\n');
  console.log('This AI uses:');
  console.log('  - UI element detection for game state');
  console.log('  - Ollama LLM (llama3.2) for strategic decisions\n');
  
  if (CAPTURE_STATES_MODE) {
    console.log('📷 CAPTURE STATES MODE ENABLED');
    console.log(`   Will systematically capture all debug states`);
    console.log(`   States: ${DEBUG_STATES.join(', ')}`);
    console.log(`   Screenshots per state: ${SCREENSHOTS_PER_STATE}\n`);
  } else if (CAPTURE_MODE) {
    console.log('📷 CAPTURE MODE ENABLED');
    console.log(`   Training images will be saved to: ${CAPTURE_DIR}`);
    console.log(`   Playing ${NUM_HANDS_ARG} hands for data collection\n`);
  }
  
  // Connect to Appium
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
    // Take screenshot and analyze where we are
    const initialPath = await takeScreenshot(driver, 'initial_state');
    const initialAnalysis = await analyzeScreenshotWithLLM(initialPath);
    
    // Check if we're on login screen by looking for TextFields
    const allTextFields = await driver.$$('XCUIElementTypeTextField');
    const isLoginScreen = allTextFields.length >= 2; // Login has username + password fields
    
    if (isLoginScreen && !initialAnalysis.onPokerTable) {
      console.log(`📍 On login screen (found ${allTextFields.length} text fields) - logging in...`);
      await login(driver);
      await driver.pause(2000);
    }
    
    // CAPTURE STATES MODE: Systematically capture all debug states
    if (CAPTURE_STATES_MODE) {
      await captureAllDebugStates(driver);
      
      console.log('\n🏆 ===== STATE CAPTURE COMPLETE =====');
      console.log(`   Total screenshots: ${screenshotCounter}`);
      console.log(`   Saved to: ${CAPTURE_DIR}`);
      console.log('\n📋 Next steps:');
      console.log('   1. Run: python services/detector/fastLabel_rive.py');
      console.log('   2. Run: python services/detector/train_rive_poker.py');
      
    } else {
      // Normal mode or capture mode: Navigate to poker and play
      if (!initialAnalysis.onPokerTable) {
        console.log('📍 Navigating to poker table...');
        await navigateToPoker(driver);
      } else {
        console.log('📍 Already on poker table!\n');
      }
      
      // Play hands
      const NUM_HANDS = NUM_HANDS_ARG;
      for (let i = 1; i <= NUM_HANDS; i++) {
        await playPokerHand(driver, i);
      }
      
      console.log('\n🏆 ===== AI POKER SESSION COMPLETE =====');
      console.log(`   Played ${NUM_HANDS} hands using AI intelligence`);
      console.log(`   Screenshots saved to: ${OUTPUT_DIR}`);
      
      if (CAPTURE_MODE) {
        console.log(`   📷 Training screenshots: ${screenshotCounter} images captured`);
        console.log(`   📁 Saved to: ${CAPTURE_DIR}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await driver.deleteSession();
  }
}

main().catch(console.error);

