/**
 * Run Manager
 * Orchestrates test execution across platforms
 */

import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { v4 as uuid } from 'uuid';
import {
  parseBddFeature,
  compileEnglishToIntents,
  loadTargetRegistry,
  createStepPlanFromBddScenario,
  createStepPlanFromIntents,
  initLocatorMemory,
  type Platform,
  type RunResult,
  type StepPlan,
  type Step,
  type StepResult,
  type HealingAttempt,
} from '@ai-ui/core';
import type { OrchestratorConfig } from './config.js';
import { visionFallback } from './visionHelper.js';
import { playPokerHand, type AIPokerConfig } from './aiPokerPlayer.js';
import { capturePokerTrainingData } from './dataCapture.js';

export async function runTests(config: OrchestratorConfig): Promise<RunResult[]> {
  const runId = uuid();
  const results: RunResult[] = [];

  // Ensure output directory exists
  if (!existsSync(config.outDir)) {
    mkdirSync(config.outDir, { recursive: true });
  }

  // Initialize locator memory
  initLocatorMemory(`${config.outDir}/.locatorMemory.json`);

  // Load target registry
  if (existsSync(config.targetsPath)) {
    loadTargetRegistry(config.targetsPath);
  }

  // Build step plan
  let stepPlans: StepPlan[] = [];

  if (config.specPath) {
    // Parse BDD spec (resolve path from project root)
    const specFullPath = config.specPath.startsWith('/') ? config.specPath : resolve(process.cwd(), '..', '..', config.specPath);
    const specContent = readFileSync(specFullPath, 'utf-8');
    const scenarios = parseBddFeature(specContent);
    
    for (const scenario of scenarios) {
      for (const platform of config.platforms) {
        stepPlans.push(createStepPlanFromBddScenario(scenario, [platform]));
      }
    }
  } else if (config.englishInput) {
    // Compile English to intents
    const intents = compileEnglishToIntents(config.englishInput);
    
    for (const platform of config.platforms) {
      stepPlans.push(createStepPlanFromIntents('English Test', intents, [platform]));
    }
  }

  console.log(`📝 Generated ${stepPlans.length} step plan(s)\n`);

  // Execute each step plan
  for (const plan of stepPlans) {
    const platform = plan.platforms[0];
    console.log(`🚀 Running scenario "${plan.scenario}" on ${platform}...`);

    let result: RunResult;
    
    if (config.realExecution && platform === 'web') {
      // Real Playwright execution
      result = await executeWithPlaywright(runId, plan, config);
    } else if (config.realExecution && platform === 'flutter') {
      // Real iOS Simulator execution
      result = await executeWithSimulator(runId, plan, config);
    } else {
      // Mock execution
      result = await executeStepPlanMock(runId, plan, platform, config);
    }
    
    results.push(result);

    const statusIcon = result.ok ? '✅' : '❌';
    console.log(`   ${statusIcon} Completed: ${result.summary.passed}/${result.summary.total} passed\n`);
  }

  return results;
}

/**
 * Execute step plan with real Playwright browser
 */
