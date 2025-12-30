/**
 * Gherkin-lite BDD Parser
 * Parses a subset of Gherkin syntax for test specifications
 */

import type { BddScenario, BddStep } from './schema.js';

const KEYWORDS = ['Given', 'When', 'Then', 'And'] as const;
type Keyword = (typeof KEYWORDS)[number];

export function parseBddFeature(content: string): BddScenario[] {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  const scenarios: BddScenario[] = [];
  let currentScenario: BddScenario | null = null;

  for (const line of lines) {
    // Skip Feature line
    if (line.startsWith('Feature:')) {
      continue;
    }

    // Parse Scenario
    if (line.startsWith('Scenario:')) {
      if (currentScenario) {
        scenarios.push(currentScenario);
      }
      currentScenario = {
        name: line.replace('Scenario:', '').trim(),
        steps: [],
      };
      continue;
    }

    // Parse step keywords
    for (const keyword of KEYWORDS) {
      if (line.startsWith(keyword + ' ')) {
        if (!currentScenario) {
          throw new Error(`Step found outside scenario: ${line}`);
        }

        let text = line.substring(keyword.length + 1).trim();
        let useVision = false;

        // Check for vision annotation
        if (text.includes('using vision') || text.includes('(use vision')) {
          useVision = true;
          text = text.replace(/\s*using vision\s*/gi, '').replace(/\s*\(use vision.*?\)\s*/gi, '').trim();
        }

        currentScenario.steps.push({
          keyword: keyword as Keyword,
          text,
          useVision,
        });
        break;
      }
    }
  }

  if (currentScenario) {
    scenarios.push(currentScenario);
  }

  return scenarios;
}

/**
 * Extract quoted parameters from a step text
 * E.g., 'I type "demo" into "login_username"' -> ["demo", "login_username"]
 */
export function extractQuotedParams(text: string): string[] {
  const matches = text.match(/"([^"]+)"/g);
  if (!matches) return [];
  return matches.map(m => m.replace(/"/g, ''));
}

/**
 * Match step text against patterns and return extracted data
 */
export interface StepMatch {
  pattern: string;
  params: Record<string, string>;
}

const STEP_PATTERNS: Array<{ regex: RegExp; pattern: string; params: string[] }> = [
  { regex: /^I am on the login page$/, pattern: 'login_page', params: [] },
  { regex: /^I am on the lobby page$/, pattern: 'lobby_page', params: [] },
  { regex: /^I am on the (.+) page$/, pattern: 'any_page', params: ['page'] },
  { regex: /^I navigate to "([^"]+)"$/, pattern: 'navigate', params: ['path'] },
  { regex: /^I tap "([^"]+)"$/, pattern: 'tap', params: ['target'] },
  { regex: /^I click "([^"]+)"$/, pattern: 'tap', params: ['target'] },
  { regex: /^I type "([^"]+)" into "([^"]+)"$/, pattern: 'type', params: ['value', 'target'] },
  { regex: /^I should see text "([^"]+)"$/, pattern: 'assertText', params: ['text'] },
  { regex: /^"([^"]+)" should be visible$/, pattern: 'assertVisible', params: ['target'] },
  { regex: /^"([^"]+)" should not be visible$/, pattern: 'assertNotVisible', params: ['target'] },
  { regex: /^I wait for "([^"]+)" to appear$/, pattern: 'waitForVisible', params: ['target'] },
  { regex: /^I scroll (up|down|left|right)$/, pattern: 'scroll', params: ['direction'] },
  { regex: /^I take a screenshot$/, pattern: 'screenshot', params: [] },
  // Casino-specific patterns
  { regex: /^I tap the "([^"]+)" on the game canvas$/, pattern: 'tap_canvas', params: ['element'] },
  { regex: /^I interact with "([^"]+)" element$/, pattern: 'tap_canvas', params: ['element'] },
  { regex: /^the "([^"]+)" should display$/, pattern: 'assertVisible', params: ['target'] },
  { regex: /^I wait (\d+) seconds?$/, pattern: 'wait', params: ['seconds'] },
  // AI Poker patterns
  { regex: /^AI plays poker hand (\d+)$/, pattern: 'aiPokerPlay', params: ['handNumber'] },
  { regex: /^AI plays (\d+) poker hands?$/, pattern: 'aiPokerPlayMultiple', params: ['count'] },
  { regex: /^AI makes poker decision$/, pattern: 'aiPokerPlay', params: [] },
  { regex: /^AI captures training data for (\d+) hands?$/, pattern: 'aiCaptureTraining', params: ['count'] },
];

export function matchStepPattern(text: string): StepMatch | null {
  for (const { regex, pattern, params } of STEP_PATTERNS) {
    const match = text.match(regex);
    if (match) {
      const result: StepMatch = { pattern, params: {} };
      params.forEach((param, index) => {
        result.params[param] = match[index + 1];
      });
      return result;
    }
  }
  return null;
}

