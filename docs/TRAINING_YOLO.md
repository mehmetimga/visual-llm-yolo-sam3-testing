# Training YOLO for Flutter UI Detection

## Overview

The current YOLO model (`yolov8n.pt`) is trained on COCO dataset (general objects like person, car, dog) and returns **0 detections** for Flutter UI elements. To detect Flutter UI components, you need to train a custom model.

## Why Current YOLO Returns 0 Detections

```python
# Current model: yolov8n.pt
COCO Classes: ['person', 'bicycle', 'car', 'dog', 'cat', ...]  # 80 classes

# What we need:
Flutter UI Classes: ['button', 'textfield', 'canvas_button', 'game_control', ...]
```

**Flutter uses CustomPaint/Canvas** → Not recognized by COCO-trained model

## Training Steps

### 1. Prepare Training Data

#### Option A: Use Existing Test Screenshots (Quick Start)

You already have **116 test screenshots** from your runs!

```bash
# Copy screenshots to training directory
mkdir -p services/detector/training_data/images
cp apps/orchestrator/out/steps/flutter/*.png services/detector/training_data/images/

# You should have images showing:
- Login screens with text fields and buttons
- Lobby with game cards
- Slots game with SPIN, +, - buttons
- Blackjack with DEAL, HIT, STAND buttons
```

#### Option B: Generate More Diverse Data

Run tests with different:
- Screen sizes
- Devices (iPhone, Android)
- App states (different bet amounts, game states)
- UI themes (if you have dark/light modes)

### 2. Label the Data

**Tool Options:**

**A. Roboflow (Recommended - Easy)**
1. Go to [roboflow.com](https://roboflow.com)
2. Create project "Flutter UI Detection"
3. Upload your 116 screenshots
4. Draw bounding boxes around UI elements
5. Assign classes: `button`, `textfield`, `canvas_button`, etc.
6. Export in "YOLOv8" format

**B. LabelImg (Free, Offline)**
```bash
pip install labelImg
labelImg services/detector/training_data/images
```

**What to Label:**

| Class | Examples | Priority |
|-------|----------|----------|
| `button` | LOG IN, PLAY NOW, JOIN NOW | High |
| `canvas_button` | SPIN, DEAL, HIT, STAND, +, - | **Critical** |
| `textfield` | Username, Password inputs | High |
| `label` | "Casino Lobby", "MEGA SLOTS" | Medium |
| `icon` | 🎰, 🃏, 🎡 emojis | Low |
| `card_widget` | Game cards in lobby | Medium |
| `balance_display` | "$1000" balance | Medium |

**Label Format (YOLO):**
```
# services/detector/training_data/labels/screenshot_001.txt
6 0.500 0.413 0.156 0.083  # canvas_button (SPIN) at center
6 0.755 0.495 0.039 0.069  # canvas_button (+)
6 0.515 0.495 0.039 0.069  # canvas_button (-)
```

### 3. Create Dataset Configuration

```yaml
# services/detector/training_data/dataset.yaml
path: /app/training_data
train: images
val: images  # Can create separate val/ folder with 20% of data

names:
  0: button
  1: textfield
  2: label
  3: icon
  4: card_widget
  5: balance_display
  6: canvas_button
  7: game_control
```

### 4. Train the Model

#### Using Docker:

```bash
# Update docker-compose to mount training data
# Add to docker-compose.local.yml

services:
  detector:
    volumes:
      - ./services/detector/training_data:/app/training_data
      - ./services/detector/runs:/app/runs

# Run training inside container
docker exec -it detector python train_flutter_ui.py
```

#### Or Locally:

```bash
cd services/detector
pip install ultralytics pyyaml pillow

# Train
python train_flutter_ui.py

# The model will be saved to:
# runs/flutter_ui_v1/weights/best.pt
```

**Training will take:**
- ~10-30 minutes on CPU (100 epochs, 116 images)
- ~2-5 minutes on GPU
- Progress shown in terminal

### 5. Deploy Trained Model

Update the detector service to use your custom model:

```python
# services/detector/main.py (line 35)
model_path = os.environ.get("YOLO_MODEL_PATH", "runs/flutter_ui_v1/weights/best.pt")
```

Or via environment variable:

```yaml
# docker-compose.local.yml
services:
  detector:
    environment:
      - YOLO_MODEL_PATH=/app/runs/flutter_ui_v1/weights/best.pt
```

Restart the service:
```bash
docker-compose -f docker-compose.local.yml restart detector
```

### 6. Test the New Model

```bash
# Run comprehensive tests
pnpm test -- --spec specs/flutter_comprehensive.feature --platform flutter --real --vgs

# You should now see:
# 📊 Detector found 8 elements  ← Instead of 0!
# ✅ Vision found "SPIN" at (640, 413)  ← Using YOLO detection!
```

## Expected Results After Training

### Before Training (Current State):
```
📡 Calling detector service...
📊 Detector found 0 elements
⚡ Using hardcoded position
```

### After Training (With Custom Model):
```
📡 Calling detector service...
📊 Detector found 8 elements
   - canvas_button "SPIN" (95% conf)
   - canvas_button "+" (92% conf)
   - canvas_button "-" (91% conf)
✅ Vision found "SPIN" at (640, 413)
🎯 SAM-3 refined click point (if enabled)
```

## Training Data Requirements

**Minimum:**
- 50-100 labeled screenshots per UI screen type
- At least 200 total bounding boxes

**Recommended:**
- 500+ screenshots with varied states
- 1000+ labeled UI elements
- Split: 80% train, 20% validation

**Your Current Assets:**
- ✅ 116 screenshots already captured
- ✅ Multiple game screens covered
- ⚠️ Need labeling (most time-consuming part)

## Quick Start Training Pipeline

```bash
# 1. Collect more screenshots by running tests multiple times
for i in {1..5}; do
  pnpm test -- --spec specs/flutter_comprehensive.feature --platform flutter --real
  mv apps/orchestrator/out/steps/flutter/*.png services/detector/training_data/images/run_$i/
done

# 2. Label with Roboflow (online) or LabelImg (offline)
# → This takes 1-2 hours for 500 images

# 3. Train
docker exec -it detector python train_flutter_ui.py

# 4. Deploy
docker-compose -f docker-compose.local.yml restart detector

# 5. Test
pnpm test -- --spec specs/casino_game.feature --platform flutter --real --vgs --sam3
```

## Alternative: Use Vision LLM Instead

If labeling is too time-consuming, you can rely more on **Vision LLM (Ollama)**:

1. Enable VLM as primary fallback (before hardcoded positions)
2. Use models like `llava:13b` or `minicpm-v:latest`
3. No training needed - works out of the box!

**Trade-off:**
- YOLO (trained): Fast (50-100ms), requires training
- VLM (Ollama): Slower (1-3s), no training needed

## Summary

**Yes, you can train YOLO** for Flutter UI detection. You have all the infrastructure ready in [services/detector/](services/detector/):

✅ Training script: [train_flutter_ui.py](services/detector/train_flutter_ui.py)
✅ Detector service: [main.py](services/detector/main.py)
✅ 116 test screenshots ready to label
✅ Docker setup for easy deployment

**Next steps:**
1. Label your 116 screenshots (1-2 hours)
2. Run `train_flutter_ui.py` (10-30 minutes)
3. Update `YOLO_MODEL_PATH` to use custom model
4. Restart detector service
5. Watch YOLO detect Flutter UI elements! 🎯
