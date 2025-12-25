/**
 * Playwright Harness
 * High-level test execution wrapper with tracing and evidence collection
 */

import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import type { Step, StepResult, RunResult, Platform } from '@ai-ui/core';
import { createWebDriver } from './webDriver.js';

export interface PlaywrightHarnessConfig {
  baseUrl: string;
  outDir: string;
  headed?: boolean;
  traceOnFailure?: boolean;
}

export interface PlaywrightHarness {
  runScenario(
    runId: string,
    scenario: string,
    steps: Step[]
  ): Promise<RunResult>;
  dispose(): Promise<void>;
}

export async function createPlaywrightHarness(
  config: PlaywrightHarnessConfig
): Promise<PlaywrightHarness> {
  const driver = await createWebDriver({
    baseUrl: config.baseUrl,
    outDir: config.outDir,
    headed: config.headed,
  });

  // Ensure trace directory exists
  const traceDir = `${config.outDir}/traces`;
  if (!existsSync(traceDir)) {
    mkdirSync(traceDir, { recursive: true });
  }

  return {
    async runScenario(runId: string, scenario: string, steps: Step[]): Promise<RunResult> {
      const startedAt = new Date().toISOString();
      const stepResults: StepResult[] = [];
      let passed = 0;
      let failed = 0;
      let healed = 0;
      let hasFailure = false;

      // Start tracing if configured
      if (config.traceOnFailure) {
        await driver.page.context().tracing.start({
          screenshots: true,
          snapshots: true,
        });
      }

      // Initialize driver with base URL
      await driver.init({ baseUrl: config.baseUrl, outDir: config.outDir });

      // Execute each step
      for (const step of steps) {
        if (step.platform !== 'web') continue;

        const result = await driver.runStep(step);
        stepResults.push(result);

        if (result.ok) {
          passed++;
          if (result.healingAttempts?.some(a => a.success)) {
            healed++;
          }
        } else {
          failed++;
          hasFailure = true;
          
          // Stop on first failure (fail-fast mode)
          // Can be made configurable later
          break;
        }
      }

      // Save trace on failure
      if (config.traceOnFailure && hasFailure) {
        const tracePath = `${traceDir}/${runId}_web.zip`;
        await driver.page.context().tracing.stop({ path: tracePath });
        
        // Add trace path to last step's evidence
        if (stepResults.length > 0) {
          const lastStep = stepResults[stepResults.length - 1];
          lastStep.evidence = {
            ...lastStep.evidence,
            tracePath,
          };
        }
      } else if (config.traceOnFailure) {
        await driver.page.context().tracing.stop();
      }

      return {
        runId,
        platform: 'web' as Platform,
        scenario,
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
    },

    async dispose(): Promise<void> {
      await driver.dispose();
    },
  };
}

