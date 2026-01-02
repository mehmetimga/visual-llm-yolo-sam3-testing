"""
Fast Template-Based Labeling for Rive Poker UI Screenshots
Uses fixed UI positions for Rive button elements (buttons are always in same place)

This script generates YOLO format labels for training data captured with the
new Rive-based poker UI.
"""

import os
from pathlib import Path
from PIL import Image
import json

IMAGES_DIR = Path(__file__).parent / "training_data" / "rive_poker_images"
LABELS_DIR = Path(__file__).parent / "training_data" / "rive_poker_labels"

# YOLO Classes for Rive UI
CLASSES = {
    "btn_fold": 0,
    "btn_check": 1,
    "btn_call": 2,
    "btn_raise": 3,
    "btn_deal": 4,
    "hole_card": 5,
    "board_card": 6,
    "pot_amount": 7,
    "bet_slider": 8,
}

# Screen dimensions (iPhone 16 Pro Max simulator - Appium coordinates)
# Note: Screenshot is 1320x2868 (3x scale), Appium uses 440x956
SCREEN_WIDTH = 440
SCREEN_HEIGHT = 956

# Rive panel dimensions
# Artboard: 375x250, scaled to screen width
# Panel height = SCREEN_WIDTH / (375/250) = 430 / 1.5 = ~286px
RIVE_PANEL_HEIGHT = 286
RIVE_PANEL_Y_START = SCREEN_HEIGHT - RIVE_PANEL_HEIGHT  # y = 646

# Rive button positions (normalized 0-1 for 440x956 screen)
# IMPORTANT: These are CLICKABLE/TAP positions, NOT visual positions!
# The Rive animation renders buttons at different locations than where they respond to taps.
# Visual layout:    CALL(left) | RAISE(center) | FOLD(right)
# Clickable layout: CALL/FOLD(left, stacked) | RAISE(center)
#
# Calculated from working Appium coordinates:
#   CALL/CHECK: (60, 680)  → normalized: (60/440, 680/956) = (0.1364, 0.7113)
#   RAISE:      (190, 680) → normalized: (190/440, 680/956) = (0.4318, 0.7113)
#   FOLD:       (60, 780)  → normalized: (60/440, 780/956) = (0.1364, 0.8159)
RIVE_BUTTONS = {
    "btn_fold": {"x": 0.1364, "y": 0.8159, "w": 0.14, "h": 0.055},
    "btn_check": {"x": 0.1364, "y": 0.7113, "w": 0.14, "h": 0.055},
    "btn_call": {"x": 0.1364, "y": 0.7113, "w": 0.14, "h": 0.055},
    "btn_raise": {"x": 0.4318, "y": 0.7113, "w": 0.18, "h": 0.055},
}

# Deal Again button (appears at center, above Rive panel when hand ends)
# Working Appium coordinates: (220, 550) → normalized: (220/440, 550/956) = (0.5, 0.5753)
DEAL_BUTTON = {"x": 0.5, "y": 0.5753, "w": 0.40, "h": 0.055}

# Pot display (center of table, above Rive panel)
POT_DISPLAY = {"x": 0.5, "y": 0.42, "w": 0.18, "h": 0.06}

# Bet slider (inside Rive panel, above buttons)
BET_SLIDER = {"x": 0.5, "y": 0.85, "w": 0.80, "h": 0.03}

# Hole cards (YOUR cards - positioned above Rive panel)
HOLE_CARDS = [
    {"x": 0.42, "y": 0.73, "w": 0.10, "h": 0.10},  # Left card
    {"x": 0.58, "y": 0.73, "w": 0.10, "h": 0.10},  # Right card
]

# Board cards (community cards in center)
BOARD_CARDS = [
    {"x": 0.26, "y": 0.50, "w": 0.08, "h": 0.09},  # Card 1
    {"x": 0.38, "y": 0.50, "w": 0.08, "h": 0.09},  # Card 2
    {"x": 0.50, "y": 0.50, "w": 0.08, "h": 0.09},  # Card 3
    {"x": 0.62, "y": 0.50, "w": 0.08, "h": 0.09},  # Card 4
    {"x": 0.74, "y": 0.50, "w": 0.08, "h": 0.09},  # Card 5
]


def classify_image(image_path: str) -> str:
    """Determine image type based on filename patterns"""
    name = os.path.basename(image_path).lower()
    
    # Check for specific game states in filename
    if "deal" in name and ("again" in name or "end" in name):
        return "deal_again"
    elif "dealt" in name or "flop" in name or "turn" in name or "river" in name:
        return "action_playing"
    elif "start" in name:
        return "action_start"
    elif any(phase in name for phase in ["pre_flop", "preflop", "action"]):
        return "action_playing"
    else:
        # Default to action_playing for Rive screenshots
        return "action_playing"


