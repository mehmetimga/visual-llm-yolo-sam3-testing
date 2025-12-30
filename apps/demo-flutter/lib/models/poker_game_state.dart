import 'dart:math';
import '../widgets/playing_card.dart';
import '../utils/poker_hand_evaluator.dart';

/// Represents a player at the poker table
class PokerPlayer {
  final String id;
  final String name;
  final String avatar;
  final bool isHuman;
  final bool isAI;
  
  List<PlayingCard> hand;
  int chips;
  int currentBet;
  bool hasFolded;
  bool isAllIn;
  bool isDealer;
  bool isCurrentTurn;
  String? lastAction;
  String? thinkingMessage;
  String? personality; // AI personality trait
  
  PokerPlayer({
    required this.id,
    required this.name,
    required this.avatar,
    this.isHuman = false,
    this.isAI = false,
    this.chips = 1000,
    this.personality,
  })  : hand = [],
        currentBet = 0,
        hasFolded = false,
        isAllIn = false,
        isDealer = false,
        isCurrentTurn = false,
        lastAction = null,
        thinkingMessage = null;

  void reset() {
    hand = [];
    currentBet = 0;
    hasFolded = false;
    isAllIn = false;
    lastAction = null;
    thinkingMessage = null;
  }

  bool get isActive => !hasFolded && chips > 0;
  
  PokerPlayer copyWith({
    List<PlayingCard>? hand,
    int? chips,
    int? currentBet,
    bool? hasFolded,
    bool? isAllIn,
    bool? isDealer,
    bool? isCurrentTurn,
    String? lastAction,
    String? thinkingMessage,
  }) {
    final player = PokerPlayer(
      id: id,
      name: name,
      avatar: avatar,
      isHuman: isHuman,
      isAI: isAI,
      chips: chips ?? this.chips,
      personality: personality,
    );
    player.hand = hand ?? List.from(this.hand);
    player.currentBet = currentBet ?? this.currentBet;
    player.hasFolded = hasFolded ?? this.hasFolded;
    player.isAllIn = isAllIn ?? this.isAllIn;
    player.isDealer = isDealer ?? this.isDealer;
    player.isCurrentTurn = isCurrentTurn ?? this.isCurrentTurn;
    player.lastAction = lastAction ?? this.lastAction;
    player.thinkingMessage = thinkingMessage ?? this.thinkingMessage;
    return player;
  }
}

/// Game phases
enum TablePhase {
  waiting,    // Waiting to start
  preFlop,    // Before flop, initial betting
  flop,       // 3 community cards
  turn,       // 4th community card
  river,      // 5th community card
  showdown,   // Reveal hands
  finished,   // Hand complete
}

/// Player actions
enum PlayerAction {
  fold,
  check,
  call,
  raise,
  allIn,
}

/// AI decision result
class AIDecision {
  final PlayerAction action;
  final int raiseAmount;
  final String reasoning;
  final String thinkingMessage;

  AIDecision({
    required this.action,
    this.raiseAmount = 0,
    required this.reasoning,
    required this.thinkingMessage,
  });
}

/// Main game state for 4-player poker table
class PokerTableState {
  List<PokerPlayer> players;
  List<PlayingCard> communityCards;
  List<PlayingCard> deck;
  
  int pot;
  int currentBet;
  int smallBlind;
  int bigBlind;
  int dealerIndex;
  int currentPlayerIndex;
  
  TablePhase phase;
  List<String> actionLog;
  String? winnerMessage;
  
  PokerTableState({
    required this.players,
    this.smallBlind = 10,
    this.bigBlind = 20,
  })  : communityCards = [],
        deck = [],
        pot = 0,
        currentBet = 0,
        dealerIndex = 0,
        currentPlayerIndex = 0,
        phase = TablePhase.waiting,
        actionLog = [],
        winnerMessage = null;

  /// Create a new game with default players
  factory PokerTableState.newGame() {
    final players = [
      PokerPlayer(
        id: 'player',
        name: 'You',
        avatar: '👤',
        isHuman: true,
        chips: 1000,
      ),
      PokerPlayer(
        id: 'ai1',
        name: 'Alex',
        avatar: '🤖',
        isAI: true,
        chips: 1000,
        personality: 'aggressive',
      ),
      PokerPlayer(
        id: 'ai2',
        name: 'Beth',
        avatar: '🎭',
        isAI: true,
        chips: 1000,
        personality: 'conservative',
      ),
      PokerPlayer(
        id: 'ai3',
        name: 'Carl',
        avatar: '🎩',
        isAI: true,
        chips: 1000,
        personality: 'unpredictable',
      ),
    ];
    
    return PokerTableState(players: players);
  }

