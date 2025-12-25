/**
 * Healer
 * Self-healing policy for element resolution failures
 */

import type { 
  TargetHint, 
  LocatorVariant, 
  HealingAttempt, 
  CandidateElement,
  VisionGroundingRequest,
  VisionGroundingResponse,
  SamSegRequest,
  SamSegResponse,
  Platform,
} from './schema.js';
import { getLocatorVariants, recordSuccessfulLocator, recordVisionHint } from './locatorMemory.js';

export interface HealingContext {
  runId: string;
  stepId: string;
  platform: Platform;
  target: TargetHint;
  screenshotPath: string;
  outDir: string;
}

export interface HealingResult {
  success: boolean;
  attempts: HealingAttempt[];
  resolvedLocator?: LocatorVariant;
  clickPoint?: { x: number; y: number };
}

export interface HealerServices {
  vmsEnabled: boolean;
  vgsEnabled: boolean;
  sam3Enabled: boolean;
  querySimilarScreens?: (embedding: number[]) => Promise<Array<{ targetName: string; locator: LocatorVariant; ok: boolean }>>;
  computeEmbedding?: (screenshotPath: string) => Promise<number[]>;
  detectElements?: (screenshotPath: string) => Promise<CandidateElement[]>;
  pickCandidate?: (request: VisionGroundingRequest) => Promise<VisionGroundingResponse>;
  segmentElement?: (request: SamSegRequest) => Promise<SamSegResponse>;
}

const MAX_HEALING_ATTEMPTS = 3;

export async function attemptHealing(
  ctx: HealingContext,
  services: HealerServices
): Promise<HealingResult> {
  const attempts: HealingAttempt[] = [];
  
  // Strategy 1: Try locator memory variants
  const variants = getLocatorVariants(ctx.target.name);
  
  for (const variant of variants.slice(0, MAX_HEALING_ATTEMPTS)) {
    attempts.push({
      strategy: 'locatorMemory',
      success: false,
      details: `Trying variant: ${JSON.stringify(variant)}`,
    });
    
    // Return variant for driver to try
    // Note: Actual resolution happens in the driver
    // This is a simplified version - in production, we'd call back to driver
    if (variant.testId || variant.role || variant.text || variant.semanticsLabel) {
      return {
        success: true,
        attempts: attempts.map((a, i) => i === attempts.length - 1 ? { ...a, success: true } : a),
        resolvedLocator: variant,
      };
    }
  }

  // Strategy 2: Try VMS (Visual Memory Service) if enabled
  if (services.vmsEnabled && services.computeEmbedding && services.querySimilarScreens) {
    attempts.push({
      strategy: 'vms',
      success: false,
      details: 'Querying similar screens from visual memory',
    });

    try {
      const embedding = await services.computeEmbedding(ctx.screenshotPath);
      const similarScreens = await services.querySimilarScreens(embedding);
      
      const matchingHint = similarScreens.find(
        s => s.targetName === ctx.target.name && s.ok
      );

      if (matchingHint) {
        attempts[attempts.length - 1] = {
          ...attempts[attempts.length - 1],
          success: true,
          details: `Found matching hint from similar screen`,
        };

        return {
          success: true,
          attempts,
          resolvedLocator: matchingHint.locator,
        };
      }
    } catch (err) {
      attempts[attempts.length - 1].details = `VMS query failed: ${err}`;
    }
  }

  // Strategy 3: Try VGS (Vision Grounding Service) if enabled
  if (services.vgsEnabled && services.detectElements && services.pickCandidate) {
    attempts.push({
      strategy: 'vgs',
      success: false,
      details: 'Using Vision Grounding Service to locate element',
    });

    try {
      const candidates = await services.detectElements(ctx.screenshotPath);
      
      if (candidates.length > 0) {
        const vgsRequest: VisionGroundingRequest = {
          runId: ctx.runId,
          stepId: ctx.stepId,
          platform: ctx.platform,
          screenshotPath: ctx.screenshotPath,
          intent: `Locate the ${ctx.target.name.replace(/_/g, ' ')}`,
          targetName: ctx.target.name,
          candidates,
        };

        const response = await services.pickCandidate(vgsRequest);
        
        const selectedCandidate = candidates.find(c => c.id === response.selectedId);
        
        if (selectedCandidate && (response.confidence || 0) >= 0.35) {
          const clickX = selectedCandidate.bbox.x + selectedCandidate.bbox.w / 2;
          const clickY = selectedCandidate.bbox.y + selectedCandidate.bbox.h / 2;

          attempts[attempts.length - 1] = {
            ...attempts[attempts.length - 1],
            success: true,
            candidateId: response.selectedId,
            confidence: response.confidence,
            details: `VGS selected ${response.selectedId}: ${response.reason}`,
          };

          return {
            success: true,
            attempts,
            clickPoint: { x: clickX, y: clickY },
          };
        }
      }
    } catch (err) {
      attempts[attempts.length - 1].details = `VGS failed: ${err}`;
    }
  }

  // Strategy 4: Try SAM-3 segmentation if enabled (for complex UI)
  if (services.sam3Enabled && services.segmentElement) {
    attempts.push({
      strategy: 'sam3',
      success: false,
      details: 'Using SAM-3 segmentation for precise targeting',
    });

    try {
      const samRequest: SamSegRequest = {
        runId: ctx.runId,
        stepId: ctx.stepId,
        screenshotPath: ctx.screenshotPath,
        promptText: ctx.target.text || ctx.target.name.replace(/_/g, ' '),
      };

      const response = await services.segmentElement(samRequest);

      if (response.clickPoint && (response.confidence || 0) >= 0.5) {
        attempts[attempts.length - 1] = {
          ...attempts[attempts.length - 1],
          success: true,
          confidence: response.confidence,
          details: `SAM-3 found click point at (${response.clickPoint.x}, ${response.clickPoint.y})`,
        };

        return {
          success: true,
          attempts,
          clickPoint: response.clickPoint,
        };
      }
    } catch (err) {
      attempts[attempts.length - 1].details = `SAM-3 failed: ${err}`;
    }
  }

  // All strategies failed
  return {
    success: false,
    attempts,
  };
}

/**
 * Record successful healing for future use
 */
export function recordHealingSuccess(
  targetName: string,
  result: HealingResult,
  screenshotWidth: number,
  screenshotHeight: number,
  screenLabel?: string
): void {
  if (result.resolvedLocator) {
    recordSuccessfulLocator(targetName, result.resolvedLocator);
  }

  if (result.clickPoint && screenLabel) {
    // Store relative bbox for vision hint
    const relativeBbox: [number, number, number, number] = [
      result.clickPoint.x / screenshotWidth,
      result.clickPoint.y / screenshotHeight,
      0.1, // approximate width
      0.1, // approximate height
    ];
    recordVisionHint(targetName, screenLabel, relativeBbox);
  }
}

