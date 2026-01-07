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

function isAndroidDriver(driver: WebdriverIO.Browser): boolean {
  const platformName = String((driver as any)?.capabilities?.platformName || '').toLowerCase();
  return platformName === 'android';
}

const ANDROID_SCALE = 3.0;

const ANDROID_RIVE_ACTION_POSITIONS: Record<string, { x: number; y: number }> = {
  // LOGICAL coordinates (must be scaled by ANDROID_SCALE for ADB pixels)
  btn_check: { x: 57, y: 767 },
  btn_call: { x: 57, y: 767 },
  btn_raise: { x: 167, y: 767 },
  btn_fold: { x: 57, y: 817 },
  btn_allin: { x: 350, y: 767 },
};

const ANDROID_FLUTTER_POSITIONS: Record<string, { x: number; y: number }> = {
  // LOGICAL coordinates (must be scaled by ANDROID_SCALE for ADB pixels)
  deal: { x: 224, y: 575 },
  deal_again: { x: 224, y: 920 },
};

async function tryClickDealAndroid(driver: WebdriverIO.Browser): Promise<boolean> {
  // First try by accessibility id if Semantics identifier is provided by Flutter
  try {
    const el = await driver.$('~deal_button');
    if (await el.isExisting()) {
      await el.click();
      await driver.pause(300);
      console.log(`   🃏 Clicked DEAL via accessibility id: deal_button`);
      return true;
    }
  } catch {}

  try {
    const el = await driver.$('~deal_again_button');
    if (await el.isExisting()) {
      await el.click();
      await driver.pause(300);
      console.log(`   🃏 Clicked DEAL AGAIN via accessibility id: deal_again_button`);
      return true;
    }
  } catch {}

  // First try to click by Android accessibility/text (works if Flutter exposes it)
  const candidates = [
    '//*[@content-desc="DEAL" or @text="DEAL"]',
    '//*[contains(@content-desc, "DEAL") or contains(@text, "DEAL")]',
    '//*[@content-desc="DEAL AGAIN" or @text="DEAL AGAIN"]',
    '//*[contains(@content-desc, "DEAL AGAIN") or contains(@text, "DEAL AGAIN")]',
  ];

  for (const xpath of candidates) {
    try {
      const el = await driver.$(xpath);
      if (await el.isExisting()) {
        await el.click();
        await driver.pause(300);
        console.log(`   🃏 Clicked DEAL via Android selector: ${xpath}`);
        return true;
      }
    } catch {}
  }

  // Fallback: calibrated ADB tap at the DEAL button area
  try {
    console.log(`   🃏 Clicking DEAL via Android hardcoded position (${ANDROID_FLUTTER_POSITIONS.deal.x}, ${ANDROID_FLUTTER_POSITIONS.deal.y})`);
    await tapAt(driver, ANDROID_FLUTTER_POSITIONS.deal.x, ANDROID_FLUTTER_POSITIONS.deal.y);
    return true;
  } catch {}

  return false;
}

async function tapAt(driver: WebdriverIO.Browser, x: number, y: number): Promise<void> {
  if (isAndroidDriver(driver)) {
    const px = Math.round(x * ANDROID_SCALE);
    const py = Math.round(y * ANDROID_SCALE);
    await driver.execute('mobile: shell', {
      command: 'input',
      args: ['tap', px.toString(), py.toString()],
    });
    await driver.pause(150);
    return;
  }

  // iOS: W3C pointer with pause is required for Rive hit-testing
  await driver.action('pointer')
    .move({ x, y })
    .down()
    .pause(100)
    .up()
    .perform();
  await driver.pause(150);
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
    if (t === 'btn_deal') return false; // deal is not an action decision button
    const conf = d.confidence ?? 0;
    // Keep this permissive; our model is high-confidence on Rive buttons.
    return conf >= 0.3;
  });
}

