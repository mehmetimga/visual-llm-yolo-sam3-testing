/**
 * SAM-3 Segmentation Service
 * Precise element segmentation for complex UI (casino games, canvas elements)
 */

import type { SamSegRequest, SamSegResponse } from '../schema.js';

export interface SAM3Config {
  url: string;
  timeout?: number;
}

export interface SAM3Client {
  segment(request: SamSegRequest): Promise<SamSegResponse>;
}

export async function createSAM3Client(config: SAM3Config): Promise<SAM3Client> {
  const timeout = config.timeout || 60000; // SAM-3 can be slow

  return {
    async segment(request: SamSegRequest): Promise<SamSegResponse> {
      try {
        const response = await fetch(`${config.url}/segment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_path: request.screenshotPath,
            prompt_text: request.promptText,
            coarse_bbox: request.coarseBbox,
          }),
          signal: AbortSignal.timeout(timeout),
        });

        if (!response.ok) {
          throw new Error(`SAM-3 service returned ${response.status}`);
        }

        const data = await response.json() as {
          mask_path: string;
          click_point: { x: number; y: number };
          confidence: number;
        };

        return {
          maskPath: data.mask_path,
          clickPoint: data.click_point,
          confidence: data.confidence,
        };
      } catch (err) {
        console.error('SAM-3 service error:', err);
        throw err;
      }
    },
  };
}

/**
 * Mock SAM-3 client for development/testing
 */
export function createMockSAM3Client(): SAM3Client {
  return {
    async segment(request: SamSegRequest): Promise<SamSegResponse> {
      // Return center of coarse bbox if provided, otherwise a default point
      let clickPoint = { x: 200, y: 300 };
      
      if (request.coarseBbox) {
        clickPoint = {
          x: request.coarseBbox.x + request.coarseBbox.w / 2,
          y: request.coarseBbox.y + request.coarseBbox.h / 2,
        };
      }

      return {
        maskPath: `/tmp/mock_mask_${request.stepId}.png`,
        clickPoint,
        confidence: 0.85,
      };
    },
  };
}

