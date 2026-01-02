/**
 * AI Poker Player
 * Uses YOLO detection + Visual LLM to analyze poker game state and make decisions
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { visionFallback } from './visionHelper.js';

export interface PokerGameState {
  playerCards: string[];
  communityCards: string[];
  potSize: number;
  currentBet: number;
  playerStack: number;
  availableActions: string[];
  gamePhase: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'unknown';
}

export interface PokerDecision {
  action: 'fold' | 'check' | 'call' | 'raise' | 'all_in';
  reasoning: string;
  confidence: number;
}

export interface AIPokerConfig {
  detectorUrl: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
}

/**
 * Analyze the poker game screenshot and decide what action to take
 */
export async function analyzeAndDecide(
  screenshotPath: string,
  config: AIPokerConfig,
  handNumber: number
): Promise<PokerDecision> {
  console.log(`\n   🎰 AI Poker Hand #${handNumber}`);
  console.log(`   📸 Analyzing game state from screenshot...`);

  try {
    // Step 1: Detect UI elements using YOLO
    const detections = await detectPokerElements(screenshotPath, config.detectorUrl);
    console.log(`   🔍 YOLO detected ${detections.length} elements`);

    // Step 2: Send screenshot to Visual LLM for game analysis and decision
    const decision = await askLLMForPokerDecision(screenshotPath, detections, config, handNumber);
    
    console.log(`   🧠 AI Decision: ${decision.action.toUpperCase()}`);
    console.log(`   💭 Reasoning: ${decision.reasoning}`);
    console.log(`   📊 Confidence: ${(decision.confidence * 100).toFixed(0)}%`);

    return decision;
  } catch (err) {
    console.log(`   ⚠️ AI analysis failed: ${err}`);
    // Default to CHECK if available, otherwise FOLD
    return {
      action: 'check',
      reasoning: 'Fallback decision due to analysis error',
      confidence: 0.3
    };
  }
}

/**
 * Detect poker-specific elements using YOLO
 */
