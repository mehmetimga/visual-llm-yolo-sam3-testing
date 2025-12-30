Goal: A black-box AI tester that can complete hands end-to-end and reliably click “Deal Again”.

Hard success criteria

Detect + click Deal Again with >99% reliability.

Detect whose turn it is (action buttons visible) with >99% reliability.

Identify board card count (0/3/4/5) reliably.

Read your hole cards + board cards with high confidence when face-up.

v1 non-goals

Perfect opponent card reading except at showdown.

Advanced poker strategy (keep policy simple initially).


Data capture harness using your current Visual LLM tester (automation-first)
1.1 Build a “Recorder” wrapper around the current agent

At every step (before and after each click), record:

screenshot.png

timestamp

action_taken (fold/check/call/raise/all-in/deal-again)

tap_coordinates and/or tap_target_name (if the LLM outputs it)

game_step_id (hand id, decision index)

resolution / device model

Store as:

runs/run_<run_id>_<hand_id>_<step_idx>_screenshot.png

runs/run_<run_id>_<hand_id>_<step_idx>_meta.json

Add “event triggers” (so you capture useful frames)

1.2 Capture extra screenshots when:

action buttons appear/disappear

board card count changes (flop/turn/river)

showdown happens (opponent cards flip)

winner banner appears

deal again appears

1.3 Collect coverage (dataset design)

Run many hands across:

multiple devices/resolutions

different table themes if any

different LLM action behaviors (more raises, more folds) to diversify UI states

Target: 500–2,000 hands worth of step screenshots (you will downsample later).



2.1 YOLO dataset (layout objects)

Objective: label boxes for UI elements (buttons, cards, player panels).

You have two choices for labeling source:

A) Weak labels from LLM (fast start)

Ask the Visual LLM to output structured detections per screenshot:

list of UI elements and bounding boxes (approx)

Use that as initial training labels.

Expect noise; you will clean with heuristics.


Classes (v1 minimal)

btn_fold, btn_check_call, btn_raise, btn_all_in, btn_deal_again

winner_banner

hole_cards_pair (or hole_card)

board_card

player_panel

pot_amount

dealer_button

card_back

2.2 Card corner dataset (rank/suit reader)

Objective: produce corner crops and labels.

Since you are black-box, labels must come from vision:

Start by collecting face-up card crops (you/board/showdown).

For each card crop, have the LLM output the card identity (e.g., “9S”).

Then create two labels:

rank label: 9

suit label: S

Store:

card_crops/<id>.png

rank_labels.csv, suit_labels.csv

Then you can train:

rank_model (13 classes)

suit_model (4 classes)
Optionally include unknown for blurry/transition frames.


3.2 Replace LLM for “UI navigation”

Once YOLO works:

Use YOLO to find:

action buttons

deal again

board cards count

presence of winner banner

Click based on bounding boxes (center point or safe tap point).

The LLM is still used (temporarily) only for:

card identity reading (until corner reader is trained)

rare ambiguous screens

Phase 4 — Train corner rank/suit reader (deterministic perception v2)
4.1 Implement corner extraction

For each detected board_card / hole_card crop:

extract top-left corner patch (fixed % of card size)

normalize size (e.g., 96×96)

4.2 Train models

Rank classifier: 13 classes

Suit classifier: 4 classes

Add confidence threshold:

if rank_conf < t or suit_conf < t → treat as unknown and retry next frame