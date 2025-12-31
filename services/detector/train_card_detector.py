"""
Card Detector Training Script
Uses clean card PNGs to train YOLO for specific card detection
"""

import os
import random
import shutil
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np

# Paths - Use Flutter app's card assets
CARDS_DIR = Path(__file__).parent.parent.parent / "apps" / "demo-flutter" / "assets" / "cards"
OUTPUT_DIR = Path(__file__).parent / "training_data" / "card_detection"
IMAGES_DIR = OUTPUT_DIR / "images"
LABELS_DIR = OUTPUT_DIR / "labels"

# Card classes (52 cards)
CARD_CLASSES = {
    # Aces
    "ace_of_spades": 0, "ace_of_hearts": 1, "ace_of_diamonds": 2, "ace_of_clubs": 3,
    # Kings
    "king_of_spades": 4, "king_of_hearts": 5, "king_of_diamonds": 6, "king_of_clubs": 7,
    # Queens
    "queen_of_spades": 8, "queen_of_hearts": 9, "queen_of_diamonds": 10, "queen_of_clubs": 11,
    # Jacks
    "jack_of_spades": 12, "jack_of_hearts": 13, "jack_of_diamonds": 14, "jack_of_clubs": 15,
    # 10s
    "10_of_spades": 16, "10_of_hearts": 17, "10_of_diamonds": 18, "10_of_clubs": 19,
    # 9s
    "9_of_spades": 20, "9_of_hearts": 21, "9_of_diamonds": 22, "9_of_clubs": 23,
    # 8s
    "8_of_spades": 24, "8_of_hearts": 25, "8_of_diamonds": 26, "8_of_clubs": 27,
    # 7s
    "7_of_spades": 28, "7_of_hearts": 29, "7_of_diamonds": 30, "7_of_clubs": 31,
    # 6s
    "6_of_spades": 32, "6_of_hearts": 33, "6_of_diamonds": 34, "6_of_clubs": 35,
    # 5s
    "5_of_spades": 36, "5_of_hearts": 37, "5_of_diamonds": 38, "5_of_clubs": 39,
    # 4s
    "4_of_spades": 40, "4_of_hearts": 41, "4_of_diamonds": 42, "4_of_clubs": 43,
    # 3s
    "3_of_spades": 44, "3_of_hearts": 45, "3_of_diamonds": 46, "3_of_clubs": 47,
    # 2s
    "2_of_spades": 48, "2_of_hearts": 49, "2_of_diamonds": 50, "2_of_clubs": 51,
    # Back (for face-down cards)
    "card_back": 52,
}

# Reverse mapping
CLASS_NAMES = {v: k for k, v in CARD_CLASSES.items()}