async function detectPokerElements(
  screenshotPath: string,
  detectorUrl: string
): Promise<any[]> {
  try {
    const imageBuffer = readFileSync(screenshotPath);
    const base64Image = imageBuffer.toString('base64');

    const response = await fetch(`${detectorUrl}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64Image,
        conf_threshold: 0.25
      })
    });

    if (!response.ok) {
      console.log(`   ⚠️ Detector returned ${response.status}`);
      return [];
    }

    const result = await response.json() as { detections: any[], count: number };
    return result.detections || [];
  } catch (err) {
    console.log(`   ⚠️ YOLO detection failed: ${err}`);
    return [];
  }
}

type DetectedElement = {
  type?: string;
  text?: string;
  confidence?: number;
  bbox?: { x: number; y: number; w: number; h: number };
};

function hasRiveActionButtonsFromDetections(detections: DetectedElement[]): boolean {
  return detections.some((d) => {
    const t = (d.type || '').toLowerCase();
    if (!t.startsWith('btn_')) return false;
    const conf = d.confidence ?? 0;
    // Keep this permissive; our model is high-confidence on Rive buttons.
    return conf >= 0.3;
  });
}

/**
 * Use YOLO + LLM to check if it's our turn (buttons are active/colored, not grayed)
 */
async function checkIfOurTurnWithYOLO(
  screenshotPath: string,
  config: AIPokerConfig
): Promise<{ isOurTurn: boolean; reason: string }> {
  const imageBuffer = readFileSync(screenshotPath);
  const base64Image = imageBuffer.toString('base64');

  const prompt = `Look at this poker game screenshot and tell me:
1. Is it MY turn to act? (Are the action buttons at the bottom COLORED/ACTIVE, or are they GRAYED OUT/DISABLED?)
2. Do you see "Thinking..." text which means another player is deciding?

Respond with ONLY JSON:
{"is_my_turn": true/false, "reason": "brief explanation"}

If buttons are RED/GREEN/ORANGE/PURPLE = my turn (active)
If buttons are GRAY = not my turn (disabled)
If "Thinking..." visible = not my turn`;

  try {
    const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        messages: [{ role: 'user', content: prompt, images: [base64Image] }],
        stream: false,
        options: { temperature: 0.1 }
      })
    });

    if (response.ok) {
      const result = await response.json() as { message?: { content: string } };
      const text = result.message?.content || '';
      const jsonMatch = text.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          isOurTurn: parsed.is_my_turn === true,
          reason: parsed.reason || ''
        };
      }
    }
  } catch (err) {
    // Fallback: assume it's our turn
  }

  return { isOurTurn: true, reason: 'Could not determine, assuming our turn' };
}

/**
 * Ask Visual LLM to analyze the poker game and make a decision
 */
async function askLLMForPokerDecision(
  screenshotPath: string,
  detections: any[],
  config: AIPokerConfig,
  handNumber: number
): Promise<PokerDecision> {
  const imageBuffer = readFileSync(screenshotPath);
  const base64Image = imageBuffer.toString('base64');

  // Build context from YOLO detections
  const detectionContext = detections.length > 0
    ? `YOLO detected these elements: ${detections.map(d => `${d.type}(${d.confidence?.toFixed(2)})`).join(', ')}`
    : 'No specific elements detected by YOLO.';

  const prompt = `You are an expert poker player AI. Analyze this Texas Hold'em poker game screenshot and decide the best action.

${detectionContext}

Look at the screenshot and identify:
1. Your hole cards (bottom of screen, face up cards belonging to "YOU")
2. Community cards (center of table, if any)
3. The pot size
4. Available action buttons (FOLD, CHECK, CALL, RAISE, ALL IN)
5. Current game phase (preflop, flop, turn, river)

Based on basic poker strategy:
- With strong hands (pairs, high cards, suited connectors): RAISE or CALL
- With weak hands and no investment: CHECK if free, otherwise FOLD
- With medium hands: CHECK or CALL to see more cards
- Be more aggressive with good position

You MUST respond with ONLY a JSON object in this exact format:
{"action": "fold|check|call|raise|all_in", "reasoning": "brief explanation", "confidence": 0.0-1.0}

Example responses:
{"action": "raise", "reasoning": "I have a pair of Aces, strong preflop hand", "confidence": 0.95}
{"action": "check", "reasoning": "Weak hand but free to see more cards", "confidence": 0.7}
{"action": "fold", "reasoning": "Very weak hand and facing a large bet", "confidence": 0.85}

Your JSON decision:`;

  try {
    const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        messages: [
          {
            role: 'user',
            content: prompt,
            images: [base64Image]
          }
        ],
        stream: false,
        options: {
          temperature: 0.3  // Lower temperature for more consistent decisions
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   ⚠️ LLM request failed: ${response.status} - ${errorText}`);
      return getRandomDecision();
    }

    const result = await response.json() as { message?: { content: string }, response?: string };
    const responseText = result.message?.content || result.response || '';
    console.log(`   📝 LLM raw response: ${responseText.substring(0, 150)}...`);

    // Parse JSON response
    const decision = parsePokerDecision(responseText);
    return decision;

  } catch (err) {
    console.log(`   ⚠️ LLM error: ${err}`);
    return getRandomDecision();
  }
}

/**
 * Parse LLM response to extract poker decision
 */
