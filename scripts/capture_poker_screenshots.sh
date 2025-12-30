#!/bin/bash
# Capture poker game screenshots from iOS simulator
# This script captures screenshots at regular intervals while you play

DEVICE_ID="4502FBC7-E7FA-4F70-8040-4B5844B6AEDA"
OUTPUT_DIR="/Users/mehmetimga/ai-campions/visual-llm-yolo-sam3-testing/services/detector/training_data/poker_images"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$OUTPUT_DIR"

echo "=== Poker Screenshot Capture Tool ==="
echo "Output directory: $OUTPUT_DIR"
echo ""
echo "Instructions:"
echo "1. Make sure the Flutter app is running on the simulator"
echo "2. Navigate to the poker game"
echo "3. This script will capture screenshots every 2 seconds"
echo "4. Play through different game states:"
echo "   - Pre-flop, Flop, Turn, River, Showdown"
echo "   - Different betting actions (fold, check, call, raise)"
echo "   - Winner announcements"
echo "5. Press Ctrl+C to stop capturing"
echo ""
echo "Starting capture in 3 seconds..."
sleep 3

count=1
while true; do
    filename="poker_${TIMESTAMP}_$(printf '%03d' $count).png"
    xcrun simctl io "$DEVICE_ID" screenshot "$OUTPUT_DIR/$filename" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "[$count] Captured: $filename"
    else
        echo "[$count] Failed to capture (is simulator running?)"
    fi
    
    count=$((count + 1))
    sleep 2
done

