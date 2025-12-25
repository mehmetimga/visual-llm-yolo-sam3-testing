# prompt.md — Cross‑Platform AI UI Automation (Web + Flutter) PoC → CI/CD

## Goal
Build a **Cursor-like AI UI automation testing tool** that:
- Accepts **English** or **BDD (Gherkin)** test descriptions.
- Executes tests on **Web** and **Flutter mobile** apps.
- Interacts with UI (click/tap/type/scroll), verifies UI components, and produces **CI-friendly artifacts**.
- Supports **self-healing** for minor UI changes (fallback locator strategies).
- Is designed as a PoC but structured to graduate into **CI/CD** reliably.

You are implementing this in a new repo. Prefer correctness, determinism, and clean interfaces.

---

## Non‑Goals (for PoC)
- No security/auth hardening (Okta, secrets vaults) beyond minimal config.
- No production-grade scheduling, multi-tenant auth, or RBAC.
- No sophisticated model training; only lightweight “healer v0”.
- No heavy vision pipeline unless needed; keep vision as optional Phase 2.

---

## Preferred Stack
### Web
- **Playwright + TypeScript** for deterministic execution, traces, screenshots, reliability.

### Flutter Mobile
- **Appium** with Flutter support (Flutter driver) OR a Flutter-friendly automation approach that can:
  - find elements by **Key** or **Semantics label**,
  - tap/type/scroll,
  - capture screenshots and logs.

### Orchestrator
Choose one:
- **Node/TypeScript** (fastest iteration; recommended for PoC)
- or **Go** orchestrator + Node Playwright worker (if you want production-like platform feel)

For the PoC, implement orchestrator in **Node/TS**.

---

## Key Design Principles
1. **Intent-level abstraction**: English/BDD compiles into a platform-neutral step plan.
2. **Deterministic executors**: Web and Mobile drivers are strict; LLM/agent is not controlling low-level timing directly.
3. **Evidence-first**: Every run produces artifacts (screenshots, traces, logs, JUnit).
4. **Instrumentation-first**: Require `data-testid` (web) and `Key()/Semantics` (Flutter).
5. **Self-healing is constrained**: Fallback strategies only; no open-ended wandering.

---

## Repository Layout (Recommended)
```
ai-ui-automation/
  README.md
  prompt.md
  package.json
  tsconfig.json
  .env.example

  apps/
    orchestrator/                 # CLI + HTTP API for running tests
      src/
        index.ts                  # main entry (CLI)
        server.ts                 # optional HTTP API
        config.ts
        runManager.ts
        reportWriter.ts
      tests/                      # unit tests for compiler, schema, etc.

    web-runner/                   # Playwright execution worker
      src/
        webDriver.ts
        playwrightHarness.ts
      playwright.config.ts

    mobile-runner/                # Appium/Flutter execution worker
      src/
        mobileDriver.ts
        appiumHarness.ts

  packages/
    core/                         # shared types + compiler + step model
      src/
        schema.ts                 # Step, TargetHint, RunResult
        bddParser.ts              # Gherkin-lite parser (subset)
        englishCompiler.ts        # English → Intent (simple rules + optional LLM hook)
        planner.ts                # Intent → StepPlan (deterministic)
        healer.ts                 # Healing policy (fallback order)
        locatorMemory.ts          # simple JSON/SQLite store of locator variants
        utils/
    ui/                           # optional simple dashboard (Phase 2)
      src/
```

---

## Primary User Experience (CLI First)
### Example command
```bash
# Run a BDD spec against both platforms
pnpm run test -- --spec specs/lobby_login.feature --platform web,flutter --baseUrl http://localhost:3000

# Run English spec
pnpm run test -- --english "Open the app, login as demo, go to lobby, open first game, verify Join Now visible." --platform web
```

### CLI Requirements
- `--platform`: `web`, `flutter`, or `web,flutter`
- `--spec`: path to `.feature` file
- `--english`: raw string input
- `--baseUrl` for web runs
- `--appPath` or `--appId` for mobile runs
- `--outDir` for artifacts

---

## Step Model (Platform-neutral Contract)
Create a **strict Step model** so drivers can execute consistently.

