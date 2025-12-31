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
      _enterTrigger?.fire();
      debugPrint('RiveActionButtons: Enter trigger fired');

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

    // Setup click listeners with debounce protection
    _foldButton?.clicked?.addListener((_) => _handleClick('FOLD', () => widget.onFold?.call()));
    _checkButton?.clicked?.addListener((_) => _handleClick('CHECK', () => widget.onCheck?.call()));
    _callButton?.clicked?.addListener((_) => _handleClick('CALL', () => widget.onCall?.call()));
    _raiseButton?.clicked?.addListener((_) => _handleClick('RAISE', () => widget.onRaise?.call(widget.raiseAmount)));
    _betButton?.clicked?.addListener((_) => _handleClick('BET', () => widget.onRaise?.call(widget.raiseAmount)));
    _allInButton?.clicked?.addListener((_) => _handleClick('ALL-IN', () => widget.onAllIn?.call()));

    // Bet shortcuts click listeners
    _betSize1?.clicked?.addListener((_) {
      debugPrint('Bet Size 1 clicked');
      widget.onSliderChanged?.call(widget.minRaise);
    });
    _betSize2?.clicked?.addListener((_) {
      debugPrint('Bet Size 2 clicked');
      widget.onSliderChanged?.call((widget.pot / 2).round().clamp(widget.minRaise, widget.maxRaise));
    });
    _betSize3?.clicked?.addListener((_) {
      debugPrint('Bet Size 3 clicked');
      widget.onSliderChanged?.call(widget.pot.clamp(widget.minRaise, widget.maxRaise));
    });
    _betSize4?.clicked?.addListener((_) {
      debugPrint('Bet Size 4 clicked');
      widget.onSliderChanged?.call(widget.maxRaise);
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

  void _setupStateMachine() {
    final sm = _controller?.stateMachine;
    if (sm == null) return;

    for (final input in sm.inputs) {
      debugPrint('RiveActionButtons: SM Input: ${input.name} (${input.runtimeType})');
      if (input.name == 'Enter' && input is TriggerInput) {
        _enterTrigger = input;
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

    // FOLD - always visible
    _foldButton?.visible?.value = true;
    _foldButton?.enabled?.value = isEnabled;
    _foldButton?.label?.value = 'FOLD';

    // CHECK - visible when canCheck
    _checkButton?.visible?.value = canCheck;
    _checkButton?.enabled?.value = isEnabled && canCheck;
    _checkButton?.label?.value = 'CHECK';

    // CALL - visible when !canCheck
    _callButton?.visible?.value = !canCheck;
    _callButton?.enabled?.value = isEnabled && !canCheck;
    _callButton?.label?.value = 'CALL';
    _callButton?.value?.value = '\$$callAmount';

    // RAISE - visible when !canCheck
    _raiseButton?.visible?.value = !canCheck;
    _raiseButton?.enabled?.value = isEnabled && !canCheck;
    _raiseButton?.label?.value = 'RAISE';
    _raiseButton?.value?.value = '\$$raiseAmount';

    // BET - visible when canCheck
    _betButton?.visible?.value = canCheck;
    _betButton?.enabled?.value = isEnabled && canCheck;
    _betButton?.label?.value = 'BET';
    _betButton?.value?.value = '\$$raiseAmount';

    // ALL-IN - always visible
    _allInButton?.visible?.value = true;
    _allInButton?.enabled?.value = isEnabled;
    _allInButton?.label?.value = 'ALL IN';

    // Bet shortcuts
    final showBetControls = isEnabled;
    final halfPot = (pot / 2).round().clamp(widget.minRaise, widget.maxRaise);

    _betSize1?.visible?.value = showBetControls;
    _betSize1?.enabled?.value = isEnabled;
    _betSize1?.label?.value = 'MIN';
    _betSize1?.value?.value = '\$${widget.minRaise}';

    _betSize2?.visible?.value = showBetControls;
    _betSize2?.enabled?.value = isEnabled;
    _betSize2?.label?.value = '½ POT';
    _betSize2?.value?.value = '\$$halfPot';

    _betSize3?.visible?.value = showBetControls;
    _betSize3?.enabled?.value = isEnabled;
    _betSize3?.label?.value = 'POT';
    _betSize3?.value?.value = '\$$pot';

    _betSize4?.visible?.value = showBetControls;
    _betSize4?.enabled?.value = isEnabled;
    _betSize4?.label?.value = 'MAX';
    _betSize4?.value?.value = '\$${widget.maxRaise}';

    // Slider
    _sliderVisibleInput?.value = showBetControls;
    _updateSliderPosition();

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

    return Container(
      height: 180,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF1A1A1A), Color(0xFF0D0D0D)],
        ),
      ),
      child: RiveWidget(
        controller: _controller!,
        fit: Fit.contain,
        hitTestBehavior: RiveHitTestBehavior.translucent,
      ),
    );
  }

  Widget _buildLoading() {
    return Container(
      height: 180,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF1A1A1A), Color(0xFF0D0D0D)],
        ),
      ),
      child: const Center(
        child: CircularProgressIndicator(color: Colors.amber),
      ),
    );
  }

  Widget _buildError() {
    return Container(
      height: 180,
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF1A1A1A), Color(0xFF0D0D0D)],
        ),
      ),
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
