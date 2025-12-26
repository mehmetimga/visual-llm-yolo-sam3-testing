/**
 * Vision Helper
 * Provides vision-based element detection fallback
 * Uses YOLO detector + Visual LLM for element grounding
 */

import { readFileSync, writeFileSync } from 'node:fs';

export interface VisionConfig {
  detectorUrl: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  sam3Url?: string;
}

export interface DetectedElement {
  id: string;
  type: string;
  text?: string;
  bbox: { x: number; y: number; w: number; h: number };
  confidence: number;
}

export interface VisionFallbackResult {
  success: boolean;
  clickPoint?: { x: number; y: number };
  method: 'detector' | 'vlm' | 'hardcoded' | 'failed';
  confidence?: number;
  details?: string;
}

/**
 * Try to find an element using vision-based detection
 */
export async function visionFallback(
  screenshotPath: string,
  targetText: string,
  config: VisionConfig
): Promise<VisionFallbackResult> {
  console.log(`   🔍 Vision fallback: looking for "${targetText}"`);
  
  try {
    // Step 1: Try YOLO detector
    const detections = await detectWithYolo(screenshotPath, config.detectorUrl);
    
    if (detections.length > 0) {
      // Find best match for target text
      const match = findBestMatch(detections, targetText);
      
      if (match) {
        let clickPoint = getCenterPoint(match.bbox);
        
        // Try SAM-3 for precise segmentation if available
        if (config.sam3Url) {
          const refinedPoint = await refineWithSam3(screenshotPath, match.bbox, config.sam3Url);
          if (refinedPoint) {
            clickPoint = refinedPoint;
          }
        }
        
        console.log(`   ✅ Vision found "${targetText}" at (${clickPoint.x}, ${clickPoint.y})`);
        return {
          success: true,
          clickPoint,
          method: 'detector',
          confidence: match.confidence,
          details: `Detected ${match.type} with text "${match.text}"`
        };
      }
    }
    
    // Step 2: Try Visual LLM if detector didn't find it
    console.log(`   🤖 Asking MiniCPM-V to locate "${targetText}"...`);
    const vlmResult = await askVlm(screenshotPath, targetText, config);

    if (vlmResult.success && vlmResult.clickPoint) {
      console.log(`   ✅ VLM (MiniCPM-V) found "${targetText}" at (${vlmResult.clickPoint.x}, ${vlmResult.clickPoint.y}) [confidence: ${vlmResult.confidence}]`);
      return vlmResult;
    } else {
      console.log(`   ⚠️ VLM could not locate "${targetText}" - ${vlmResult.details}`);
    }

    // Step 3: Hardcoded fallback for known elements (demo purposes)
    const hardcodedResult = getHardcodedFallback(targetText);
    if (hardcodedResult.success) {
      console.log(`   ⚡ Using hardcoded position for "${targetText}"`);
      return hardcodedResult;
    }
    
    return {
      success: false,
      method: 'failed',
      details: `Could not find "${targetText}" using vision`
    };
    
  } catch (err) {
    console.log(`   ⚠️ Vision fallback error: ${err}`);
    return {
      success: false,
      method: 'failed',
      details: String(err)
    };
  }
}

/**
 * Call YOLO detector service
 */
async function detectWithYolo(
  screenshotPath: string,
  detectorUrl: string
): Promise<DetectedElement[]> {
  try {
    const imageBuffer = readFileSync(screenshotPath);
    const base64Image = imageBuffer.toString('base64');
    
    console.log(`   📡 Calling detector service at ${detectorUrl}...`);
    
    const response = await fetch(`${detectorUrl}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64Image,
        conf_threshold: 0.3
      })
    });
    
    if (!response.ok) {
      console.log(`   ⚠️ Detector returned ${response.status}`);
      return [];
    }
    
    const result = await response.json() as { detections: DetectedElement[], count: number };
    console.log(`   📊 Detector found ${result.count || result.detections?.length || 0} elements`);
    return result.detections || [];
    
  } catch (err) {
    // Detector service not available
    console.log(`   ⚠️ Detector service unavailable: ${err}`);
    return [];
  }
}

/**
 * Ask Visual LLM to find element
 */
async function askVlm(
  screenshotPath: string,
  targetText: string,
  config: VisionConfig
): Promise<VisionFallbackResult> {
  try {
    const imageBuffer = readFileSync(screenshotPath);
    const base64Image = imageBuffer.toString('base64');

    const prompt = `Find the UI element "${targetText}" in this screenshot.

IMPORTANT: You MUST respond with ONLY a JSON object, nothing else.

If you find the element, return:
{"x": <pixel_x>, "y": <pixel_y>, "confidence": <0.0-1.0>}

If you cannot find it, return:
{"error": "not found"}

Example responses:
{"x": 640, "y": 400, "confidence": 0.9}
{"error": "not found"}

Your JSON response:`;

    // Use /api/chat endpoint with messages format (required for vision models)
    const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        messages: [
          {
            role: 'user',
            content: prompt,
            images: [base64Image]
          }
        ],
        stream: false
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   ⚠️ VLM HTTP ${response.status}: ${errorText}`);
      return { success: false, method: 'vlm', details: `VLM request failed: ${response.status}` };
    }

    const result = await response.json() as { message?: { content: string }, response?: string };
    const responseText = result.message?.content || result.response || '';
    console.log(`   📄 VLM response: ${responseText.substring(0, 200)}`);
    const parsed = parseVlmResponse(responseText);

    if (parsed.x && parsed.y) {
      return {
        success: true,
        clickPoint: { x: parsed.x, y: parsed.y },
        method: 'vlm',
        confidence: parsed.confidence || 0.7,
        details: 'Found by Visual LLM (MiniCPM-V)'
      };
    }

    return { success: false, method: 'vlm', details: `VLM response did not contain coordinates: ${responseText.substring(0, 100)}` };

  } catch (err) {
    // VLM service not available
    console.log(`   ⚠️ VLM error: ${err}`);
    return { success: false, method: 'vlm', details: `VLM service unavailable: ${err}` };
  }
}

