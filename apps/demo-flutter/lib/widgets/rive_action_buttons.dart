import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:rive/rive.dart';

import '../rive/cached_assets.dart';
import '../rive/cached_fonts.dart';
import '../rive/shared_font_loader.dart';
import '../rive/custom_rive_widget_controller.dart';
import '../rive/rive_dispose_mixin.dart';
import '../rive/rive_button.dart';

const _logTag = "RiveActionButtons";

/// Debounce duration to prevent double-clicks on Rive buttons
const _buttonDebounceMs = 300;

/// Safe listener extension (like production utils.dart)
extension SafeListenerX<T> on ViewModelInstanceObservableValue<T> {
  void addSafeListener(State state, void Function(T value) callback) {
    addListener((val) {
      if (state.mounted) {
        callback(val);
      }
    });
  }
}

/// Callback types for action buttons
typedef ActionCallback = void Function();
typedef RaiseCallback = void Function(int amount);

class RiveActionButtons extends StatefulWidget {
  final bool isEnabled;
  final bool canCheck;
  final int callAmount;
  final int raiseAmount;
  final int minRaise;
  final int maxRaise;
  final int pot;
  final ActionCallback onFold;
  final ActionCallback onCheck;
  final ActionCallback onCall;
  final RaiseCallback onRaise;
  final ActionCallback onAllIn;
  final ValueChanged<int>? onSliderChanged;

  const RiveActionButtons({
    super.key,
    required this.isEnabled,
    required this.canCheck,
    required this.callAmount,
    required this.raiseAmount,
    required this.minRaise,
    required this.maxRaise,
    required this.pot,
    required this.onFold,
    required this.onCheck,
    required this.onCall,
    required this.onRaise,
    required this.onAllIn,
    this.onSliderChanged,
  });

  @override
  State<RiveActionButtons> createState() => _RiveActionButtonsState();
}

class _RiveActionButtonsState extends State<RiveActionButtons> with RiveDisposeMixin {
  CustomRiveWidgetController? _controller;
  
  // State machine triggers
  TriggerInput? _enterTrigger;
  TriggerInput? _enterStateTrigger;
  TriggerInput? _exitTrigger;
  TriggerInput? _exitStateTrigger;
  BooleanInput? _sliderVisible;

  // VMI properties
  ViewModelInstanceNumber? _sliderValue;
  ViewModelInstanceString? _knobInputValue;
  ViewModelInstanceBoolean? _betSizeInputVisible;

  // Action buttons (like production)
  late RiveButton _callButton;
  late RiveButton _checkButton;
  late RiveButton _foldButton;
  late RiveButton _raiseButton;
  late RiveButton _betButton;
  late List<RiveButton> _shortcutButtons;

  bool _isLoading = true;
  bool _isClosed = false;
  bool _isEntering = false;
  bool _isHovered = false;
  String? _errorMessage;
  
  int _currentBet = 0;
  int _lastClickTime = 0;  // Debounce timestamp

  /// Check if button click should be processed (debounce)
  bool _shouldProcessClick() {
    final now = DateTime.now().millisecondsSinceEpoch;
    if (now - _lastClickTime < _buttonDebounceMs) {
      debugPrint('$_logTag: Click debounced (${now - _lastClickTime}ms since last click)');
      return false;
    }
    _lastClickTime = now;
    return true;
  }

  @override
  void initState() {
    super.initState();
    riveLogTag = _logTag;
    _currentBet = widget.raiseAmount;
    _loadRiveFile();
  }

