# How to Run Tests

## Prerequisites

- Node.js 20+
- pnpm 8+
- Docker (for ML services)
- Flutter SDK (for mobile testing)
- Appium 3.x (for mobile automation)
- iOS Simulator / Android Emulator

## Quick Setup

```bash
# Install dependencies
pnpm install

# Build packages
pnpm build
```

## Web Testing

### 1. Start the Demo Web App

```bash
pnpm dev:web
# App runs at http://localhost:3000
# Demo credentials: demo / password123
```

### 2. Run Web Tests

```bash
# Mock mode (no browser)
pnpm test -- --spec specs/lobby_login.feature --platform web

# Real browser (headless)
pnpm test -- --spec specs/lobby_login.feature --platform web --real

# Real browser (visible)
pnpm test -- --spec specs/lobby_login.feature --platform web --real --headed

# With vision services
pnpm test -- --spec specs/casino_game.feature --platform web --real --vgs
```

## Mobile Testing (Flutter + Appium)

### 1. Start the Flutter App

```bash
# List available simulators
flutter devices

# Start iOS simulator
open -a Simulator

# Run Flutter app on simulator
cd apps/demo-flutter
flutter run -d <DEVICE_ID>

# Or using clean PATH (if conda conflicts):
env -i HOME="$HOME" PATH="/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$HOME/flutter/bin" \
  flutter run -d <DEVICE_ID>
```

### 2. Start Appium Server

```bash
# Install Appium globally (if not installed)
npm install -g appium
appium driver install xcuitest   # For iOS
appium driver install uiautomator2  # For Android

# Start Appium with clean PATH (recommended to avoid conda conflicts)
pkill -f appium 2>/dev/null
env -i HOME="$HOME" PATH="/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$HOME/.npm-global/bin" \
  appium --port 4723 &

# Verify Appium is running
curl http://localhost:4723/status
```

### 3. Run Mobile Tests

```bash
# Run full Flutter test (login + games)
cd /Users/mehmetimga/ai-campions/visual-llm-yolo-sam3-testing
pnpm test -- --spec specs/flutter_full.feature --platform flutter --real --vgs

# Run lobby-only test (if already logged in)
pnpm test -- --spec specs/flutter_lobby.feature --platform flutter --real --vgs
```

### 4. Restart Fresh (Clear Previous State)

If you need to restart the app fresh (clear previous test data):

```bash
# Terminate and relaunch the app
xcrun simctl terminate <DEVICE_ID> com.example.demoCasino
xcrun simctl launch <DEVICE_ID> com.example.demoCasino

# Or fully restart:
cd apps/demo-flutter
flutter run -d <DEVICE_ID>
```

## Docker Services (Vision/ML Stack)

### Start Services

```bash
# Start all ML services
./scripts/setup-services.sh start

# Or manually:
docker-compose -f docker-compose.local.yml up -d

# Pull Ollama models
./scripts/setup-services.sh pull-models
```

### Service Ports

| Service | Port | Description |
|---------|------|-------------|
| Detector (YOLO) | 8001 | UI element detection |
| DINOv2 | 8002 | Visual embeddings |
| SAM-3 | 8003 | Element segmentation |
| Ollama | 11434 | Vision LLM |
| Qdrant | 6333 | Vector database |

### Verify Services

```bash
curl http://localhost:8001/health  # Detector
curl http://localhost:8003/health  # SAM-3
curl http://localhost:11434/api/tags  # Ollama models
```

## Troubleshooting

### Conda/Miniforge PATH Conflicts

If you see errors like "Unknown option: -Xlinker" or build failures, conda may be interfering:

```bash
# Run commands with clean PATH:
env -i HOME="$HOME" PATH="/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$HOME/flutter/bin" \
  <command>
```

### Port Already in Use

```bash
# Kill process on port
lsof -ti:3000 | xargs kill -9  # Web app
lsof -ti:4723 | xargs kill -9  # Appium
```

### Appium Connection Issues

1. Ensure Appium is running: `curl http://localhost:4723/status`
2. Ensure the app is running on simulator
3. Check WebDriverAgent build: use clean PATH when starting Appium

### Flutter App Won't Build

```bash
# Clean and rebuild
cd apps/demo-flutter
flutter clean
rm -rf ios/Pods ios/Podfile.lock
cd ios && pod install && cd ..
flutter run -d <DEVICE_ID>
```

## Test Output

Tests produce artifacts in `apps/orchestrator/out/`:
- `run.json` - Raw test results
- `report.html` - Visual HTML report
- `junit.xml` - CI-compatible report
- `steps/<platform>/step_*.png` - Screenshots per step
