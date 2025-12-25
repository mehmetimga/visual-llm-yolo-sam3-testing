/**
 * English to Intent Compiler
 * Converts natural language test descriptions to structured intents
 */

import type { Intent, Action } from './schema.js';

const VERB_TO_ACTION: Record<string, Action> = {
  open: 'navigate',
  navigate: 'navigate',
  go: 'navigate',
  visit: 'navigate',
  click: 'tap',
  tap: 'tap',
  press: 'tap',
  type: 'type',
  enter: 'type',
  input: 'type',
  fill: 'type',
  verify: 'assertVisible',
  see: 'assertText',
  check: 'assertVisible',
  assert: 'assertVisible',
  wait: 'waitForVisible',
  scroll: 'scroll',
  screenshot: 'screenshot',
};

const ACTION_ALIASES: Record<string, string> = {
  login: 'login_button',
  'log in': 'login_button',
  'sign in': 'login_button',
  lobby: 'lobby',
  home: 'home',
  username: 'login_username',
  password: 'login_password',
  'join now': 'join_now_button',
  'join': 'join_now_button',
  spin: 'spin_button',
  bet: 'bet_button',
};

export function compileEnglishToIntents(input: string): Intent[] {
  const intents: Intent[] = [];
  
  // Split by common separators
  const parts = input
    .split(/[,;]|\bthen\b|\band\b/i)
    .map(p => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    const intent = parseEnglishPhrase(part);
    if (intent) {
      intents.push(intent);
    }
  }

  return intents;
}

function parseEnglishPhrase(phrase: string): Intent | null {
  const lower = phrase.toLowerCase();
  
  // Check for vision annotation
  const useVision = lower.includes('use vision') || lower.includes('using vision');
  const cleanPhrase = phrase.replace(/\(?use\s+vision.*?\)?/gi, '').trim();
  const cleanLower = cleanPhrase.toLowerCase();

  // Navigate patterns
  if (/^open\s+(?:the\s+)?app$/i.test(cleanLower)) {
    return { action: 'navigate', url: '/', useVision };
  }

  if (/^(?:go|navigate)\s+to\s+/i.test(cleanLower)) {
    const match = cleanLower.match(/(?:go|navigate)\s+to\s+(?:the\s+)?(.+)/i);
    if (match) {
      const target = match[1].trim();
      // Check if it's a known screen/target
      const mapped = ACTION_ALIASES[target] || target;
      if (mapped.startsWith('/') || mapped === 'lobby' || mapped === 'home') {
        return { action: 'navigate', url: mapped === 'lobby' ? '/lobby' : mapped === 'home' ? '/' : mapped, useVision };
      }
      return { action: 'navigate', url: `/${target}`, useVision };
    }
  }

  // Login pattern
  if (/^login\s+as\s+/i.test(cleanLower)) {
    const match = cleanLower.match(/login\s+as\s+(\w+)/i);
    if (match) {
      // This is a compound action - login with username
      return { action: 'type', targetName: 'login_username', value: match[1], useVision };
    }
  }

  // Click/tap patterns
  if (/^(?:click|tap|press)\s+/i.test(cleanLower)) {
    const match = cleanLower.match(/(?:click|tap|press)\s+(?:on\s+)?(?:the\s+)?(.+)/i);
    if (match) {
      const target = match[1].trim();
      const mapped = ACTION_ALIASES[target] || target.replace(/\s+/g, '_');
      return { action: 'tap', targetName: mapped, useVision };
    }
  }

  // Type patterns
  if (/^(?:type|enter|input|fill)\s+/i.test(cleanLower)) {
    const match = cleanPhrase.match(/(?:type|enter|input|fill)\s+["']?([^"']+)["']?\s+(?:into|in)\s+(?:the\s+)?(.+)/i);
    if (match) {
      const value = match[1].trim();
      const target = match[2].trim().toLowerCase();
      const mapped = ACTION_ALIASES[target] || target.replace(/\s+/g, '_');
      return { action: 'type', targetName: mapped, value, useVision };
    }
  }

  // Verify/assert patterns
  if (/^(?:verify|check|see|assert)\s+/i.test(cleanLower)) {
    const match = cleanPhrase.match(/(?:verify|check|see|assert)\s+(?:that\s+)?(?:the\s+)?(.+?)(?:\s+(?:is\s+)?visible)?$/i);
    if (match) {
      const target = match[1].trim();
      // Check if it's text verification
      if (target.startsWith('"') || target.startsWith("'")) {
        return { action: 'assertText', value: target.replace(/["']/g, ''), useVision };
      }
      const mapped = ACTION_ALIASES[target.toLowerCase()] || target.replace(/\s+/g, '_');
      return { action: 'assertVisible', targetName: mapped, useVision };
    }
  }

  // Open game patterns
  if (/^open\s+(?:the\s+)?(?:first\s+)?game$/i.test(cleanLower)) {
    return { action: 'tap', targetName: 'first_game', useVision };
  }

  // Default: try to extract action and target
  const words = cleanLower.split(/\s+/);
  const firstWord = words[0];
  const action = VERB_TO_ACTION[firstWord];
  
  if (action) {
    const rest = words.slice(1).join(' ');
    if (rest) {
      return { action, targetName: rest.replace(/\s+/g, '_'), useVision };
    }
  }

  return null;
}

/**
 * Interface for optional LLM-based compilation
 */
export interface PlannerLLM {
  compileEnglishToIntent(input: string): Promise<Intent[]>;
}