function parsePokerDecision(response: string): PokerDecision {
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[^}]+\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate action
      const validActions = ['fold', 'check', 'call', 'raise', 'all_in'];
      const action = parsed.action?.toLowerCase();
      
      if (validActions.includes(action)) {
        return {
          action: action as PokerDecision['action'],
          reasoning: parsed.reasoning || 'AI decision',
          confidence: Math.min(1, Math.max(0, parsed.confidence || 0.7))
        };
      }
    }
  } catch (err) {
    console.log(`   ⚠️ Failed to parse LLM response: ${err}`);
  }

  // If parsing fails, try to detect action from text
  const lowerResponse = response.toLowerCase();
  if (lowerResponse.includes('fold')) {
    return { action: 'fold', reasoning: 'Parsed from text', confidence: 0.5 };
  } else if (lowerResponse.includes('raise') || lowerResponse.includes('bet')) {
    return { action: 'raise', reasoning: 'Parsed from text', confidence: 0.5 };
  } else if (lowerResponse.includes('call')) {
    return { action: 'call', reasoning: 'Parsed from text', confidence: 0.5 };
  } else if (lowerResponse.includes('all in') || lowerResponse.includes('all_in')) {
    return { action: 'all_in', reasoning: 'Parsed from text', confidence: 0.5 };
  }

  // Default to check
  return { action: 'check', reasoning: 'Default fallback', confidence: 0.3 };
}

/**
 * Get a random but reasonable poker decision as fallback
 */
function getRandomDecision(): PokerDecision {
  const decisions: PokerDecision[] = [
    { action: 'check', reasoning: 'Random: Playing it safe', confidence: 0.4 },
    { action: 'call', reasoning: 'Random: Staying in the hand', confidence: 0.4 },
    { action: 'fold', reasoning: 'Random: Protecting chips', confidence: 0.4 },
    { action: 'raise', reasoning: 'Random: Being aggressive', confidence: 0.4 },
  ];
  
  return decisions[Math.floor(Math.random() * decisions.length)];
}

/**
 * Map AI decision to actual button tap coordinates
 */
export function getActionButtonPosition(action: PokerDecision['action']): { x: number; y: number } {
  // Calibrated clickable positions for iOS Rive canvas (logical coordinates)
  // IMPORTANT: Visual locations differ from clickable ones for Rive.
  const rive: Record<string, { x: number; y: number }> = {
    fold: { x: 60, y: 780 },
    check: { x: 60, y: 680 },
    call: { x: 60, y: 680 },
    raise: { x: 190, y: 680 },
    all_in: { x: 380, y: 680 },
  };

  return rive[action] || rive.check;
}

/**
 * Execute a complete poker hand with AI decision-making
 * Continues making decisions until the hand is complete
 */
