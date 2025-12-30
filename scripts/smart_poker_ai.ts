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
 */

import { remote } from 'webdriverio';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const OLLAMA_URL = 'http://localhost:11434';
const DETECTOR_URL = 'http://localhost:8001';
const OUTPUT_DIR = join(process.cwd(), 'apps/orchestrator/out/poker_ai');

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

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
  class: string;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
  label?: string;
}

// Button positions (iPhone 16 Pro Max: 430x932)
const BUTTON_POSITIONS = {
  deal: { x: 215, y: 575 },
  fold: { x: 55, y: 900 },
  check: { x: 160, y: 900 },
  call: { x: 160, y: 900 },
  raise: { x: 265, y: 900 },
  all_in: { x: 370, y: 900 },
};

async function takeScreenshot(driver: WebdriverIO.Browser, name: string): Promise<string> {
  const screenshot = await driver.takeScreenshot();
  const path = join(OUTPUT_DIR, `${name}.png`);
  writeFileSync(path, screenshot, 'base64');
  console.log(`📸 Screenshot saved: ${name}.png`);
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
        threshold: 0.3
      })
    });
    
    if (!response.ok) {
      console.log('   ⚠️ YOLO detection failed, using fallback');
      return [];
    }
    
    const result = await response.json();
    console.log(`   🔍 YOLO detected ${result.detections?.length || 0} elements`);
    return result.detections || [];
  } catch (error) {
    console.log('   ⚠️ YOLO service unavailable, using vision LLM');
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
  const actionKey = action.toLowerCase().replace(' ', '_').replace('all_in', 'all_in');
  const pos = BUTTON_POSITIONS[actionKey as keyof typeof BUTTON_POSITIONS];
  
  if (!pos) {
    console.log(`   ⚠️ Unknown action position: ${action}, trying text search`);
    // Try to find by text
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
  
  await driver.action('pointer')
    .move({ x: pos.x, y: pos.y })
    .down()
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
  console.log('\n🎰 Navigating to Poker Table...');
  
  // Scroll down twice to find Poker Table
  const { width, height } = await driver.getWindowRect();
  for (let i = 0; i < 2; i++) {
    await driver.action('pointer')
      .move({ x: width / 2, y: height * 0.7 })
      .down()
      .move({ x: width / 2, y: height * 0.3, duration: 300 })
      .up()
      .perform();
    await driver.pause(500);
  }
  
  // Tap PLAY POKER button
  try {
    const playPokerBtn = await driver.$('//*[contains(@label, "PLAY POKER") or contains(@name, "PLAY POKER")]');
    if (await playPokerBtn.isExisting()) {
      await playPokerBtn.click();
      console.log('   ✅ Found and tapped PLAY POKER button');
    }
  } catch {
    // Fallback to hardcoded position
    await driver.action('pointer')
      .move({ x: 190, y: 770 })
      .down()
      .up()
      .perform();
    console.log('   ⚡ Tapped poker table via hardcoded position');
  }
  
  await driver.pause(2000);
}

async function analyzeScreenshotWithLLM(screenshotPath: string): Promise<{ onPokerTable: boolean; availableActions: string[]; suggestion: string }> {
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
      await navigateToPoker(driver);
    } else if (!initialAnalysis.onPokerTable) {
      // Might be on lobby - try to navigate to poker
      console.log('📍 Trying to navigate to poker table...');
      await navigateToPoker(driver);
    } else {
      console.log('📍 Already on poker table!\n');
    }
    
    // Play 10 hands
    const NUM_HANDS = 10;
    for (let i = 1; i <= NUM_HANDS; i++) {
      await playPokerHand(driver, i);
    }
    
    console.log('\n🏆 ===== AI POKER SESSION COMPLETE =====');
    console.log(`   Played ${NUM_HANDS} hands using AI intelligence`);
    console.log(`   Screenshots saved to: ${OUTPUT_DIR}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await driver.deleteSession();
  }
}

main().catch(console.error);

