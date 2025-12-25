/**
 * Ollama Client
 * Local Visual LLM integration for grounding
 */

import { readFileSync } from 'node:fs';
import type { VisionGroundingRequest, VisionGroundingResponse } from '../schema.js';

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  fallbackModel?: string;
  maxRetries?: number;
  timeout?: number;
}

export interface OllamaVisionClient {
  pickCandidate(req: VisionGroundingRequest): Promise<VisionGroundingResponse>;
}

const SYSTEM_PROMPT = `You are a UI automation grounding assistant.
You will receive:
1) A screenshot of an app
2) A list of detected candidate UI elements with IDs, types, text, and bounding boxes
3) A target intent (what the test is trying to click/verify)

Task:
- Select the single candidate element ID that best matches the intent.
- If none match, select the best approximate match.
- Return STRICT JSON only, with keys: selectedId, reason, confidence.
- confidence must be a number from 0.0 to 1.0.
Do not include any other text.`;

function buildUserPrompt(req: VisionGroundingRequest): string {
  const candidateList = req.candidates
    .map(c => `- id=${c.id}, type=${c.type || 'unknown'}, text=${c.text || ''}, bbox=${c.bbox.x},${c.bbox.y},${c.bbox.w},${c.bbox.h}, conf=${c.confidence || 0}`)
    .join('\n');

  return `Intent: "${req.intent}"
Platform: ${req.platform}
TargetName: ${req.targetName || 'unknown'}

Candidates:
${candidateList}

Return JSON only:
{"selectedId":"...","reason":"...","confidence":0.0}`;
}

export async function createOllamaClient(config: OllamaConfig): Promise<OllamaVisionClient> {
  const maxRetries = config.maxRetries || 2;
  const timeout = config.timeout || 30000;

  async function callOllama(
    model: string,
    req: VisionGroundingRequest
  ): Promise<VisionGroundingResponse | null> {
    try {
      // Read image and convert to base64
      const imageBuffer = readFileSync(req.screenshotPath);
      const base64Image = imageBuffer.toString('base64');

      const response = await fetch(`${config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: buildUserPrompt(req),
          system: SYSTEM_PROMPT,
          images: [base64Image],
          stream: false,
          format: 'json',
        }),
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        console.error(`Ollama returned ${response.status}`);
        return null;
      }

      const data = await response.json() as { response: string };
      
      // Parse JSON response
      try {
        const parsed = JSON.parse(data.response) as VisionGroundingResponse;
        if (parsed.selectedId && typeof parsed.reason === 'string') {
          return {
            selectedId: parsed.selectedId,
            reason: parsed.reason,
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
          };
        }
      } catch (parseErr) {
        console.error('Failed to parse Ollama response as JSON:', data.response);
      }

      return null;
    } catch (err) {
      console.error('Ollama request failed:', err);
      return null;
    }
  }

  return {
    async pickCandidate(req: VisionGroundingRequest): Promise<VisionGroundingResponse> {
      // Try primary model with retries
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const result = await callOllama(config.model, req);
        if (result && (result.confidence || 0) >= 0.35) {
          return result;
        }
      }

      // Try fallback model if configured
      if (config.fallbackModel) {
        const result = await callOllama(config.fallbackModel, req);
        if (result) {
          return result;
        }
      }

      // Default fallback - pick first candidate
      return {
        selectedId: req.candidates[0]?.id || 'unknown',
        reason: 'Fallback selection - no confident match found',
        confidence: 0.1,
      };
    },
  };
}

/**
 * Mock Ollama client for development/testing
 */
export function createMockOllamaClient(): OllamaVisionClient {
  return {
    async pickCandidate(req: VisionGroundingRequest): Promise<VisionGroundingResponse> {
      // Simple matching based on text similarity
      const targetText = req.targetName?.replace(/_/g, ' ').toLowerCase() || req.intent.toLowerCase();
      
      let bestMatch = req.candidates[0];
      let bestScore = 0;

      for (const candidate of req.candidates) {
        const candidateText = (candidate.text || '').toLowerCase();
        const score = candidateText.includes(targetText) || targetText.includes(candidateText) ? 0.9 : 0.3;
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = candidate;
        }
      }

      return {
        selectedId: bestMatch?.id || 'unknown',
        reason: `Matched "${bestMatch?.text}" with target "${req.targetName}"`,
        confidence: bestScore,
      };
    },
  };
}

