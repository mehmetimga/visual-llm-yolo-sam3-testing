import 'package:rive/rive.dart';
import 'package:flutter/foundation.dart' as flutter;

/// RiveButton wraps all ViewModelInstance properties for a Rive button
class RiveButton {
  final String name;
  final ViewModelInstance? vmi;
  final ViewModelInstanceBoolean enabled;
  final ViewModelInstanceBoolean visible;
  final ViewModelInstanceBoolean selected;
  final ViewModelInstanceBoolean pressed;
  final ViewModelInstanceBoolean hover;
  final ViewModelInstanceTrigger clicked;
  final ViewModelInstanceString label;
  final ViewModelInstanceString? value;

  const RiveButton({
    required this.name,
    required this.vmi,
    required this.enabled,
    required this.visible,
    required this.selected,
    required this.pressed,
    required this.hover,
    required this.clicked,
    required this.label,
    required this.value,
  });

  void dispose() {
    vmi?.dispose();
    enabled.dispose();
    visible.dispose();
    selected.dispose();
    pressed.dispose();
    hover.dispose();
    clicked.dispose();
    label.dispose();
    value?.dispose();
  }

  /// Create a RiveButton from a ViewModelInstance with debug logging
  static RiveButton create(ViewModelInstance vmi, String name, {bool disposeVmi = false}) {
    final visibleProp = vmi.boolean("Visible");
    final enabledProp = vmi.boolean("Enabled");
    
    flutter.debugPrint('RiveButton.create($name): Visible binding = $visibleProp, Enabled binding = $enabledProp');
    
    if (visibleProp == null) {
      flutter.debugPrint('RiveButton.create($name): WARNING - Visible property is NULL!');
    }
    
    return RiveButton(
      name: name,
      vmi: disposeVmi ? vmi : null,
      enabled: enabledProp!,
      visible: visibleProp!,
      selected: vmi.boolean("Selected")!,
      pressed: vmi.boolean("Press")!,
      hover: vmi.boolean("Hover")!,
      clicked: vmi.trigger("Clicked")!,
      label: vmi.string("Label")!,
      value: vmi.string("Value"),
    );
  }

  factory RiveButton.fromVmi(ViewModelInstance vmi, String name) => create(vmi, name);

  /// Create RiveButton from a nested ViewModelInstance
  factory RiveButton.fromNestedVmi(ViewModelInstance vmi, String name) {
    flutter.debugPrint('RiveButton.fromNestedVmi: Getting nested VMI for "$name"');
    final nestedVmi = vmi.viewModel(name);
    if (nestedVmi == null) {
      flutter.debugPrint('RiveButton.fromNestedVmi: ERROR - Nested VMI is NULL for "$name"!');
    }
    return create(nestedVmi!, name, disposeVmi: true);
  }
}

