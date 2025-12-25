/**
 * Locator Memory
 * Stores and retrieves successful locator variants for self-healing
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import type { LocatorMemory, LocatorVariant } from './schema.js';

const DEFAULT_PATH = './.locatorMemory.json';

let memory: LocatorMemory = {};
let memoryPath = DEFAULT_PATH;

export function initLocatorMemory(path?: string): void {
  memoryPath = path || DEFAULT_PATH;
  
  if (existsSync(memoryPath)) {
    try {
      const content = readFileSync(memoryPath, 'utf-8');
      memory = JSON.parse(content);
    } catch (err) {
      console.warn(`Failed to load locator memory from ${memoryPath}:`, err);
      memory = {};
    }
  } else {
    memory = {};
  }
}

export function getLocatorVariants(targetName: string): LocatorVariant[] {
  return memory[targetName] || [];
}

export function addLocatorVariant(targetName: string, variant: LocatorVariant): void {
  if (!memory[targetName]) {
    memory[targetName] = [];
  }

  // Check if variant already exists
  const exists = memory[targetName].some(v => 
    v.testId === variant.testId &&
    v.role === variant.role &&
    v.text === variant.text &&
    v.semanticsLabel === variant.semanticsLabel
  );

  if (!exists) {
    // Add to the beginning (most recent first)
    memory[targetName].unshift(variant);
    
    // Keep only top 5 variants per target
    if (memory[targetName].length > 5) {
      memory[targetName] = memory[targetName].slice(0, 5);
    }
  }
}

export function saveLocatorMemory(): void {
  try {
    writeFileSync(memoryPath, JSON.stringify(memory, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Failed to save locator memory to ${memoryPath}:`, err);
  }
}

export function getLocatorMemory(): LocatorMemory {
  return { ...memory };
}

export function clearLocatorMemory(): void {
  memory = {};
}

/**
 * Record a successful locator for future healing
 */
export function recordSuccessfulLocator(
  targetName: string,
  locator: {
    testId?: string;
    role?: string;
    text?: string;
    semanticsLabel?: string;
  }
): void {
  addLocatorVariant(targetName, locator);
  saveLocatorMemory();
}

/**
 * Record a vision-based hit for future healing
 */
export function recordVisionHint(
  targetName: string,
  screen: string,
  relativeBbox: [number, number, number, number]
): void {
  addLocatorVariant(targetName, {
    visionHint: { screen, relativeBbox },
  });
  saveLocatorMemory();
}