function hasDealButtonFromDetections(detections: DetectedElement[]): boolean {
  return detections.some((d) => (d.type || '').toLowerCase() === 'btn_deal' && (d.confidence ?? 0) >= 0.3);
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
  
  let lastDecision: PokerDecision = { action: 'check', reasoning: 'Initial', confidence: 0 };
  let roundNumber = 1;
  const maxRoundsPerHand = 5;  // Safety limit for betting rounds
  
  // Keep playing until hand is complete or we hit max rounds
  let waitCycles = 0;
  const maxWaitCycles = 60;  // Max time waiting for our turn (60 * 0.5s = 30s)
  let dealAttemptedThisHand = false;
  
  while (roundNumber <= maxRoundsPerHand && waitCycles < maxWaitCycles) {
    // Take screenshot of current game state
    const screenshotPath = `${stepsDir}/poker_hand_${handNumber}_round_${roundNumber}.png`;
    const screenshot = await driver.takeScreenshot();
    writeFileSync(screenshotPath, screenshot, 'base64');

    // Detect elements once per loop (used for turn heuristics + logging)
    const detections = await detectPokerElements(screenshotPath, config.detectorUrl);

    // If the DEAL/DEAL AGAIN button is present, ALWAYS click it first.
    // Reason: YOLO can produce false-positive btn_* detections on an empty table,
    // which would otherwise trick us into thinking action buttons exist.
    if (!dealAttemptedThisHand) {
      try {
        const deal = await driver.$('~deal_button');
        if (await deal.isExisting()) {
          dealAttemptedThisHand = true;
          await deal.click();
          console.log(`   🃏 Clicked DEAL via accessibility id: deal_button`);
          await driver.pause(800);
          waitCycles = 0;
          continue;
        }
      } catch {}

      try {
        const dealAgain = await driver.$('~deal_again_button');
        if (await dealAgain.isExisting()) {
          dealAttemptedThisHand = true;
          await dealAgain.click();
          console.log(`   🃏 Clicked DEAL AGAIN via accessibility id: deal_again_button`);
          await driver.pause(800);
          waitCycles = 0;
          continue;
        }
      } catch {}

      // iOS fallback: DEAL/DEAL AGAIN are standard Flutter buttons (native XCUIElementTypeButton)
      // and are reliably clickable by label even if accessibility id isn't exposed.
      if (!isAndroidDriver(driver)) {
        const labels = ['DEAL AGAIN', 'DEAL', 'Deal Again', 'Deal', 'NEW HAND', 'New Hand'];
        for (const label of labels) {
          try {
            const btn = await driver.$(
              `//XCUIElementTypeButton[@label="${label}" or @name="${label}" or contains(@label, "${label}") or contains(@name, "${label}")]`
            );
            if (await btn.isExisting() && await btn.isDisplayed()) {
              dealAttemptedThisHand = true;
              await btn.click();
              console.log(`   🃏 Clicked ${label} via iOS XPath`);
              await driver.pause(800);
              waitCycles = 0;
              continue;
            }
          } catch {}
        }
      }
    }

    // IMPORTANT: Rive action buttons are NOT exposed as XCUIElementTypeButton.
    // Use YOLO detections (btn_call/btn_raise/...) to decide whether actions are available.
    const hasActionButtons = hasRiveActionButtonsFromDetections(detections);

    // If DEAL/DEAL AGAIN is visible, click it when there are no action buttons (not in-hand yet / hand ended)
    if (!hasActionButtons && hasDealButtonFromDetections(detections)) {
      console.log(`   🃏 DEAL available (btn_deal detected) — clicking to (re)start hand...`);
      if (isAndroidDriver(driver)) {
        // Best-effort: tap standard Android deal button area
        await tapAt(driver, ANDROID_FLUTTER_POSITIONS.deal.x, ANDROID_FLUTTER_POSITIONS.deal.y);
      } else {
        const vision = await visionFallback(screenshotPath, 'DEAL', {
          detectorUrl: config.detectorUrl,
          ollamaBaseUrl: config.ollamaBaseUrl,
          ollamaModel: config.ollamaModel,
        });
        if (vision.success && vision.clickPoint) {
          await tapAt(driver, vision.clickPoint.x, vision.clickPoint.y);
        } else {
          // Fallback to iOS hardcoded deal pos via visionHelper hardcoded map
          await tapAt(driver, 215, 575);
        }
      }
      await driver.pause(800);
      waitCycles = 0;
      continue;
    }

    if (!hasActionButtons) {
      // Common Android case: DEAL is visible but the detector doesn't return btn_deal.
      // In that case, proactively click DEAL once at the start of the hand instead of waiting forever.
      if (isAndroidDriver(driver) && !dealAttemptedThisHand && roundNumber === 1) {
        dealAttemptedThisHand = true;
        const clicked = await tryClickDealAndroid(driver);
        if (clicked) {
          await driver.pause(800);
          waitCycles = 0;
          continue;
        }
      }

      // Waiting for other players / animation / not our turn
      if (waitCycles === 0) console.log(`   ⏳ Waiting for other players...`);
      else if (waitCycles % 10 === 0) console.log(`   ⏳ Still waiting... (${waitCycles * 0.5}s)`);
      await driver.pause(500);
      waitCycles++;
      continue;
    }

    // Reset wait counter when we have action buttons
    waitCycles = 0;
    
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
  
  return { success: true, decision: lastDecision };
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
 * Execute the poker action by clicking the appropriate button
 */
async function executePokerAction(
  driver: WebdriverIO.Browser,
  decision: PokerDecision,
  screenshotPath: string,
  config: AIPokerConfig
): Promise<{ success: boolean; decision: PokerDecision }> {
  const targetText =
    decision.action === 'all_in' ? 'ALL IN' :
    decision.action === 'raise' ? 'RAISE' :
    decision.action === 'call' ? 'CALL' :
    decision.action === 'fold' ? 'FOLD' :
    'CHECK';

  // Android: use calibrated logical positions + ADB tap for reliability
  if (isAndroidDriver(driver)) {
    const key =
      decision.action === 'all_in' ? 'btn_allin' :
      decision.action === 'raise' ? 'btn_raise' :
      decision.action === 'call' ? 'btn_call' :
      decision.action === 'fold' ? 'btn_fold' :
      'btn_check';

    const pos = ANDROID_RIVE_ACTION_POSITIONS[key] || ANDROID_RIVE_ACTION_POSITIONS.btn_call;
    console.log(`   🎯 Android tap ${targetText} via calibrated ${key} at (${pos.x}, ${pos.y})`);
    await tapAt(driver, pos.x, pos.y);
    return { success: true, decision };
  }

  // iOS: use vision helper (YOLO-first) which maps btn_* → calibrated iOS positions.
  const visionResult = await visionFallback(screenshotPath, targetText, {
    detectorUrl: config.detectorUrl,
    ollamaBaseUrl: config.ollamaBaseUrl,
    ollamaModel: config.ollamaModel,
  });

  if (visionResult.success && visionResult.clickPoint) {
    const { x, y } = visionResult.clickPoint;
    console.log(`   🎯 Tapping ${targetText} at (${x}, ${y}) via YOLO/VLM`);
    await tapAt(driver, x, y);
    return { success: true, decision };
  }

  // Final fallback: calibrated iOS positions
  const pos = getActionButtonPosition(decision.action);
  console.log(`   ⚡ Fallback tap ${targetText} at (${pos.x}, ${pos.y})`);
  await tapAt(driver, pos.x, pos.y);
  return { success: true, decision };
}

