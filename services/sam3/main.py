"""
SAM-3 Segmentation Service
Precise element segmentation for complex UI (casino games, canvas elements)
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import os
import logging
import base64
import io
import tempfile

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="SAM-3 Segmentation Service",
    description="Precise UI element segmentation for AI UI Automation",
    version="0.1.0"
)

# Model loading (lazy initialization)
sam_model = None
sam_predictor = None

def get_model():
    """Lazy load SAM model"""
    global sam_model, sam_predictor
    if sam_model is None:
        try:
            import torch
            from segment_anything import sam_model_registry, SamPredictor
            
            # Use SAM model (SAM-3 when available, fallback to SAM)
            model_type = os.environ.get("SAM_MODEL_TYPE", "vit_b")
            checkpoint_path = os.environ.get("SAM_CHECKPOINT", "/models/sam_vit_b_01ec64.pth")
            
            if os.path.exists(checkpoint_path):
                sam_model = sam_model_registry[model_type](checkpoint=checkpoint_path)
                
                # Move to GPU if available
                if torch.cuda.is_available():
                    sam_model = sam_model.cuda()
                elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                    sam_model = sam_model.to('mps')
                
                sam_predictor = SamPredictor(sam_model)
                logger.info(f"Loaded SAM model: {model_type}")
            else:
                logger.warning(f"SAM checkpoint not found at {checkpoint_path}. Using mock mode.")
                sam_model = "mock"
        except Exception as e:
            logger.warning(f"Failed to load SAM model: {e}. Using mock mode.")
            sam_model = "mock"
    return sam_model, sam_predictor


class BBox(BaseModel):
    x: int
    y: int
    w: int
    h: int


class ClickPoint(BaseModel):
    x: int
    y: int


class SegmentRequest(BaseModel):
    image_path: Optional[str] = None
    image: Optional[str] = None  # Base64 encoded image
    prompt_text: Optional[str] = None
    coarse_bbox: Optional[BBox] = None
    point: Optional[ClickPoint] = None  # Point prompt


class SegmentResponse(BaseModel):
    mask_path: Optional[str] = None
    mask: Optional[str] = None  # Base64 encoded mask
    click_point: ClickPoint
    confidence: Optional[float] = None


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "model_loaded": sam_model is not None and sam_model != "mock"}


@app.get("/")
async def root():
    """Root endpoint"""
    return {"service": "SAM-3 Segmentation", "version": "0.1.0", "status": "running"}


@app.post("/segment", response_model=SegmentResponse)
async def segment(request: SegmentRequest):
    """
    Segment a UI element and return precise click point
    
    Uses SAM for precise segmentation of complex UI elements
    """
    image_path = None
    temp_file = None
    
    try:
        # Handle base64 image
        if request.image:
            from PIL import Image
            image_data = base64.b64decode(request.image)
            image = Image.open(io.BytesIO(image_data))
            
            # Save to temp file
            temp_file = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
            image.save(temp_file.name)
            image_path = temp_file.name
        elif request.image_path:
            if not os.path.exists(request.image_path):
                raise HTTPException(status_code=404, detail=f"Image not found: {request.image_path}")
            image_path = request.image_path
        else:
            raise HTTPException(status_code=400, detail="Either image_path or image (base64) must be provided")
        
        model, predictor = get_model()
        
        # Generate output path
        base_name = os.path.splitext(os.path.basename(image_path))[0]
        out_dir = os.environ.get("OUTPUT_DIR", "/tmp")
        mask_path = os.path.join(out_dir, f"{base_name}_mask.png")
        
        if model == "mock":
            # Return mock response for development/testing
            if request.coarse_bbox:
                click_x = request.coarse_bbox.x + request.coarse_bbox.w // 2
                click_y = request.coarse_bbox.y + request.coarse_bbox.h // 2
            elif request.point:
                click_x = request.point.x
                click_y = request.point.y
            else:
                click_x, click_y = 640, 413  # Default to SPIN button area
                
            return SegmentResponse(
                mask_path=mask_path,
                click_point=ClickPoint(x=click_x, y=click_y),
                confidence=0.85
            )
        
        import torch
        import numpy as np
        from PIL import Image
        
        # Load image
        image = Image.open(image_path).convert("RGB")
        image_array = np.array(image)
        
        # Set image for predictor
        predictor.set_image(image_array)
        
        # Prepare prompts
        if request.coarse_bbox:
            # Use bounding box prompt
            box = np.array([
                request.coarse_bbox.x,
                request.coarse_bbox.y,
                request.coarse_bbox.x + request.coarse_bbox.w,
                request.coarse_bbox.y + request.coarse_bbox.h
            ])
            masks, scores, _ = predictor.predict(box=box, multimask_output=True)
        elif request.point:
            # Use point prompt
            point_coords = np.array([[request.point.x, request.point.y]])
            point_labels = np.array([1])
            masks, scores, _ = predictor.predict(
                point_coords=point_coords,
                point_labels=point_labels,
                multimask_output=True
            )
        else:
            # Use center point as prompt
            h, w = image_array.shape[:2]
            center_point = np.array([[w // 2, h // 2]])
            center_label = np.array([1])
            masks, scores, _ = predictor.predict(
                point_coords=center_point,
                point_labels=center_label,
                multimask_output=True
            )
        
        # Use best mask
        best_idx = np.argmax(scores)
        mask = masks[best_idx]
        confidence = float(scores[best_idx])
        
        # Find centroid of mask for click point
        y_coords, x_coords = np.where(mask)
        if len(x_coords) > 0 and len(y_coords) > 0:
            click_x = int(np.mean(x_coords))
            click_y = int(np.mean(y_coords))
        else:
            # Fallback to bbox center
            if request.coarse_bbox:
                click_x = request.coarse_bbox.x + request.coarse_bbox.w // 2
                click_y = request.coarse_bbox.y + request.coarse_bbox.h // 2
            else:
                click_x, click_y = image_array.shape[1] // 2, image_array.shape[0] // 2
        
        # Save mask
        mask_image = Image.fromarray((mask * 255).astype(np.uint8))
        mask_image.save(mask_path)
        
        # Also return base64 encoded mask
        buffer = io.BytesIO()
        mask_image.save(buffer, format='PNG')
        mask_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        return SegmentResponse(
            mask_path=mask_path,
            mask=mask_base64,
            click_point=ClickPoint(x=click_x, y=click_y),
            confidence=confidence
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Segmentation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Cleanup temp file
        if temp_file and os.path.exists(temp_file.name):
            os.unlink(temp_file.name)


@app.get("/info")
async def info():
    """Get model info"""
    model, _ = get_model()
    if model == "mock":
        return {"model": "mock", "status": "mock mode"}
    
    return {
        "model": os.environ.get("SAM_MODEL_TYPE", "vit_b"),
        "status": "loaded"
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8003))
    uvicorn.run(app, host="0.0.0.0", port=port)
