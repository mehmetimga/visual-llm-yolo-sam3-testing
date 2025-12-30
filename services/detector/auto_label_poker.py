#!/usr/bin/env python3
"""
VLM Auto-Labeling Script for Poker Game Screenshots
Uses Ollama (minicpm-v or llava) to automatically detect and label UI elements
Outputs YOLO format labels for training
"""

import os
import json
import base64
import requests
from pathlib import Path
from typing import List, Dict, Optional
import re
from PIL import Image

# Configuration
OLLAMA_URL = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "minicpm-v"  # or "llava:7b" for better accuracy
IMAGES_DIR = Path("training_data/poker_images")
LABELS_DIR = Path("training_data/poker_labels")

# Poker-specific UI classes
CLASSES = {
    "button": 0,           # FOLD, CHECK, CALL, RAISE, ALL-IN, DEAL AGAIN
    "card_face": 1,        # Visible playing cards (value + suit visible)
    "card_back": 2,        # Face-down cards
    "chip_stack": 3,       # Player chip displays
    "pot_display": 4,      # Central pot amount
    "player_badge": 5,     # Player name + chips info
    "slider": 6,           # Bet amount slider
    "community_area": 7,   # 5-card board area
    "winner_banner": 8,    # Win announcement overlay
    "text_label": 9,       # Game text/labels
}

# Reverse mapping
CLASS_NAMES = {v: k for k, v in CLASSES.items()}

def encode_image(image_path: str) -> str:
    """Encode image to base64"""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

def get_image_dimensions(image_path: str) -> tuple:
    """Get image width and height"""
    with Image.open(image_path) as img:
        return img.size  # (width, height)

def ask_vlm(image_path: str) -> Optional[List[Dict]]:
    """
    Ask VLM to detect and label UI elements in the image
    Returns list of detections with bounding boxes
    """
    base64_image = encode_image(image_path)
    width, height = get_image_dimensions(image_path)
    
    prompt = f"""Analyze this poker game screenshot and detect all UI elements.
The image dimensions are {width}x{height} pixels.

For each UI element, provide:
- class: One of: button, card_face, card_back, chip_stack, pot_display, player_badge, slider, community_area, winner_banner, text_label
- bbox: [x_center, y_center, width, height] in PIXELS (not normalized)
- confidence: 0.0 to 1.0

IMPORTANT: Return ONLY a valid JSON array. No explanation, no markdown.

Example response format:
[
  {{"class": "button", "bbox": [200, 800, 100, 50], "text": "FOLD", "confidence": 0.95}},
  {{"class": "card_face", "bbox": [150, 600, 60, 87], "text": "Ace of Hearts", "confidence": 0.9}},
  {{"class": "player_badge", "bbox": [50, 200, 120, 60], "text": "Player 1 $500", "confidence": 0.85}}
]

Detect ALL visible elements including:
- Action buttons (FOLD, CHECK, CALL, RAISE, ALL-IN, DEAL AGAIN)
- Playing cards (face-up and face-down)
- Player info badges (name + chips)
- Pot display
- Bet slider
- Any winner banners

Your JSON response:"""

    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt,
                        "images": [base64_image]
                    }
                ],
                "stream": False,
                "options": {
                    "temperature": 0.1,  # Low temperature for consistent output
                }
            },
            timeout=120
        )
        
        if response.status_code != 200:
            print(f"  ⚠️ VLM error: {response.status_code}")
            return None
        
        result = response.json()
        content = result.get("message", {}).get("content", "")
        
        # Try to extract JSON from response
        detections = parse_vlm_response(content)
        return detections
        
    except requests.exceptions.ConnectionError:
        print("  ❌ Cannot connect to Ollama. Is it running?")
        print("     Start with: ollama serve")
        return None
    except Exception as e:
        print(f"  ❌ VLM error: {e}")
        return None

def parse_vlm_response(response: str) -> List[Dict]:
    """Parse VLM response to extract detections"""
    # Try to find JSON array in response
    try:
        # First, try direct JSON parse
        detections = json.loads(response)
        if isinstance(detections, list):
            return detections
    except json.JSONDecodeError:
        pass
    
    # Try to extract JSON from markdown code block
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', response)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass
    
    # Try to find array pattern
    array_match = re.search(r'\[[\s\S]*\]', response)
    if array_match:
        try:
            return json.loads(array_match.group(0))
        except json.JSONDecodeError:
            pass
    
    print(f"  ⚠️ Could not parse VLM response: {response[:200]}...")
    return []

def convert_to_yolo_format(detection: Dict, img_width: int, img_height: int) -> Optional[str]:
    """
    Convert detection to YOLO format:
    class_id center_x center_y width height (all normalized 0-1)
    """
    class_name = detection.get("class", "").lower()
    if class_name not in CLASSES:
        return None
    
    class_id = CLASSES[class_name]
    bbox = detection.get("bbox", [])
    
    if len(bbox) != 4:
        return None
    
    x_center, y_center, width, height = bbox
    
    # Normalize to 0-1 range
    x_center_norm = x_center / img_width
    y_center_norm = y_center / img_height
    width_norm = width / img_width
    height_norm = height / img_height
    
    # Clamp values to valid range
    x_center_norm = max(0, min(1, x_center_norm))
    y_center_norm = max(0, min(1, y_center_norm))
    width_norm = max(0, min(1, width_norm))
    height_norm = max(0, min(1, height_norm))
    
    return f"{class_id} {x_center_norm:.6f} {y_center_norm:.6f} {width_norm:.6f} {height_norm:.6f}"

