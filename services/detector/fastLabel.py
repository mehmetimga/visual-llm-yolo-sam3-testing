"""
Fast Template-Based Labeling for Poker Screenshots
Uses fixed UI positions for common elements (buttons are always in same place)
"""

import os
from pathlib import Path
from PIL import Image
import json

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

# Fixed positions for iPhone 16 Pro Max (1290 x 2796 pixels, but displayed as 430 x 932)
# Normalized coordinates (0-1)

# Action buttons at bottom (when visible) - 4 buttons in a row
ACTION_BUTTONS = {
    "btn_fold": {"x": 0.128, "y": 0.970, "w": 0.22, "h": 0.045},
    "btn_check_call": {"x": 0.372, "y": 0.970, "w": 0.22, "h": 0.045},
    "btn_raise": {"x": 0.616, "y": 0.970, "w": 0.22, "h": 0.045},
    "btn_all_in": {"x": 0.860, "y": 0.970, "w": 0.22, "h": 0.045},
}

# Deal Again button (full width at bottom)
DEAL_AGAIN = {"x": 0.5, "y": 0.970, "w": 0.90, "h": 0.050}

# Pot display (center of table)
POT_DISPLAY = {"x": 0.5, "y": 0.720, "w": 0.20, "h": 0.080}

# Bet slider (above action buttons)
BET_SLIDER = {"x": 0.5, "y": 0.920, "w": 0.85, "h": 0.035}

# Hole cards (YOUR cards at bottom)
HOLE_CARDS = [
    {"x": 0.42, "y": 0.830, "w": 0.12, "h": 0.13},  # Left card
    {"x": 0.58, "y": 0.830, "w": 0.12, "h": 0.13},  # Right card
]

# Board cards (community cards in center)
BOARD_CARDS = [
    {"x": 0.26, "y": 0.610, "w": 0.10, "h": 0.11},  # Card 1
    {"x": 0.38, "y": 0.610, "w": 0.10, "h": 0.11},  # Card 2
    {"x": 0.50, "y": 0.610, "w": 0.10, "h": 0.11},  # Card 3
    {"x": 0.62, "y": 0.610, "w": 0.10, "h": 0.11},  # Card 4
    {"x": 0.74, "y": 0.610, "w": 0.10, "h": 0.11},  # Card 5
]

# Winner banner (center, appears after hand)
WINNER_BANNER = {"x": 0.5, "y": 0.560, "w": 0.80, "h": 0.045}


def classify_image(image_path: str) -> str:
    """Determine image type based on filename"""
    name = os.path.basename(image_path).lower()
    
    if "deal_again" in name:
        return "deal_again"
    elif "action" in name:
        return "action"
    else:
        return "unknown"


def generate_action_labels() -> list:
    """Generate labels for action screen (buttons visible)"""
    labels = []
    
    # Action buttons
    for btn_name, pos in ACTION_BUTTONS.items():
        class_id = CLASSES[btn_name]
        labels.append(f"{class_id} {pos['x']:.6f} {pos['y']:.6f} {pos['w']:.6f} {pos['h']:.6f}")
    
    # Bet slider
    class_id = CLASSES["bet_slider"]
    labels.append(f"{class_id} {BET_SLIDER['x']:.6f} {BET_SLIDER['y']:.6f} {BET_SLIDER['w']:.6f} {BET_SLIDER['h']:.6f}")
    
    # Pot display
    class_id = CLASSES["pot_amount"]
    labels.append(f"{class_id} {POT_DISPLAY['x']:.6f} {POT_DISPLAY['y']:.6f} {POT_DISPLAY['w']:.6f} {POT_DISPLAY['h']:.6f}")
    
    # Hole cards (always 2)
    for card in HOLE_CARDS:
        class_id = CLASSES["hole_card"]
        labels.append(f"{class_id} {card['x']:.6f} {card['y']:.6f} {card['w']:.6f} {card['h']:.6f}")
    
    # Board cards (assume 3-4 visible on average)
    for card in BOARD_CARDS[:4]:
        class_id = CLASSES["board_card"]
        labels.append(f"{class_id} {card['x']:.6f} {card['y']:.6f} {card['w']:.6f} {card['h']:.6f}")
    
    return labels


def generate_deal_again_labels() -> list:
    """Generate labels for deal again screen"""
    labels = []
    
    # Deal Again button
    class_id = CLASSES["btn_deal_again"]
    labels.append(f"{class_id} {DEAL_AGAIN['x']:.6f} {DEAL_AGAIN['y']:.6f} {DEAL_AGAIN['w']:.6f} {DEAL_AGAIN['h']:.6f}")
    
    # Winner banner
    class_id = CLASSES["winner_banner"]
    labels.append(f"{class_id} {WINNER_BANNER['x']:.6f} {WINNER_BANNER['y']:.6f} {WINNER_BANNER['w']:.6f} {WINNER_BANNER['h']:.6f}")
    
    # Pot display
    class_id = CLASSES["pot_amount"]
    labels.append(f"{class_id} {POT_DISPLAY['x']:.6f} {POT_DISPLAY['y']:.6f} {POT_DISPLAY['w']:.6f} {POT_DISPLAY['h']:.6f}")
    
    # Hole cards (face up at showdown)
    for card in HOLE_CARDS:
        class_id = CLASSES["hole_card"]
        labels.append(f"{class_id} {card['x']:.6f} {card['y']:.6f} {card['w']:.6f} {card['h']:.6f}")
    
    # Board cards (all 5 visible at showdown)
    for card in BOARD_CARDS:
        class_id = CLASSES["board_card"]
        labels.append(f"{class_id} {card['x']:.6f} {card['y']:.6f} {card['w']:.6f} {card['h']:.6f}")
    
    return labels


def main():
    """Fast template-based labeling"""
    print("🚀 Fast Template-Based Labeling")
    print("=" * 50)
    
    # Ensure labels directory exists
    LABELS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Get all PNG images
    images = list(IMAGES_DIR.glob("*.png"))
    print(f"📁 Found {len(images)} images")
    
    action_count = 0
    deal_again_count = 0
    unknown_count = 0
    
    for image_path in images:
        label_path = LABELS_DIR / f"{image_path.stem}.txt"
        
        # Classify image
        img_type = classify_image(str(image_path))
        
        if img_type == "action":
            labels = generate_action_labels()
            action_count += 1
        elif img_type == "deal_again":
            labels = generate_deal_again_labels()
            deal_again_count += 1
        else:
            # Default to action labels
            labels = generate_action_labels()
            unknown_count += 1
        
        # Write label file
        label_path.write_text("\n".join(labels))
    
    print(f"\n✅ Labeling complete!")
    print(f"   Action screens: {action_count}")
    print(f"   Deal Again screens: {deal_again_count}")
    print(f"   Unknown (defaulted to action): {unknown_count}")
    print(f"   Total labels: {len(images)}")
    print(f"\n💾 Labels saved to: {LABELS_DIR}")


if __name__ == "__main__":
    main()

