/**
 * Configuration loader for orchestrator
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Platform } from '@ai-ui/core';

export type DeviceType = 'ios' | 'android';

export interface OrchestratorConfig {
  specPath?: string;
  englishInput?: string;
  platforms: Platform[];
  deviceType: DeviceType;
  baseUrl: string;
  appPath?: string;
  outDir: string;
  headed: boolean;
  timeout: number;
  realExecution: boolean;
  vgsEnabled: boolean;
  vmsEnabled: boolean;
  sam3Enabled: boolean;
  targetsPath: string;
  // Service URLs from environment
  ollamaBaseUrl: string;
  ollamaModel: string;
  ollamaFallbackModel?: string;
  detectorUrl: string;
  dinov3Url: string;
  sam3Url: string;
  qdrantUrl: string;
  qdrantCollection: string;
}

export interface ConfigInput {
  specPath?: string;
  englishInput?: string;
  platforms: Platform[];
  deviceType?: DeviceType;
  baseUrl: string;
  appPath?: string;
  outDir: string;
  headed: boolean;
  timeout?: number;
  realExecution?: boolean;
  vgsEnabled: boolean;
  vmsEnabled: boolean;
  sam3Enabled: boolean;
}

export function loadConfig(input: ConfigInput): OrchestratorConfig {
  const outDir = resolve(input.outDir);
  
  // Find targets.json
  const possibleTargetsPaths = [
    resolve('specs/targets.json'),
    resolve('targets.json'),
    resolve('../../specs/targets.json'),
  ];
  const targetsPath = possibleTargetsPaths.find(p => existsSync(p)) || possibleTargetsPaths[0];

  return {
    ...input,
    outDir,
    targetsPath,
    deviceType: input.deviceType || 'ios',
    timeout: input.timeout || 30000,
    realExecution: input.realExecution ?? false,
    // Load from environment with defaults
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_VISION_MODEL || 'minicpm-v:latest',
    ollamaFallbackModel: process.env.OLLAMA_VISION_MODEL_FALLBACK,
    detectorUrl: process.env.DETECTOR_URL || 'http://localhost:8001',
    dinov3Url: process.env.DINOV3_URL || 'http://localhost:8002',
    sam3Url: process.env.SAM3_URL || 'http://localhost:8003',
    qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
    qdrantCollection: process.env.QDRANT_COLLECTION || 'ui_runs',
  };
}