  /// Start a new hand
  void startNewHand() {
    // Reset all players
    for (final player in players) {
      player.reset();
    }
    
    // Create and shuffle deck
    deck = createStandardDeck();
    communityCards = [];
    pot = 0;
    currentBet = bigBlind;
    winnerMessage = null;
    actionLog = [];
    
    // Move dealer button
    dealerIndex = (dealerIndex + 1) % players.length;
    _updateDealerButton();
    
    // Post blinds
    final sbIndex = (dealerIndex + 1) % players.length;
    final bbIndex = (dealerIndex + 2) % players.length;
    
    _postBlind(players[sbIndex], smallBlind, 'Small Blind');
    _postBlind(players[bbIndex], bigBlind, 'Big Blind');
    
    // Deal cards
    for (final player in players) {
      player.hand = [deck.removeLast(), deck.removeLast()];
    }
    
    // First to act is after big blind
    currentPlayerIndex = (bbIndex + 1) % players.length;
    _updateCurrentPlayer();
    
    phase = TablePhase.preFlop;
    _addLog('🃏 Cards dealt! Pre-flop betting begins.');
  }

  void _updateDealerButton() {
    for (int i = 0; i < players.length; i++) {
      players[i].isDealer = (i == dealerIndex);
    }
  }

  void _updateCurrentPlayer() {
    for (int i = 0; i < players.length; i++) {
      players[i].isCurrentTurn = (i == currentPlayerIndex);
    }
  }

  void _postBlind(PokerPlayer player, int amount, String type) {
    final actualAmount = min(amount, player.chips);
    player.chips -= actualAmount;
    player.currentBet = actualAmount;
    pot += actualAmount;
    _addLog('${player.avatar} ${player.name} posts $type: \$$actualAmount');
  }

  void _addLog(String message) {
    actionLog.add(message);
    if (actionLog.length > 20) {
      actionLog.removeAt(0);
    }
  }

  /// Get the current player
  PokerPlayer get currentPlayer => players[currentPlayerIndex];

  /// Check if it's human's turn
  bool get isHumanTurn => currentPlayer.isHuman && phase != TablePhase.waiting && phase != TablePhase.showdown && phase != TablePhase.finished;

  /// Get active players (not folded)
  List<PokerPlayer> get activePlayers => players.where((p) => p.isActive).toList();

  /// Amount needed to call
  int get amountToCall => currentBet - currentPlayer.currentBet;

  /// Can the current player check?
  bool get canCheck => currentPlayer.currentBet >= currentBet;

  /// Execute a player action
  void executeAction(PlayerAction action, {int raiseAmount = 0}) {
    final player = currentPlayer;
    
    switch (action) {
      case PlayerAction.fold:
        player.hasFolded = true;
        player.lastAction = 'Fold';
        _addLog('${player.avatar} ${player.name} folds');
        break;
        
      case PlayerAction.check:
        player.lastAction = 'Check';
        _addLog('${player.avatar} ${player.name} checks');
        break;
        
      case PlayerAction.call:
        final callAmount = min(amountToCall, player.chips);
        player.chips -= callAmount;
        player.currentBet += callAmount;
        pot += callAmount;
        player.lastAction = 'Call \$$callAmount';
        _addLog('${player.avatar} ${player.name} calls \$$callAmount');
        if (player.chips == 0) player.isAllIn = true;
        break;
        
      case PlayerAction.raise:
        final totalRaise = amountToCall + raiseAmount;
        final actualRaise = min(totalRaise, player.chips);
        player.chips -= actualRaise;
        player.currentBet += actualRaise;
        pot += actualRaise;
        currentBet = player.currentBet;
        player.lastAction = 'Raise \$$raiseAmount';
        _addLog('${player.avatar} ${player.name} raises to \$${player.currentBet}');
        if (player.chips == 0) player.isAllIn = true;
        break;
        
      case PlayerAction.allIn:
        final allInAmount = player.chips;
        pot += allInAmount;
        player.currentBet += allInAmount;
        if (player.currentBet > currentBet) {
          currentBet = player.currentBet;
        }
        player.chips = 0;
        player.isAllIn = true;
        player.lastAction = 'All-In!';
        _addLog('${player.avatar} ${player.name} goes ALL-IN for \$$allInAmount!');
        break;
    }
    
    player.thinkingMessage = null;
    _moveToNextPlayer();
  }

