/**
 * Appium Harness
 * High-level test execution wrapper for Flutter mobile tests
 */

import { mkdirSync, existsSync } from 'node:fs';
import type { Step, StepResult, RunResult, Platform } from '@ai-ui/core';
import { createMobileDriver } from './mobileDriver.js';

export interface AppiumHarnessConfig {
  appiumUrl: string;
  appPath: string;
  outDir: string;
  platformName?: 'Android' | 'iOS';
  deviceName?: string;
}

export interface AppiumHarness {
  runScenario(
    runId: string,
    scenario: string,
    steps: Step[]
  ): Promise<RunResult>;
  dispose(): Promise<void>;
}

export async function createAppiumHarness(
  config: AppiumHarnessConfig
): Promise<AppiumHarness> {
  const driver = await createMobileDriver({
    appiumUrl: config.appiumUrl,
    appPath: config.appPath,
    outDir: config.outDir,
    platformName: config.platformName,
    deviceName: config.deviceName,
  });

  // Ensure log directory exists
  const logDir = `${config.outDir}/logs`;
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  return {
    async runScenario(runId: string, scenario: string, steps: Step[]): Promise<RunResult> {
      const startedAt = new Date().toISOString();
      const stepResults: StepResult[] = [];
      let passed = 0;
      let failed = 0;
      let healed = 0;

      // Initialize driver
      await driver.init({ appPath: config.appPath, outDir: config.outDir });

      // Execute each step
      for (const step of steps) {
        if (step.platform !== 'flutter') continue;

        const result = await driver.runStep(step);
        stepResults.push(result);

        if (result.ok) {
          passed++;
          if (result.healingAttempts?.some(a => a.success)) {
            healed++;
          }
        } else {
          failed++;
          
          // Capture page source on failure
          try {
            await driver.snapshot({ reason: `failure_${step.id}` });
          } catch {
            // Ignore snapshot errors
          }
          
          // Stop on first failure
          break;
        }
      }

      return {
        runId,
        platform: 'flutter' as Platform,
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