def process_image(image_path: Path) -> int:
    """Process a single image and generate YOLO labels"""
    print(f"\n📷 Processing: {image_path.name}")
    
    # Get image dimensions
    width, height = get_image_dimensions(str(image_path))
    print(f"   Dimensions: {width}x{height}")
    
    # Ask VLM to detect elements
    print(f"   🤖 Asking {OLLAMA_MODEL}...")
    detections = ask_vlm(str(image_path))
    
    if not detections:
        print("   ⚠️ No detections")
        return 0
    
    print(f"   ✅ Found {len(detections)} elements")
    
    # Convert to YOLO format
    yolo_labels = []
    for det in detections:
        label = convert_to_yolo_format(det, width, height)
        if label:
            class_name = det.get("class", "unknown")
            text = det.get("text", "")
            print(f"      - {class_name}: {text[:30] if text else '(no text)'}")
            yolo_labels.append(label)
    
    # Save labels
    label_path = LABELS_DIR / f"{image_path.stem}.txt"
    with open(label_path, "w") as f:
        f.write("\n".join(yolo_labels))
    
    print(f"   💾 Saved: {label_path.name} ({len(yolo_labels)} labels)")
    return len(yolo_labels)

def create_dataset_yaml():
    """Create YOLO dataset configuration file"""
    yaml_content = f"""# Poker UI Detection Dataset
# Auto-generated by VLM auto-labeling

path: {Path.cwd() / 'training_data'}
train: poker_images
val: poker_images

names:
  0: button
  1: card_face
  2: card_back
  3: chip_stack
  4: pot_display
  5: player_badge
  6: slider
  7: community_area
  8: winner_banner
  9: text_label
"""
    
    yaml_path = Path("training_data/poker_dataset.yaml")
    with open(yaml_path, "w") as f:
        f.write(yaml_content)
    
    print(f"\n📄 Created dataset config: {yaml_path}")

def create_classes_txt():
    """Create classes.txt file for reference"""
    classes_path = LABELS_DIR / "classes.txt"
    with open(classes_path, "w") as f:
        for name in sorted(CLASSES.keys(), key=lambda x: CLASSES[x]):
            f.write(f"{name}\n")
    print(f"📄 Created classes file: {classes_path}")

def main():
    global OLLAMA_MODEL
    
    print("=" * 60)
    print("🎰 VLM Auto-Labeling for Poker Screenshots")
    print("=" * 60)
    
    # Check if Ollama is available
    try:
        response = requests.get("http://localhost:11434/api/tags", timeout=5)
        models = response.json().get("models", [])
        available = [m["name"] for m in models]
        print(f"\n📡 Ollama connected. Available models: {available[:5]}")
        
        # Check if our model is available
        if not any(OLLAMA_MODEL in m for m in available):
            print(f"\n⚠️ Model {OLLAMA_MODEL} not found. Trying to pull...")
            print(f"   Run: ollama pull {OLLAMA_MODEL}")
            # Try llava as fallback
            if any("llava" in m for m in available):
                OLLAMA_MODEL = "llava:7b"
                print(f"   Using fallback model: {OLLAMA_MODEL}")
    except:
        print("\n❌ Cannot connect to Ollama. Please start it with: ollama serve")
        return
    
    # Setup directories
    LABELS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Get list of images
    image_files = list(IMAGES_DIR.glob("*.png")) + list(IMAGES_DIR.glob("*.jpg"))
    
    if not image_files:
        print(f"\n❌ No images found in {IMAGES_DIR}")
        print("   Run the capture script first:")
        print("   ./scripts/capture_poker_screenshots.sh")
        return
    
    print(f"\n📁 Found {len(image_files)} images to process")
    
    # Process each image
    total_labels = 0
    processed = 0
    
    for image_path in image_files:
        labels = process_image(image_path)
        total_labels += labels
        processed += 1
        
        # Progress
        print(f"\n   Progress: {processed}/{len(image_files)} images")
    
    # Create dataset files
    create_dataset_yaml()
    create_classes_txt()
    
    # Summary
    print("\n" + "=" * 60)
    print("✅ Auto-labeling complete!")
    print(f"   Images processed: {processed}")
    print(f"   Total labels: {total_labels}")
    print(f"   Labels directory: {LABELS_DIR}")
    print("\n📌 Next steps:")
    print("   1. Review labels in training_data/poker_labels/")
    print("   2. Fix any obvious errors manually")
    print("   3. Run training: python train_poker.py")
    print("=" * 60)

if __name__ == "__main__":
    main()

