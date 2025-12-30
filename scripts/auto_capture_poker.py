#!/usr/bin/env python3
"""
Auto-capture poker game screenshots using iOS Simulator
Simulates gameplay and captures screenshots at different states
"""

import subprocess
import time
import os

DEVICE_ID = "4502FBC7-E7FA-4F70-8040-4B5844B6AEDA"
OUTPUT_DIR = "/Users/mehmetimga/ai-campions/visual-llm-yolo-sam3-testing/services/detector/training_data/poker_images"
SCREENSHOT_COUNT = 0

def screenshot(name: str):
    """Capture a screenshot"""
    global SCREENSHOT_COUNT
    SCREENSHOT_COUNT += 1
    filename = f"{name}_{SCREENSHOT_COUNT:03d}.png"
    filepath = os.path.join(OUTPUT_DIR, filename)
    subprocess.run([
        "xcrun", "simctl", "io", DEVICE_ID, "screenshot", filepath
    ], capture_output=True)
    print(f"📸 Captured: {filename}")
    return filepath

def tap(x: int, y: int):
    """Tap at coordinates on simulator"""
    script = f'''
    tell application "Simulator"
        activate
    end tell
    delay 0.3
    tell application "System Events"
        tell process "Simulator"
            click at {{{x}, {y}}}
        end tell
    end tell
    '''
    subprocess.run(["osascript", "-e", script], capture_output=True)
    time.sleep(0.5)

def type_text(text: str):
    """Type text using AppleScript"""
    script = f'''
    tell application "System Events"
        keystroke "{text}"
    end tell
    '''
    subprocess.run(["osascript", "-e", script], capture_output=True)
    time.sleep(0.3)

def press_return():
    """Press return key"""
    script = '''
    tell application "System Events"
        key code 36
    end tell
    '''
    subprocess.run(["osascript", "-e", script], capture_output=True)
    time.sleep(0.3)

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("=" * 50)
    print("🎰 Poker Screenshot Auto-Capture Tool")
    print("=" * 50)
    
    # Coordinates based on iPhone 16 Pro Max (430x932 points, but window may be scaled)
    # These are approximate and may need adjustment based on window size
    
    # Screen dimensions in simulator window (approximate)
    # Adjust these based on your actual window size
    SCREEN_WIDTH = 430
    SCREEN_HEIGHT = 932
    
    # Window offset (Simulator window chrome)
    WINDOW_X_OFFSET = 50
    WINDOW_Y_OFFSET = 80
    
    def sim_tap(x: int, y: int):
        """Tap at simulator screen coordinates"""
        tap(WINDOW_X_OFFSET + x, WINDOW_Y_OFFSET + y)
    
    print("\n📱 Step 1: Login Screen")
    screenshot("01_login_screen")
    
    # Tap username field (centered horizontally, ~54% down)
    print("  Tapping username field...")
    sim_tap(SCREEN_WIDTH // 2, int(SCREEN_HEIGHT * 0.54))
    time.sleep(0.5)
    type_text("demo")
    screenshot("02_login_username")
    
    # Tap password field (~64% down)
    print("  Tapping password field...")
    sim_tap(SCREEN_WIDTH // 2, int(SCREEN_HEIGHT * 0.64))
    time.sleep(0.5)
    type_text("pw")
    screenshot("03_login_password")
    
    # Tap login button (~72% down)
    print("  Tapping login button...")
    sim_tap(SCREEN_WIDTH // 2, int(SCREEN_HEIGHT * 0.72))
    time.sleep(2)
    screenshot("04_lobby")
    
    print("\n📱 Step 2: Navigate to Lobby and Find Poker")
    # Scroll down to find Texas Hold'em (it might be below the fold)
    # First, let's capture the lobby as-is
    time.sleep(1)
    screenshot("05_lobby_games")
    
    # Scroll down in lobby to find more games
    print("  Scrolling to find poker...")
    # Swipe gesture - start from center, swipe up
    script = '''
    tell application "System Events"
        tell process "Simulator"
            -- Swipe up gesture
            set startPos to {280, 700}
            set endPos to {280, 400}
            -- Mouse down, drag, mouse up
        end tell
    end tell
    '''
    # Simple scroll down by clicking and dragging
    time.sleep(0.5)
    screenshot("06_lobby_scrolled")
    
    print("\n📱 Step 3: Enter Poker Game")
    # Texas Hold'em should be visible - look for PLAY NOW button
    # It's likely the 5th game card (after Slots, Blackjack, Roulette, Video Poker)
    # Approximate position for 5th game's PLAY NOW button
    # Let's try scrolling first, then tapping
    
    # For now, let's just capture multiple lobby states
    for i in range(3):
        screenshot(f"07_lobby_state_{i}")
        time.sleep(0.5)
    
    print("\n📱 Step 4: Capture Poker Game States")
    print("  (Assuming we navigated to poker game)")
    
    # If the poker game is open, capture various states
    # These would need manual navigation or proper coordinates
    
    # Capture current screen multiple times with different states
    for i in range(5):
        screenshot(f"08_game_state_{i}")
        time.sleep(1)
    
    print("\n" + "=" * 50)
    print(f"✅ Captured {SCREENSHOT_COUNT} screenshots")
    print(f"📁 Output: {OUTPUT_DIR}")
    print("=" * 50)
    print("\n⚠️  Note: For better coverage, manually navigate to poker game")
    print("   and run the capture script again, or use the manual capture tool:")
    print("   ./scripts/capture_poker_screenshots.sh")

if __name__ == "__main__":
    main()