### Types
```ts
export type Platform = "web" | "flutter";

export type Action =
  | "navigate"
  | "tap"
  | "type"
  | "scroll"
  | "waitForVisible"
  | "assertVisible"
  | "assertText"
  | "assertNotVisible"
  | "screenshot";

export interface TargetHint {
  name: string;                  // canonical name: "login_button"
  testId?: string;               // web data-testid; flutter Key value
  role?: string;                 // web accessibility role (button, textbox, etc.)
  text?: string;                 // visible text or label
  semanticsLabel?: string;        // flutter semantics label
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
  meta?: Record<string, any>;
}
```

### Step Execution Result
```ts
export interface StepResult {
  stepId: string;
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  error?: { message: string; stack?: string; };
  evidence?: {
    screenshotPath?: string;
    tracePath?: string;
    domSnapshotPath?: string;
    a11ySnapshotPath?: string;
    mobilePageSourcePath?: string;
    logsPath?: string;
  };
}
```

---

## Driver Interface (WebDriver + FlutterDriver)
Define a common interface; platform-specific implementations behind it.

```ts
export interface Driver {
  platform: Platform;
  init(ctx: { baseUrl?: string; appPath?: string; outDir: string }): Promise<void>;
  runStep(step: Step): Promise<StepResult>;
  snapshot(ctx?: { reason?: string }): Promise<void>; // dom/a11y/page source
  dispose(): Promise<void>;
}
```

---

## Locator Resolution Strategy (Deterministic + Healable)
### Web (Playwright)
Resolve TargetHint in this order:
1. `testId` → `page.getByTestId(testId)`
2. `role + text` → `page.getByRole(role, { name: text })`
3. `text` → `page.getByText(text, { exact: false })`
4. `css` fallback (optional, only if provided in meta)

### Flutter (Appium)
Resolve TargetHint in this order:
1. `testId` → Flutter `Key(testId)` (preferred)
2. `semanticsLabel` → accessibility id
3. `text` → visible text match (if supported)
4. fallback to stored alternatives in locatorMemory

---

## Healer v0 (Constrained Self-Healing)
When a step fails due to element not found:
1. Try alternate locator variants from **locatorMemory** (per target name).
2. Try fallbacks (role+text, text partial).
3. If successful, record the working locator variant back into locatorMemory.

Do **not** allow arbitrary exploration. Healing must be bounded:
- max 3 alternate attempts per step
- max 1 extra screenshot + snapshot per attempt
- stop and fail fast if still missing

### locatorMemory format
Store as JSON in `outDir/.locatorMemory.json` (PoC).
```json
{
  "login_button": [
    { "testId": "login-btn" },
    { "role": "button", "text": "Log In" },
    { "text": "Log In" }
  ],
  "join_now_button": [
    { "testId": "join-now" },
    { "text": "Join Now" }
  ]
}
```

---

## BDD Support (Gherkin-lite, subset)
Implement a minimal parser that supports:
- `Scenario: ...`
- `Given`, `When`, `Then`, `And`
- Quoted strings for parameters

### Supported step phrases (PoC)
Map these to intent actions:
- `Given I am on the login page`
- `When I navigate to "<path>"`
- `When I tap "<targetName>"`
- `When I type "<text>" into "<targetName>"`
- `Then I should see text "<text>"`
- `Then "<targetName>" should be visible`
- `Then "<targetName>" should not be visible`

Your compiler should translate `targetName` into a TargetHint using a **Target Registry** (see below).

---

## Target Registry (Crucial for Cross-Platform)
Create `targets.json` that defines canonical targets and their hints for each platform.

### Example `specs/targets.json`
```json
{
  "login_username": {
    "web": { "name": "login_username", "testId": "username", "role": "textbox" },
    "flutter": { "name": "login_username", "testId": "username_input" }
  },
  "login_password": {
    "web": { "name": "login_password", "testId": "password", "role": "textbox" },
    "flutter": { "name": "login_password", "testId": "password_input" }
  },
  "login_button": {
    "web": { "name": "login_button", "testId": "login-btn", "role": "button", "text": "Log In" },
    "flutter": { "name": "login_button", "testId": "login_button", "text": "Log In" }
  },
  "join_now_button": {
    "web": { "name": "join_now_button", "testId": "join-now", "role": "button", "text": "Join Now" },
    "flutter": { "name": "join_now_button", "testId": "join_now_button", "text": "Join Now" }
  }
}
```

