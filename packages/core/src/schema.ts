/**
 * Core Schema Types for AI UI Automation
 * Platform-neutral contracts for steps, targets, and results
 */

export type Platform = 'web' | 'flutter';

export type Action =
  | 'navigate'
  | 'tap'
  | 'type'
  | 'scroll'
  | 'waitForVisible'
  | 'assertVisible'
  | 'assertText'
  | 'assertNotVisible'
  | 'screenshot';

export interface TargetHint {
  name: string;                  // canonical name: "login_button"
  testId?: string;               // web data-testid; flutter Key value
  role?: string;                 // web accessibility role (button, textbox, etc.)
  text?: string;                 // visible text or label
  semanticsLabel?: string;       // flutter semantics label
  screen?: string;               // optional: "Login"
}

export interface Step {
  id: string;
  platform: Platform;
  action: Action;
  target?: TargetHint;
  value?: string;                // for type
  url?: string;                  // for navigate
  timeoutMs?: number;
  meta?: Record<string, unknown>;
}

export interface StepResult {
  stepId: string;
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  healingAttempts?: HealingAttempt[];
  error?: { message: string; stack?: string };
  evidence?: {
    screenshotPath?: string;
    tracePath?: string;
    domSnapshotPath?: string;
    a11ySnapshotPath?: string;
    mobilePageSourcePath?: string;
    logsPath?: string;
  };
}

export interface HealingAttempt {
  strategy: 'locatorMemory' | 'vms' | 'vgs' | 'sam3';
  success: boolean;
  details?: string;
  candidateId?: string;
  confidence?: number;
}

export interface RunResult {
  runId: string;
  platform: Platform;
  scenario: string;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  steps: StepResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    healed: number;
  };
}

export interface Driver {
  platform: Platform;
  init(ctx: { baseUrl?: string; appPath?: string; outDir: string }): Promise<void>;
  runStep(step: Step): Promise<StepResult>;
  snapshot(ctx?: { reason?: string }): Promise<void>;
  clickAtPoint(x: number, y: number): Promise<void>;
  dispose(): Promise<void>;
}

// Vision Grounding Service Types
export interface CandidateElement {
  id: string;                 // stable id like "el_01"
  type?: string;              // "button" | "textbox" | "icon" | ...
  text?: string;              // OCR or inferred label
  role?: string;              // optional
  bbox: { x: number; y: number; w: number; h: number }; // pixel coords
  confidence?: number;        // 0..1
}

export interface VisionGroundingRequest {
  runId: string;
  stepId: string;
  platform: Platform;
  screenshotPath: string;
  intent: string;            // e.g., "Tap the Join Now button"
  targetName?: string;       // e.g., "join_now_button"
  candidates: CandidateElement[];
}

export interface VisionGroundingResponse {
  selectedId: string;        // e.g., "el_02"
  reason: string;
  confidence?: number;       // optional 0..1
}

// Visual Memory Service Types
export interface VisualEmbeddingRecord {
  id: string;                  // e.g. runId:stepId
  embedding: number[];         // float vector from DINOv3
  metadata: {
    runId: string;
    stepId: string;
    platform: Platform;
    scenario: string;
    targetName?: string;
    ok: boolean;
    timestamp: string;
    screenshotPath: string;
    label?: string;            // "Login" | "Lobby" | ...
  };
}

// SAM-3 Segmentation Types
export interface SamSegRequest {
  runId: string;
  stepId: string;
  screenshotPath: string;
  promptText?: string; // e.g., "Join Now button"
  coarseBbox?: { x: number; y: number; w: number; h: number };
}

export interface SamSegResponse {
  maskPath: string;    // saved mask image
  clickPoint: { x: number; y: number }; // recommended click center
  confidence?: number;
}

// Target Registry Types
export interface TargetRegistry {
  [targetName: string]: {
    web?: TargetHint;
    flutter?: TargetHint;
  };
}

// Locator Memory Types
export interface LocatorVariant {
  testId?: string;
  role?: string;
  text?: string;
  semanticsLabel?: string;
  visionHint?: {
    screen: string;
    relativeBbox: [number, number, number, number]; // [x, y, w, h] normalized 0..1
  };
}

export interface LocatorMemory {
  [targetName: string]: LocatorVariant[];
}

// BDD Types
export interface BddScenario {
  name: string;
  steps: BddStep[];
}

export interface BddStep {
  keyword: 'Given' | 'When' | 'Then' | 'And';
  text: string;
  useVision?: boolean;
}

// Intent Types
export interface Intent {
  action: Action;
  targetName?: string;
  value?: string;
  url?: string;
  useVision?: boolean;
}

export interface StepPlan {
  scenario: string;
  platforms: Platform[];
  steps: Step[];
}

