#!/usr/bin/env python3
"""
YOLO Training Script for Poker UI Detection
Trains YOLOv8 on auto-labeled poker screenshots
"""

import os
from pathlib import Path

def train_yolo():
    """Train YOLOv8 on poker dataset"""
    print("=" * 60)
    print("🎰 YOLO Training for Poker UI Detection")
    print("=" * 60)
    
    # Import ultralytics
    try:
        from ultralytics import YOLO
    except ImportError:
        print("❌ ultralytics not installed. Run:")
        print("   pip install ultralytics")
        return
    
    # Configuration
    DATASET_YAML = "training_data/poker_data.yaml"
    MODEL_NAME = "yolov8n.pt"  # Nano model - fast inference
    EPOCHS = 100
    IMAGE_SIZE = 640
    BATCH_SIZE = 16  # Larger batch for better training
    PROJECT = "runs"
    NAME = "poker_ui_v2"
    
    # Check dataset
    if not Path(DATASET_YAML).exists():
        print(f"❌ Dataset config not found: {DATASET_YAML}")
        print("   Run auto_label_poker.py first!")
        return
    
    # Check for training images
    images_dir = Path("training_data/poker_images")
    labels_dir = Path("training_data/poker_labels")
    
    image_count = len(list(images_dir.glob("*.png"))) + len(list(images_dir.glob("*.jpg")))
    label_count = len(list(labels_dir.glob("*.txt")))
    
    print(f"\n📊 Dataset:")
    print(f"   Images: {image_count}")
    print(f"   Labels: {label_count}")
    
    if label_count == 0:
        print("\n❌ No labels found! Run auto_label_poker.py first.")
        return
    
    if label_count < image_count * 0.5:
        print(f"\n⚠️ Warning: Only {label_count}/{image_count} images have labels")
        print("   Consider running auto-labeling on more images")
    
    print(f"\n🔧 Training Configuration:")
    print(f"   Model: {MODEL_NAME}")
    print(f"   Epochs: {EPOCHS}")
    print(f"   Image Size: {IMAGE_SIZE}")
    print(f"   Batch Size: {BATCH_SIZE}")
    print(f"   Output: {PROJECT}/{NAME}")
    
    # Create symlinks for YOLO to find labels alongside images
    # YOLO expects labels in images/../labels/ or same directory
    print("\n📁 Setting up dataset structure...")
    
    # Move/copy labels to be alongside images
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
    print("\n🚀 Starting training...")
    print("   This may take 10-30 minutes on CPU, 2-5 minutes on GPU")
    print("-" * 60)
    
    try:
        results = model.train(
            data=DATASET_YAML,
            epochs=EPOCHS,
            imgsz=IMAGE_SIZE,
            batch=BATCH_SIZE,
            project=PROJECT,
            name=NAME,
            patience=10,  # Early stopping
            save=True,
            plots=True,
            verbose=True,
            device="cpu",  # Use 'cuda' for GPU
        )
        
        print("\n" + "=" * 60)
        print("✅ Training complete!")
        print(f"\n📁 Model saved to: {PROJECT}/{NAME}/weights/best.pt")
        print("\n📊 Results:")
        print(f"   Final mAP50: Check {PROJECT}/{NAME}/results.csv")
        print(f"   Confusion matrix: {PROJECT}/{NAME}/confusion_matrix.png")
        
        # Show how to use the model
        print("\n📌 To use the trained model:")
        print(f"   1. Copy {PROJECT}/{NAME}/weights/best.pt to poker_model.pt")
        print("   2. Update YOLO_MODEL_PATH in main.py")
        print("   3. Restart detector service")
        
    except Exception as e:
        print(f"\n❌ Training failed: {e}")
        print("\nTroubleshooting:")
        print("   - Ensure you have enough training data (50+ labeled images)")
        print("   - Reduce batch size if out of memory")
        print("   - Check that labels are in correct YOLO format")

def validate_labels():
    """Validate YOLO labels format"""
    print("\n🔍 Validating labels...")
    
    labels_dir = Path("training_data/poker_labels")
    valid = 0
    invalid = 0
    
    for label_file in labels_dir.glob("*.txt"):
        if label_file.name == "classes.txt":
            continue
            
        try:
            with open(label_file) as f:
                for line_num, line in enumerate(f, 1):
                    parts = line.strip().split()
                    if len(parts) != 5:
                        print(f"   ⚠️ {label_file.name}:{line_num} - Invalid format: {line.strip()}")
                        invalid += 1
                        continue
                    
                    class_id = int(parts[0])
                    coords = [float(x) for x in parts[1:]]
                    
                    # Check ranges (11 classes: 0-10)
                    if class_id < 0 or class_id > 10:
                        print(f"   ⚠️ {label_file.name}:{line_num} - Invalid class ID: {class_id}")
                        invalid += 1
                        continue
                    
                    if any(c < 0 or c > 1 for c in coords):
                        print(f"   ⚠️ {label_file.name}:{line_num} - Coords out of range: {coords}")
                        invalid += 1
                        continue
                    
                    valid += 1
                    
        except Exception as e:
            print(f"   ❌ {label_file.name}: {e}")
            invalid += 1
    
    print(f"\n   Valid labels: {valid}")
    print(f"   Invalid labels: {invalid}")
    return invalid == 0

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--validate":
        validate_labels()
    else:
        if validate_labels():
            train_yolo()
        else:
            print("\n⚠️ Fix label issues before training")
            print("   Or run with --force to train anyway")
            if len(sys.argv) > 1 and sys.argv[1] == "--force":
                train_yolo()

