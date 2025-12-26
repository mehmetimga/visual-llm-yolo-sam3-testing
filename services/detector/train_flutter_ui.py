"""
Train Custom YOLO Model for Flutter UI Detection
"""

from ultralytics import YOLO
import yaml
import os

# Define dataset configuration
dataset_config = {
    'path': '/app/training_data',  # Dataset root
    'train': 'images',              # Training images folder
    'val': 'images',                # Validation images folder (can split later)
    'names': {
        0: 'button',
        1: 'textfield',
        2: 'label',
        3: 'icon',
        4: 'card_widget',
        5: 'balance_display',
        6: 'canvas_button',  # For CustomPaint buttons
        7: 'game_control',   # For game-specific controls
    }
}

# Save dataset config
with open('/app/training_data/dataset.yaml', 'w') as f:
    yaml.dump(dataset_config, f)

def train_flutter_ui_detector():
    """Train YOLO model on Flutter UI screenshots"""

    # Load pre-trained model as starting point
    model = YOLO('yolov8n.pt')  # Or yolov8s.pt for better accuracy

    # Train the model
    results = model.train(
        data='/app/training_data/dataset.yaml',
        epochs=100,               # Adjust based on dataset size
        imgsz=640,                # Image size (640x640)
        batch=16,                 # Batch size (adjust for your GPU)
        device='cpu',             # Use 'cuda:0' if GPU available
        project='/app/runs',      # Output directory
        name='flutter_ui_v1',     # Model name
        patience=20,              # Early stopping patience
        save=True,                # Save checkpoints
        plots=True,               # Generate plots

        # Data augmentation for UI screenshots
        hsv_h=0.01,              # Minimal hue variation
        hsv_s=0.3,               # Some saturation variation
        hsv_v=0.2,               # Brightness variation
        degrees=0,                # No rotation (UI is axis-aligned)
        translate=0.1,            # Small translation
        scale=0.1,                # Small scaling
        fliplr=0.0,              # No horizontal flip (text would be backwards)
        flipud=0.0,              # No vertical flip
        mosaic=0.5,              # Mosaic augmentation
    )

    # Export best model
    best_model = YOLO('/app/runs/flutter_ui_v1/weights/best.pt')
    best_model.export(format='onnx')  # Export to ONNX for deployment

    print(f"Training complete! Best model saved to: /app/runs/flutter_ui_v1/weights/best.pt")
    print(f"Model metrics: {results.results_dict}")

    return results

def validate_model(model_path='/app/runs/flutter_ui_v1/weights/best.pt'):
    """Validate trained model on test screenshots"""
    model = YOLO(model_path)

    # Run inference on test images
    test_images = '/app/training_data/test'
    results = model.val(data='/app/training_data/dataset.yaml')

    print(f"Validation mAP50: {results.box.map50}")
    print(f"Validation mAP50-95: {results.box.map}")

    return results

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == 'validate':
        validate_model()
    else:
        train_flutter_ui_detector()