  Future<void> _loadRiveFile() async {
    debugPrint('$_logTag: Loading Rive file with fonts...');

    // Ensure fonts are loaded
    if (!CachedFonts.instance.hasLoadedFonts) {
      debugPrint('$_logTag: Fonts not preloaded, loading now...');
      await _preloadFonts();
    }
    debugPrint('$_logTag: Fonts ready (${CachedFonts.instance.fontCount} fonts)');

    try {
      // Load Rive file with font loader (like production)
      final file = await CachedRiveFiles.instance.asset(
        'assets/rive/m-action-buttons.riv',
        assetLoader: SharedFontAssetsLoader.create(),
      );

      if (file == null) {
        throw Exception('Failed to load Rive file');
      }
      debugPrint('$_logTag: Rive file loaded');

      // Create controller (like production)
      final controller = CustomRiveWidgetController(
        file,
        artboardSelector: ArtboardNamed('Action Buttons'),
        primaryButtonOnly: false,  // Mobile
      );
      debugPrint('$_logTag: Controller created');

      // AutoDataBind (like production)
      final vmi = controller.autoDataBind(this, DataBind.auto(), instanceName: 'Action Buttons');
      debugPrint('$_logTag: VMI bound');

      // Create RiveButtons from nested VMIs (EXACTLY like production)
      _callButton = RiveButton.fromNestedVmi(vmi, "Action Button Call");
      _checkButton = RiveButton.fromNestedVmi(vmi, "Action Button Check");
      _foldButton = RiveButton.fromNestedVmi(vmi, "Action Button Fold");
      _raiseButton = RiveButton.fromNestedVmi(vmi, "Action Button Raise");
      _betButton = RiveButton.fromNestedVmi(vmi, "Action Button Bet");
      debugPrint('$_logTag: Action buttons created');

      // Bet shortcut buttons
      final riveBet1 = RiveButton.fromNestedVmi(vmi, "Bet Size 1");
      final riveBet2 = RiveButton.fromNestedVmi(vmi, "Bet Size 2");
      final riveBet3 = RiveButton.fromNestedVmi(vmi, "Bet Size 3");
      final riveBet4 = RiveButton.fromNestedVmi(vmi, "Bet Size 4");
      _shortcutButtons = [riveBet1, riveBet2, riveBet3, riveBet4];
      debugPrint('$_logTag: Shortcut buttons created');

      // VMI properties (like production)
      _sliderValue = vmi.autoNumber(this, "Slider Value");
      final vmiBetSizeEditInput = vmi.autoViewModelInstance(this, "Bet Size Text Input")!;
      _knobInputValue = vmiBetSizeEditInput.autoString(this, "Value");
      _knobInputValue?.value = "";
      _betSizeInputVisible = vmiBetSizeEditInput.autoBoolean(this, "Visible");

      // Listen for state triggers (like production lines 252-254)
      vmi.autoTrigger(this, "enter state entered")?.addSafeListener(this, (_) => _handleEnterState());
      vmi.autoTrigger(this, "idle state entered")?.addSafeListener(this, (_) => _handleExitState());
      vmi.autoTrigger(this, "exit state entered")?.addSafeListener(this, (_) => _handleExitState());
      debugPrint('$_logTag: State triggers bound');

      // Add hover listeners (like production line 269)
      final buttons = [_callButton, _checkButton, _foldButton, _raiseButton, _betButton, ..._shortcutButtons];
      for (final button in buttons) {
        button.hover.addSafeListener(this, (hovered) => setState(() => _isHovered = hovered));
      }

      // Add click listeners with debounce (like production lines 273-274)
      _foldButton.clicked.addSafeListener(this, (_) {
        if (!_shouldProcessClick()) return;
        debugPrint('$_logTag: FOLD clicked');
        widget.onFold();
      });
      _checkButton.clicked.addSafeListener(this, (_) {
        if (!_shouldProcessClick()) return;
        debugPrint('$_logTag: CHECK clicked');
        widget.onCheck();
      });
      _callButton.clicked.addSafeListener(this, (_) {
        if (!_shouldProcessClick()) return;
        debugPrint('$_logTag: CALL clicked');
        widget.onCall();
      });
      _raiseButton.clicked.addSafeListener(this, (_) {
        if (!_shouldProcessClick()) return;
        debugPrint('$_logTag: RAISE clicked');
        widget.onRaise(_currentBet);
      });
      _betButton.clicked.addSafeListener(this, (_) {
        if (!_shouldProcessClick()) return;
        debugPrint('$_logTag: BET clicked');
        widget.onRaise(_currentBet);  // Use onRaise since mobile layout uses same callback
      });

      // Hide shortcuts initially (like production)
      for (final shortcut in _shortcutButtons) {
        shortcut.visible.value = false;
      }

      // State machine inputs (like production)
      final sm = controller.stateMachine;
      _enterTrigger = sm.autoTrigger(this, 'Enter');
      _enterStateTrigger = sm.autoTrigger(this, 'Enter State');
      _exitTrigger = sm.autoTrigger(this, 'Exit');
      _exitStateTrigger = sm.autoTrigger(this, 'Exit State');
      _sliderVisible = sm.autoBoolean(this, 'Slider Visible');
      debugPrint('$_logTag: State machine inputs bound');

      // Set texts IMMEDIATELY before setting controller (prevent flash of default text)
      _setInitialButtonTexts();
      
      // Set controller and update state (like production lines 306-313)
      setState(() {
        _controller = controller;
        _handleButtonsVisibility();
        _handleButtonsTexts();
        if (!_isClosed) {
          _showRiveButtons();
        }
        _isLoading = false;
      });

    } catch (e, stack) {
      debugPrint('$_logTag: Error: $e');
      debugPrint('$stack');
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _preloadFonts() async {
    final fonts = [
      'assets/fonts/DM Sans-Bold.ttf',
      'assets/fonts/DM Sans-Regular.ttf',
      'assets/fonts/IBM Plex Sans Condensed-Bold.ttf',
      'assets/fonts/IBM Plex Sans Condensed-Regular.ttf',
    ];
    for (final font in fonts) {
      try {
        await CachedFonts.instance.addFont(font);
      } catch (e) {
        debugPrint('$_logTag: Could not load font $font: $e');
      }
    }
  }

  /// Called when enter state animation completes (like production)
  void _handleEnterState() {
    debugPrint('$_logTag: _handleEnterState CALLED');
    _isEntering = false;
    _isClosed = false;
    _isLoading = false;
    _safeSetState();
  }

  /// Called when exit state animation completes (like production)
  void _handleExitState() {
    debugPrint('$_logTag: _handleExitState CALLED');
    if (_isLoading && !_isClosed) {
      _isLoading = false;
      _safeSetState();
      return;
    }
    _isLoading = false;
    _isClosed = true;
    _isEntering = false;  // Reset for next show
    _handleButtonsVisibility(availableActions: {});
    _safeSetState();
  }

  void _safeSetState() {
    SchedulerBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        setState(() {});
      }
    });
  }

  /// Set initial button texts AND visibility BEFORE controller is set
  void _setInitialButtonTexts() {
    // Determine what buttons should be visible based on game state
    final isEnabled = widget.isEnabled;
    final canCheck = widget.canCheck;
    final showBetControls = isEnabled && widget.minRaise != widget.maxRaise;
    
    // Set button labels
    _foldButton.label.value = 'Fold';
    _checkButton.label.value = 'Check';
    _callButton.label.value = 'Call';
    _callButton.value?.value = '\$${widget.callAmount}';
    
    // RAISE or BET based on canCheck
    if (canCheck) {
      _raiseButton.label.value = 'Bet';
    } else {
      _raiseButton.label.value = 'Raise to';
    }
    _raiseButton.value?.value = '\$${widget.raiseAmount}';
    
    // SET VISIBILITY IMMEDIATELY (like production)
    // FOLD - only when enabled
    _foldButton.visible.value = isEnabled;
    
    // CHECK - only when enabled AND canCheck
    _checkButton.visible.value = isEnabled && canCheck;
    
    // CALL - only when enabled AND !canCheck  
    _callButton.visible.value = isEnabled && !canCheck;
    
    // RAISE - only when enabled (handles both BET and RAISE on mobile)
    _raiseButton.visible.value = isEnabled;
    
    // BET button hidden on mobile
    _betButton.visible.value = false;
    
    // Shortcuts - only when bet controls should show
    if (_shortcutButtons.isNotEmpty) {
      _shortcutButtons[0].label.value = 'All-in';
      _shortcutButtons[0].value?.value = '\$${widget.maxRaise}';
      _shortcutButtons[0].visible.value = showBetControls;
      
      _shortcutButtons[1].label.value = 'Pot';
      _shortcutButtons[1].value?.value = '\$${widget.pot}';
      _shortcutButtons[1].visible.value = showBetControls;
      
      _shortcutButtons[2].label.value = '3/4';
      _shortcutButtons[2].value?.value = '\$${(widget.pot * 3 / 4).round()}';
      _shortcutButtons[2].visible.value = showBetControls;
      
      _shortcutButtons[3].label.value = 'Min';
      _shortcutButtons[3].value?.value = '\$${widget.minRaise}';
      _shortcutButtons[3].visible.value = showBetControls;
    }
    
    // Slider visibility
    _sliderVisible?.value = showBetControls;
    _betSizeInputVisible?.value = showBetControls;
    
    // Bet size input
    _knobInputValue?.value = '\$${widget.raiseAmount}';
    
    debugPrint('$_logTag: Initial state - isEnabled=$isEnabled, canCheck=$canCheck');
    debugPrint('$_logTag: Initial visibility - FOLD=$isEnabled, CHECK=${isEnabled && canCheck}, CALL=${isEnabled && !canCheck}, RAISE=$isEnabled');
  }

  /// Show Rive buttons with animation (like production)
  void _showRiveButtons() {
    debugPrint('$_logTag: _showRiveButtons called, _isEntering=$_isEntering');
    // Always fire the trigger (reset _isEntering check)
    _isEntering = true;
    _enterStateTrigger?.fire();
    debugPrint('$_logTag: Enter State trigger fired');
  }

  /// Hide Rive buttons with animation (like production)
  void _hideRiveButtons() {
    _isEntering = false;  // Reset so we can show again
    _exitStateTrigger?.fire();
    debugPrint('$_logTag: Exit State trigger fired');
  }

  /// Set button visibility based on available actions (EXACTLY like production lines 475-505)
  void _handleButtonsVisibility({Set<String>? availableActions}) {
    if (_controller == null || _isLoading) return;

    // Determine available actions from widget state
    final actions = availableActions ?? _getAvailableActions();
    final showBetControls = (actions.contains('BET') || actions.contains('RAISE')) &&
        widget.minRaise != widget.maxRaise;

    final callShouldShow = actions.contains('CALL');
    final checkShouldShow = actions.contains('CHECK');
    final foldShouldShow = actions.contains('FOLD');
    final raiseShouldShow = actions.contains('RAISE') || actions.contains('BET');
    
    // First pass - set visibility
    _foldButton.visible.value = foldShouldShow;
    _checkButton.visible.value = checkShouldShow;
    _callButton.visible.value = callShouldShow;
    _raiseButton.visible.value = raiseShouldShow;
    _betButton.visible.value = false;

    // Force Rive to process
    _controller?.advance(0);
    
    // Second pass - set visibility AGAIN after advance (fixes CALL/CHECK binding issue)
    _foldButton.visible.value = foldShouldShow;
    _checkButton.visible.value = checkShouldShow;
    _callButton.visible.value = callShouldShow;
    _raiseButton.visible.value = raiseShouldShow;

    // Shortcut buttons visibility
    for (int i = 0; i < _shortcutButtons.length; i++) {
      _shortcutButtons[i].visible.value = showBetControls;
      _shortcutButtons[i].enabled.value = showBetControls;
    }

    // Slider visibility
    _sliderVisible?.value = showBetControls;
    _betSizeInputVisible?.value = showBetControls;

    debugPrint('$_logTag: Visibility - FOLD=$foldShouldShow, CHECK=$checkShouldShow, CALL=$callShouldShow, RAISE=$raiseShouldShow');
  }

  /// Get available actions based on widget state
  Set<String> _getAvailableActions() {
    debugPrint('$_logTag: _getAvailableActions - isEnabled=${widget.isEnabled}, canCheck=${widget.canCheck}');
    if (!widget.isEnabled) return {};
    
    final actions = <String>{'FOLD'};
    
    if (widget.canCheck) {
      actions.add('CHECK');
      actions.add('BET');
    } else {
      actions.add('CALL');
      actions.add('RAISE');
    }
    
    debugPrint('$_logTag: Available actions: $actions');
    return actions;
  }

  /// Set button texts (like production lines 432-458)
  void _handleButtonsTexts() {
    if (_controller == null || _isLoading) return;

    _foldButton.label.value = 'Fold';
    _checkButton.label.value = 'Check';

    if (_getAvailableActions().contains('CALL')) {
      _callButton.label.value = 'Call';
      _callButton.value?.value = '\$${widget.callAmount}';
    }

    // RAISE or BET text (like production lines 460-472)
    if (_getAvailableActions().contains('RAISE')) {
      _raiseButton.label.value = 'Raise to';
      _raiseButton.value?.value = '\$$_currentBet';
    } else if (_getAvailableActions().contains('BET')) {
      _raiseButton.label.value = 'Bet';
      _raiseButton.value?.value = '\$$_currentBet';
    }

    // Shortcut labels
    if (_shortcutButtons.isNotEmpty) {
      _shortcutButtons[0].label.value = 'All-in';
      _shortcutButtons[0].value?.value = '\$${widget.maxRaise}';
      _shortcutButtons[1].label.value = 'Pot';
      _shortcutButtons[1].value?.value = '\$${widget.pot}';
      _shortcutButtons[2].label.value = '3/4';
      _shortcutButtons[2].value?.value = '\$${(widget.pot * 3 / 4).round()}';
      _shortcutButtons[3].label.value = 'Min';
      _shortcutButtons[3].value?.value = '\$${widget.minRaise}';
    }

    // Update bet size input
    _knobInputValue?.value = '\$$_currentBet';

    debugPrint('$_logTag: Texts updated');
  }

  void _setSliderState() {
    final min = widget.minRaise;
    final max = widget.maxRaise;
    if (max > min) {
      final normalizedPos = ((_currentBet - min) / (max - min) * 100).clamp(0, 100);
      _sliderValue?.value = normalizedPos.toDouble();
    }
  }

  @override
  void didUpdateWidget(RiveActionButtons oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (_controller == null) return;

    // Update current bet if needed
    if (widget.raiseAmount != oldWidget.raiseAmount) {
      _currentBet = widget.raiseAmount;
    }

    debugPrint('$_logTag: didUpdateWidget - isEnabled: ${oldWidget.isEnabled} -> ${widget.isEnabled}, _isClosed=$_isClosed');
    
    // Show or hide buttons based on isEnabled FIRST
    if (widget.isEnabled && !oldWidget.isEnabled) {
      debugPrint('$_logTag: Transitioning to ENABLED - calling _showRiveButtons');
      _isClosed = false;
      _showRiveButtons();
    } else if (!widget.isEnabled && oldWidget.isEnabled) {
      debugPrint('$_logTag: Transitioning to DISABLED - calling _hideRiveButtons');
      _hideRiveButtons();
    }

    // Update visibility and texts AFTER show/hide trigger (fixes visibility reset issue)
    _handleButtonsTexts();
    _handleButtonsVisibility();
    _setSliderState();
    
    // Force rebuild to apply visibility changes
    setState(() {});
  }

  @override
  void dispose() {
    // Only dispose buttons if controller was initialized (like production)
    if (_controller != null) {
      _callButton.dispose();
      _checkButton.dispose();
      _foldButton.dispose();
      _raiseButton.dispose();
      _betButton.dispose();
      for (final shortcut in _shortcutButtons) {
        shortcut.dispose();
      }
    }
    disposeRiveObjects();
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const SizedBox(
        height: 250,
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (_errorMessage != null) {
      return SizedBox(
        height: 250,
        child: Center(
          child: Text('Error: $_errorMessage', style: const TextStyle(color: Colors.red)),
        ),
      );
    }

    if (_controller == null) {
      return const SizedBox(height: 250);
    }

    // Calculate size based on artboard (like production)
    final screenWidth = MediaQuery.of(context).size.width;
    final artboardWidth = _controller!.artboard.width;
    final artboardHeight = _controller!.artboard.height;
    final aspectRatio = artboardWidth / artboardHeight;
    final scaledHeight = screenWidth / aspectRatio;

    return SizedBox(
      width: screenWidth,
      height: scaledHeight,
      child: RiveWidget(
        controller: _controller!,
        hitTestBehavior: RiveHitTestBehavior.translucent,
        fit: Fit.fitWidth,
      ),
    );
  }
}