The compiler uses this registry to build TargetHint per platform.

---

## Artifacts & Reporting (CI-Ready)
For each run, write to:
```
out/
  run.json
  report.html
  junit.xml
  steps/
    001_navigate.json
    001_navigate.png
    002_type_username.json
    ...
  traces/
    web_trace.zip (on failure)
  snapshots/
    dom.html (web)
    a11y.json (web)
    mobile_source.xml (flutter)
  logs/
    web_console.log
    web_network.har
    mobile_driver.log
```

### Minimum for demo
- screenshot per step
- trace on failure for web (Playwright trace viewer)
- JUnit XML for CI
- single HTML report with step list + thumbnails

---

## Demo Scenario (Must Work on Web + Flutter)
Create `specs/lobby_login.feature`:

```gherkin
Feature: Lobby smoke

Scenario: Login and open lobby
  Given I am on the login page
  When I type "demo" into "login_username"
  And I type "pw" into "login_password"
  And I tap "login_button"
  Then I should see text "Casino Lobby"
  And "join_now_button" should be visible
```

Your goal is to run this scenario:
- `--platform web` and `--platform flutter`
- produce a report with evidence

---

## Web Runner Implementation Details (Playwright)
- Use Playwright’s strict locators.
- For each step:
  - run action
  - take screenshot (or at least on key steps)
- On failure:
  - capture screenshot
  - capture DOM snapshot
  - start/stop Playwright trace
- Prefer headless for CI; allow headed for local demo.

---

## Flutter Runner Implementation Details (Appium)
- Start Appium server locally for PoC or connect to existing.
- Launch emulator/simulator.
- Install app (APK/IPA) or start with `appPath`.
- Implement `tap`, `type`, `assertVisible`, `assertText`, `screenshot`.
- On failure:
  - screenshot
  - page source / widget tree dump (whatever driver provides)

**Important**: Add Flutter `Key()` and Semantics labels in the demo Flutter app.

---

## Optional: English → Steps (PoC)
For demo, keep English compiler simple:
- Split by commas/“then/and”
- Map common verbs: open, navigate, login, click/tap, verify/see
- Use Target Registry lookup for named targets.

If you want LLM, keep it behind an interface:
```ts
export interface PlannerLLM {
  compileEnglishToIntent(input: string): Promise<Intent>;
}
```
But do not require it for core function; PoC should run deterministically without external dependencies.

---

## CI/CD Plan (After PoC)
1. Add `pnpm test:web` job (headless Playwright, artifact upload).
2. Add `pnpm test:flutter:android` job (Android emulator).
3. Add `pnpm test:flutter:ios` job (macOS runner with iOS simulator) if needed.
4. Split suites:
   - PR smoke (1–3 scenarios)
   - nightly regression (broader)
5. Persist artifacts and JUnit for visibility.

---

## Quality Bar
- Clear types and interfaces.
- No hidden global state.
- Logs and evidence always written.
- Fails must be diagnosable via artifacts.
- Healing bounded and transparent (report shows healing attempt).

---

## Deliverables (What to implement now)
1. `packages/core`: Step schema, Target Registry loader, BDD-lite parser, compiler → StepPlan.
2. `apps/web-runner`: Playwright driver implementing `Driver`.
3. `apps/mobile-runner`: Appium driver implementing `Driver`.
4. `apps/orchestrator`: CLI that loads spec, produces StepPlan for requested platforms, runs drivers, writes artifacts.
5. `specs/targets.json` + `specs/lobby_login.feature`.
6. HTML report + JUnit output.

---

## Definition of Done (PoC Demo)
- One command runs scenario on **web** and **flutter**.
- Produces report with screenshots and JUnit.
- One intentional minor change (rename a testId/key) can be handled by healer v0 (optional but strong).

---