/**
 * Parse VLM response JSON
 */
function parseVlmResponse(response: string): { x?: number; y?: number; confidence?: number; error?: string } {
  try {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[^}]+\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {}
  return {};
}

/**
 * Find best matching detection for target text
 */
function findBestMatch(
  detections: DetectedElement[],
  targetText: string
): DetectedElement | null {
  const target = targetText.toLowerCase();
  
  // Score each detection
  let bestMatch: DetectedElement | null = null;
  let bestScore = 0;
  
  for (const det of detections) {
    const detText = (det.text || det.type || '').toLowerCase();
    
    // Calculate similarity score
    let score = 0;
    
    // Exact match
    if (detText === target) {
      score = 1.0;
    }
    // Contains match
    else if (detText.includes(target) || target.includes(detText)) {
      score = 0.7;
    }
    // Word match
    else if (target.split(/\s+/).some(word => detText.includes(word))) {
      score = 0.5;
    }
    
    // Boost by confidence
    score *= det.confidence;
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = det;
    }
  }
  
  return bestScore > 0.3 ? bestMatch : null;
}

/**
 * Get center point of bounding box
 */
function getCenterPoint(bbox: { x: number; y: number; w: number; h: number }): { x: number; y: number } {
  return {
    x: Math.round(bbox.x + bbox.w / 2),
    y: Math.round(bbox.y + bbox.h / 2)
  };
}

/**
 * Call SAM-3 service for precise segmentation
 */
async function refineWithSam3(
  screenshotPath: string,
  bbox: { x: number; y: number; w: number; h: number },
  sam3Url: string
): Promise<{ x: number; y: number } | null> {
  try {
    const imageBuffer = readFileSync(screenshotPath);
    const base64Image = imageBuffer.toString('base64');
    
    console.log(`   📡 Calling SAM-3 service for precise targeting...`);
    
    const response = await fetch(`${sam3Url}/segment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64Image,
        coarse_bbox: { x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h }
      })
    });
    
    if (!response.ok) {
      console.log(`   ⚠️ SAM-3 returned ${response.status}`);
      return null;
    }
    
    const result = await response.json() as { click_point: { x: number; y: number }, confidence: number };
    console.log(`   🎯 SAM-3 refined click point: (${result.click_point.x}, ${result.click_point.y})`);
    return result.click_point;
    
  } catch (err) {
    console.log(`   ⚠️ SAM-3 service unavailable: ${err}`);
    return null;
  }
}

/**
 * Hardcoded fallback positions for demo elements
 * These are approximate positions based on the demo app layout
 */
function getHardcodedFallback(targetText: string): VisionFallbackResult {
  const target = targetText.toLowerCase();
  
  // For 1280x720 viewport on slots/blackjack pages
  const knownPositions: Record<string, { x: number; y: number }> = {
    'spin': { x: 640, y: 413 },        // SPIN button center
    'spin_button': { x: 640, y: 413 },
    '+': { x: 755, y: 495 },           // Bet + button
    'bet_plus': { x: 755, y: 495 },
    'bet_plus_button': { x: 755, y: 495 },
    '-': { x: 515, y: 495 },           // Bet - button
    'bet_minus': { x: 515, y: 495 },
    'bet_minus_button': { x: 515, y: 495 },
    'deal': { x: 640, y: 480 },        // DEAL button (blackjack)
    'deal_button': { x: 640, y: 480 },
    'hit': { x: 560, y: 480 },         // HIT button (blackjack)
    'hit_button': { x: 560, y: 480 },
    'stand': { x: 720, y: 480 },       // STAND button (blackjack)
    'stand_button': { x: 720, y: 480 },
    'back': { x: 87, y: 38 },          // Back to Lobby button (top left)
    'back_button': { x: 87, y: 38 },
    'back_to_lobby': { x: 87, y: 38 },
    'balance': { x: 1170, y: 40 },     // Balance display (top right)
    'balance_display': { x: 1170, y: 40 },
  };
  
  for (const [key, pos] of Object.entries(knownPositions)) {
    if (target.includes(key) || key.includes(target)) {
      return {
        success: true,
        clickPoint: pos,
        method: 'hardcoded',
        confidence: 0.6,
        details: `Using hardcoded position for "${key}"`
      };
    }
  }
  
  return { success: false, method: 'hardcoded', details: 'No hardcoded position' };
}

