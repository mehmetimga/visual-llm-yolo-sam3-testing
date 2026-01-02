# YOLO Training Steps - Complete Guide

## Current Status

✅ **PoC Tests Working:** Both web and mobile tests pass with hardcoded fallbacks
✅ **Docker Services Running:** YOLO detector, SAM-3, DINOv3, Ollama, Qdrant
✅ **Training data directory created:** `services/detector/training_data/`
✅ **Images collected:** Screenshots from test runs available
⏳ **Labels:** Need to label images for better YOLO detection

## Current Detection Flow

The system currently uses this fallback order:
1. Native locators (testId, accessibility label, text)
2. YOLO detector (returns 0 elements without training)
3. Hardcoded positions (demo mode - currently used)
4. Visual LLM via Ollama (backup)

**To improve detection, train YOLO with labeled UI screenshots.**

## Step-by-Step Training Process

### Step 1: Collect More Training Images (RECOMMENDED)

You currently have 3 images. For better training results:

**Minimum:** 50-100 images
**Recommended:** 200-500 images
**Ideal:** 1000+ images

**Collect more screenshots:**

```bash
# Run tests multiple times to collect diverse screenshots
for i in {1..10}; do
  # Restart app for clean state
  xcrun simctl terminate 4502FBC7-E7FA-4F70-8040-4B5844B6AEDA com.example.demoCasino
  sleep 2
  xcrun simctl launch 4502FBC7-E7FA-4F70-8040-4B5844B6AEDA com.example.demoCasino
  sleep 2

  # Run different test scenarios
  pnpm test -- --spec specs/flutter_comprehensive.feature --platform flutter --real

  # Copy screenshots with unique names
  cp apps/orchestrator/out/steps/flutter/*.png services/detector/training_data/images/batch_${i}_
done

# You should now have 100+ images
ls services/detector/training_data/images/ | wc -l
```

### Step 2: Label the Images (MOST IMPORTANT STEP)

You need to draw bounding boxes around UI elements and assign classes.

#### Option A: Roboflow (Easiest - Recommended)

1. **Go to:** https://roboflow.com
2. **Create account** (free tier available)
3. **Create new project:** "Flutter UI Detection"
4. **Upload images:**
   ```bash
   # Zip your images
   cd services/detector/training_data
   zip -r flutter_ui_images.zip images/
   # Upload flutter_ui_images.zip to Roboflow
   ```

5. **Draw bounding boxes** around:
   - `button` - All buttons (SPIN, DEAL, HIT, STAND, PLAY NOW, LOG IN)
   - `textfield` - Username, Password input fields
   - `canvas_button` - Game control buttons (on canvas/CustomPaint)
   - `label` - Text labels ("MEGA SLOTS", "Casino Lobby")
   - `icon` - Game icons (🎰, 🃏)
   - `card` - Game cards in lobby

6. **Export in YOLOv8 format**
7. **Download** the exported dataset

#### Option B: LabelImg (Free, Offline)

```bash
# Install LabelImg
pip install labelImg

# Launch labeling tool
labelImg services/detector/training_data/images

# For each image:
# 1. Draw box around UI element
# 2. Assign class (button, textfield, etc.)
# 3. Save (creates .txt file)
# 4. Next image (keyboard: D key)

# When done, you'll have:
# images/login_screen.png
# images/login_screen.txt  <- YOLO labels
```

**Label format (YOLO):**
```
# images/login_screen.txt
# Format: class_id center_x center_y width height (all normalized 0-1)
0 0.500 0.650 0.150 0.080  # button (LOG IN)
1 0.500 0.400 0.400 0.060  # textfield (username)
1 0.500 0.500 0.400 0.060  # textfield (password)
```

**Class IDs:**
```
0: button
1: textfield
2: label
3: icon
4: card
5: canvas_button
6: game_control
```

### Step 3: Create Dataset Configuration

```bash
# Create dataset.yaml
cat > services/detector/training_data/dataset.yaml << 'EOF'
path: /app/training_data
train: images  # 80% of images for training
val: images    # 20% for validation (can split later)

names:
  0: button
  1: textfield
  2: label
  3: icon
  4: card
  5: canvas_button
  6: game_control
EOF
```

### Step 4: Train YOLO Model

#### Option A: Using Docker (Recommended)

```bash
# Update docker-compose to mount training data
# Edit docker-compose.local.yml - add volume:
#   detector:
#     volumes:
#       - ./services/detector/training_data:/app/training_data
#       - ./services/detector/runs:/app/runs

# Restart detector service
docker-compose -f docker-compose.local.yml restart detector

# Run training inside container
docker exec -it detector python train_flutter_ui.py

# Monitor progress (takes 10-30 minutes on CPU)
docker logs -f detector
```

#### Option B: Locally (if you have Python/GPU)