export async function playPokerHand(
  driver: WebdriverIO.Browser,
  config: AIPokerConfig,
  handNumber: number,
  stepsDir: string
): Promise<{ success: boolean; decision: PokerDecision }> {
  const { writeFileSync } = await import('node:fs');
  
  console.log(`\n   ========== POKER HAND #${handNumber} ==========`);
  
  // Quick settle - no long waits needed
  await driver.pause(200);
  
  // First, check if we need to click DEAL or DEAL AGAIN button (new hand)
  const dealClicked = await clickDealButton(driver);
  if (dealClicked) {
    await driver.pause(800);  // Brief wait for cards to be dealt
  }
  
  let lastDecision: PokerDecision = { action: 'check', reasoning: 'Initial', confidence: 0 };
  let roundNumber = 1;
  const maxRoundsPerHand = 5;  // Safety limit for betting rounds
  
  // Keep playing until hand is complete or we hit max rounds
  let waitCycles = 0;
  const maxWaitCycles = 60;  // Max time waiting for our turn (60 * 0.5s = 30s)
  
  while (roundNumber <= maxRoundsPerHand && waitCycles < maxWaitCycles) {
    // Take screenshot of current game state
    const screenshotPath = `${stepsDir}/poker_hand_${handNumber}_round_${roundNumber}.png`;
    const screenshot = await driver.takeScreenshot();
    writeFileSync(screenshotPath, screenshot, 'base64');

    // Detect elements once per loop (used for turn heuristics + logging)
    const detections = await detectPokerElements(screenshotPath, config.detectorUrl);
    
    // Check if we see DEAL AGAIN button (hand is over)
    const handEnded = await isHandComplete(driver);
    if (handEnded) {
      console.log(`   🏆 Hand #${handNumber} complete!`);
      break;
    }
    
    // Check if waiting for other players (buttons disabled or "Thinking..." visible)
    const waitingForOthers = await isWaitingForOtherPlayers(driver);
    if (waitingForOthers) {
      if (waitCycles === 0) {
        console.log(`   ⏳ Waiting for other players...`);
      } else if (waitCycles % 10 === 0) {
        console.log(`   ⏳ Still waiting... (${waitCycles * 0.5}s)`);
      }
      await driver.pause(500);  // Short poll interval when waiting
      waitCycles++;
      continue;
    }
    
    // Reset wait counter when it's our turn
    waitCycles = 0;
    
    // IMPORTANT: Rive action buttons are NOT exposed as XCUIElementTypeButton.
    // Use YOLO detections (btn_call/btn_raise/...) to decide whether actions are available.
    const hasActionButtons = hasRiveActionButtonsFromDetections(detections);
    if (!hasActionButtons) {
      console.log(`   ⏳ No action buttons available, waiting...`);
      await driver.pause(300);  // Quick check
      
      // Check again if hand ended
      if (await isHandComplete(driver)) {
        console.log(`   🏆 Hand #${handNumber} complete!`);
        break;
      }
      
      continue;
    }
    
    // Get AI decision
    console.log(`   📍 Round ${roundNumber} of hand #${handNumber}`);
    const decision = await analyzeAndDecide(screenshotPath, config, handNumber);
    lastDecision = decision;
    
    // Execute the decision
    await executePokerAction(driver, decision, screenshotPath, config);
    
    // Brief wait for game to process
    await driver.pause(500);
    
    roundNumber++;
  }
  
  if (waitCycles >= maxWaitCycles) {
    console.log(`   ⚠️ Timeout waiting for turn in hand #${handNumber}`);
  }
  
  // After hand completes, click DEAL AGAIN to start next hand
  await driver.pause(300);
  const dealtAgain = await clickDealButton(driver);
  if (dealtAgain) {
    console.log(`   🔄 Starting next hand...`);
  }
  
  return { success: true, decision: lastDecision };
}

/**
 * Check if the hand is complete (DEAL AGAIN button visible)
 */
async function isHandComplete(driver: WebdriverIO.Browser): Promise<boolean> {
  const dealAgainLabels = ['DEAL AGAIN', 'Deal Again', 'NEW HAND', 'New Hand', 'NEXT HAND'];
  
  for (const label of dealAgainLabels) {
    try {
      const button = await driver.$(`//XCUIElementTypeButton[contains(@label, "${label}") or contains(@name, "${label}")]`);
      if (await button.isExisting() && await button.isDisplayed()) {
        return true;
      }
    } catch {}
  }
  
  // Also check for winner announcement text
  try {
    const winnerText = await driver.$(`//*[contains(@label, "wins") or contains(@label, "WIN") or contains(@label, "WINNER")]`);
    if (await winnerText.isExisting()) {
      return true;
    }
  } catch {}
  
  return false;
}

/**
 * Check if poker action buttons are visible AND ENABLED (not grayed out)
 * When it's not your turn, buttons are disabled/grayed
 */
async function hasPokerActionButtons(driver: WebdriverIO.Browser): Promise<boolean> {
  const actionLabels = ['FOLD', 'CHECK', 'CALL', 'RAISE', 'ALL IN'];
  
  for (const label of actionLabels) {
    try {
      const button = await driver.$(`//XCUIElementTypeButton[contains(@label, "${label}") or contains(@name, "${label}")]`);
      if (await button.isExisting() && await button.isDisplayed()) {
        // Check if button is enabled (not grayed out)
        const isEnabled = await button.isEnabled();
        if (isEnabled) {
          return true;
        }
      }
    } catch {}
  }
  
  return false;
}

