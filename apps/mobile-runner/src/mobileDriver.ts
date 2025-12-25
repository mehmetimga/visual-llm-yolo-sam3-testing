/**
 * Mobile Driver
 * Appium implementation of the Driver interface for Flutter apps
 */

import { remote, type Browser as WDIOBrowser } from 'webdriverio';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import type { Driver, Step, StepResult, TargetHint } from '@ai-ui/core';

export interface MobileDriverConfig {
  appiumUrl: string;
  appPath: string;
  outDir: string;
  platformName?: 'Android' | 'iOS';
  deviceName?: string;
  timeout?: number;
}

export interface MobileDriver extends Driver {
  client: WDIOBrowser;
}

export async function createMobileDriver(config: MobileDriverConfig): Promise<MobileDriver> {
  const platformName = config.platformName || 'Android';
  const timeout = config.timeout || 30000;

  // Ensure output directories exist
  const stepsDir = `${config.outDir}/steps/flutter`;
  const snapshotsDir = `${config.outDir}/snapshots`;
  if (!existsSync(stepsDir)) mkdirSync(stepsDir, { recursive: true });
  if (!existsSync(snapshotsDir)) mkdirSync(snapshotsDir, { recursive: true });

  // Connect to Appium
  const client = await remote({
    hostname: new URL(config.appiumUrl).hostname,
    port: parseInt(new URL(config.appiumUrl).port) || 4723,
    path: '/wd/hub',
    capabilities: {
      platformName,
      'appium:app': config.appPath,
      'appium:deviceName': config.deviceName || 'emulator-5554',
      'appium:automationName': 'Flutter',
      'appium:newCommandTimeout': timeout / 1000,
    },
  });

  const driver: MobileDriver = {
    platform: 'flutter',
    client,

    async init(_ctx) {
      // Wait for app to be ready
      await client.pause(2000);
    },

    async runStep(step: Step): Promise<StepResult> {
      const startedAt = new Date().toISOString();
      const screenshotPath = `${stepsDir}/${step.id}.png`;
      
      try {
        await executeMobileAction(client, step);
        
        // Take screenshot after action
        const screenshot = await client.takeScreenshot();
        writeFileSync(screenshotPath, screenshot, 'base64');
        
        return {
          stepId: step.id,
          ok: true,
          startedAt,
          finishedAt: new Date().toISOString(),
          evidence: { screenshotPath },
        };
      } catch (err) {
        // Take failure screenshot
        try {
          const screenshot = await client.takeScreenshot();
          writeFileSync(screenshotPath, screenshot, 'base64');
        } catch {
          // Ignore screenshot errors
        }
        
        return {
          stepId: step.id,
          ok: false,
          startedAt,
          finishedAt: new Date().toISOString(),
          error: {
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          },
          evidence: { screenshotPath },
        };
      }
    },

    async snapshot(ctx) {
      const reason = ctx?.reason || 'manual';
      const snapshotPath = `${snapshotsDir}/${reason}_${Date.now()}`;
      
      // Mobile page source
      const pageSource = await client.getPageSource();
      writeFileSync(`${snapshotPath}_source.xml`, pageSource, 'utf-8');
    },

    async clickAtPoint(x: number, y: number) {
      await client.touchAction([
        { action: 'tap', x, y },
      ]);
    },

    async dispose() {
      await client.deleteSession();
    },
  };

  return driver;
}

async function executeMobileAction(client: WDIOBrowser, step: Step): Promise<void> {
  switch (step.action) {
    case 'navigate': {
      // For Flutter, navigation is typically via tapping navigation elements
      // or using deep links. For now, just wait a bit.
      await client.pause(500);
      break;
    }
    
    case 'tap': {
      const element = await resolveFlutterElement(client, step.target);
      await element.click();
      break;
    }
    
    case 'type': {
      const element = await resolveFlutterElement(client, step.target);
      await element.setValue(step.value || '');
      break;
    }
    
    case 'scroll': {
      const direction = step.meta?.direction as string;
      // Implement scroll using touch actions
      const windowSize = await client.getWindowRect();
      const startX = windowSize.width / 2;
      const startY = direction === 'down' ? windowSize.height * 0.7 : windowSize.height * 0.3;
      const endY = direction === 'down' ? windowSize.height * 0.3 : windowSize.height * 0.7;
      
      await client.touchAction([
        { action: 'press', x: startX, y: startY },
        { action: 'moveTo', x: startX, y: endY },
        { action: 'release' },
      ]);
      break;
    }
    
    case 'waitForVisible': {
      const element = await resolveFlutterElement(client, step.target);
      await element.waitForDisplayed({ timeout: step.timeoutMs });
      break;
    }
    
    case 'assertVisible': {
      const element = await resolveFlutterElement(client, step.target);
      const isDisplayed = await element.isDisplayed();
      if (!isDisplayed) {
        throw new Error(`Element "${step.target?.name}" is not visible`);
      }
      break;
    }
    
    case 'assertText': {
      // Find element by text
      const element = await client.$(`//*[contains(@text, "${step.value}")]`);
      const isDisplayed = await element.isDisplayed();
      if (!isDisplayed) {
        throw new Error(`Text "${step.value}" is not visible`);
      }
      break;
    }
    
    case 'assertNotVisible': {
      const element = await resolveFlutterElement(client, step.target);
      const isDisplayed = await element.isDisplayed();
      if (isDisplayed) {
        throw new Error(`Element "${step.target?.name}" should not be visible`);
      }
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

async function resolveFlutterElement(client: WDIOBrowser, target?: TargetHint) {
  if (!target) {
    throw new Error('No target specified for action');
  }

  // Priority order: testId (Flutter Key) > semanticsLabel > text
  if (target.testId) {
    // Flutter Key finder
    return client.$(`-flutter key:${target.testId}`);
  }
  
  if (target.semanticsLabel) {
    // Accessibility ID finder
    return client.$(`~${target.semanticsLabel}`);
  }
  
  if (target.text) {
    // Text finder
    return client.$(`-flutter text:${target.text}`);
  }
  
  // Fallback to key with name
  return client.$(`-flutter key:${target.name}`);
}