## Implementation Notes / Suggestions
- Use `pnpm` workspaces or `npm` monorepo; keep it simple.
- Prefer ESM + TS for Node.
- Keep config in `.env` and command flags.
- Make drivers robust with timeouts and explicit waits.

---

## Vision Grounding Service (Ollama Visual LLM + Detector) — Explicit Wiring

### Purpose
Add a **Vision Grounding Service (VGS)** that enables the system to:
- Recover when DOM/Keys locators fail (or when UI is custom-rendered/canvas-heavy).
- Ground actions using screenshots by combining:
  1) **Detection / parsing** (YOLO or OmniParser-style UI parsing) to produce candidate UI elements, and
  2) **Local Visual LLM via Ollama** (MiniCPM-V 2.x preferred; Qwen2-VL optional) to select the correct candidate element for a given intent.

This keeps execution deterministic while still providing “AI” recovery and strong demo value without external API calls.

### When VGS is invoked (Policy)
Invoke VGS only when:
- A step fails with `ELEMENT_NOT_FOUND` (primary locator resolution fails), OR
- A step explicitly sets `meta.useVision = true`, OR
- The target is marked `meta.requiresVision = true` in `targets.json`.

Do NOT use VGS for every step; it is a fallback path to keep CI stable.

---

## VGS Components

### 1) Detector (Choose One)
#### Option A: YOLO-based UI Element Detection (Recommended for PoC)
- Input: screenshot
- Output: list of bounding boxes for UI primitives (button, input, checkbox, icon) + confidence

#### Option B: OmniParser-style UI Parsing (Optional Phase 2)
- Input: screenshot
- Output: list of interactable elements + richer metadata (type, candidate text, inferred role)

For the PoC, implement Option A as a stub that can later be replaced with a real model:
- You can start with a simple detector placeholder that returns hard-coded regions for the demo screen(s),
  then swap to YOLO once the pipeline is proven.

---

### 2) Local Visual LLM via Ollama (Required for VGS)
Use a local multimodal model in Ollama to choose the best candidate element from the detector output.

**Primary model:** MiniCPM-V 2.x  
**Optional model:** Qwen2-VL  

The Visual LLM should NOT output coordinates. It selects among candidate element IDs.

---

## VGS Data Contracts

### Candidate Element Model
```ts
export interface CandidateElement {
  id: string;                 // stable id like "el_01"
  type?: string;              // "button" | "textbox" | "icon" | ...
  text?: string;              // OCR or inferred label
  role?: string;              // optional
  bbox: { x: number; y: number; w: number; h: number }; // pixel coords
  confidence?: number;        // 0..1
}
```

### Vision Grounding Request/Response
```ts
export interface VisionGroundingRequest {
  runId: string;
  stepId: string;
  platform: "web" | "flutter";
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
```

### Driver integration
If VGS selects `CandidateElement` with bbox:
- **Web**: click/tap via Playwright mouse at center point:
  - `x = bbox.x + bbox.w/2`, `y = bbox.y + bbox.h/2`
- **Flutter (Appium)**: tap by coordinates through driver touch action.

Important:
- Always re-screenshot after the click to confirm UI changed as expected.
- Store this grounding outcome in locatorMemory (see below).

---

## Ollama Integration (Local Visual LLM)

### Configuration (.env)
Add these to `.env.example`:
```
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_VISION_MODEL=minicpm-v:latest
# Optional fallback model
OLLAMA_VISION_MODEL_FALLBACK=qwen2-vl:latest

# Control JSON strictness / retries
OLLAMA_MAX_RETRIES=2
OLLAMA_TIMEOUT_MS=30000
```

### Ollama Client (TypeScript) — Interface
Implement a minimal client that:
- Sends prompt + image to Ollama
- Requires JSON-only response
- Retries once if JSON is invalid

```ts
export interface OllamaVisionClient {
  pickCandidate(req: VisionGroundingRequest): Promise<VisionGroundingResponse>;
}
```

Implementation notes:
- Keep prompts small.
- Do not pass full DOM dumps; only pass candidate list + intent.
- Include guardrails: “Return JSON only; no markdown.”

---

