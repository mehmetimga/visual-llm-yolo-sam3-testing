/**
 * Target Registry
 * Loads and manages canonical target definitions for cross-platform testing
 */

import { readFileSync, existsSync } from 'node:fs';
import type { TargetRegistry, TargetHint, Platform } from './schema.js';

let registry: TargetRegistry = {};

export function loadTargetRegistry(path: string): void {
  if (!existsSync(path)) {
    console.warn(`Target registry not found at ${path}, using empty registry`);
    registry = {};
    return;
  }

  const content = readFileSync(path, 'utf-8');
  registry = JSON.parse(content);
}

export function getTargetHint(targetName: string, platform: Platform): TargetHint | undefined {
  const entry = registry[targetName];
  if (!entry) {
    // Return a default hint with just the name
    return {
      name: targetName,
      testId: targetName.replace(/_/g, '-'),
      text: targetName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    };
  }

  const platformHint = entry[platform];
  if (platformHint) {
    return platformHint;
  }

  // Try to get hint from the other platform as fallback
  const otherPlatform = platform === 'web' ? 'flutter' : 'web';
  return entry[otherPlatform];
}

export function getAllTargets(): TargetRegistry {
  return { ...registry };
}

export function hasTarget(targetName: string): boolean {
  return targetName in registry;
}

export function getTargetNames(): string[] {
  return Object.keys(registry);
}

