/**
 * Data Capture Module for YOLO Training
 * Captures screenshots during poker gameplay and prepares them for labeling
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TRAINING_DATA_DIR = '/Users/mehmetimga/ai-campions/visual-llm-yolo-sam3-testing/services/detector/training_data';
const IMAGES_DIR = join(TRAINING_DATA_DIR, 'poker_images');
const LABELS_DIR = join(TRAINING_DATA_DIR, 'poker_labels');

// Ensure directories exist
if (!existsSync(IMAGES_DIR)) mkdirSync(IMAGES_DIR, { recursive: true });
if (!existsSync(LABELS_DIR)) mkdirSync(LABELS_DIR, { recursive: true });

let captureCounter = 0;

export interface CaptureMetadata {
  handNumber: number;
  stepNumber: number;
  gameState: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'deal_again' | 'action';
  actionTaken?: string;
  timestamp: string;
}

/**
 * Capture a screenshot for YOLO training
 */
export async function captureTrainingScreenshot(
  driver: WebdriverIO.Browser,
  metadata: CaptureMetadata
): Promise<string> {
  captureCounter++;
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `poker_h${metadata.handNumber}_s${metadata.stepNumber}_${metadata.gameState}_${captureCounter}`;
  const imagePath = join(IMAGES_DIR, `${filename}.png`);
  const metaPath = join(IMAGES_DIR, `${filename}.json`);
  
  // Take screenshot
  const screenshot = await driver.takeScreenshot();
  writeFileSync(imagePath, screenshot, 'base64');
  
  // Save metadata
  writeFileSync(metaPath, JSON.stringify({
    ...metadata,
    filename,
    captureCounter,
    imagePath,
  }, null, 2));
  
  console.log(`   📸 Captured training image: ${filename}.png`);
  
  return imagePath;
}

/**
 * Detect game state from available buttons
 */
export async function detectGameState(driver: WebdriverIO.Browser): Promise<string> {
  // Check for DEAL AGAIN button
  try {
    const dealAgain = await driver.$(`//XCUIElementTypeButton[contains(@label, "DEAL AGAIN") or contains(@label, "Deal Again")]`);
    if (await dealAgain.isExisting() && await dealAgain.isDisplayed()) {
      return 'deal_again';
    }
  } catch {}
  
  // Check for action buttons
  const actionLabels = ['FOLD', 'CHECK', 'CALL', 'RAISE', 'ALL IN'];
  for (const label of actionLabels) {
    try {
      const btn = await driver.$(`//XCUIElementTypeButton[contains(@label, "${label}")]`);
      if (await btn.isExisting() && await btn.isDisplayed()) {
        return 'action';
      }
    } catch {}
  }
  
  // Check for winner banner
  try {
    const winner = await driver.$(`//*[contains(@label, "wins") or contains(@label, "WIN")]`);
    if (await winner.isExisting()) {
      return 'showdown';
    }
  } catch {}
  
  return 'waiting';
}

/**
 * Play multiple hands while capturing training data
 */
export async function capturePokerTrainingData(
  driver: WebdriverIO.Browser,
  numHands: number,
  ollamaConfig: { baseUrl: string; model: string }
): Promise<{ imagesCapture: number; handsPlayed: number }> {
  console.log(`\n🎰 Starting YOLO training data capture for ${numHands} hands...\n`);
  
  let imagesCapture = 0;
  let handsPlayed = 0;
  
  for (let hand = 1; hand <= numHands; hand++) {
    console.log(`\n========== CAPTURING HAND #${hand} ==========`);
    
    // First, click DEAL or DEAL AGAIN if visible
    await clickDealIfVisible(driver);
    await driver.pause(2000);
    
    let stepInHand = 0;
    let handComplete = false;
    const maxStepsPerHand = 10;
    
    while (!handComplete && stepInHand < maxStepsPerHand) {
      stepInHand++;
      
      // Detect current game state
      const gameState = await detectGameState(driver);
      
      // Capture screenshot
      await captureTrainingScreenshot(driver, {
        handNumber: hand,
        stepNumber: stepInHand,
        gameState: gameState as any,
        timestamp: new Date().toISOString(),
      });
      imagesCapture++;
      
      if (gameState === 'deal_again') {
        console.log(`   🏆 Hand ${hand} complete - clicking DEAL AGAIN`);
        await clickDealIfVisible(driver);
        await driver.pause(2000);
        handComplete = true;
        handsPlayed++;
      } else if (gameState === 'action') {
        // Make a random action to progress the game
        const action = await makeRandomAction(driver);
        console.log(`   🎲 Action: ${action}`);
        await driver.pause(1500);
      } else {
        // Waiting state - just pause
        await driver.pause(1000);
      }
    }
    
    if (!handComplete) {
      console.log(`   ⚠️ Hand ${hand} did not complete within ${maxStepsPerHand} steps`);
      handsPlayed++;
    }
  }
  
  console.log(`\n✅ Training data capture complete!`);
  console.log(`   Images captured: ${imagesCapture}`);
  console.log(`   Hands played: ${handsPlayed}`);
  console.log(`   Images saved to: ${IMAGES_DIR}`);
  
  return { imagesCapture, handsPlayed };
}