## Prompts for Ollama Visual LLM (MiniCPM-V / Qwen2-VL)
Use the following **system prompt** and **user prompt template**.

### System Prompt (constant)
```text
You are a UI automation grounding assistant.
You will receive:
1) A screenshot of an app
2) A list of detected candidate UI elements with IDs, types, text, and bounding boxes
3) A target intent (what the test is trying to click/verify)

Task:
- Select the single candidate element ID that best matches the intent.
- If none match, select the best approximate match.
- Return STRICT JSON only, with keys: selectedId, reason, confidence.
- confidence must be a number from 0.0 to 1.0.
Do not include any other text.
```

### User Prompt Template (per request)
```text
Intent: "{{intent}}"
Platform: {{platform}}
TargetName: {{targetName}}

Candidates:
{{#each candidates}}
- id={{id}}, type={{type}}, text={{text}}, bbox={{bbox.x}},{{bbox.y}},{{bbox.w}},{{bbox.h}}, conf={{confidence}}
{{/each}}

Return JSON only:
{"selectedId":"...","reason":"...","confidence":0.0}
```

### Model selection policy
- Try `OLLAMA_VISION_MODEL` (MiniCPM-V) first.
- If response is invalid JSON or confidence < 0.35, retry once.
- If still poor and `OLLAMA_VISION_MODEL_FALLBACK` is set, call fallback (Qwen2-VL).

---

## VGS Orchestration Flow (Pseudo)
1. Executor fails to resolve element by testId/Key/role/text.
2. Orchestrator requests:
   - screenshot (already captured on failure)
   - candidates from Detector
3. Orchestrator calls Ollama Vision model to pick candidate.
4. Orchestrator issues a coordinate click/tap through the driver.
5. Orchestrator validates:
   - element disappearance, page changed, or expected text appears (depending on step).
6. Orchestrator records:
   - success/failure
   - selected candidate + screenshot embedding (optional Phase 2)
   - updates `locatorMemory` with a new “visual hint”.

---

## locatorMemory Extension for Vision Outcomes
Extend `locatorMemory` entries to optionally include a visual region hint:
```json
{
  "join_now_button": [
    { "testId": "join-now" },
    { "text": "Join Now" },
    { "visionHint": { "screen": "Lobby", "relativeBbox": [0.72, 0.08, 0.22, 0.07] } }
  ]
}
```

- `relativeBbox` uses normalized coords (x,y,w,h) in 0..1, based on screenshot size.
- For PoC, storing `relativeBbox` is sufficient.
- In Phase 2, you can attach a DINOv3 embedding key to this hint for screen similarity retrieval.

---

## BDD / English Step Metadata to Trigger Vision
Support optional annotations:
- In BDD:
  - `And I tap "join_now_button" using vision`
- In English:
  - “... click Join Now (use vision if needed)”

Compile this into:
```ts
meta: { useVision: true }
```

---

## Definition of Done (Updated Demo Bar)
In addition to previous DoD:
- Demo run succeeds on web + flutter even after one intentional `testId`/`Key` rename by falling back to VGS:
  - Detector → Ollama MiniCPM-V selection → coordinate click
- Report shows:
  - “Healing attempt: Vision Grounding Service used”
  - Chosen candidate ID and reason
  - Before/after screenshots

---

## Local-Only Mode (MacBook Pro M5, 10‑GPU cores) — Full Local Stack

### Objective
Run the entire system locally with **no external API calls**:
- Orchestrator + Web Runner + Mobile Runner
- Ollama Visual LLM (MiniCPM‑V 2.x, optional Qwen2‑VL)
- DINOv3 Embeddings (Visual Memory)
- SAM‑3 Segmentation (Precision Grounding for casino/game UI)
- Local VectorDB (Qdrant recommended) for embedding search and incident clustering

### Why this matters for the demo
- Shows the system is **privacy-preserving** and **vendor-independent**
- Demonstrates “AI testing” capabilities **without cloud dependencies**
- Reduces security review friction

---

## Visual Memory Service (DINOv3) — Explicit Wiring