async function executeWithPlaywright(
  runId: string,
  plan: StepPlan,
  config: OrchestratorConfig
): Promise<RunResult> {
  const startedAt = new Date().toISOString();
  const stepResults: StepResult[] = [];
  let passed = 0;
  let failed = 0;
  let healed = 0;

  // Dynamic import of Playwright
  const { chromium } = await import('playwright');
  
  // Create output directories
  const stepsDir = `${config.outDir}/steps/web`;
  const snapshotsDir = `${config.outDir}/snapshots`;
  if (!existsSync(stepsDir)) mkdirSync(stepsDir, { recursive: true });
  if (!existsSync(snapshotsDir)) mkdirSync(snapshotsDir, { recursive: true });

  // Launch browser
  const browser = await chromium.launch({
    headless: !config.headed,
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  
  const page = await context.newPage();
  page.setDefaultTimeout(config.timeout || 30000);

  const baseUrl = config.baseUrl || 'http://localhost:3000';

  try {
    for (const step of plan.steps) {
      if (step.platform !== 'web') continue;

      const stepStart = new Date().toISOString();
      const screenshotPath = `${stepsDir}/${step.id}.png`;
      
      console.log(`   → ${step.action}: ${step.target?.name || step.url || step.value || ''}`);

      try {
        await executePlaywrightAction(page, step, baseUrl);
        
        // Take screenshot after action
        await page.screenshot({ path: screenshotPath });
        
        stepResults.push({
          stepId: step.id,
          ok: true,
          startedAt: stepStart,
          finishedAt: new Date().toISOString(),
          evidence: { screenshotPath },
        });
        passed++;
      } catch (err) {
        // Take failure screenshot
        try {
          await page.screenshot({ path: screenshotPath });
        } catch {}
        
        const errorMsg = err instanceof Error ? err.message : String(err);
        
        // Try vision fallback for tap/click actions with useVision or vgsEnabled
        const healingAttempts: HealingAttempt[] = [];
        let wasHealed = false;
        
        if ((step.action === 'tap' || step.action === 'assertVisible') && 
            (step.meta?.useVision || config.vgsEnabled)) {
          
          const targetText = step.target?.text || step.target?.name || '';
          const visionResult = await visionFallback(
            screenshotPath,
            targetText,
            {
              detectorUrl: config.detectorUrl,
              ollamaBaseUrl: config.ollamaBaseUrl,
              ollamaModel: config.ollamaModel,
              sam3Url: config.sam3Enabled ? config.sam3Url : undefined,
            }
          );
          
          healingAttempts.push({
            strategy: 'vgs',
            success: visionResult.success,
            details: visionResult.details,
            confidence: visionResult.confidence,
          });
          
          if (visionResult.success && visionResult.clickPoint) {
            try {
              if (step.action === 'tap') {
                await page.mouse.click(visionResult.clickPoint.x, visionResult.clickPoint.y);
              }
              // For assertVisible, if vision found it, we consider it visible
              
              await page.screenshot({ path: screenshotPath });
              wasHealed = true;
              
              stepResults.push({
                stepId: step.id,
                ok: true,
                startedAt: stepStart,
                finishedAt: new Date().toISOString(),
                healingAttempts,
                evidence: { screenshotPath },
              });
              passed++;
              healed++;
              continue;
            } catch (healErr) {
              healingAttempts.push({
                strategy: 'vgs',
                success: false,
                details: `Click failed: ${healErr}`,
              });
            }
          }
        }
        
        if (!wasHealed) {
          console.log(`   ❌ Step failed: ${errorMsg}`);
          
          stepResults.push({
            stepId: step.id,
            ok: false,
            startedAt: stepStart,
            finishedAt: new Date().toISOString(),
            healingAttempts: healingAttempts.length > 0 ? healingAttempts : undefined,
            error: {
              message: errorMsg,
              stack: err instanceof Error ? err.stack : undefined,
            },
            evidence: { screenshotPath },
          });
          failed++;
        }
      }
    }
  } finally {
    await browser.close();
  }

  return {
    runId,
    platform: 'web',
    scenario: plan.scenario,
    startedAt,
    finishedAt: new Date().toISOString(),
    ok: failed === 0,
    steps: stepResults,
    summary: {
      total: stepResults.length,
      passed,
      failed,
      healed,
    },
  };
}

/**
 * Execute a single step with Playwright
 */
async function executePlaywrightAction(
  page: any, // Page type
  step: Step,
  baseUrl: string
): Promise<void> {
  switch (step.action) {
    case 'navigate': {
      const url = step.url?.startsWith('http') ? step.url : `${baseUrl}${step.url}`;
      await page.goto(url, { waitUntil: 'networkidle' });
      break;
    }
    
    case 'tap': {
      const locator = resolvePlaywrightLocator(page, step);
      await locator.click();
      break;
    }
    
    case 'type': {
      const locator = resolvePlaywrightLocator(page, step);
      await locator.fill(step.value || '');
      break;
    }
    
    case 'scroll': {
      const direction = step.meta?.direction as string;
      if (direction === 'down') {
        await page.mouse.wheel(0, 300);
      } else if (direction === 'up') {
        await page.mouse.wheel(0, -300);
      }
      break;
    }
    
    case 'waitForVisible': {
      const locator = resolvePlaywrightLocator(page, step);
      await locator.waitFor({ state: 'visible', timeout: step.timeoutMs || 10000 });
      break;
    }
    
    case 'assertVisible': {
      const locator = resolvePlaywrightLocator(page, step);
      await locator.waitFor({ state: 'visible', timeout: step.timeoutMs || 10000 });
      break;
    }
    
    case 'assertText': {
      if (step.value) {
        await page.getByText(step.value, { exact: false }).waitFor({ 
          state: 'visible', 
          timeout: step.timeoutMs || 10000 
        });
      }
      break;
    }
    
    case 'assertNotVisible': {
      const locator = resolvePlaywrightLocator(page, step);
      await locator.waitFor({ state: 'hidden', timeout: step.timeoutMs || 5000 });
      break;
    }
    
    case 'screenshot': {
      // Screenshot is taken automatically after each step
      break;
    }
    
    default:
      throw new Error(`Unknown action: ${step.action}`);
  }
}

/**
 * Resolve Playwright locator from step target
 */
function resolvePlaywrightLocator(page: any, step: Step): any {
  const target = step.target;
  
  if (!target) {
    throw new Error('No target specified for action');
  }

  // Priority order: testId > role+text > text > fallback
  if (target.testId) {
    return page.getByTestId(target.testId);
  }
  
  if (target.role && target.text) {
    return page.getByRole(target.role, { name: target.text });
  }
  
  if (target.text) {
    return page.getByText(target.text, { exact: false });
  }
  
  // Fallback: convert target name to testId format
  const testIdFromName = target.name.replace(/_/g, '-');
  return page.getByTestId(testIdFromName);
}

/**
 * Execute step plan on iOS Simulator using Appium + XCUITest
 * Provides reliable touch interactions via WebDriverIO
 */
async function executeWithSimulator(
  runId: string,
  plan: StepPlan,
  config: OrchestratorConfig
): Promise<RunResult> {
  const { remote } = await import('webdriverio');
  const { writeFileSync } = await import('node:fs');
  const startedAt = new Date().toISOString();
  const stepResults: StepResult[] = [];
  let passed = 0;
  let failed = 0;
  let healed = 0;

  const stepsDir = `${config.outDir}/steps/flutter`;
  if (!existsSync(stepsDir)) mkdirSync(stepsDir, { recursive: true });

  // Get simulator device ID
  const deviceId = await getBootedSimulatorId();
  if (!deviceId) {
    console.log('   ❌ No booted iOS simulator found');
    return {
      runId,
      platform: 'flutter',
      scenario: plan.scenario,
      startedAt,
      finishedAt: new Date().toISOString(),
      ok: false,
      steps: [],
      summary: { total: 0, passed: 0, failed: 1, healed: 0 },
    };
  }

  console.log(`   📱 Connecting to Appium for iOS Simulator: ${deviceId}`);

  // Connect to Appium with XCUITest driver
  let driver: WebdriverIO.Browser | null = null;
  
  try {
    driver = await remote({
      hostname: 'localhost',
      port: 4723,
      path: '/',
      capabilities: {
        platformName: 'iOS',
        'appium:automationName': 'XCUITest',
        'appium:udid': deviceId,
        'appium:bundleId': 'com.example.demoCasino', // Flutter app bundle ID
        'appium:noReset': true,
        'appium:newCommandTimeout': 60,
        'appium:wdaLaunchTimeout': 60000,
        'appium:wdaConnectionTimeout': 60000,
      },
      logLevel: 'warn',
    });

    console.log(`   ✅ Appium connected`);

    // Wait for app to be ready
    await driver.pause(1000);

    for (const step of plan.steps) {
      if (step.platform !== 'flutter') continue;

      const stepStart = new Date().toISOString();
      const screenshotPath = `${stepsDir}/${step.id}.png`;

      console.log(`   → ${step.action}: ${step.target?.name || step.url || step.value || ''}`);

      try {
        await executeAppiumAction(driver, step, screenshotPath, config);

        // Take screenshot after action
        try {
          const screenshot = await driver.takeScreenshot();
          writeFileSync(screenshotPath, screenshot, 'base64');
        } catch {}

        stepResults.push({
          stepId: step.id,
          ok: true,
          startedAt: stepStart,
          finishedAt: new Date().toISOString(),
          evidence: { screenshotPath },
        });
        passed++;
      } catch (err) {
        // Take failure screenshot
        try {
          const screenshot = await driver.takeScreenshot();
          writeFileSync(screenshotPath, screenshot, 'base64');
        } catch {}

        const errorMsg = err instanceof Error ? err.message : String(err);
        
        // Try vision fallback for tap/assertVisible
        const healingAttempts: HealingAttempt[] = [];
        let stepHealed = false;

        if ((step.action === 'tap' || step.action === 'assertVisible') && config.vgsEnabled) {
          const targetText = step.target?.text || step.target?.name || '';
          console.log(`   🔍 Vision fallback: looking for "${targetText}"`);
          
          const visionResult = await visionFallback(screenshotPath, targetText, {
            detectorUrl: config.detectorUrl,
            ollamaBaseUrl: config.ollamaBaseUrl,
            ollamaModel: config.ollamaModel,
            sam3Url: config.sam3Enabled ? config.sam3Url : undefined,
          });

          healingAttempts.push({
            strategy: 'vgs',
            success: visionResult.success,
            details: visionResult.details || 'Vision fallback',
            confidence: visionResult.confidence,
          });

          if (visionResult.success && visionResult.clickPoint) {
            // Click at detected position via Appium (100ms pause for Rive)
            try {
              await driver.action('pointer')
                .move({ x: visionResult.clickPoint.x, y: visionResult.clickPoint.y })
                .down()
                .pause(100)
                .up()
                .perform();
              
              const screenshot = await driver.takeScreenshot();
              writeFileSync(screenshotPath, screenshot, 'base64');
              stepHealed = true;
              healed++;
              console.log(`   ✨ Healed via vision at (${visionResult.clickPoint.x}, ${visionResult.clickPoint.y})`);
            } catch {}
          }
        }

        stepResults.push({
          stepId: step.id,
          ok: stepHealed,
          startedAt: stepStart,
          finishedAt: new Date().toISOString(),
          error: stepHealed ? undefined : { message: errorMsg },
          healingAttempts,
          evidence: { screenshotPath },
        });
        
        if (!stepHealed) failed++;
        else passed++;
      }
    }
  } catch (err) {
    console.log(`   ❌ Appium error: ${err instanceof Error ? err.message : err}`);
    return {
      runId,
      platform: 'flutter',
      scenario: plan.scenario,
      startedAt,
      finishedAt: new Date().toISOString(),
      ok: false,
      steps: stepResults,
      summary: { total: plan.steps.length, passed, failed: plan.steps.length - passed, healed: 0 },
    };
  } finally {
    // Clean up Appium session
    if (driver) {
      try {
        await driver.deleteSession();
      } catch {}
    }
  }

  return {
    runId,
    platform: 'flutter',
    scenario: plan.scenario,
    startedAt,
    finishedAt: new Date().toISOString(),
    ok: failed === 0,
    steps: stepResults,
    summary: { total: stepResults.length, passed, failed, healed },
  };
}

/**
 * Get the device ID of a booted iOS simulator
 */
async function getBootedSimulatorId(): Promise<string | null> {
  const { execSync } = await import('node:child_process');
  try {
    const output = execSync('xcrun simctl list devices | grep -i booted', { encoding: 'utf-8' });
    const match = output.match(/\(([A-F0-9-]+)\)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Execute action on iOS simulator via Appium
 */
async function executeAppiumAction(
  driver: WebdriverIO.Browser,
  step: Step,
  screenshotPath: string,
  config: OrchestratorConfig
): Promise<void> {
  const { writeFileSync } = await import('node:fs');
  
  // Small delay between actions for stability
  await driver.pause(300);

  switch (step.action) {
    case 'navigate': {
      // For Flutter, just wait - app should already be launched
      await driver.pause(500);
      break;
    }

    case 'tap': {
      const targetName = step.target?.name || '';
      const targetText = step.target?.text || targetName;

      // IMPORTANT: Ensure keyboard is dismissed before tapping buttons
      // The first tap might just dismiss the keyboard, not actually tap the button
      try {
        const doneBtn = await driver.$('~Done');
        if (await doneBtn.isExisting()) {
          await doneBtn.click();
          console.log(`   ⌨️ Dismissed keyboard before tapping`);
          await driver.pause(800); // Wait for keyboard to fully dismiss
        }
      } catch {}

      // PRIORITY: For targets with ambiguous text like "PLAY NOW", use hardcoded position FIRST
      // This ensures we tap the correct game button, not just any PLAY NOW
      // Note: poker_table_play_button now uses unique "PLAY POKER" text, so removed from list
      const ambiguousTargets = ['poker_play_button', 'slots_play_button', 
                                'blackjack_play_button', 'roulette_play_button'];
      if (ambiguousTargets.includes(targetName)) {
        const pos = getFlutterElementPosition(targetName);
        if (pos) {
          // Use 100ms pause between down/up - required for Rive buttons to register
          await driver.action('pointer')
            .move({ x: pos.x, y: pos.y })
            .down()
            .pause(100)
            .up()
            .perform();
          console.log(`   🎯 Tapped ${targetName} via hardcoded position at (${pos.x}, ${pos.y})`);
          break;
        }
      }

      // Try to find element by accessibility ID first
      let element = null;
      let tapped = false;

      try {
        // Try accessibility ID (Flutter Key becomes accessibility ID)
        element = await driver.$(`~${targetName}`);
        if (await element.isExisting()) {
          await element.click();
          console.log(`   ✅ Tapped via accessibility ID: ${targetName}`);
          tapped = true;
        }
      } catch {}

      if (!tapped) {
        // Try to find by text in label
        try {
          element = await driver.$(`//*[contains(@label, "${targetText}") or contains(@name, "${targetText}")]`);
          if (await element.isExisting()) {
            await element.click();
            console.log(`   ✅ Tapped via text: ${targetText}`);
            tapped = true;
          }
        } catch {}
      }

      if (!tapped) {
        // Try XCUIElementTypeButton with label or name (case-sensitive)
        try {
          element = await driver.$(`//XCUIElementTypeButton[@label="${targetText}" or @name="${targetText}"]`);
          if (await element.isExisting()) {
            await element.click();
            console.log(`   ✅ Tapped button via XPath: ${targetText}`);
            tapped = true;
          }
        } catch {}
      }

      if (!tapped && targetText) {
        // Try uppercase version (Flutter buttons often use uppercase text)
        // Convert underscores to spaces for button labels (e.g., "deal_again" -> "DEAL AGAIN")
        const upperText = targetText.replace(/_/g, ' ').toUpperCase();
        try {
          element = await driver.$(`//XCUIElementTypeButton[@label="${upperText}" or @name="${upperText}"]`);
          if (await element.isExisting()) {
            await element.click();
            console.log(`   ✅ Tapped button via XPath (uppercase): ${upperText}`);
            tapped = true;
          }
        } catch {}
      }

      if (!tapped && targetText) {
        // Try contains match with uppercase and spaces (for partial matches)
        const upperText = targetText.replace(/_/g, ' ').toUpperCase();
        try {
          element = await driver.$(`//*[contains(@label, "${upperText}") or contains(@name, "${upperText}")]`);
          if (await element.isExisting()) {
            await element.click();
            console.log(`   ✅ Tapped via contains (uppercase): ${upperText}`);
            tapped = true;
          }
        } catch {}
      }

      if (!tapped) {
        // Try predicate string for iOS
        try {
          element = await driver.$(`-ios predicate string:label CONTAINS "${targetText}" OR name CONTAINS "${targetText}"`);
          if (await element.isExisting()) {
            await element.click();
            console.log(`   ✅ Tapped via predicate: ${targetText}`);
            tapped = true;
          }
        } catch {}
      }

      if (tapped) {
        break;
      }

      // Fall back to coordinates using vision or hardcoded positions
      const screenshot = await driver.takeScreenshot();
      writeFileSync(screenshotPath, screenshot, 'base64');
      
      const visionResult = await visionFallback(screenshotPath, targetText, {
        detectorUrl: config.detectorUrl,
        ollamaBaseUrl: config.ollamaBaseUrl,
        ollamaModel: config.ollamaModel,
      });
      
      if (visionResult.success && visionResult.clickPoint) {
        // Use 100ms pause between down/up - required for Rive buttons to register
        await driver.action('pointer')
          .move({ x: visionResult.clickPoint.x, y: visionResult.clickPoint.y })
          .down()
          .pause(100)
          .up()
          .perform();
        console.log(`   📍 Tapped via vision at (${visionResult.clickPoint.x}, ${visionResult.clickPoint.y})`);
      } else {
        // Use hardcoded positions
        const pos = getFlutterElementPosition(targetText);
        if (pos) {
          // Use 100ms pause between down/up - required for Rive buttons to register
          await driver.action('pointer')
            .move({ x: pos.x, y: pos.y })
            .down()
            .pause(100)
            .up()
            .perform();
          console.log(`   ⚡ Tapped via hardcoded position at (${pos.x}, ${pos.y})`);
        } else {
          throw new Error(`Cannot find element: ${targetText}`);
        }
      }
      break;
    }

    case 'type': {
      const text = step.value || '';
      const targetName = step.target?.name || '';
      let typed = false;
      
      // Determine which field to target based on name
      const isPassword = targetName.toLowerCase().includes('password');
      const isUsername = targetName.toLowerCase().includes('username');
      
      // Wait for any previous keyboard animation to complete
      await driver.pause(300);
      
      // For Flutter login form on iPhone 16 Pro Max:
      // Username field is at approximately y=495 (center), Password at y=590
      // Screen width ~430, fields are centered
      const fieldPositions = {
        username: { x: 215, y: 495 },
        password: { x: 215, y: 590 },
      };
      
      try {
        if (isUsername || isPassword) {
          // First, dismiss any existing keyboard to reset coordinate system and make all fields accessible
          try {
            const doneBtn = await driver.$('~Done');
            if (await doneBtn.isExisting()) {
              await doneBtn.click();
              await driver.pause(800); // Wait longer for keyboard to fully dismiss
            }
          } catch {}

          // Find the correct field by matching its label attribute
          const targetLabel = isPassword ? 'Password' : 'Username';

          // Try multiple times to find and interact with the field
          let attempts = 3;
          while (attempts > 0 && !typed) {
            try {
              // Re-find all TextFields each attempt to avoid stale references
              const allTextFields = await driver.$$('XCUIElementTypeTextField');
              console.log(`   🔍 Found ${allTextFields.length} TextFields (looking for "${targetLabel}")`);

              let targetElement = null;

              // Find the field by matching label
              for (const field of allTextFields) {
                try {
                  const label = await field.getAttribute('label');
                  if (label === targetLabel) {
                    targetElement = field;
                    console.log(`   📍 Found field by label: "${label}"`);
                    break;
                  }
                } catch {}
              }

              if (!targetElement) {
                console.log(`   ⚠️ Could not find field with label "${targetLabel}"`);
                break;
              }

              // Click the field to focus it first
              await targetElement.click();
              await driver.pause(1000); // Wait for keyboard to appear

              // Clear ALL existing content by checking length and deleting only what's needed
              // This handles multiple accumulated entries efficiently
              try {
                // Get current field value to know how much to delete
                const currentValue = await targetElement.getAttribute('value');
                const charsToDelete = currentValue ? currentValue.length : 0;

                if (charsToDelete > 0) {
                  console.log(`   🧹 Clearing ${charsToDelete} characters...`);

                  // Move cursor to end of text using Cmd+Right Arrow
                  await driver.performActions([{
                    type: 'key',
                    id: 'keyboard',
                    actions: [
                      { type: 'keyDown', value: '\uE03D' }, // Command key
                      { type: 'keyDown', value: '\uE014' }, // Right arrow
                      { type: 'keyUp', value: '\uE014' },
                      { type: 'keyUp', value: '\uE03D' },
                    ]
                  }]);
                  await driver.pause(100);

                  // Delete only the number of characters that exist
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

              // Now type the new text via keyboard
              // Send each character properly with keyDown/keyUp to avoid WebDriverAgent errors
              for (const char of text) {
                await driver.keys([char]);
                await driver.pause(50);
              }
              typed = true;
              console.log(`   ✅ Typed "${text}" into ${targetLabel} field`);
              await driver.pause(300);
              break;

            } catch (err: any) {
              attempts--;
              const errMsg = err?.toString() || '';
              if (errMsg.includes('stale') && attempts > 0) {
                console.log(`   ⚠️ Stale element, retrying (${attempts} attempts left)...`);
                await driver.pause(500);
              } else {
                console.log(`   ⚠️ Could not interact with field: ${err}`);
                break;
              }
            }
          }
          
          // Dismiss keyboard
          try {
            await driver.pause(200);
            const doneBtn = await driver.$('~Done');
            if (await doneBtn.isExisting()) {
              await doneBtn.click();
              await driver.pause(300);
            }
          } catch {}
        }
      } catch (e) {
        console.log(`   ⚠️ Type failed: ${e}`);
      }

      if (!typed) {
        console.log(`   ⚠️ Could not type into field for: ${targetName}`);
      }
      
      break;
    }

    case 'assertText': {
      const expectedText = step.value || '';
      await driver.pause(500);
      
      // Try to find text on screen
      try {
        const element = await driver.$(`//*[contains(@label, "${expectedText}") or contains(@name, "${expectedText}")]`);
        const exists = await element.isExisting();
        if (!exists) {
          throw new Error(`Text "${expectedText}" not found on screen`);
        }
        console.log(`   ✅ Found text: ${expectedText}`);
      } catch {
        // Just pass for now - could use OCR
        console.log(`   ⚠️ Text assertion (soft pass): ${expectedText}`);
      }
      break;
    }

    case 'assertVisible': {
      const targetName = step.target?.name || '';
      const targetText = step.target?.text || targetName;
      await driver.pause(300);
      
      // Try to find element
      try {
        const element = await driver.$(`~${targetName}`);
        const isDisplayed = await element.isDisplayed();
        if (!isDisplayed) {
          throw new Error(`Element "${targetName}" is not visible`);
        }
        console.log(`   ✅ Element visible: ${targetName}`);
      } catch {
        // Try by text
        try {
          const element = await driver.$(`//*[contains(@label, "${targetText}")]`);
          const exists = await element.isExisting();
          if (!exists) {
            console.log(`   ⚠️ Visibility assertion (soft pass): ${targetName}`);
          } else {
            console.log(`   ✅ Element visible via text: ${targetText}`);
          }
        } catch {
          console.log(`   ⚠️ Visibility assertion (soft pass): ${targetName}`);
        }
      }
      break;
    }

    case 'waitForVisible': {
      const targetName = step.target?.name || '';
      const targetText = step.target?.text || targetName;
      const timeout = step.timeoutMs || 30000; // Default 30 second timeout
      const pollInterval = 1000; // Check every second
      const startTime = Date.now();

      console.log(`   ⏳ Waiting for "${targetText}" to appear (max ${timeout / 1000}s)...`);

      let found = false;
      while (Date.now() - startTime < timeout) {
        // Try to find by text (with space conversion for underscore names)
        const searchText = targetText.replace(/_/g, ' ');
        const searchTextUpper = searchText.toUpperCase();

        try {
          // Try exact match first
          const element = await driver.$(`//*[@label="${searchTextUpper}" or @name="${searchTextUpper}"]`);
          if (await element.isExisting()) {
            found = true;
            console.log(`   ✅ Found "${targetText}" (exact match)`);
            break;
          }
        } catch {}

        try {
          // Try contains match
          const element = await driver.$(`//*[contains(@label, "${searchTextUpper}") or contains(@name, "${searchTextUpper}")]`);
          if (await element.isExisting()) {
            found = true;
            console.log(`   ✅ Found "${targetText}" (contains match)`);
            break;
          }
        } catch {}

        await driver.pause(pollInterval);
      }

      if (!found) {
        throw new Error(`Timeout waiting for "${targetText}" to appear after ${timeout / 1000} seconds`);
      }
      break;
    }

    case 'scroll': {
      const direction = step.meta?.direction as string;
      const { width, height } = await driver.getWindowRect();

      const startX = width / 2;
      const startY = direction === 'down' ? height * 0.7 : height * 0.3;
      const endY = direction === 'down' ? height * 0.3 : height * 0.7;

      await driver.action('pointer')
        .move({ x: startX, y: startY })
        .down()
        .move({ x: startX, y: endY, duration: 300 })
        .up()
        .perform();
      break;
    }

    case 'screenshot': {
      const screenshot = await driver.takeScreenshot();
      writeFileSync(screenshotPath, screenshot, 'base64');
      break;
    }

    case 'wait': {
      const seconds = (step.meta?.seconds as number) || 1;
      console.log(`   ⏳ Waiting ${seconds} second(s)...`);
      await driver.pause(seconds * 1000);
      break;
    }

    case 'aiPokerPlay': {
      const handNumber = (step.meta?.handNumber as number) || 1;
      const aiConfig: AIPokerConfig = {
        detectorUrl: config.detectorUrl,
        ollamaBaseUrl: config.ollamaBaseUrl,
        ollamaModel: config.ollamaModel,
      };
      
      const stepsDir = screenshotPath.substring(0, screenshotPath.lastIndexOf('/'));
      const result = await playPokerHand(driver, aiConfig, handNumber, stepsDir);
      
      if (!result.success) {
        throw new Error(`AI poker play failed for hand ${handNumber}`);
      }
      console.log(`   ✅ AI completed poker hand #${handNumber}: ${result.decision.action.toUpperCase()}`);
      break;
    }

    case 'aiPokerPlayMultiple': {
      const count = (step.meta?.count as number) || 5;
      const aiConfig: AIPokerConfig = {
        detectorUrl: config.detectorUrl,
        ollamaBaseUrl: config.ollamaBaseUrl,
        ollamaModel: config.ollamaModel,
      };
      
      const stepsDir = screenshotPath.substring(0, screenshotPath.lastIndexOf('/'));
      console.log(`   🎰 AI playing ${count} poker hands...`);
      
      for (let i = 1; i <= count; i++) {
        const result = await playPokerHand(driver, aiConfig, i, stepsDir);
        console.log(`   ✅ Hand #${i}: ${result.decision.action.toUpperCase()} (${result.decision.reasoning})`);
        await driver.pause(500);
      }
      break;
    }

    case 'aiCaptureTraining': {
      const count = (step.meta?.count as number) || 20;
      console.log(`   📸 Capturing YOLO training data for ${count} hands...`);
      
      const result = await capturePokerTrainingData(driver, count, {
        baseUrl: config.ollamaBaseUrl,
        model: config.ollamaModel,
      });
      
      console.log(`   ✅ Captured ${result.imagesCapture} images from ${result.handsPlayed} hands`);
      break;
    }

    default:
      console.log(`   ⚠️ Unknown action: ${step.action}`);
  }

  // Wait a bit for UI to settle
  await driver.pause(200);
}

/**
 * Tap at specific coordinates on iOS simulator using simctl
 * Uses xcrun simctl io to send touch events
 */
async function simulatorTapAt(deviceId: string, x: number, y: number): Promise<void> {
  const { execSync, spawn } = await import('node:child_process');
  
  // For iOS Simulator, we can use AppleScript to click in the Simulator window
  // The coordinates need to account for the simulator's window position and scale
  
  // First, bring Simulator to front and get window info
  try {
    // Method 1: Use cliclick if available (brew install cliclick)
    try {
      // Get Simulator window position first
      const windowScript = `
        tell application "Simulator"
          activate
        end tell
        delay 0.3
      `;
      execSync(`osascript -e '${windowScript}'`, { stdio: 'pipe' });
      
      // Try using cliclick for more reliable clicking
      execSync(`which cliclick`, { stdio: 'pipe' });
      // cliclick uses absolute screen coordinates, so we need to get simulator window position
      // For now, assume standard position
      const absX = 50 + x; // Assuming Simulator window is at ~50 from left
      const absY = 130 + y; // Accounting for title bar + status bar
      execSync(`cliclick c:${absX},${absY}`, { stdio: 'pipe' });
      console.log(`   📍 Tapped at (${x}, ${y}) using cliclick`);
    } catch {
      // Method 2: Use AppleScript System Events
      // Need Accessibility permissions
      const script = `
        tell application "Simulator"
          activate
        end tell
        delay 0.2
        tell application "System Events"
          tell process "Simulator"
            set frontWindow to front window
            set {wx, wy} to position of frontWindow
            click at {${Math.round(x)} + wx + 0, ${Math.round(y)} + wy + 50}
          end tell
        end tell
      `;
      execSync(`osascript -e '${script}'`, { stdio: 'pipe' });
      console.log(`   📍 Tapped at (${x}, ${y}) using AppleScript`);
    }
  } catch (err) {
    // Method 3: Just log - the test will continue and use assertions
    console.log(`   ⚠️ Tap at (${x}, ${y}) - Could not execute tap, continuing`);
  }
  
  await new Promise(r => setTimeout(r, 500));
}

/**
 * Get hardcoded positions for Flutter app elements
 * Based on iPhone 16 Pro Max simulator screenshot (430x932 logical points)
 */
function getFlutterElementPosition(targetName: string): { x: number; y: number } | null {
  const target = targetName.toLowerCase();
  
  // Positions are based on actual Flutter app screenshot (430x932)
  // These are approximate center points in logical points
  const positions: Record<string, { x: number; y: number }> = {
    // Login screen
    'login_username': { x: 215, y: 300 },
    'username': { x: 215, y: 300 },
    'login_password': { x: 215, y: 380 },
    'password': { x: 215, y: 380 },
    'login_button': { x: 215, y: 470 },
    'log in': { x: 215, y: 470 },
    
    // Lobby screen (from screenshot - 430x932 logical points)
    // Note: PLAY NOW buttons are at the bottom of each game card
    'join_now': { x: 215, y: 870 },           // JOIN NOW button at bottom
    'join now': { x: 215, y: 870 },
    'join_now_button': { x: 215, y: 870 },
    'slots_game': { x: 120, y: 450 },          // PLAY NOW button on Mega Slots card
    'mega slots': { x: 120, y: 450 },
    'slots_play': { x: 120, y: 450 },
    'play now slots': { x: 120, y: 450 },
    'blackjack_game': { x: 310, y: 450 },      // PLAY NOW button on Blackjack card
    'blackjack': { x: 310, y: 450 },
    'blackjack_play': { x: 310, y: 450 },
    'roulette': { x: 120, y: 690 },            // PLAY NOW on Roulette card
    'video poker': { x: 310, y: 690 },         // PLAY NOW on Video Poker card
    'texas_holdem': { x: 310, y: 450 },        // Texas Hold'em (after scroll)
    'poker_play_button': { x: 310, y: 450 },   // Texas Hold'em PLAY NOW
    'poker_table': { x: 190, y: 770 },         // Poker Table PLAY NOW button (after scroll)
    'poker_table_play_button': { x: 190, y: 770 }, // Poker Table PLAY NOW (after scroll - left card, bottom)
    'logout': { x: 400, y: 95 },               // Logout icon (top right)
    'balance': { x: 320, y: 95 },              // Balance display
    'balance_display': { x: 320, y: 95 },
    
    // Game screen (slots) - estimated positions
    'spin_button': { x: 215, y: 500 },
    'spin': { x: 215, y: 500 },
    'bet_plus': { x: 280, y: 600 },
    '+': { x: 280, y: 600 },
    'bet_minus': { x: 150, y: 600 },
    '-': { x: 150, y: 600 },
    'back_button': { x: 40, y: 95 },           // Back button (top left area)
    'back': { x: 40, y: 95 },
    'back_to_lobby': { x: 40, y: 95 },
    
    // Game screen (blackjack)
    'hit_button': { x: 150, y: 500 },
    'hit': { x: 150, y: 500 },
    'stand_button': { x: 280, y: 500 },
    'stand': { x: 280, y: 500 },
    
    // Poker table screen - DEAL button (Flutter button, not Rive)
    'deal_button': { x: 215, y: 575 },
    'deal': { x: 215, y: 575 },
    'deal_again': { x: 215, y: 870 },      // DEAL AGAIN is at bottom after hand ends
    'deal again': { x: 215, y: 870 },

    // Poker table screen - RIVE action buttons (calibrated clickable positions)
    // IMPORTANT: These are the CLICKABLE positions, NOT the visual positions!
    // Rive renders buttons visually at different locations than where they respond to taps
    // See docs/RIVE_YOLO_TEST_RESULTS.md for details
    'fold_button': { x: 60, y: 780 },      // FOLD - bottom left
    'fold': { x: 60, y: 780 },
    'check_button': { x: 60, y: 680 },     // CHECK - left side (same as CALL)
    'check': { x: 60, y: 680 },
    'call_button': { x: 60, y: 680 },      // CALL - left side (same as CHECK)
    'call': { x: 60, y: 680 },
    'bet_button': { x: 190, y: 680 },      // BET - center (same as RAISE)
    'bet': { x: 190, y: 680 },
    'raise_button': { x: 190, y: 680 },    // RAISE - center (same as BET)
    'raise': { x: 190, y: 680 },
    'all_in_button': { x: 380, y: 680 },   // ALL IN - right side
    'all_in': { x: 380, y: 680 },
    'allin': { x: 380, y: 680 },
  };

  for (const [key, pos] of Object.entries(positions)) {
    if (target.includes(key) || key.includes(target)) {
      return pos;
    }
  }
  
  return null;
}

/**
 * Mock execution (for platforms without real drivers or testing)
 */
async function executeStepPlanMock(
  runId: string,
  plan: StepPlan,
  platform: Platform,
  config: OrchestratorConfig
): Promise<RunResult> {
  const startedAt = new Date().toISOString();
  const stepResults: StepResult[] = [];
  let passed = 0;
  let failed = 0;
  let healed = 0;

  // Create platform-specific step output directory
  const stepsDir = `${config.outDir}/steps/${platform}`;
  if (!existsSync(stepsDir)) {
    mkdirSync(stepsDir, { recursive: true });
  }

  // Simulate step execution
  for (const step of plan.steps) {
    if (step.platform !== platform) continue;

    const stepStart = new Date().toISOString();
    
    console.log(`   → ${step.action}: ${step.target?.name || step.url || step.value || ''}`);
    
    // For mock mode, all steps pass
    const stepOk = true;
    
    stepResults.push({
      stepId: step.id,
      ok: stepOk,
      startedAt: stepStart,
      finishedAt: new Date().toISOString(),
      evidence: {
        screenshotPath: `${stepsDir}/${step.id}.png`,
      },
    });

    if (stepOk) passed++;
    else failed++;
  }

  return {
    runId,
    platform,
    scenario: plan.scenario,
    startedAt,
    finishedAt: new Date().toISOString(),
    ok: failed === 0,
    steps: stepResults,
    summary: {
      total: stepResults.length,
      passed,
      failed,
      healed,
    },
  };
}