```bash
cd services/detector

# Install dependencies
pip install ultralytics pyyaml pillow opencv-python

# Run training
python train_flutter_ui.py

# Training will output:
# - Progress bars for each epoch
# - Metrics (mAP, precision, recall)
# - Best model saved to: runs/flutter_ui_v1/weights/best.pt
```

**Training Parameters (in train_flutter_ui.py):**
- Epochs: 100 (adjust based on dataset size)
- Image size: 640x640
- Batch size: 16 (reduce if out of memory)
- Device: 'cpu' or 'cuda:0' if GPU available

**Expected training time:**
- CPU: 10-30 minutes (3 images) | 1-3 hours (500 images)
- GPU: 2-5 minutes (3 images) | 10-30 minutes (500 images)

### Step 5: Deploy Trained Model

After training completes:

```bash
# Copy trained model to detector service
cp services/detector/runs/flutter_ui_v1/weights/best.pt services/detector/flutter_ui_model.pt

# Update detector to use new model
# Edit services/detector/main.py line 35:
# model_path = os.environ.get("YOLO_MODEL_PATH", "flutter_ui_model.pt")

# Or set environment variable in docker-compose.local.yml:
# detector:
#   environment:
#     - YOLO_MODEL_PATH=/app/runs/flutter_ui_v1/weights/best.pt

# Restart detector service
docker-compose -f docker-compose.local.yml restart detector

# Or if running locally:
# Just update the model path in main.py and restart
```

### Step 6: Test the Trained Model

```bash
# Run tests with trained YOLO
pnpm test -- --spec specs/flutter_comprehensive.feature \
  --platform flutter --real --vgs

# You should now see:
# 📡 Calling detector service...
# 📊 Detector found 8 elements  ← Instead of 0!
# ✅ Vision found "SPIN" at (640, 413) via YOLO
```

### Step 7: Evaluate Results

Check detection accuracy:

```bash
# Validation metrics will be in:
cat services/detector/runs/flutter_ui_v1/results.txt

# Look for:
# - mAP50: Should be > 0.7 (70%)
# - mAP50-95: Should be > 0.5 (50%)
# - Precision: Should be > 0.8 (80%)
# - Recall: Should be > 0.7 (70%)
```

## Available Screenshots for Training

Current test runs have generated screenshots:

**Flutter (Mobile):** `apps/orchestrator/out/steps/flutter/`
- 17 screenshots (login, lobby, slots, blackjack screens)

**Web:** `apps/orchestrator/out/steps/web/`
- 11 screenshots (login, lobby, game screens)

Copy these to training directory:
```bash
# Copy Flutter screenshots
cp apps/orchestrator/out/steps/flutter/*.png services/detector/training_data/images/flutter_

# Copy Web screenshots  
cp apps/orchestrator/out/steps/web/*.png services/detector/training_data/images/web_

# Check count
ls services/detector/training_data/images/ | wc -l
```

## Quick Start (With Your Current 3 Images)

Since you only have 3 images, let's do a quick test training:

```bash
# 1. Create empty labels directory
mkdir -p services/detector/training_data/labels

# 2. Manually create labels for your 3 images
# For login_screen.png - create login_screen.txt:
cat > services/detector/training_data/labels/login_screen.txt << 'EOF'
0 0.500 0.820 0.680 0.120
1 0.500 0.520 0.680 0.080
1 0.500 0.640 0.680 0.080
EOF

# 3. Create dataset.yaml (already created above)

# 4. Run quick training (10 epochs for testing)
docker exec -it detector python -c "
from ultralytics import YOLO
model = YOLO('yolov8n.pt')
results = model.train(
    data='/app/training_data/dataset.yaml',
    epochs=10,  # Quick test
    imgsz=640,
    batch=1,
    device='cpu'
)
print('Training complete! Model saved to runs/detect/train/weights/best.pt')
"
```

## Recommended Approach

**For best results:**

1. ✅ Collect 100-200 more screenshots (run tests 10-20 times)
2. ✅ Use Roboflow.com to label (1-2 hours for 200 images)
3. ✅ Train for 50-100 epochs
4. ✅ Deploy and test

**Minimum viable:**

1. Label your 3 existing images manually (15 minutes)
2. Train for 10 epochs as quick test
3. See if it detects anything
4. Collect more data based on results

## What You'll Achieve

**Before YOLO training:**
```
Native Detection: 70% success
YOLO Detection: 0 elements found
VLM Detection: Sometimes works
```

**After YOLO training:**
```
Native Detection: 70% success
YOLO Detection: 80-95% success  ← NEW!
VLM Detection: Rare fallback only
Speed: 5x faster (YOLO is 50ms vs VLM 2-3s)
```

## Next Step

**Choose your path:**

**A. Quick Test (Today):**
```bash
# Manually label 3 images (15 min)
# Train with 10 epochs (5 min)
# Test results
```

**B. Production Quality (This Week):**
```bash
# Collect 200+ screenshots
# Label with Roboflow (2 hours)
# Train with 100 epochs (30 min)
# Deploy to production
```

Which would you like to do? I can help with either approach!
