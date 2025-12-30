"""
Auto-Labeling Script for YOLO Training
Uses MiniCPM-V (Visual LLM) to generate bounding box labels for poker screenshots
"""

import os
import json
import base64
import requests
import re
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

# Configuration
OLLAMA_URL = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "openbmb/minicpm-v2.6:latest"
IMAGES_DIR = Path(__file__).parent / "training_data" / "poker_images"
LABELS_DIR = Path(__file__).parent / "training_data" / "poker_labels"

# YOLO Classes
CLASSES = {
    "btn_fold": 0,
    "btn_check_call": 1,
    "btn_raise": 2,
    "btn_all_in": 3,
    "btn_deal_again": 4,
    "winner_banner": 5,
    "hole_card": 6,
    "board_card": 7,
    "pot_amount": 8,
    "card_back": 9,
    "bet_slider": 10,
}

LABELING_PROMPT = """Analyze this poker game screenshot and identify UI elements with their bounding boxes.

Return ONLY a JSON array with detected elements. For each element provide:
- "class": one of [btn_fold, btn_check_call, btn_raise, btn_all_in, btn_deal_again, winner_banner, hole_card, board_card, pot_amount, card_back, bet_slider]
- "x": center x coordinate as fraction (0-1) of image width
- "y": center y coordinate as fraction (0-1) of image height  
- "w": width as fraction (0-1) of image width
- "h": height as fraction (0-1) of image height

Rules:
- btn_fold: Red FOLD button at bottom
- btn_check_call: Green CHECK or CALL button at bottom
- btn_raise: Orange RAISE button at bottom
- btn_all_in: Purple ALL IN button at bottom
- btn_deal_again: Yellow DEAL AGAIN button (full width at bottom)
- winner_banner: Yellow banner showing "wins $X"
- hole_card: Face-up cards at bottom belonging to YOU (2 cards)
- board_card: Community cards in center (up to 5 cards)
- pot_amount: Chip stack with dollar amount in center
- card_back: Face-down cards (blue/purple backs)
- bet_slider: Horizontal slider with Min/Pot/Max options

Example response:
[
  {"class": "btn_fold", "x": 0.13, "y": 0.95, "w": 0.2, "h": 0.05},
  {"class": "btn_check_call", "x": 0.37, "y": 0.95, "w": 0.2, "h": 0.05},
  {"class": "hole_card", "x": 0.42, "y": 0.82, "w": 0.08, "h": 0.12},
  {"class": "hole_card", "x": 0.58, "y": 0.82, "w": 0.08, "h": 0.12}
]

Return ONLY the JSON array, no other text."""


def encode_image(image_path: str) -> str:
    """Encode image to base64"""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def call_llm(image_path: str) -> list:
    """Call MiniCPM-V to get bounding box labels"""
    try:
        image_b64 = encode_image(image_path)
        
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "messages": [
                    {
                        "role": "user",
                        "content": LABELING_PROMPT,
                        "images": [image_b64]
                    }
                ],
                "stream": False,
                "options": {
                    "temperature": 0.1  # Low temperature for consistent outputs
                }
            },
            timeout=120
        )
        
        if response.status_code != 200:
            print(f"  ⚠️ LLM error {response.status_code}")
            return []
        
        result = response.json()
        content = result.get("message", {}).get("content", "")
        
        # Extract JSON array from response
        return parse_llm_response(content)
        
    except Exception as e:
        print(f"  ⚠️ Error calling LLM: {e}")
        return []


def parse_llm_response(content: str) -> list:
    """Parse LLM response to extract JSON array"""
    try:
        # Try to find JSON array in response
        # Look for [...] pattern
        match = re.search(r'\[[\s\S]*?\]', content)
        if match:
            json_str = match.group()
            return json.loads(json_str)
        
        # Try direct parse
        return json.loads(content)
    except json.JSONDecodeError:
        # Try to extract individual objects
        objects = []
        for match in re.finditer(r'\{[^{}]+\}', content):
            try:
                obj = json.loads(match.group())
                if "class" in obj and "x" in obj:
                    objects.append(obj)
            except:
                pass
        return objects


