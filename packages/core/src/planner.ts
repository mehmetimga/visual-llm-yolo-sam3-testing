/**
 * Planner
 * Converts intents to platform-specific step plans
 */

import type { Intent, Step, StepPlan, Platform, Action, BddScenario } from './schema.js';
import { getTargetHint } from './targetRegistry.js';
import { matchStepPattern } from './bddParser.js';
import { v4 as uuid } from 'uuid';

let stepCounter = 0;

function generateStepId(): string {
  stepCounter++;
  return `step_${String(stepCounter).padStart(3, '0')}`;
}

export function resetStepCounter(): void {
  stepCounter = 0;
}

export function createStepFromIntent(intent: Intent, platform: Platform): Step {
  const step: Step = {
    id: generateStepId(),
    platform,
    action: intent.action,
    meta: {},
  };

  if (intent.targetName) {
    step.target = getTargetHint(intent.targetName, platform);
  }

  if (intent.value) {
    step.value = intent.value;
  }

  if (intent.url) {
    step.url = intent.url;
  }

  if (intent.useVision) {
    step.meta = { ...step.meta, useVision: true };
  }

  return step;
}

export function createStepPlanFromIntents(
  scenario: string,
  intents: Intent[],
  platforms: Platform[]
): StepPlan {
  resetStepCounter();
  const steps: Step[] = [];

  for (const platform of platforms) {
    for (const intent of intents) {
      steps.push(createStepFromIntent(intent, platform));
    }
  }

  return {
    scenario,
    platforms,
    steps,
  };
}

export function createStepPlanFromBddScenario(
  bddScenario: BddScenario,
  platforms: Platform[]
): StepPlan {
  resetStepCounter();
  const steps: Step[] = [];

  for (const platform of platforms) {
    for (const bddStep of bddScenario.steps) {
      const matched = matchStepPattern(bddStep.text);
      if (!matched) {
        console.warn(`Unmatched BDD step: ${bddStep.text}`);
        continue;
      }

      const step = createStepFromBddMatch(matched, bddStep.useVision || false, platform);
      if (step) {
        steps.push(step);
      }
    }
  }

  return {
    scenario: bddScenario.name,
    platforms,
    steps,
  };
}

function createStepFromBddMatch(
  match: { pattern: string; params: Record<string, string> },
  useVision: boolean,
  platform: Platform
): Step | null {
  const baseStep: Partial<Step> = {
    id: generateStepId(),
    platform,
    meta: useVision ? { useVision: true } : {},
  };

  switch (match.pattern) {
    case 'login_page':
      return {
        ...baseStep,
        action: 'navigate',
        url: '/',
      } as Step;

    case 'lobby_page':
    case 'any_page':
      // Just a placeholder step - don't navigate, assume already there
      return {
        ...baseStep,
        action: 'screenshot',
      } as Step;

    case 'navigate':
      return {
        ...baseStep,
        action: 'navigate',
        url: match.params.path,
      } as Step;

    case 'tap':
    case 'tap_canvas':
      return {
        ...baseStep,
        action: 'tap',
        target: getTargetHint(match.params.target || match.params.element, platform),
        meta: match.pattern === 'tap_canvas' 
          ? { ...baseStep.meta, useVision: true, requiresSegmentation: true }
          : baseStep.meta,
      } as Step;

    case 'type':
      return {
        ...baseStep,
        action: 'type',
        target: getTargetHint(match.params.target, platform),
        value: match.params.value,
      } as Step;

    case 'assertText':
      return {
        ...baseStep,
        action: 'assertText',
        value: match.params.text,
      } as Step;

    case 'assertVisible':
      return {
        ...baseStep,
        action: 'assertVisible',
        target: getTargetHint(match.params.target, platform),
      } as Step;

    case 'assertNotVisible':
      return {
        ...baseStep,
        action: 'assertNotVisible',
        target: getTargetHint(match.params.target, platform),
      } as Step;

    case 'waitForVisible':
      return {
        ...baseStep,
        action: 'waitForVisible',
        target: getTargetHint(match.params.target, platform),
      } as Step;

    case 'scroll':
      return {
        ...baseStep,
        action: 'scroll',
        meta: { ...baseStep.meta, direction: match.params.direction },
      } as Step;

    case 'screenshot':
      return {
        ...baseStep,
        action: 'screenshot',
      } as Step;

    case 'wait':
      return {
        ...baseStep,
        action: 'wait',
        meta: { ...baseStep.meta, seconds: parseInt(match.params.seconds, 10) },
      } as Step;

    default:
      return null;
  }
}

