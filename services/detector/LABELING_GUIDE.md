# YOLO Labeling Guide for Flutter UI

## Quick Reference

You need to create `.txt` files with the same name as each image.

**Example:**
- Image: `login_screen.png`
- Label: `login_screen.txt`

## Label Format

Each line in the `.txt` file represents one bounding box:

```
class_id center_x center_y width height
```

**All values are normalized (0.0 to 1.0):**
- `center_x` = (bbox_center_x / image_width)
- `center_y` = (bbox_center_y / image_height)
- `width` = (bbox_width / image_width)
- `height` = (bbox_height / image_height)

## Class IDs

```
0: button           # LOG IN, PLAY NOW, JOIN NOW
1: textfield        # Username, Password inputs
2: label            # MEGA SLOTS, Casino Lobby text
3: icon             # 🎰, 🃏, 🎡 emojis
4: card             # Game cards in lobby
5: canvas_button    # SPIN, DEAL, HIT, STAND, +, -
6: game_control     # Other controls
```

## Example Labels

### login_screen.txt

Assuming image is 430x932 pixels (iPhone simulator):

```
# Username textfield (center at x=215, y=300, size 380x60)
1 0.500 0.322 0.884 0.064

# Password textfield (center at x=215, y=380, size 380x60)
1 0.500 0.408 0.884 0.064

# LOG IN button (center at x=215, y=470, size 380x60)
0 0.500 0.504 0.884 0.064

# "MEGA CASINO" label (center at x=215, y=160, size 300x40)
2 0.500 0.172 0.698 0.043
```

### lobby_screen.txt

```
# Mega Slots PLAY NOW button (first card, x=90, y=450, size 130x50)
0 0.209 0.483 0.302 0.054

# Blackjack PLAY NOW button (second card, x=310, y=450, size 130x50)
0 0.721 0.483 0.302 0.054

# JOIN NOW button (bottom, x=215, y=870, size 360x60)
0 0.500 0.933 0.837 0.064

# Balance display label (top right, x=320, y=95, size 100x30)
2 0.744 0.102 0.233 0.032
```

## Tools to Help

### Option 1: Use LabelImg (GUI Tool)

```bash
pip install labelImg
labelImg services/detector/training_data/images
```

**LabelImg shortcuts:**
- `W` - Create box
- `D` - Next image
- `A` - Previous image
- `Ctrl+S` - Save

### Option 2: Roboflow (Online, Easier)

1. Go to https://roboflow.com
2. Upload images
3. Draw boxes with mouse
4. Export in YOLOv8 format
5. Download and extract to `training_data/`

### Option 3: Manual (for 3 images - Fastest)

I can help you create the label files manually if you tell me:
1. Image dimensions (check with: `file services/detector/training_data/images/*.png`)
2. Which elements you want to detect

## Quick Manual Labeling

For your 3 images, you can create labels manually:

```bash
# Get image dimensions
file services/detector/training_data/images/login_screen.png

# Then calculate normalized coordinates:
# normalized_x = actual_x / image_width
# normalized_y = actual_y / image_height
# normalized_w = actual_width / image_width
# normalized_h = actual_height / image_height
```

Example for LOG IN button at pixel (215, 470) with size 380x60 on 430x932 image:
- center_x = 215/430 = 0.500
- center_y = 470/932 = 0.504
- width = 380/430 = 0.884
- height = 60/932 = 0.064

Result: `0 0.500 0.504 0.884 0.064`

## What Elements to Label?

**Priority (label these first):**
1. **Canvas buttons** (class 5): SPIN, DEAL, HIT, STAND, +, -
2. **Standard buttons** (class 0): LOG IN, PLAY NOW, JOIN NOW
3. **Text fields** (class 1): Username, Password

**Nice to have:**
4. Labels (class 2): MEGA SLOTS, Casino Lobby
5. Icons (class 3): Game emojis
6. Cards (class 4): Game cards

## Do You Want Me To...?

1. **Create sample labels** for your 3 images based on typical positions?
2. **Help you install LabelImg** and walk through labeling?
3. **Generate labels from screenshots** using Vision LLM?

Let me know and I'll help!