/**
 * Click DEAL or DEAL AGAIN button if visible
 */
async function clickDealIfVisible(driver: WebdriverIO.Browser): Promise<boolean> {
  const dealLabels = ['DEAL AGAIN', 'DEAL', 'Deal Again', 'Deal'];
  
  for (const label of dealLabels) {
    try {
      const btn = await driver.$(`//XCUIElementTypeButton[contains(@label, "${label}") or contains(@name, "${label}")]`);
      if (await btn.isExisting() && await btn.isDisplayed()) {
        await btn.click();
        console.log(`   🃏 Clicked ${label}`);
        return true;
      }
    } catch {}
  }
  return false;
}

/**
 * Make a random poker action to progress the game
 */
async function makeRandomAction(driver: WebdriverIO.Browser): Promise<string> {
  // Weight actions: diverse mix for training data
  const actions = [
    { label: 'CHECK', weight: 25 },
    { label: 'CALL', weight: 25 },
    { label: 'RAISE', weight: 30 },  // More raises to capture slider states
    { label: 'FOLD', weight: 10 },
    { label: 'ALL IN', weight: 10 },
  ];
  
  // Try each action in weighted random order
  const shuffled = actions
    .map(a => ({ ...a, sort: Math.random() * a.weight }))
    .sort((a, b) => b.sort - a.sort);
  
  for (const action of shuffled) {
    try {
      const btn = await driver.$(`//XCUIElementTypeButton[contains(@label, "${action.label}")]`);
      if (await btn.isExisting() && await btn.isDisplayed()) {
        // For RAISE, randomly use the slider first
        if (action.label === 'RAISE' && Math.random() > 0.5) {
          await useRaiseSlider(driver);
        }
        await btn.click();
        return action.label;
      }
    } catch {}
  }
  
  return 'none';
}

/**
 * Use the raise slider to set different bet amounts
 */
async function useRaiseSlider(driver: WebdriverIO.Browser): Promise<void> {
  try {
    // Try to find and interact with the slider
    const slider = await driver.$('//XCUIElementTypeSlider');
    if (await slider.isExisting() && await slider.isDisplayed()) {
      // Get slider bounds
      const location = await slider.getLocation();
      const size = await slider.getSize();
      
      // Random position on slider (0.2 to 0.9 of width)
      const sliderX = location.x + size.width * (0.2 + Math.random() * 0.7);
      const sliderY = location.y + size.height / 2;
      
      // Tap on slider to change value
      await driver.action('pointer')
        .move({ x: Math.round(sliderX), y: Math.round(sliderY) })
        .down()
        .up()
        .perform();
      
      console.log(`   📊 Adjusted raise slider`);
      await driver.pause(300);
    }
  } catch {}
  
  // Also try quick bet buttons (Min, ½ Pot, Pot, Max)
  const quickBets = ['½ Pot', 'Pot', 'Min', 'Max'];
  const randomBet = quickBets[Math.floor(Math.random() * quickBets.length)];
  
  try {
    const btn = await driver.$(`//*[contains(@label, "${randomBet}") or contains(@name, "${randomBet}")]`);
    if (await btn.isExisting() && await btn.isDisplayed()) {
      await btn.click();
      console.log(`   💰 Selected ${randomBet} bet`);
      await driver.pause(200);
    }
  } catch {}
}

export function getTrainingStats(): { imagesDir: string; labelsDir: string } {
  return { imagesDir: IMAGES_DIR, labelsDir: LABELS_DIR };
}