/**
 * Check if "Thinking..." indicator is visible (means it's not our turn)
 */
async function isWaitingForOtherPlayers(driver: WebdriverIO.Browser): Promise<boolean> {
  try {
    // Check for "Thinking..." text
    const thinking = await driver.$(`//*[contains(@label, "Thinking") or contains(@label, "thinking")]`);
    if (await thinking.isExisting() && await thinking.isDisplayed()) {
      return true;
    }
  } catch {}
  
  // Also check if buttons exist but are disabled
  const actionLabels = ['FOLD', 'CHECK', 'CALL', 'RAISE'];
  for (const label of actionLabels) {
    try {
      const button = await driver.$(`//XCUIElementTypeButton[contains(@label, "${label}")]`);
      if (await button.isExisting() && await button.isDisplayed()) {
        const isEnabled = await button.isEnabled();
        if (!isEnabled) {
          return true;  // Buttons exist but disabled = waiting
        }
      }
    } catch {}
  }
  
  return false;
}

/**
 * Click DEAL or DEAL AGAIN button if visible
 */
async function clickDealButton(driver: WebdriverIO.Browser): Promise<boolean> {
  const dealLabels = ['DEAL AGAIN', 'DEAL', 'Deal Again', 'Deal', 'NEW HAND', 'New Hand'];
  
  for (const label of dealLabels) {
    try {
      const button = await driver.$(`//XCUIElementTypeButton[contains(@label, "${label}") or contains(@name, "${label}")]`);
      if (await button.isExisting() && await button.isDisplayed()) {
        console.log(`   🃏 Clicking ${label} to start new hand...`);
        await button.click();
        return true;
      }
    } catch {}
  }
  
  // Try by text content
  try {
    const button = await driver.$(`//*[contains(@label, "DEAL") or contains(@name, "DEAL")]`);
    if (await button.isExisting() && await button.isDisplayed()) {
      console.log(`   🃏 Clicking DEAL button...`);
      await button.click();
      return true;
    }
  } catch {}
  
  return false;
}

/**
 * Execute the poker action by clicking the appropriate button
 */
async function executePokerAction(
  driver: WebdriverIO.Browser,
  decision: PokerDecision,
  screenshotPath: string,
  config: AIPokerConfig
): Promise<{ success: boolean; decision: PokerDecision }> {
  // Use vision helper (YOLO-first) so we can click Rive canvas reliably
  // (it maps btn_* types to calibrated clickable positions).
  const targetText =
    decision.action === 'all_in' ? 'ALL IN' :
    decision.action === 'raise' ? 'RAISE' :
    decision.action === 'call' ? 'CALL' :
    decision.action === 'fold' ? 'FOLD' :
    'CHECK';

  const visionResult = await visionFallback(screenshotPath, targetText, {
    detectorUrl: config.detectorUrl,
    ollamaBaseUrl: config.ollamaBaseUrl,
    ollamaModel: config.ollamaModel,
  });

  if (visionResult.success && visionResult.clickPoint) {
    const { x, y } = visionResult.clickPoint;
    console.log(`   🎯 Tapping ${targetText} at (${x}, ${y}) via YOLO/VLM`);
    await driver.action('pointer')
      .move({ x, y })
      .down()
      .pause(100) // crucial for Rive
      .up()
      .perform();
    await driver.pause(300);
    return { success: true, decision };
  }

  // Final fallback: calibrated positions (still with the 100ms pause)
  const pos = getActionButtonPosition(decision.action);
  console.log(`   ⚡ Fallback tap ${targetText} at (${pos.x}, ${pos.y})`);
  await driver.action('pointer')
    .move({ x: pos.x, y: pos.y })
    .down()
    .pause(100)
    .up()
    .perform();

  await driver.pause(300);
  return { success: true, decision };
}

