/**
 * Web Driver
 * Playwright implementation of the Driver interface
 */

import type { Browser, Page, BrowserContext, Locator } from 'playwright';
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import type { Driver, Step, StepResult, TargetHint } from '@ai-ui/core';

export interface WebDriverConfig {
  baseUrl: string;
  headed?: boolean;
  outDir: string;
  timeout?: number;
}

export interface WebDriver extends Driver {
  page: Page;
  browser: Browser;
}

export async function createWebDriver(config: WebDriverConfig): Promise<WebDriver> {
  const browser = await chromium.launch({
    headless: !config.headed,
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: undefined, // Can enable for debugging
  });
  
  const page = await context.newPage();
  const timeout = config.timeout || 30000;
  page.setDefaultTimeout(timeout);

  // Ensure output directories exist
  const stepsDir = `${config.outDir}/steps/web`;
  const snapshotsDir = `${config.outDir}/snapshots`;
  if (!existsSync(stepsDir)) mkdirSync(stepsDir, { recursive: true });
  if (!existsSync(snapshotsDir)) mkdirSync(snapshotsDir, { recursive: true });

  const driver: WebDriver = {
    platform: 'web',
    browser,
    page,

    async init(ctx) {
      if (ctx.baseUrl) {
        await page.goto(ctx.baseUrl);
      }
    },

    async runStep(step: Step): Promise<StepResult> {
      const startedAt = new Date().toISOString();
      const screenshotPath = `${stepsDir}/${step.id}.png`;
      
      try {
        await executeWebAction(page, step, config.baseUrl);
        
        // Take screenshot after action
        await page.screenshot({ path: screenshotPath });
        
        return {
          stepId: step.id,
          ok: true,
          startedAt,
          finishedAt: new Date().toISOString(),
          evidence: { screenshotPath },
        };
      } catch (err) {
        // Take failure screenshot
        await page.screenshot({ path: screenshotPath });
        
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
      
      // DOM snapshot
      const dom = await page.content();
      const { writeFileSync } = await import('node:fs');
      writeFileSync(`${snapshotPath}_dom.html`, dom, 'utf-8');
      
      // Accessibility tree
      const a11y = await page.accessibility.snapshot();
      writeFileSync(`${snapshotPath}_a11y.json`, JSON.stringify(a11y, null, 2), 'utf-8');
    },

    async clickAtPoint(x: number, y: number) {
      await page.mouse.click(x, y);
    },

    async dispose() {
      await browser.close();
    },
  };

  return driver;
}

async function executeWebAction(page: Page, step: Step, baseUrl: string): Promise<void> {
  switch (step.action) {
    case 'navigate': {
      const url = step.url?.startsWith('http') ? step.url : `${baseUrl}${step.url}`;
      await page.goto(url);
      break;
    }
    
    case 'tap': {
      const locator = resolveLocator(page, step.target);
      await locator.click();
      break;
    }
    
    case 'type': {
      const locator = resolveLocator(page, step.target);
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
      const locator = resolveLocator(page, step.target);
      await locator.waitFor({ state: 'visible', timeout: step.timeoutMs });
      break;
    }
    
    case 'assertVisible': {
      const locator = resolveLocator(page, step.target);
      await locator.waitFor({ state: 'visible', timeout: step.timeoutMs || 5000 });
      break;
    }
    
    case 'assertText': {
      if (step.value) {
        await page.getByText(step.value, { exact: false }).waitFor({ state: 'visible' });
      }
      break;
    }
    
    case 'assertNotVisible': {
      const locator = resolveLocator(page, step.target);
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

function resolveLocator(page: Page, target?: TargetHint): Locator {
  if (!target) {
    throw new Error('No target specified for action');
  }

  // Priority order: testId > role+text > text > fallback
  if (target.testId) {
    return page.getByTestId(target.testId);
  }
  
  if (target.role && target.text) {
    return page.getByRole(target.role as any, { name: target.text });
  }
  
  if (target.text) {
    return page.getByText(target.text, { exact: false });
  }
  
  // Fallback to name-based locator
  return page.getByTestId(target.name.replace(/_/g, '-'));
}