def create_green_background(width=640, height=480):
    """Create a poker table green background"""
    # Various shades of poker table green
    greens = [
        (34, 139, 34),   # Forest green
        (0, 100, 0),     # Dark green
        (46, 139, 87),   # Sea green
        (60, 120, 60),   # Poker green
        (35, 100, 35),   # Table green
    ]
    color = random.choice(greens)
    
    # Create base image
    img = Image.new('RGB', (width, height), color)
    
    # Add some texture/noise
    pixels = np.array(img)
    noise = np.random.randint(-10, 10, pixels.shape, dtype=np.int16)
    pixels = np.clip(pixels.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    
    return Image.fromarray(pixels)


def load_card_image(card_name):
    """Load a card image and make background transparent"""
    card_path = CARDS_DIR / f"{card_name}.png"
    if not card_path.exists():
        return None
    
    img = Image.open(card_path).convert('RGBA')
    return img


def augment_card(card_img):
    """Apply random augmentations to card"""
    # Random rotation (-15 to 15 degrees)
    angle = random.uniform(-15, 15)
    card_img = card_img.rotate(angle, expand=True, resample=Image.BICUBIC)
    
    # Random scale (0.8 to 1.2)
    scale = random.uniform(0.8, 1.2)
    new_size = (int(card_img.width * scale), int(card_img.height * scale))
    card_img = card_img.resize(new_size, Image.LANCZOS)
    
    # Random brightness
    if random.random() > 0.5:
        enhancer = ImageEnhance.Brightness(card_img)
        card_img = enhancer.enhance(random.uniform(0.8, 1.2))
    
    # Random contrast
    if random.random() > 0.5:
        enhancer = ImageEnhance.Contrast(card_img)
        card_img = enhancer.enhance(random.uniform(0.9, 1.1))
    
    return card_img


def place_card_on_background(background, card_img, x, y):
    """Place a card on the background at position (x, y)"""
    # Ensure RGBA
    if card_img.mode != 'RGBA':
        card_img = card_img.convert('RGBA')
    
    # Create a copy of background
    result = background.copy()
    
    # Paste card with transparency
    result.paste(card_img, (x, y), card_img)
    
    return result


def generate_training_image(image_id, num_cards=None):
    """Generate a single training image with random cards"""
    if num_cards is None:
        num_cards = random.randint(2, 7)  # 2-7 cards per image
    
    # Create background (simulate iPhone screen size)
    width, height = 640, 960
    background = create_green_background(width, height)
    
    labels = []
    card_names = list(CARD_CLASSES.keys())
    
    # Remove card_back from random selection most of the time
    if random.random() > 0.3:
        card_names = [c for c in card_names if c != "card_back"]
    
    # Track placed cards to avoid overlap
    placed_rects = []
    
    for _ in range(num_cards):
        # Select random card
        card_name = random.choice(card_names)
        card_img = load_card_image(card_name)
        
        if card_img is None:
            continue
        
        # Augment card
        card_img = augment_card(card_img)
        
        # Find non-overlapping position
        max_attempts = 20
        for _ in range(max_attempts):
            x = random.randint(0, width - card_img.width)
            y = random.randint(0, height - card_img.height)
            
            # Check overlap
            new_rect = (x, y, x + card_img.width, y + card_img.height)
            overlap = False
            for rect in placed_rects:
                if (new_rect[0] < rect[2] and new_rect[2] > rect[0] and
                    new_rect[1] < rect[3] and new_rect[3] > rect[1]):
                    overlap = True
                    break
            
            if not overlap:
                placed_rects.append(new_rect)
                break
        else:
            continue  # Skip if can't find non-overlapping position
        
        # Place card
        background = place_card_on_background(background, card_img, x, y)
        
        # Calculate YOLO label (normalized center x, y, width, height)
        cx = (x + card_img.width / 2) / width
        cy = (y + card_img.height / 2) / height
        w = card_img.width / width
        h = card_img.height / height
        
        class_id = CARD_CLASSES[card_name]
        labels.append(f"{class_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")
    
    # Convert to RGB for saving
    background = background.convert('RGB')
    
    return background, labels


def generate_dataset(num_images=2000):
    """Generate complete training dataset"""
    print("🃏 Card Detector Training Data Generator")
    print("=" * 50)
    
    # Create directories
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    LABELS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Generate images
    print(f"📸 Generating {num_images} training images...")
    
    for i in range(num_images):
        if (i + 1) % 100 == 0:
            print(f"   Progress: {i + 1}/{num_images}")
        
        img, labels = generate_training_image(i)
        
        # Save image
        img_path = IMAGES_DIR / f"cards_{i:05d}.png"
        img.save(img_path)
        
        # Save labels
        label_path = LABELS_DIR / f"cards_{i:05d}.txt"
        label_path.write_text("\n".join(labels))
    
    print(f"\n✅ Generated {num_images} images")
    print(f"📁 Images: {IMAGES_DIR}")
    print(f"📁 Labels: {LABELS_DIR}")
    
    # Create dataset YAML
    create_dataset_yaml()
    
    return True


def create_dataset_yaml():
    """Create YOLO dataset configuration"""
    yaml_content = f"""# Card Detection Dataset
path: {OUTPUT_DIR}
train: images
val: images

# Number of classes (52 cards + back)
nc: 53

# Class names
names:
"""
    for i in range(53):
        yaml_content += f"  {i}: {CLASS_NAMES[i]}\n"
    
    yaml_path = OUTPUT_DIR / "card_data.yaml"
    yaml_path.write_text(yaml_content)
    print(f"📄 Created: {yaml_path}")


def train_model():
    """Train YOLO model on card dataset"""
    print("\n🚀 Training Card Detector Model")
    print("=" * 50)
    
    try:
        from ultralytics import YOLO
    except ImportError:
        print("❌ ultralytics not installed")
        return
    
    yaml_path = OUTPUT_DIR / "card_data.yaml"
    if not yaml_path.exists():
        print("❌ Dataset not found. Run generate_dataset() first.")
        return
    
    # Load base model
    model = YOLO('yolov8n.pt')
    
    # Train
    print("🔄 Starting training (this may take 30-60 minutes)...")
    results = model.train(
        data=str(yaml_path),
        epochs=50,
        imgsz=640,
        batch=16,
        project="runs",
        name="card_detector_v1",
        patience=10,
        device="cpu",  # Use 'cuda' for GPU
    )
    
    print("\n✅ Training complete!")
    print(f"📁 Model saved to: runs/card_detector_v1/weights/best.pt")
    
    return results


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--train":
        train_model()
    else:
        generate_dataset(2000)
        print("\n📌 To train the model, run:")
        print("   python train_card_detector.py --train")

