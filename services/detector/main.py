"""
YOLO-based UI Element Detector Service
Detects UI elements (buttons, inputs, icons) from screenshots
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import logging
import base64
import io
import tempfile

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="UI Detector Service",
    description="YOLO-based UI element detection for AI UI Automation",
    version="0.1.0"
)

# Model loading (lazy initialization)
model = None

def get_model():
    """Lazy load YOLO model"""
    global model
    if model is None:
        try:
            from ultralytics import YOLO
            # Use a pre-trained model or custom UI detection model
            model_path = os.environ.get("YOLO_MODEL_PATH", "yolov8n.pt")
            model = YOLO(model_path)
            logger.info(f"Loaded YOLO model from {model_path}")
        except Exception as e:
            logger.warning(f"Failed to load YOLO model: {e}. Using mock mode.")
            model = "mock"
    return model


class BBox(BaseModel):
    x: int
    y: int
    w: int
    h: int


class CandidateElement(BaseModel):
    id: str
    type: Optional[str] = None
    text: Optional[str] = None
    role: Optional[str] = None
    bbox: BBox
    confidence: Optional[float] = None


class DetectRequest(BaseModel):
    image_path: Optional[str] = None
    image: Optional[str] = None  # Base64 encoded image
    conf_threshold: float = 0.3


class DetectResponse(BaseModel):
    detections: List[CandidateElement]
    count: int


# UI element type mapping from COCO classes
UI_TYPE_MAPPING = {
    "person": None,  # Skip
    "cell phone": "button",
    "keyboard": "textbox",
    "remote": "button",
    "book": "card",
    "tv": "container",
    "laptop": "container",
    "mouse": "icon",
}


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "model_loaded": model is not None and model != "mock"}


@app.get("/")
async def root():
    """Root endpoint"""
    return {"service": "UI Detector", "version": "0.1.0", "status": "running"}


@app.post("/detect", response_model=DetectResponse)
async def detect(request: DetectRequest):
    """
    Detect UI elements in a screenshot
    
    Accepts either image_path or base64-encoded image.
    Returns bounding boxes for buttons, inputs, icons, etc.
    """
    image_path = None
    temp_file = None
    
    try:
        # Handle base64 image
        if request.image:
            from PIL import Image
            image_data = base64.b64decode(request.image)
            image = Image.open(io.BytesIO(image_data))
            
            # Save to temp file for YOLO
            temp_file = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
            image.save(temp_file.name)
            image_path = temp_file.name
        elif request.image_path:
            if not os.path.exists(request.image_path):
                raise HTTPException(status_code=404, detail=f"Image not found: {request.image_path}")
            image_path = request.image_path
        else:
            raise HTTPException(status_code=400, detail="Either image_path or image (base64) must be provided")
        
        detector = get_model()
        
        if detector == "mock":
            # Return mock elements for development/testing
            return DetectResponse(
                detections=[
                    CandidateElement(
                        id="el_01",
                        type="button",
                        text="SPIN",
                        role="button",
                        bbox=BBox(x=540, y=383, w=200, h=60),
                        confidence=0.95
                    ),
                    CandidateElement(
                        id="el_02",
                        type="button",
                        text="+",
                        role="button",
                        bbox=BBox(x=730, y=470, w=50, h=50),
                        confidence=0.92
                    ),
                    CandidateElement(
                        id="el_03",
                        type="button",
                        text="-",
                        role="button",
                        bbox=BBox(x=490, y=470, w=50, h=50),
                        confidence=0.91
                    ),
                    CandidateElement(
                        id="el_04",
                        type="button",
                        text="DEAL",
                        role="button",
                        bbox=BBox(x=565, y=455, w=150, h=50),
                        confidence=0.90
                    ),
                    CandidateElement(
                        id="el_05",
                        type="button",
                        text="HIT",
                        role="button",
                        bbox=BBox(x=500, y=455, w=100, h=50),
                        confidence=0.89
                    ),
                    CandidateElement(
                        id="el_06",
                        type="button",
                        text="STAND",
                        role="button",
                        bbox=BBox(x=660, y=455, w=100, h=50),
                        confidence=0.88
                    ),
                ],
                count=6
            )
        
        # Run YOLO detection
        results = detector(image_path, conf=request.conf_threshold)
        
        elements = []
        for i, result in enumerate(results):
            if result.boxes is None:
                continue
                
            for j, box in enumerate(result.boxes):
                # Get bounding box coordinates
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                confidence = float(box.conf[0])
                class_id = int(box.cls[0])
                class_name = result.names.get(class_id, "unknown")
                
                # Map to UI element type
                ui_type = UI_TYPE_MAPPING.get(class_name, "button")
                if ui_type is None:
                    continue
                
                elements.append(CandidateElement(
                    id=f"el_{i:02d}_{j:02d}",
                    type=ui_type,
                    role=ui_type,
                    bbox=BBox(
                        x=int(x1),
                        y=int(y1),
                        w=int(x2 - x1),
                        h=int(y2 - y1)
                    ),
                    confidence=confidence
                ))
        
        # Sort by confidence and limit
        elements.sort(key=lambda e: e.confidence or 0, reverse=True)
        elements = elements[:20]  # Limit to top 20 elements
        
        return DetectResponse(detections=elements, count=len(elements))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Detection failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Cleanup temp file
        if temp_file and os.path.exists(temp_file.name):
            os.unlink(temp_file.name)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
