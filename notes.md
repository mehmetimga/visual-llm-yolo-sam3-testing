# AI UI Automation Test Setup

## Quick Reference Commands

### 1. Start Appium (Required for Both Platforms)

```bash
# Run Appium with ADB shell enabled (for Android taps)
appium --allow-insecure=uiautomator2:adb_shell
```

### 2. Start Docker Services (YOLO Detector)

```bash
# Start YOLO detector (and Docker Ollama if needed)
cd /Users/mehmetimga/ai-campions/visual-llm-yolo-sam3-testing
docker-compose -f docker-compose.local.yml up
```

### 3. Start Local Ollama (Recommended)

```bash
# If using local Ollama instead of Docker
ollama serve
# (or just ensure Ollama.app is running)
```

### 4. Run Flutter App

```bash
cd /Users/mehmetimga/ai-campions/visual-llm-yolo-sam3-testing/apps/demo-flutter

# List available iOS simulators:
xcrun simctl list devices

# Boot an iOS simulator:
xcrun simctl boot 4502FBC7-E7FA-4F70-8040-4B5844B6AEDA
open -a Simulator  # Opens the Simulator UI

# For iOS Simulator:
flutter run -d 4502FBC7-E7FA-4F70-8040-4B5844B6AEDA

# List available Android emulators (AVDs):
emulator -list-avds

# List connected Android devices/emulators:
adb devices

# For Android Emulator:
flutter run -d emulator-5554
```

> **Note:** Start the Android emulator first with: `emulator -avd Pixel_9_Pro_XL`

### 5. Run the Test

**iOS Test:**
```bash
cd /Users/mehmetimga/ai-campions/visual-llm-yolo-sam3-testing/apps/orchestrator
OLLAMA_BASE_URL=http://127.0.0.1:11434 OLLAMA_VISION_MODEL=minicpm-v:latest \
  pnpm run dev --spec ../../specs/poker_session.feature --platform flutter --device ios --real --vgs --timeout 60000
```

**Android Test:**
```bash
cd /Users/mehmetimga/ai-campions/visual-llm-yolo-sam3-testing/apps/orchestrator
OLLAMA_BASE_URL=http://127.0.0.1:11434 OLLAMA_VISION_MODEL=minicpm-v:latest \
  pnpm run dev --spec ../../specs/poker_session.feature --platform flutter --device android --real --vgs --timeout 60000
```

### Alternative: Use Scripts

```bash
./scripts/run_poker_ios.sh
./scripts/run_poker_android.sh
```

## Checklist

- [ ] Appium running on `localhost:4723`
- [ ] YOLO detector running on `localhost:8001` (Docker)
- [ ] Ollama running on `localhost:11434` (local)
- [ ] Flutter app running on simulator/emulator
- [ ] Run orchestrator test

