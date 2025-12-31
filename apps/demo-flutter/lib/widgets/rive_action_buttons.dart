import 'package:flutter/material.dart';
import 'package:rive/rive.dart';

import '../rive/cached_assets.dart';
import '../rive/cached_fonts.dart';
import '../rive/shared_font_loader.dart';

/// Rive Action Buttons widget for poker demo
/// Full Rive implementation with font loading
class RiveActionButtons extends StatefulWidget {
  final bool isEnabled;
  final bool canCheck;
  final int callAmount;
  final int raiseAmount;
  final int minRaise;
  final int maxRaise;
  final int pot;
  final VoidCallback? onFold;
  final VoidCallback? onCheck;
  final VoidCallback? onCall;
  final ValueChanged<int>? onRaise;
  final VoidCallback? onAllIn;
  final ValueChanged<int>? onSliderChanged;

  const RiveActionButtons({
    super.key,
    this.isEnabled = true,
    this.canCheck = false,
    this.callAmount = 0,
    this.raiseAmount = 20,
    this.minRaise = 20,
    this.maxRaise = 500,
    this.pot = 100,
    this.onFold,
    this.onCheck,
    this.onCall,
    this.onRaise,
    this.onAllIn,
    this.onSliderChanged,
  });

  @override
  State<RiveActionButtons> createState() => _RiveActionButtonsState();
}

class _RiveActionButtonsState extends State<RiveActionButtons> {
  RiveWidgetController? _controller;
  ViewModelInstance? _vmi;
  bool _isLoading = true;
  bool _isUpdatingState = false;  // Prevent callbacks during state updates
  bool _isProcessingClick = false;  // Debounce rapid clicks
  String? _errorMessage;

  // Button ViewModelInstances
  _RiveButton? _foldButton;
  _RiveButton? _checkButton;
  _RiveButton? _callButton;
  _RiveButton? _raiseButton;
  _RiveButton? _betButton;
  _RiveButton? _allInButton;

  // Bet shortcuts
  _RiveButton? _betSize1;
  _RiveButton? _betSize2;
  _RiveButton? _betSize3;
  _RiveButton? _betSize4;

  // Slider
  ViewModelInstanceNumber? _sliderValue;
  ViewModelInstanceBoolean? _sliderVisible;
  
  // Bet size input (the "$value" display)
  ViewModelInstanceString? _betSizeInputValue;

  // State machine inputs
  TriggerInput? _enterTrigger;
  BooleanInput? _sliderVisibleInput;

  @override
  void initState() {
    super.initState();
    _loadRiveFile();
  }

