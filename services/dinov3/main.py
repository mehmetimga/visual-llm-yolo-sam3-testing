"""
DINOv3 Visual Embedding Service
Computes visual embeddings for similarity search and healing
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="DINOv3 Embedding Service",
    description="Visual embeddings for AI UI Automation visual memory",
    version="0.1.0"
)

# Model loading (lazy initialization)
model = None
processor = None

def get_model():
    """Lazy load DINOv2 model (using v2 as v3 may not be available yet)"""
    global model, processor
    if model is None:
        try:
            import torch
            from transformers import AutoImageProcessor, AutoModel
            from PIL import Image
            
            # Use DINOv2 (similar architecture to v3)
            model_name = os.environ.get("DINO_MODEL", "facebook/dinov2-base")
            processor = AutoImageProcessor.from_pretrained(model_name)
            model = AutoModel.from_pretrained(model_name)
            model.eval()
            
            # Move to GPU if available
            if torch.cuda.is_available():
                model = model.cuda()
            elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
                model = model.to('mps')
                
            logger.info(f"Loaded DINO model: {model_name}")
        except Exception as e:
            logger.warning(f"Failed to load DINO model: {e}. Using mock mode.")
            model = "mock"
            processor = "mock"
    return model, processor


class EmbedRequest(BaseModel):
    image_path: str


class EmbedResponse(BaseModel):
    embedding: List[float]
    dimensions: int


class SearchRequest(BaseModel):
    embedding: List[float]
    top_k: int = 5


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "model_loaded": model is not None}


@app.post("/embed", response_model=EmbedResponse)
async def embed(request: EmbedRequest):
    """
    Compute visual embedding for an image
    
    Returns a 768-dimensional embedding vector
    """
    if not os.path.exists(request.image_path):
        raise HTTPException(status_code=404, detail=f"Image not found: {request.image_path}")
    
    dino_model, dino_processor = get_model()
    
    if dino_model == "mock":
        # Return mock embedding for development/testing
        import random
        embedding = [random.uniform(-1, 1) for _ in range(768)]
        return EmbedResponse(embedding=embedding, dimensions=768)
    
    try:
        import torch
        from PIL import Image
        
        # Load and preprocess image
        image = Image.open(request.image_path).convert("RGB")
        inputs = dino_processor(images=image, return_tensors="pt")
        
        # Move to same device as model
        device = next(dino_model.parameters()).device
        inputs = {k: v.to(device) for k, v in inputs.items()}
        
        # Get embedding
        with torch.no_grad():
            outputs = dino_model(**inputs)
            # Use CLS token embedding
            embedding = outputs.last_hidden_state[:, 0, :].squeeze().cpu().numpy().tolist()
        
        return EmbedResponse(embedding=embedding, dimensions=len(embedding))
        
    except Exception as e:
        logger.error(f"Embedding failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/info")
async def info():
    """Get model info"""
    dino_model, _ = get_model()
    if dino_model == "mock":
        return {"model": "mock", "dimensions": 768}
    
    return {
        "model": os.environ.get("DINO_MODEL", "facebook/dinov2-base"),
        "dimensions": 768
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8002))
    uvicorn.run(app, host="0.0.0.0", port=port)

