import 'package:flutter/gestures.dart';
import 'package:rive/rive.dart';

/// Custom RiveWidgetController that handles primary button clicks only
base class CustomRiveWidgetController extends RiveWidgetController {
  final bool primaryButtonOnly;
  bool _isPrimaryButtonDown = false;

  CustomRiveWidgetController(
    super.file, {
    super.artboardSelector,
    super.stateMachineSelector,
    this.primaryButtonOnly = false,
  });

  @override
  void pointerEvent(PointerEvent event, HitTestEntry<HitTestTarget> entry) {
    if (primaryButtonOnly) {
      if (event is PointerDownEvent) {
        if (event.buttons == kPrimaryButton) {
          _isPrimaryButtonDown = true;
        }
        super.pointerEvent(event, entry);
      } else if (event is PointerUpEvent) {
        if (event.buttons == 0 && _isPrimaryButtonDown) {
          super.pointerEvent(event, entry);
        }
        _isPrimaryButtonDown = false;
      } else if (event is PointerCancelEvent) {
        _isPrimaryButtonDown = false;
        super.pointerEvent(event, entry);
      } else {
        super.pointerEvent(event, entry);
      }
    } else {
      super.pointerEvent(event, entry);
    }
  }
}