### Purpose
Add a **Visual Memory Service (VMS)** powered by **DINOv3** embeddings to enable:
1. **Similar Incident Retrieval**: “This failure looks like past incident #123.”
2. **Failure Clustering**: Deduplicate CI noise (many failures → one root cause cluster).
3. **Healing Bootstrap**: When a locator fails, retrieve past successful runs on visually similar screens and reuse stored locator/vision hints.

### When VMS is invoked (Policy)
- Always compute DINOv3 embedding for:
  - Failure screenshots (mandatory)
  - Optional: key checkpoints (login page, lobby page)
- On any failure, query VectorDB for top‑K similar embeddings and attach results to report.

### VMS API (Local Service)
Create a local service/module:
- `POST /embed` → returns embedding vector for a given image
- `POST /search` → returns top‑K similar runs/images
- `POST /upsert` → stores embedding + metadata

**Metadata to store**
- runId, stepId, platform, scenario, targetName, ok/fail, timestamp
- screenshotPath (or hash), optional label (e.g., “Lobby”)
- optional: candidate elements + selected candidate for healing replay

### Data Contract
```ts
export interface VisualEmbeddingRecord {
  id: string;                  // e.g. runId:stepId
  embedding: number[];         // float vector from DINOv3
  metadata: {
    runId: string;
    stepId: string;
    platform: "web" | "flutter";
    scenario: string;
    targetName?: string;
    ok: boolean;
    timestamp: string;
    screenshotPath: string;
    label?: string;            // "Login" | "Lobby" | ...
  };
}
```

### VectorDB Choice
Use **Qdrant** locally:
- simple API
- good performance
- easy Docker deployment

Collection recommendation:
- `ui_runs` with vector size matching DINOv3 output
- payload indexes for `platform`, `scenario`, `ok`, `label`

### VMS Integration into Healer
On `ELEMENT_NOT_FOUND`:
1) Compute embedding for current screenshot.
2) Query top‑K similar screenshots.
3) If any top result has matching `targetName` and `ok=true`, try its stored locator variants and/or visionHint first.
4) If still failing, fall back to Vision Grounding Service (VGS).

---

## SAM‑3 Segmentation Service — Explicit Wiring (Casino/Game UI)

### Why SAM‑3
Casino game UIs often include:
- canvas/WebGL
- stylized neon buttons and irregular shapes
- animated chips, sliders, knobs, and overlays

YOLO boxes can be too coarse. SAM‑3 can segment the **exact clickable region** so coordinate clicks are accurate and repeatable.

### When SAM‑3 is invoked (Policy)
Invoke SAM‑3 only when:
- VGS candidate click fails to change UI state, OR
- `meta.requiresSegmentation = true` on the target, OR
- Target type is marked as one of:
  - `canvas_button`, `slider`, `toggle`, `chip`, `knob`

### SAM‑3 Service Responsibilities
Input:
- screenshot
- coarse bbox (from YOLO/OmniParser) OR a text prompt label
Output:
- segmentation mask (binary) + refined click point(s)

### SAM‑3 Request/Response
```ts
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
```

### How SAM‑3 integrates into VGS
1) Detector produces candidates (boxes).
2) Ollama picks candidate ID.
3) Executor clicks candidate center.
4) If UI state does not change (assertion still fails):
   - call SAM‑3 with `coarseBbox` + `promptText`
   - click SAM‑3 `clickPoint`
   - re-assert expected state
5) Record `relativeBbox` and/or segmentation-derived hint in locatorMemory for future runs.

---

## Vision Grounding Service (VGS) — Updated Flow (with DINOv3 + SAM‑3)
**Failure Handling Order**
1) Primary locators (testId/Key/role/text)
2) locatorMemory variants
3) DINOv3 VMS bootstrap (reuse successful hints from similar screens)
4) Detector + Ollama pick candidate (VGS)
5) If still failing: SAM‑3 segmentation refine + retry
6) Fail with full evidence bundle

This provides a strong “self-healing” narrative:
- deterministic first,
- retrieval-based second,
- vision grounding third,
- segmentation precision last.

---

## Local Deployment: docker-compose (PoC)
Create `docker-compose.local.yml` to run local dependencies.