  void _moveToNextPlayer() {
    // Check if only one player left
    if (activePlayers.length == 1) {
      _endHandWithWinner(activePlayers.first);
      return;
    }

    // Find next active player
    int nextIndex = (currentPlayerIndex + 1) % players.length;
    int startIndex = nextIndex;
    
    while (!players[nextIndex].isActive || players[nextIndex].isAllIn) {
      nextIndex = (nextIndex + 1) % players.length;
      if (nextIndex == startIndex) {
        // All players all-in or only one active
        _advanceToShowdown();
        return;
      }
    }

    // Check if betting round is complete
    if (_isBettingRoundComplete()) {
      _advancePhase();
    } else {
      currentPlayerIndex = nextIndex;
      _updateCurrentPlayer();
    }
  }

  bool _isBettingRoundComplete() {
    // All active players must have matched the current bet (or be all-in)
    for (final player in activePlayers) {
      if (!player.isAllIn && player.currentBet < currentBet) {
        return false;
      }
    }
    
    // Everyone has acted at least once after the last raise
    // For simplicity, check if we've gone around once
    return true;
  }

  void _advancePhase() {
    // Reset bets for new round
    for (final player in players) {
      player.currentBet = 0;
    }
    currentBet = 0;
    
    switch (phase) {
      case TablePhase.preFlop:
        // Deal flop
        deck.removeLast(); // Burn card
        communityCards.add(deck.removeLast());
        communityCards.add(deck.removeLast());
        communityCards.add(deck.removeLast());
        phase = TablePhase.flop;
        _addLog('🃏 Flop: ${_cardsToString(communityCards)}');
        break;
        
      case TablePhase.flop:
        // Deal turn
        deck.removeLast(); // Burn card
        communityCards.add(deck.removeLast());
        phase = TablePhase.turn;
        _addLog('🃏 Turn: ${communityCards.last}');
        break;
        
      case TablePhase.turn:
        // Deal river
        deck.removeLast(); // Burn card
        communityCards.add(deck.removeLast());
        phase = TablePhase.river;
        _addLog('🃏 River: ${communityCards.last}');
        break;
        
      case TablePhase.river:
        _showdown();
        return;
        
      default:
        break;
    }
    
    // First to act is first active player after dealer
    currentPlayerIndex = (dealerIndex + 1) % players.length;
    while (!players[currentPlayerIndex].isActive) {
      currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    }
    _updateCurrentPlayer();
  }

  void _advanceToShowdown() {
    // Deal remaining community cards
    while (communityCards.length < 5) {
      deck.removeLast(); // Burn
      communityCards.add(deck.removeLast());
    }
    _showdown();
  }

  void _showdown() {
    phase = TablePhase.showdown;
    _addLog('🎯 Showdown!');
    
    // Evaluate all active hands
    PokerPlayer? winner;
    HandEvaluation? bestHand;
    
    for (final player in activePlayers) {
      final allCards = [...player.hand, ...communityCards];
      final eval = PokerHandEvaluator.evaluate(allCards);
      
      _addLog('${player.avatar} ${player.name}: ${eval.description}');
      
      if (bestHand == null || eval.compareTo(bestHand) > 0) {
        bestHand = eval;
        winner = player;
      }
    }
    
    if (winner != null && bestHand != null) {
      _endHandWithWinner(winner, bestHand);
    }
  }

  void _endHandWithWinner(PokerPlayer winner, [HandEvaluation? hand]) {
    winner.chips += pot;
    
    final handStr = hand != null ? ' with ${hand.description}' : '';
    winnerMessage = '${winner.avatar} ${winner.name} wins \$$pot$handStr!';
    _addLog('🏆 $winnerMessage');
    
    phase = TablePhase.finished;
  }

  String _cardsToString(List<PlayingCard> cards) {
    return cards.map((c) => c.toString()).join(' ');
  }

  /// Get game state summary for AI
  Map<String, dynamic> getStateForAI(PokerPlayer aiPlayer) {
    return {
      'phase': phase.name,
      'pot': pot,
      'currentBet': currentBet,
      'yourChips': aiPlayer.chips,
      'yourBet': aiPlayer.currentBet,
      'amountToCall': currentBet - aiPlayer.currentBet,
      'yourHand': aiPlayer.hand.map((c) => c.toString()).toList(),
      'communityCards': communityCards.map((c) => c.toString()).toList(),
      'activePlayers': activePlayers.length,
      'personality': aiPlayer.personality,
      'opponents': players
          .where((p) => p.id != aiPlayer.id && p.isActive)
          .map((p) => {
            'name': p.name,
            'chips': p.chips,
            'bet': p.currentBet,
            'lastAction': p.lastAction,
          })
          .toList(),
    };
  }
}

