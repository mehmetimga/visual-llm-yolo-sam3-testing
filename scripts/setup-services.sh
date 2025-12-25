#!/bin/bash
# Setup script for AI UI Automation services
# Usage: ./scripts/setup-services.sh [start|stop|pull-models|status]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Start all services
start_services() {
    log_info "Starting AI UI Automation services..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Build and start services
    docker-compose -f docker-compose.local.yml up -d --build
    
    log_success "Services started!"
    log_info "Waiting for services to be healthy..."
    
    # Wait for services
    sleep 10
    
    show_status
}

# Stop all services
stop_services() {
    log_info "Stopping AI UI Automation services..."
    docker-compose -f docker-compose.local.yml down
    log_success "Services stopped!"
}

# Pull Ollama models
pull_models() {
    log_info "Pulling Ollama vision models..."
    
    # Check if Ollama container is running
    if ! docker ps | grep -q ai-ui-ollama; then
        log_error "Ollama container is not running. Start services first."
        exit 1
    fi
    
    log_info "Pulling minicpm-v (Vision LLM)..."
    docker exec -it ai-ui-ollama ollama pull minicpm-v || log_warn "Failed to pull minicpm-v"
    
    log_info "Pulling llava (Alternative Vision LLM)..."
    docker exec -it ai-ui-ollama ollama pull llava || log_warn "Failed to pull llava"
    
    log_success "Models pulled successfully!"
}

# Show service status
show_status() {
    echo ""
    log_info "Service Status:"
    echo "==============================================="
    
    # Check each service
    check_service "Ollama (VLM)" "http://localhost:11434"
    check_service "Qdrant (Vector DB)" "http://localhost:6333"
    check_service "Detector (YOLO)" "http://localhost:8001/health"
    check_service "DINOv2 (Embeddings)" "http://localhost:8002/health"
    check_service "SAM (Segmentation)" "http://localhost:8003/health"
    
    echo "==============================================="
    echo ""
    log_info "Service URLs:"
    echo "  - Ollama:    http://localhost:11434"
    echo "  - Qdrant:    http://localhost:6333 (UI: http://localhost:6333/dashboard)"
    echo "  - Detector:  http://localhost:8001"
    echo "  - DINOv2:    http://localhost:8002"
    echo "  - SAM:       http://localhost:8003"
    echo ""
}

check_service() {
    local name=$1
    local url=$2
    
    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200"; then
        echo -e "  ${GREEN}✓${NC} $name - Running"
    else
        echo -e "  ${RED}✗${NC} $name - Not responding"
    fi
}

# Show logs
show_logs() {
    local service=${1:-""}
    
    if [ -n "$service" ]; then
        docker-compose -f docker-compose.local.yml logs -f "$service"
    else
        docker-compose -f docker-compose.local.yml logs -f
    fi
}

# Test services
test_services() {
    log_info "Testing services..."
    echo ""
    
    # Test Detector
    log_info "Testing Detector..."
    curl -s http://localhost:8001/health | jq . || log_warn "Detector not responding"
    echo ""
    
    # Test DINOv2
    log_info "Testing DINOv2..."
    curl -s http://localhost:8002/health | jq . || log_warn "DINOv2 not responding"
    echo ""
    
    # Test SAM
    log_info "Testing SAM..."
    curl -s http://localhost:8003/health | jq . || log_warn "SAM not responding"
    echo ""
    
    # Test Ollama
    log_info "Testing Ollama..."
    curl -s http://localhost:11434/api/tags | jq '.models[:3]' || log_warn "Ollama not responding"
    echo ""
    
    log_success "Service tests complete!"
}

# Print usage
print_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start        - Start all services"
    echo "  stop         - Stop all services"
    echo "  restart      - Restart all services"
    echo "  status       - Show service status"
    echo "  pull-models  - Pull Ollama vision models"
    echo "  logs [name]  - Show service logs (optional: service name)"
    echo "  test         - Test all services"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 pull-models"
    echo "  $0 logs detector"
}

# Main
case "${1:-}" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        start_services
        ;;
    status)
        show_status
        ;;
    pull-models)
        pull_models
        ;;
    logs)
        show_logs "${2:-}"
        ;;
    test)
        test_services
        ;;
    *)
        print_usage
        exit 1
        ;;
esac