Services:
- `ollama` (vision model runtime)
- `qdrant` (vector DB)
Optional (if you containerize):
- `vms-dino` (embedding service)
- `sam3-seg` (segmentation service)

Notes:
- On macOS, you may run DINOv3/SAM‑3 directly on host Python venv if container GPU is complex.
- Keep the service boundaries (HTTP or local module) stable so you can swap deployment later.

`.env.local` should include:
```
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_VISION_MODEL=minicpm-v:latest
OLLAMA_VISION_MODEL_FALLBACK=qwen2-vl:latest

QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=ui_runs

VMS_ENABLED=true
SAM3_ENABLED=true
VGS_ENABLED=true
```

---

## Demo Plan (Audience-Facing) — Strong Web + Flutter + Casino Game Story

### Audience takeaway (script)
1) “We write tests in English/BDD.”
2) “The same spec runs on Web and Flutter.”
3) “It produces CI-ready evidence automatically.”
4) “When UI changes, it self-heals locally—no cloud.”
5) “For casino game UIs (canvas/animated), we can precisely target controls using segmentation.”

### 8–10 minute live demo agenda
#### Part A — Setup (1 min)
- Show repo structure and the single command:
  - `pnpm run test -- --spec specs/lobby_login.feature --platform web,flutter --outDir out/demo_run`

#### Part B — Web run (2 min)
- Run scenario on web.
- Open HTML report:
  - step list, screenshots, trace on failure (if any)
- Emphasize deterministic locators (testIds/a11y roles).

#### Part C — Flutter run (2 min)
- Run same scenario on Flutter emulator/simulator.
- Show:
  - screenshots per step
  - assertion results
  - JUnit output ready for CI

#### Part D — Self-healing via VGS (2 min)
- Make an intentional UI change:
  - rename `data-testid="join-now"` → `data-testid="cta-join"`
  - or rename Flutter Key `join_now_button` → `cta_join_button`
- Re-run.
- Show report section:
  - “Healing attempt: locatorMemory failed”
  - “VMS retrieved similar Lobby screen from past run”
  - “VGS used: detector candidates + Ollama (MiniCPM‑V) selected el_02”
  - click succeeded
- This is your strongest sell point: “It adapts to change.”

#### Part E — Casino game UI precision using SAM‑3 (2–3 min)
- Use a casino lobby/game screen that is canvas-like (stylized buttons).
- Demonstrate a step that requires segmentation:
  - “Tap the spin button” or “Tap bet +”
- Force the flow:
  - YOLO box is coarse; initial click fails
  - SAM‑3 segmentation refines region; click succeeds
- Show the mask overlay artifact and refined clickpoint recorded.

### Demo artifacts to show on screen
- HTML report with:
  - before/after screenshots
  - “similar incidents” panel (top‑K screenshots from DINOv3)
  - VGS selection JSON (selected candidate + reason)
  - SAM‑3 mask overlay image + click point
- Terminal output with run id and artifact paths
- Optional: Qdrant dashboard showing stored embeddings

---

## Implementation Tasks (Additions)
### Core
- Add `packages/core/src/vms.ts` (DINOv3 integration + Qdrant client)
- Add `packages/core/src/sam3.ts` (SAM‑3 request/response interface)
- Extend `healer.ts` to include VMS bootstrap before VGS

### Reporting
- Add report sections:
  - “Similar Incidents (DINOv3)”
  - “Vision Grounding (Ollama)”
  - “Segmentation (SAM‑3)”
- Save mask overlays and candidate lists for auditability

### Specs
- Add `specs/casino_spin.feature` (canvas-like / stylized UI scenario)
- Extend `targets.json` with:
  - `meta.requiresSegmentation=true` for casino controls

---

## Local Performance Notes (M5 / 10 GPU cores)
- Keep VGS and SAM‑3 as **fallback paths** to manage latency.
- For demo smoothness:
  - Pre-warm Ollama model once (first request is slower).
  - Cache DINOv3 embeddings for repeated screenshots in a run.
  - Limit DINOv3 top‑K search to 5–10.
  - Only run SAM‑3 on 1–2 steps in the casino scenario.

End.

End.
