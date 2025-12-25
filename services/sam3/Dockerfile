FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    wget \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install segment-anything from GitHub
RUN pip install git+https://github.com/facebookresearch/segment-anything.git

# Create directories
RUN mkdir -p /app/out /models

# Copy application
COPY main.py .

# Download SAM model (vit_b - smaller model for faster inference)
# Note: Users can mount their own model checkpoint
RUN wget -q https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth \
    -O /models/sam_vit_b_01ec64.pth || echo "Model download skipped"

# Set environment variables
ENV SAM_MODEL_TYPE=vit_b
ENV SAM_CHECKPOINT=/models/sam_vit_b_01ec64.pth
ENV OUTPUT_DIR=/app/out
ENV PORT=8003

# Expose port
EXPOSE 8003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8003/health || exit 1

# Run the application
CMD ["python", "main.py"]
