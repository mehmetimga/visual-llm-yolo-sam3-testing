import 'poker_game_state.dart';

/// Debug state configuration for YOLO training data capture.
/// Used to force specific game states before entering the poker table.
class DebugState {
  final String name;
  final String description;
  final TablePhase? phase;
  final bool? canCheck;
  final int? currentBet;
  final int? communityCardCount;
  final int? potAmount;
  
  const DebugState({
    required this.name,
    this.description = '',
    this.phase,
    this.canCheck,
    this.currentBet,
    this.communityCardCount,
    this.potAmount,
  });
  
  /// Predefined debug states for YOLO training
  static const List<DebugState> trainingStates = [
    // CHECK button scenario - no bet to call
    DebugState(
      name: 'CHECK',
      description: 'Post-flop with no bet (CHECK visible)',
      phase: TablePhase.flop,
      canCheck: true,
      currentBet: 0,
      communityCardCount: 3,
      potAmount: 60,
    ),
    
    // CALL button scenario - bet to match
    DebugState(
      name: 'CALL',
      description: 'Pre-flop with bet to call (CALL visible)',
      phase: TablePhase.preFlop,
      canCheck: false,
      currentBet: 40,
      communityCardCount: 0,
      potAmount: 60,
    ),
    
    // DEAL button scenario - hand finished
    DebugState(
      name: 'DEAL',
      description: 'Hand finished (DEAL AGAIN visible)',
      phase: TablePhase.finished,
    ),
    
    // FLOP scenario
    DebugState(
      name: 'FLOP',
      description: 'Flop phase with 3 community cards',
      phase: TablePhase.flop,
      canCheck: true,
      currentBet: 0,
      communityCardCount: 3,
      potAmount: 80,
    ),
    
    // TURN scenario
    DebugState(
      name: 'TURN',
      description: 'Turn phase with 4 community cards',
      phase: TablePhase.turn,
      canCheck: true,
      currentBet: 0,
      communityCardCount: 4,
      potAmount: 120,
    ),
    
    // RIVER scenario
    DebugState(
      name: 'RIVER',
      description: 'River phase with 5 community cards',
      phase: TablePhase.river,
      canCheck: true,
      currentBet: 0,
      communityCardCount: 5,
      potAmount: 200,
    ),
    
    // RAISE scenario - already called, now raising
    DebugState(
      name: 'RAISE',
      description: 'After call, with raise slider visible',
      phase: TablePhase.flop,
      canCheck: false,
      currentBet: 20,
      communityCardCount: 3,
      potAmount: 100,
    ),
    
    // NORMAL game - no forced state
    DebugState(
      name: 'NORMAL',
      description: 'Normal random game (no forced state)',
      phase: null,
    ),
  ];
  
  @override
  String toString() => 'DebugState($name)';
}