def generate_action_labels(include_slider: bool = True) -> list:
    """Generate labels for action screen (Rive buttons visible)"""
    labels = []
    
    # Fold button (always visible during action)
    class_id = CLASSES["btn_fold"]
    pos = RIVE_BUTTONS["btn_fold"]
    labels.append(f"{class_id} {pos['x']:.6f} {pos['y']:.6f} {pos['w']:.6f} {pos['h']:.6f}")
    
    # Check/Call button (left side) - use btn_call as it covers both
    class_id = CLASSES["btn_call"]
    pos = RIVE_BUTTONS["btn_call"]
    labels.append(f"{class_id} {pos['x']:.6f} {pos['y']:.6f} {pos['w']:.6f} {pos['h']:.6f}")
    
    # Raise button (center)
    class_id = CLASSES["btn_raise"]
    pos = RIVE_BUTTONS["btn_raise"]
    labels.append(f"{class_id} {pos['x']:.6f} {pos['y']:.6f} {pos['w']:.6f} {pos['h']:.6f}")
    
    # Bet slider (if included)
    if include_slider:
        class_id = CLASSES["bet_slider"]
        labels.append(f"{class_id} {BET_SLIDER['x']:.6f} {BET_SLIDER['y']:.6f} {BET_SLIDER['w']:.6f} {BET_SLIDER['h']:.6f}")
    
    # Pot display
    class_id = CLASSES["pot_amount"]
    labels.append(f"{class_id} {POT_DISPLAY['x']:.6f} {POT_DISPLAY['y']:.6f} {POT_DISPLAY['w']:.6f} {POT_DISPLAY['h']:.6f}")
    
    # Hole cards (always 2)
    for card in HOLE_CARDS:
        class_id = CLASSES["hole_card"]
        labels.append(f"{class_id} {card['x']:.6f} {card['y']:.6f} {card['w']:.6f} {card['h']:.6f}")
    
    return labels


def generate_deal_again_labels() -> list:
    """Generate labels for deal again screen"""
    labels = []
    
    # Deal button
    class_id = CLASSES["btn_deal"]
    labels.append(f"{class_id} {DEAL_BUTTON['x']:.6f} {DEAL_BUTTON['y']:.6f} {DEAL_BUTTON['w']:.6f} {DEAL_BUTTON['h']:.6f}")
    
    # Pot display
    class_id = CLASSES["pot_amount"]
    labels.append(f"{class_id} {POT_DISPLAY['x']:.6f} {POT_DISPLAY['y']:.6f} {POT_DISPLAY['w']:.6f} {POT_DISPLAY['h']:.6f}")
    
    # Hole cards still visible
    for card in HOLE_CARDS:
        class_id = CLASSES["hole_card"]
        labels.append(f"{class_id} {card['x']:.6f} {card['y']:.6f} {card['w']:.6f} {card['h']:.6f}")
    
    return labels


def generate_labels_with_board(num_board_cards: int = 0) -> list:
    """Generate labels including board cards"""
    labels = generate_action_labels()
    
    # Add board cards based on game phase
    for i in range(min(num_board_cards, 5)):
        card = BOARD_CARDS[i]
        class_id = CLASSES["board_card"]
        labels.append(f"{class_id} {card['x']:.6f} {card['y']:.6f} {card['w']:.6f} {card['h']:.6f}")
    
    return labels


def process_images():
    """Process all images in the training directory and generate labels"""
    print("=" * 60)
    print("🎰 Fast Rive UI Labeling for YOLO Training")
    print("=" * 60)
    
    # Create labels directory if needed
    LABELS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Get all images
    images = list(IMAGES_DIR.glob("*.png")) + list(IMAGES_DIR.glob("*.jpg"))
    
    if not images:
        print(f"❌ No images found in {IMAGES_DIR}")
        print("   Run the AI in capture mode first:")
        print("   pnpm tsx scripts/smart_poker_ai.ts --capture --hands=200")
        return
    
    print(f"\n📊 Found {len(images)} images to label")
    
    labeled_count = 0
    for image_path in images:
        image_type = classify_image(str(image_path))
        
        # Generate appropriate labels based on image type
        if image_type == "deal_again":
            labels = generate_deal_again_labels()
        elif "flop" in str(image_path).lower():
            labels = generate_labels_with_board(3)
        elif "turn" in str(image_path).lower():
            labels = generate_labels_with_board(4)
        elif "river" in str(image_path).lower():
            labels = generate_labels_with_board(5)
        else:
            # Default action labels
            labels = generate_action_labels()
        
        # Write label file
        label_path = LABELS_DIR / f"{image_path.stem}.txt"
        with open(label_path, "w") as f:
            f.write("\n".join(labels))
        
        labeled_count += 1
    
    print(f"\n✅ Generated {labeled_count} label files")
    print(f"   Labels saved to: {LABELS_DIR}")
    
    # Also copy labels to images directory (YOLO expects them together)
    print("\n📁 Copying labels to images directory for YOLO...")
    for label_file in LABELS_DIR.glob("*.txt"):
        dest = IMAGES_DIR / label_file.name
        if not dest.exists():
            dest.write_text(label_file.read_text())
    
    print("   Done!")
    
    # Write classes.txt
    classes_file = LABELS_DIR / "classes.txt"
    with open(classes_file, "w") as f:
        for class_name, class_id in sorted(CLASSES.items(), key=lambda x: x[1]):
            f.write(f"{class_name}\n")
    
    print(f"\n📝 Classes file written: {classes_file}")
    print(f"\n🎯 YOLO Classes:")
    for name, id in CLASSES.items():
        print(f"   {id}: {name}")


if __name__ == "__main__":
    process_images()

