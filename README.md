# AI UI Automation - Cross-Platform Testing PoC

🤖 A **Cursor-like AI UI testing system** that accepts English or BDD (Gherkin) test descriptions and executes tests on Web (Playwright) and Flutter mobile (Appium) applications.

## Features

- ✅ **Natural Language Tests**: Write tests in English or BDD/Gherkin format
- ✅ **Cross-Platform**: Same spec runs on Web and Flutter
- ✅ **Self-Healing**: Automatic recovery from minor UI changes
- ✅ **Vision Grounding**: AI-powered element detection for canvas/WebGL elements
- ✅ **SAM-3 Segmentation**: Precise targeting for complex UI (casino games)
- ✅ **CI-Ready**: Produces JUnit XML, HTML reports, and screenshots
- ✅ **Local-Only**: Runs entirely locally with Ollama, no external APIs

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker (for ML services)

### Installation

```bash
# Install dependencies
pnpm install

# Install Playwright browsers
pnpm exec playwright install chromium

# Copy environment file
cp env.example .env
```

### Start Demo Web App

```bash
# Start the demo web app
pnpm dev:web

# The app will be available at http://localhost:3000
# Demo credentials: demo / password123
```

### Running Tests

```bash
# Run BDD spec on web platform (mock mode)
pnpm test -- --spec specs/lobby_login.feature --platform web

# Run with REAL browser (headless)
pnpm test -- --spec specs/lobby_login.feature --platform web --real

# Run with REAL browser (visible)
pnpm test -- --spec specs/lobby_login.feature --platform web --real --headed

# Run casino game test with vision fallback
pnpm test -- --spec specs/casino_game.feature --platform web --real --vgs

# Run English test
pnpm test -- --english "Open the app, login as demo, go to lobby, verify Join Now visible" --platform web --real
```

## Docker Services (ML Stack)

Start the vision and ML services:

```bash
# Start all services
./scripts/setup-services.sh start

# Or manually with docker-compose
docker-compose -f docker-compose.local.yml up -d

# Check service status
./scripts/setup-services.sh status

# Pull Ollama vision models (required for VLM-based detection)
./scripts/setup-services.sh pull-models
```

### Services Overview

| Service | Port | Description |
|---------|------|-------------|
| **Detector (YOLO)** | 8001 | UI element detection from screenshots |
| **DINOv2** | 8002 | Visual embeddings for similarity search |
| **SAM-3** | 8003 | Precise element segmentation |
| **Ollama** | 11434 | Local Vision LLM (MiniCPM-V, LLaVA) |
| **Qdrant** | 6333 | Vector database for visual memory |

### Testing Services

```bash
# Test detector
curl http://localhost:8001/health

# Test with an image
curl -X POST http://localhost:8001/detect \
  -H "Content-Type: application/json" \
  -d '{"image_path": "/app/out/steps/web/step_001.png"}'

# Test SAM-3
curl http://localhost:8003/health
```

## Project Structure

```
ai-ui-automation/
├── packages/
│   └── core/                    # Shared types, parsers, services
│       ├── src/
│       │   ├── schema.ts        # Core types (Step, TargetHint, etc.)
│       │   ├── bddParser.ts     # Gherkin-lite parser
│       │   ├── englishCompiler.ts # Natural language to intents
│       │   ├── planner.ts       # Intent to step plans
│       │   ├── healer.ts        # Self-healing logic
│       │   └── locatorMemory.ts # Successful locator storage
│
├── apps/
│   ├── orchestrator/            # CLI for running tests
│   ├── web-runner/              # Playwright execution
│   ├── mobile-runner/           # Appium/Flutter execution
│   ├── demo-web/                # Next.js demo casino app
│   └── demo-flutter/            # Flutter demo casino app
│
├── services/
│   ├── detector/                # YOLO element detection (Python)
│   ├── dinov3/                  # DINOv2 embeddings (Python)
│   └── sam3/                    # SAM-3 segmentation (Python)
│
├── specs/
│   ├── targets.json             # Target definitions per platform
│   ├── lobby_login.feature      # Login smoke test
│   └── casino_game.feature      # Casino game vision test
│
├── scripts/
│   └── setup-services.sh        # Service management script
│
└── docker-compose.local.yml     # Local ML services
```

## BDD Spec Example

```gherkin
Feature: Lobby Login Smoke Test

  Scenario: Login and open lobby
    Given I am on the login page
    When I type "demo" into "login_username"
    And I type "password123" into "login_password"
    And I tap "login_button"
    Then I should see text "Casino Lobby"
    And "join_now_button" should be visible
```

## Vision-Based Testing

For canvas-rendered elements (casino games), use the `using vision` annotation:

```gherkin
@vision
Scenario: Play slots with canvas-based spin button
  When I tap "spin_button" using vision
```

This triggers the Vision Grounding Service (VGS) which:
1. Takes a screenshot
2. Detects UI elements using YOLO
3. Uses Ollama (LLaVA/MiniCPM-V) to select the correct element
4. (Optional) Refines with SAM-3 for precise click point
5. Clicks via coordinates

## Self-Healing Flow

When a locator fails, the system attempts recovery in this order:

1. **Locator Memory**: Try previously successful locator variants
2. **YOLO Detector**: Detect UI elements from screenshot
3. **Visual LLM (VLM)**: Ask Ollama to find the element
4. **Hardcoded Fallback**: Use known positions (demo mode)
5. **SAM-3 Segmentation**: Precise targeting for complex elements

## Test Results Example

```
📊 Test Results Summary:
   ✅ [web] Play slots with canvas-based spin button
      Total: 9, Passed: 9, Failed: 0, Healed: 1
   ✅ [web] Play blackjack game
      Total: 11, Passed: 11, Failed: 0, Healed: 4
```

## Configuration

Key environment variables (see `env.example`):

```bash
# Ollama (Vision LLM)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_VISION_MODEL=llava:7b

# ML Services
DETECTOR_URL=http://localhost:8001
SAM3_URL=http://localhost:8003

# Qdrant (Vector DB)
QDRANT_URL=http://localhost:6333

# Feature Flags
VGS_ENABLED=true
VMS_ENABLED=true
SAM3_ENABLED=true
```

## Artifacts

Each test run produces:

- `out/run.json` - Raw results
- `out/report.html` - Visual HTML report
- `out/junit.xml` - CI-compatible JUnit report
- `out/steps/` - Screenshots per step

## Demo Apps

### Web (Next.js)

A casino-themed demo app with:
- Login page with form inputs (`data-testid` attributes)
- Lobby with game cards
- Slots game with **canvas-rendered** controls (SPIN, bet +/-)
- Blackjack game with **canvas-rendered** cards and buttons (HIT, STAND, DEAL)

### Flutter

A matching Flutter app with:
- Login screen with semantic labels
- Lobby screen with game tiles
- CustomPaint-based casino games

## CLI Options

```bash
pnpm test -- [options]

Options:
  -s, --spec <path>       BDD feature file path
  -e, --english <text>    English test description
  -p, --platform <names>  Platforms: web, flutter, or web,flutter
  -b, --baseUrl <url>     Base URL (default: http://localhost:3000)
  -o, --outDir <path>     Output directory (default: ./out)
  --real                  Use real browser execution (vs mock)
  --headed                Run browser in visible mode
  --vgs                   Enable Vision Grounding Service
  --vms                   Enable Visual Memory Service
  --sam3                  Enable SAM-3 Segmentation
```

## License

MIT
