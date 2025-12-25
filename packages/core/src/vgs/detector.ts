/**
 * Detector Service Interface
 * YOLO-based UI element detection
 */

import type { CandidateElement } from '../schema.js';

export interface DetectorConfig {
  url: string;
  timeout?: number;
}

export interface DetectorService {
  detect(screenshotPath: string): Promise<CandidateElement[]>;
}

export async function createDetectorService(config: DetectorConfig): Promise<DetectorService> {
  const timeout = config.timeout || 30000;

  return {
    async detect(screenshotPath: string): Promise<CandidateElement[]> {
      try {
        const response = await fetch(`${config.url}/detect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_path: screenshotPath }),
          signal: AbortSignal.timeout(timeout),
        });

        if (!response.ok) {
          throw new Error(`Detector service returned ${response.status}`);
        }

        const data = await response.json() as { elements: CandidateElement[] };
        return data.elements || [];
      } catch (err) {
        console.error('Detector service error:', err);
        return [];
      }
    },
  };
}

/**
 * Mock detector for development/testing
 */
export function createMockDetector(): DetectorService {
  return {
    async detect(_screenshotPath: string): Promise<CandidateElement[]> {
      // Return mock elements for demo
      return [
        {
          id: 'el_01',
          type: 'button',
          text: 'Log In',
          role: 'button',
          bbox: { x: 150, y: 300, w: 100, h: 40 },
          confidence: 0.95,
        },
        {
          id: 'el_02',
          type: 'button',
          text: 'Join Now',
          role: 'button',
          bbox: { x: 250, y: 100, w: 120, h: 45 },
          confidence: 0.92,
        },
        {
          id: 'el_03',
          type: 'textbox',
          text: '',
          role: 'textbox',
          bbox: { x: 100, y: 150, w: 200, h: 35 },
          confidence: 0.88,
        },
        {
          id: 'el_04',
          type: 'textbox',
          text: '',
          role: 'textbox',
          bbox: { x: 100, y: 200, w: 200, h: 35 },
          confidence: 0.87,
        },
      ];
    },
  };
}

