import 'package:rive/rive.dart';
import 'package:flutter/foundation.dart' as flutter;

/// Named wrapper for disposable objects
class _Named<T> {
  final String name;
  final T value;
  _Named(this.name, this.value);
}

/// Extension for StateMachine to auto-register inputs
extension StateMachineDisposeExtension on StateMachine {
  TriggerInput? autoTrigger(RiveDisposeMixin manager, String name, {String? path}) {
    final input = trigger(name, path: path);
    if (input != null) {
      manager._addInput(input, name);
    } else {
      flutter.debugPrint("RiveDisposeMixin: Trigger $name not found${path != null ? " (path: $path)" : ""}");
    }
    return input;
  }

  NumberInput? autoNumber(RiveDisposeMixin manager, String name, {String? path}) {
    final input = number(name, path: path);
    if (input != null) {
      manager._addInput(input, name);
    } else {
      flutter.debugPrint("RiveDisposeMixin: Number input $name not found${path != null ? " (path: $path)" : ""}");
    }
    return input;
  }

  BooleanInput? autoBoolean(RiveDisposeMixin manager, String name, {String? path}) {
    final input = boolean(name, path: path);
    if (input != null) {
      manager._addInput(input, name);
    } else {
      flutter.debugPrint("RiveDisposeMixin: Boolean input $name not found${path != null ? " (path: $path)" : ""}");
    }
    return input;
  }
}

/// Extension for RiveWidgetController to auto-register data bindings
extension RiveWidgetControllerDisposeExtension on RiveWidgetController {
  ViewModelInstance autoDataBind(RiveDisposeMixin manager, DataBind bind, {String? instanceName}) {
    final viewModelInstance = dataBind(bind);
    manager._addViewModelInstance(viewModelInstance, instanceName ?? '<dataBind>');
    return viewModelInstance;
  }
}

/// Extension for ViewModelInstance to auto-register properties
extension ViewModelInstanceDisposeExtension on ViewModelInstance {
  ViewModelInstanceString? autoString(RiveDisposeMixin manager, String name) {
    final instance = string(name);
    if (instance != null) {
      manager._addInstance(instance, name);
    } else {
      flutter.debugPrint("RiveDisposeMixin: String instance $name not found");
    }
    return instance;
  }

  ViewModelInstanceNumber? autoNumber(RiveDisposeMixin manager, String name) {
    final instance = number(name);
    if (instance != null) {
      manager._addInstance(instance, name);
    } else {
      flutter.debugPrint("RiveDisposeMixin: Number instance $name not found");
    }
    return instance;
  }

  ViewModelInstanceBoolean? autoBoolean(RiveDisposeMixin manager, String name) {
    final instance = boolean(name);
    if (instance != null) {
      manager._addInstance(instance, name);
    } else {
      flutter.debugPrint("RiveDisposeMixin: Boolean instance $name not found");
    }
    return instance;
  }

  ViewModelInstanceTrigger? autoTrigger(RiveDisposeMixin manager, String name) {
    final instance = trigger(name);
    if (instance != null) {
      manager._addInstance(instance, name);
    } else {
      flutter.debugPrint("RiveDisposeMixin: Trigger instance $name not found");
    }
    return instance;
  }

  ViewModelInstance? autoViewModelInstance(RiveDisposeMixin manager, String name) {
    final instance = viewModel(name);
    if (instance != null) {
      manager._addViewModelInstance(instance, name);
    } else {
      flutter.debugPrint("RiveDisposeMixin: View Model instance $name not found");
    }
    return instance;
  }
}

/// Mixin that handles disposal of all Rive objects
mixin RiveDisposeMixin {
  final List<_Named<ViewModelInstanceValue>> _viewModelInstanceValues = [];
  final List<_Named<ViewModelInstance>> _viewModelInstances = [];
  final List<_Named<Input>> _inputs = [];
  bool _disposed = false;
  String riveLogTag = "RiveDisposeMixin";

  bool get isDisposed => _disposed;

  void _addInput(Input input, String name) => _inputs.add(_Named(name, input));
  
  void _addInstance<T extends ViewModelInstanceValue>(T value, String name) =>
      _viewModelInstanceValues.add(_Named<T>(name, value));

  void _addViewModelInstance(ViewModelInstance instance, String name) =>
      _viewModelInstances.add(_Named(name, instance));

  void disposeRiveObjects() {
    flutter.debugPrint("RiveDisposeMixin: Disposing $registeredRiveObjectsCount Rive objects");

    for (final named in _viewModelInstanceValues) {
      named.value.dispose();
    }
    _viewModelInstanceValues.clear();

    for (final named in _viewModelInstances) {
      named.value.dispose();
    }
    _viewModelInstances.clear();

    for (final named in _inputs) {
      named.value.dispose();
    }
    _inputs.clear();
    _disposed = true;
  }

  int get registeredRiveObjectsCount =>
      _viewModelInstanceValues.length + _viewModelInstances.length + _inputs.length;

  bool get hasRegisteredRiveObjects => registeredRiveObjectsCount > 0;
}