  Future<void> _loadRiveFile() async {
    try {
      debugPrint('RiveActionButtons: Loading Rive file with fonts...');

      // Ensure fonts are loaded
      if (!CachedFonts.instance.hasLoadedFonts) {
        debugPrint('RiveActionButtons: Fonts not preloaded, loading now...');
        await _preloadFonts();
      }

      debugPrint('RiveActionButtons: Fonts ready (${CachedFonts.instance.fontCount} fonts)');

      // Load Rive file with font loader
      final file = await CachedRiveFiles.instance.asset(
        'assets/rive/m-action-buttons.riv',
        assetLoader: SharedFontAssetsLoader.create(),
      );

      if (file == null) {
        throw Exception('Failed to load Rive file');
      }
      debugPrint('RiveActionButtons: Rive file loaded');

      // Create controller
      _controller = RiveWidgetController(
        file,
        artboardSelector: ArtboardNamed('Action Buttons'),
      );
      debugPrint('RiveActionButtons: Controller created');

      // Bind view model
      _vmi = _controller!.dataBind(DataBind.auto());
      debugPrint('RiveActionButtons: VMI bound');

      // Log available properties
      _logVmiProperties();

      // Setup buttons
      _setupButtons();

      // Setup state machine inputs
      _setupStateMachine();

      // Fire enter animation
      // Try Enter State first (immediate, no animation), fall back to Enter
      if (_enterStateTrigger != null) {
        _enterStateTrigger!.fire();
        debugPrint('RiveActionButtons: Enter State trigger fired (immediate)');
      } else {
        _enterTrigger?.fire();
        debugPrint('RiveActionButtons: Enter trigger fired (animated)');
      }

      // Set initial state
      _updateButtonStates();

      if (mounted) {
        setState(() => _isLoading = false);
      }
    } catch (e, stack) {
      debugPrint('RiveActionButtons: Error: $e');
      debugPrint('$stack');
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = e.toString();
        });
      }
    }
  }

  Future<void> _preloadFonts() async {
    final fonts = [
      'assets/fonts/DM Sans-Regular.ttf',
      'assets/fonts/DM Sans-Medium.ttf',
      'assets/fonts/DM Sans-Bold.ttf',
      'assets/fonts/IBM Plex Sans Condensed-Regular.ttf',
      'assets/fonts/IBM Plex Sans Condensed-Medium.ttf',
      'assets/fonts/IBM Plex Sans Condensed-SemiBold.ttf',
      'assets/fonts/IBM Plex Sans Condensed-Bold.ttf',
      'assets/fonts/Aldrich-Regular.ttf',
    ];

    for (final font in fonts) {
      await CachedFonts.instance.addFont(font);
    }
  }

  void _logVmiProperties() {
    if (_vmi == null) return;

    debugPrint('=== VMI Properties ===');
    for (final prop in _vmi!.properties) {
      debugPrint('  ${prop.name} (${prop.runtimeType})');
    }
    debugPrint('=====================');
  }

  void _setupButtons() {
    if (_vmi == null) return;

    // Main action buttons
    _foldButton = _bindButton('Action Button Fold');
    _checkButton = _bindButton('Action Button Check');
    _callButton = _bindButton('Action Button Call');
    _raiseButton = _bindButton('Action Button Raise');
    _betButton = _bindButton('Action Button Bet');
    _allInButton = _bindButton('Action Button All-in');

    // Bet shortcuts
    _betSize1 = _bindButton('Bet Size 1');
    _betSize2 = _bindButton('Bet Size 2');
    _betSize3 = _bindButton('Bet Size 3');
    _betSize4 = _bindButton('Bet Size 4');

    // Slider value
    _sliderValue = _vmi!.number('Slider Value');
    
    // Bet size input (the "$value" display in the middle)
    try {
      final betSizeInputVmi = _vmi!.viewModel('Bet Size Text Input');
      _betSizeInputValue = betSizeInputVmi?.string('Value');
      debugPrint('RiveActionButtons: Bound Bet Size Text Input');
    } catch (e) {
      debugPrint('RiveActionButtons: Could not bind Bet Size Text Input: $e');
    }

    // Setup click listeners with debounce protection
    _foldButton?.clicked?.addListener((_) => _handleClick('FOLD', () => widget.onFold?.call()));
    _checkButton?.clicked?.addListener((_) => _handleClick('CHECK', () => widget.onCheck?.call()));
    _callButton?.clicked?.addListener((_) => _handleClick('CALL', () => widget.onCall?.call()));
    // RAISE button handles both BET and RAISE in mobile
    _raiseButton?.clicked?.addListener((_) => _handleClick(
      widget.canCheck ? 'BET' : 'RAISE', 
      () => widget.onRaise?.call(widget.raiseAmount)
    ));
    // BET button not used in mobile (hidden)
    _betButton?.clicked?.addListener((_) => _handleClick('BET', () => widget.onRaise?.call(widget.raiseAmount)));
    // ALL-IN not used in mobile layout
    _allInButton?.clicked?.addListener((_) => _handleClick('ALL-IN', () => widget.onAllIn?.call()));

    // Bet shortcuts click listeners (matches production order)
    _betSize1?.clicked?.addListener((_) {
      debugPrint('All-in clicked');
      widget.onSliderChanged?.call(widget.maxRaise);  // All-in = max
    });
    _betSize2?.clicked?.addListener((_) {
      debugPrint('Pot clicked');
      widget.onSliderChanged?.call(widget.pot.clamp(widget.minRaise, widget.maxRaise));
    });
    _betSize3?.clicked?.addListener((_) {
      debugPrint('3/4 Pot clicked');
      widget.onSliderChanged?.call((widget.pot * 3 / 4).round().clamp(widget.minRaise, widget.maxRaise));
    });
    _betSize4?.clicked?.addListener((_) {
      debugPrint('Min clicked');
      widget.onSliderChanged?.call(widget.minRaise);
    });

    // Slider value listener - defer to avoid calling setState during build
    _sliderValue?.addListener((value) {
      if (!_isUpdatingState) {
        final min = widget.minRaise;
        final max = widget.maxRaise;
        final newAmount = (min + (value / 100) * (max - min)).round();
        // Use post-frame callback to avoid setState during build
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            widget.onSliderChanged?.call(newAmount);
          }
        });
      }
    });
  }

  /// Handle button click with debounce protection
  void _handleClick(String name, VoidCallback action) {
    if (_isProcessingClick || !widget.isEnabled) {
      debugPrint('$name click ignored (processing: $_isProcessingClick, enabled: ${widget.isEnabled})');
      return;
    }
    
    _isProcessingClick = true;
    debugPrint('$name clicked');
    
    // Execute the action
    action();
    
    // Reset after a short delay to prevent rapid double-clicks
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) {
        _isProcessingClick = false;
      }
    });
  }

  _RiveButton? _bindButton(String name) {
    try {
      final buttonVmi = _vmi?.viewModel(name);
      if (buttonVmi != null) {
        debugPrint('RiveActionButtons: Bound button: $name');
        return _RiveButton(
          enabled: buttonVmi.boolean('Enabled'),
          visible: buttonVmi.boolean('Visible'),
          selected: buttonVmi.boolean('Selected'),
          clicked: buttonVmi.trigger('Clicked'),
          label: buttonVmi.string('Label'),
          value: buttonVmi.string('Value'),
        );
      }
    } catch (e) {
      debugPrint('RiveActionButtons: Could not bind $name: $e');
    }
    return null;
  }

  TriggerInput? _enterStateTrigger;
  
  void _setupStateMachine() {
    final sm = _controller?.stateMachine;
    if (sm == null) return;

    for (final input in sm.inputs) {
      debugPrint('RiveActionButtons: SM Input: ${input.name} (${input.runtimeType})');
      if (input.name == 'Enter' && input is TriggerInput) {
        _enterTrigger = input;
      }
      if (input.name == 'Enter State' && input is TriggerInput) {
        _enterStateTrigger = input;
      }
      if (input.name == 'Slider Visible' && input is BooleanInput) {
        _sliderVisibleInput = input;
      }
    }
  }

  void _updateButtonStates() {
    if (_vmi == null) return;
    
    _isUpdatingState = true;  // Prevent callbacks during update

    final canCheck = widget.canCheck;
    final isEnabled = widget.isEnabled;
    final callAmount = widget.callAmount;
    final raiseAmount = widget.raiseAmount;
    final pot = widget.pot;
    
    // Debug: log button state
    debugPrint('');
    debugPrint('=== UPDATE BUTTON STATES ===');
    debugPrint('canCheck=$canCheck, isEnabled=$isEnabled, callAmount=$callAmount, pot=$pot');

    // FOLD - always visible (title case like production)
    _foldButton?.visible?.value = true;
    _foldButton?.enabled?.value = isEnabled;
    _foldButton?.label?.value = 'Fold';

    // === MOBILE LAYOUT (matches production) ===
    // In mobile: RAISE button is used for BOTH BET and RAISE
    // CHECK and CALL are separate buttons
    
    // CHECK - visible when canCheck (no bet to call)
    if (_checkButton == null) {
      debugPrint('WARNING: CHECK button not bound!');
    } else {
      if (_checkButton!.visible == null) {
        debugPrint('WARNING: CHECK visible property is NULL!');
      } else {
        _checkButton!.visible!.value = canCheck;
      }
      _checkButton!.enabled?.value = isEnabled && canCheck;
      _checkButton!.label?.value = 'Check';
      debugPrint('CHECK: setVisible=$canCheck, actualVisible=${_checkButton!.visible?.value}');
    }

    // CALL - visible when !canCheck (there's a bet to call)
    if (_callButton == null) {
      debugPrint('WARNING: CALL button not bound!');
    } else {
      if (_callButton!.visible == null) {
        debugPrint('WARNING: CALL visible property is NULL!');
      } else {
        _callButton!.visible!.value = !canCheck;
      }
      _callButton!.enabled?.value = isEnabled && !canCheck;
      _callButton!.label?.value = 'Call';
      _callButton!.value?.value = '\$$callAmount';
      debugPrint('CALL: setVisible=${!canCheck}, actualVisible=${_callButton!.visible?.value}, value=\$$callAmount');
    }

    // RAISE - visible for BOTH BET and RAISE in mobile (always visible when enabled)
    _raiseButton?.visible?.value = true;  // Always visible in mobile
    _raiseButton?.enabled?.value = isEnabled;
    // Label: "Bet" or "Raise to" (matches production style)
    _raiseButton?.label?.value = canCheck ? 'Bet' : 'Raise to';
    _raiseButton?.value?.value = '\$$raiseAmount';
    debugPrint('Raise button: ${canCheck ? "Bet" : "Raise to"} \$$raiseAmount');

    // BET - HIDDEN on mobile (RAISE button handles both)
    _betButton?.visible?.value = false;

    // ALL-IN - hidden (not used in production mobile layout)
    _allInButton?.visible?.value = false;

    // Bet shortcuts (matches production style - title case)
    final showBetControls = isEnabled;
    final halfPot = (pot / 2).round().clamp(widget.minRaise, widget.maxRaise);
    final threeFourthPot = (pot * 3 / 4).round().clamp(widget.minRaise, widget.maxRaise);

    // Slot 1: All-in (top right)
    _betSize1?.visible?.value = showBetControls;
    _betSize1?.enabled?.value = isEnabled;
    _betSize1?.label?.value = 'All-in';
    _betSize1?.value?.value = '\$${widget.maxRaise}';

    // Slot 2: Pot
    _betSize2?.visible?.value = showBetControls;
    _betSize2?.enabled?.value = isEnabled;
    _betSize2?.label?.value = 'Pot';
    _betSize2?.value?.value = '\$$pot';

    // Slot 3: 3/4 Pot
    _betSize3?.visible?.value = showBetControls;
    _betSize3?.enabled?.value = isEnabled;
    _betSize3?.label?.value = '3/4';
    _betSize3?.value?.value = '\$$threeFourthPot';

    // Slot 4: Min (bottom right)
    _betSize4?.visible?.value = showBetControls;
    _betSize4?.enabled?.value = isEnabled;
    _betSize4?.label?.value = 'Min';
    _betSize4?.value?.value = '\$${widget.minRaise}';

    // Slider
    _sliderVisibleInput?.value = showBetControls;
    _updateSliderPosition();
    
    // Bet size input value (the "$value" text in the middle)
    _betSizeInputValue?.value = '\$$raiseAmount';

    // Advance to apply changes
    _controller?.advance(0);
    
    _isUpdatingState = false;  // Re-enable callbacks
  }

  void _updateSliderPosition() {
    final min = widget.minRaise;
    final max = widget.maxRaise;
    if (max > min) {
      final normalizedPos = ((widget.raiseAmount - min) / (max - min) * 100).clamp(0, 100);
      _sliderValue?.value = normalizedPos.toDouble();
    }
  }

  @override
  void didUpdateWidget(RiveActionButtons oldWidget) {
    super.didUpdateWidget(oldWidget);
    _updateButtonStates();
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return _buildLoading();
    }

    if (_errorMessage != null || _controller == null) {
      return _buildError();
    }

    // Artboard is 375x250
    final screenWidth = MediaQuery.of(context).size.width;
    final artboardWidth = _controller!.artboard.width;  // 375
    final artboardHeight = _controller!.artboard.height; // 250
    
    // Scale to fill width, calculate proportional height
    final scale = screenWidth / artboardWidth;
    final scaledHeight = artboardHeight * scale;
    
    // Transparent container - buttons float over the table
    return SizedBox(
      width: screenWidth,
      height: scaledHeight,
      child: Stack(
        children: [
          // Rive animation with transparent background
          RiveWidget(
            controller: _controller!,
            fit: Fit.contain,
            alignment: Alignment.center,
            hitTestBehavior: RiveHitTestBehavior.translucent,
          ),
          
          // Overlay controls for bet size (positioned based on artboard layout)
          if (widget.isEnabled) ...[
            // Up arrow tap area (increase bet)
            Positioned(
              left: screenWidth * 0.38,  // Approximate position
              top: scaledHeight * 0.08,
              width: screenWidth * 0.22,
              height: scaledHeight * 0.25,
              child: GestureDetector(
                onTap: _incrementBet,
                behavior: HitTestBehavior.translucent,
                child: Container(color: Colors.transparent),
              ),
            ),
            // Down arrow tap area (decrease bet)
            Positioned(
              left: screenWidth * 0.38,
              top: scaledHeight * 0.45,
              width: screenWidth * 0.22,
              height: scaledHeight * 0.25,
              child: GestureDetector(
                onTap: _decrementBet,
                behavior: HitTestBehavior.translucent,
                child: Container(color: Colors.transparent),
              ),
            ),
            // Numpad button tap area
            Positioned(
              left: screenWidth * 0.60,
              top: scaledHeight * 0.15,
              width: screenWidth * 0.12,
              height: scaledHeight * 0.40,
              child: GestureDetector(
                onTap: _showNumpadDialog,
                behavior: HitTestBehavior.translucent,
                child: Container(color: Colors.transparent),
              ),
            ),
          ],
        ],
      ),
    );
  }
  
  void _incrementBet() {
    final step = widget.pot > 100 ? 20 : 10; // Increment by BB or 10
    final newAmount = (widget.raiseAmount + step).clamp(widget.minRaise, widget.maxRaise);
    widget.onSliderChanged?.call(newAmount);
    debugPrint('Bet increased to \$$newAmount');
  }
  
  void _decrementBet() {
    final step = widget.pot > 100 ? 20 : 10;
    final newAmount = (widget.raiseAmount - step).clamp(widget.minRaise, widget.maxRaise);
    widget.onSliderChanged?.call(newAmount);
    debugPrint('Bet decreased to \$$newAmount');
  }
  
  void _showNumpadDialog() {
    final controller = TextEditingController(text: widget.raiseAmount.toString());
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A1A),
        title: const Text(
          'Enter Bet Amount',
          style: TextStyle(color: Colors.white),
        ),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          autofocus: true,
          style: const TextStyle(color: Colors.white, fontSize: 24),
          decoration: InputDecoration(
            prefixText: '\$ ',
            prefixStyle: const TextStyle(color: Colors.amber, fontSize: 24),
            hintText: '${widget.minRaise} - ${widget.maxRaise}',
            hintStyle: TextStyle(color: Colors.white.withOpacity(0.3)),
            enabledBorder: const UnderlineInputBorder(
              borderSide: BorderSide(color: Colors.amber),
            ),
            focusedBorder: const UnderlineInputBorder(
              borderSide: BorderSide(color: Colors.amber, width: 2),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('CANCEL', style: TextStyle(color: Colors.white54)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.amber),
            onPressed: () {
              final value = int.tryParse(controller.text) ?? widget.raiseAmount;
              final clampedValue = value.clamp(widget.minRaise, widget.maxRaise);
              widget.onSliderChanged?.call(clampedValue);
              Navigator.pop(context);
              debugPrint('Bet set to \$$clampedValue');
            },
            child: const Text('OK', style: TextStyle(color: Colors.black)),
          ),
        ],
      ),
    );
  }

  Widget _buildLoading() {
    final screenWidth = MediaQuery.of(context).size.width;
    return SizedBox(
      width: screenWidth,
      height: 180,
      child: const Center(
        child: CircularProgressIndicator(color: Colors.amber),
      ),
    );
  }

  Widget _buildError() {
    final screenWidth = MediaQuery.of(context).size.width;
    return SizedBox(
      width: screenWidth,
      height: 180,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, color: Colors.red, size: 32),
            const SizedBox(height: 8),
            Text(
              'Rive load failed',
              style: TextStyle(color: Colors.red.shade300, fontSize: 12),
            ),
            if (_errorMessage != null)
              Text(
                _errorMessage!,
                style: const TextStyle(color: Colors.white54, fontSize: 10),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
          ],
        ),
      ),
    );
  }
}

/// Helper class for Rive button bindings
class _RiveButton {
  final ViewModelInstanceBoolean? enabled;
  final ViewModelInstanceBoolean? visible;
  final ViewModelInstanceBoolean? selected;
  final ViewModelInstanceTrigger? clicked;
  final ViewModelInstanceString? label;
  final ViewModelInstanceString? value;

  _RiveButton({
    this.enabled,
    this.visible,
    this.selected,
    this.clicked,
    this.label,
    this.value,
  });
}