def convert_to_yolo(detections: list, image_path: str) -> list:
    """Convert LLM detections to YOLO format"""
    yolo_lines = []
    
    for det in detections:
        class_name = det.get("class", "").lower().replace(" ", "_")
        
        # Handle variations
        if "check" in class_name or "call" in class_name:
            class_name = "btn_check_call"
        elif "fold" in class_name:
            class_name = "btn_fold"
        elif "raise" in class_name:
            class_name = "btn_raise"
        elif "all" in class_name and "in" in class_name:
            class_name = "btn_all_in"
        elif "deal" in class_name:
            class_name = "btn_deal_again"
        elif "winner" in class_name or "banner" in class_name:
            class_name = "winner_banner"
        elif "hole" in class_name:
            class_name = "hole_card"
        elif "board" in class_name or "community" in class_name:
            class_name = "board_card"
        elif "pot" in class_name:
            class_name = "pot_amount"
        elif "back" in class_name:
            class_name = "card_back"
        elif "slider" in class_name:
            class_name = "bet_slider"
        
        if class_name not in CLASSES:
            continue
        
        class_id = CLASSES[class_name]
        
        # Get coordinates (already in 0-1 format from LLM)
        x = float(det.get("x", 0))
        y = float(det.get("y", 0))
        w = float(det.get("w", 0))
        h = float(det.get("h", 0))
        
        # Validate coordinates
        if not (0 <= x <= 1 and 0 <= y <= 1 and 0 < w <= 1 and 0 < h <= 1):
            continue
        
        # YOLO format: class x_center y_center width height
        yolo_lines.append(f"{class_id} {x:.6f} {y:.6f} {w:.6f} {h:.6f}")
    
    return yolo_lines


def process_image(image_path: Path) -> tuple:
    """Process a single image and generate label file"""
    label_path = LABELS_DIR / f"{image_path.stem}.txt"
    
    # Skip if label already exists
    if label_path.exists():
        return image_path.name, "skipped", 0
    
    # Call LLM for detections
    detections = call_llm(str(image_path))
    
    if not detections:
        # Create empty label file
        label_path.write_text("")
        return image_path.name, "empty", 0
    
    # Convert to YOLO format
    yolo_lines = convert_to_yolo(detections, str(image_path))
    
    # Write label file
    label_path.write_text("\n".join(yolo_lines))
    
    return image_path.name, "labeled", len(yolo_lines)


def main():
    """Main auto-labeling function"""
    print("🏷️  YOLO Auto-Labeling Script")
    print("=" * 50)
    
    # Ensure labels directory exists
    LABELS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Get all PNG images
    images = list(IMAGES_DIR.glob("*.png"))
    print(f"📁 Found {len(images)} images to label")
    
    # Check existing labels
    existing_labels = len(list(LABELS_DIR.glob("*.txt")))
    print(f"📋 Existing labels: {existing_labels}")
    
    # Process images
    labeled = 0
    skipped = 0
    empty = 0
    total_detections = 0
    
    print("\n🔄 Processing images...")
    
    for i, image_path in enumerate(images):
        if (i + 1) % 10 == 0 or i == 0:
            print(f"\n[{i+1}/{len(images)}] Processing {image_path.name}...")
        
        name, status, count = process_image(image_path)
        
        if status == "labeled":
            labeled += 1
            total_detections += count
            print(f"  ✅ {name}: {count} detections")
        elif status == "skipped":
            skipped += 1
        else:
            empty += 1
            print(f"  ⚠️ {name}: no detections")
        
        # Rate limiting to avoid overwhelming Ollama
        if status != "skipped":
            time.sleep(0.5)
    
    print("\n" + "=" * 50)
    print("📊 Summary:")
    print(f"   Total images: {len(images)}")
    print(f"   Labeled: {labeled}")
    print(f"   Skipped (existing): {skipped}")
    print(f"   Empty (no detections): {empty}")
    print(f"   Total detections: {total_detections}")
    print(f"\n💾 Labels saved to: {LABELS_DIR}")


if __name__ == "__main__":
    main()

