#!/usr/bin/env python3
"""
YOLO Training Script for Rive Poker UI Detection
Trains YOLOv8 on auto-labeled Rive poker screenshots
"""

import os
from pathlib import Path

def train_yolo():
    """Train YOLOv8 on Rive poker dataset"""
    print("=" * 60)
    print("🎰 YOLO Training for Rive Poker UI Detection")
    print("=" * 60)
    
    # Import ultralytics
    try:
        from ultralytics import YOLO
    except ImportError:
        print("❌ ultralytics not installed. Run:")
        print("   pip install ultralytics")
        return
    
    # Configuration
    BASE_DIR = Path(__file__).parent.absolute()
    DATASET_YAML = str(BASE_DIR / "training_data/rive_poker_data.yaml")
    MODEL_NAME = "yolov8n.pt"  # Nano model - fast inference
    EPOCHS = 100
    IMAGE_SIZE = 640
    BATCH_SIZE = 16
    PROJECT = str(BASE_DIR / "runs")
    NAME = "rive_poker_v1"
    
    # Check dataset
    if not Path(DATASET_YAML).exists():
        print(f"❌ Dataset config not found: {DATASET_YAML}")
        print("   Run fastLabel_rive.py first!")
        return
    
    # Check for training images
    images_dir = BASE_DIR / "training_data/rive_poker_images"
    labels_dir = BASE_DIR / "training_data/rive_poker_labels"
    
    image_count = len(list(images_dir.glob("*.png"))) + len(list(images_dir.glob("*.jpg")))
    label_count = len(list(labels_dir.glob("*.txt")))
    
    print(f"\n📊 Rive Dataset:")
    print(f"   Images: {image_count}")
    print(f"   Labels: {label_count}")
    
    if image_count == 0:
        print("\n❌ No images found!")
        print("   Run the AI in capture mode first:")
        print("   pnpm tsx scripts/smart_poker_ai.ts --capture --hands=200")
        return
    
    if label_count == 0:
        print("\n❌ No labels found! Run fastLabel_rive.py first.")
        return
    
    if label_count < image_count * 0.5:
        print(f"\n⚠️ Warning: Only {label_count}/{image_count} images have labels")
        print("   Consider running fastLabel_rive.py")
    
    print(f"\n🔧 Training Configuration:")
    print(f"   Model: {MODEL_NAME}")
    print(f"   Epochs: {EPOCHS}")
    print(f"   Image Size: {IMAGE_SIZE}")
    print(f"   Batch Size: {BATCH_SIZE}")
    print(f"   Output: {PROJECT}/{NAME}")
    
    # Copy labels to images directory (YOLO expects them together)
    print("\n📁 Setting up dataset structure...")
    for label_file in labels_dir.glob("*.txt"):
        if label_file.name != "classes.txt":
            dest = images_dir / label_file.name
            if not dest.exists():
                dest.write_text(label_file.read_text())
    print("   Labels copied to images directory")
    
    # Load model
    print(f"\n📥 Loading {MODEL_NAME}...")
    model = YOLO(MODEL_NAME)
    
    # Train
    print(f"\n🚀 Starting training ({EPOCHS} epochs)...")
    print("   This may take a while depending on your hardware.\n")
    
    results = model.train(
        data=DATASET_YAML,
        epochs=EPOCHS,
        imgsz=IMAGE_SIZE,
        batch=BATCH_SIZE,
        project=PROJECT,
        name=NAME,
        exist_ok=True,  # Overwrite if exists
        patience=20,    # Early stopping patience
        save=True,
        verbose=True,
        device='mps',   # Use Metal Performance Shaders for Mac GPU acceleration
    )
    
    print("\n" + "=" * 60)
    print("✅ TRAINING COMPLETE!")
    print("=" * 60)
    
    # Check results
    weights_dir = Path(PROJECT) / NAME / "weights"
    best_model = weights_dir / "best.pt"
    
    if best_model.exists():
        print(f"\n🏆 Best model saved to: {best_model}")
        print(f"\n📋 To deploy this model:")
        print(f"   cp {best_model} rive_poker_model.pt")
        print(f"   # Then update main.py to use 'rive_poker_model.pt'")
    else:
        print(f"\n⚠️ Could not find best model at {best_model}")
    
    # Print validation metrics if available
    results_file = Path(PROJECT) / NAME / "results.csv"
    if results_file.exists():
        print(f"\n📊 Training results saved to: {results_file}")


def validate_model(model_path: str = "rive_poker_model.pt"):
    """Validate a trained model on the dataset"""
    try:
        from ultralytics import YOLO
    except ImportError:
        print("❌ ultralytics not installed")
        return
    
    if not Path(model_path).exists():
        print(f"❌ Model not found: {model_path}")
        return
    
    print(f"\n🔍 Validating {model_path}...")
    model = YOLO(model_path)
    
    results = model.val(data="training_data/rive_poker_data.yaml")
    
    print("\n📊 Validation Results:")
    print(f"   mAP50: {results.box.map50:.3f}")
    print(f"   mAP50-95: {results.box.map:.3f}")


if __name__ == "__main__":
    import sys
    
    if "--validate" in sys.argv:
        model = sys.argv[sys.argv.index("--validate") + 1] if len(sys.argv) > sys.argv.index("--validate") + 1 else "rive_poker_model.pt"
        validate_model(model)
    else:
        train_yolo()

