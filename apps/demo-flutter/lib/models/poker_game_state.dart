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
  int lastRaiserIndex;  // Track who raised last to ensure everyone gets to respond
  int actionsThisRound; // Count actions in current betting round
  
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
        lastRaiserIndex = -1,
        actionsThisRound = 0,
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
    // Auto-refill chips for all players who are out
    for (final player in players) {
      if (player.chips <= 0) {
        player.chips = 1000;
        _addLog('${player.avatar} ${player.name} reloaded with \$1000');
      }
    }

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
    lastRaiserIndex = -1;
    actionsThisRound = 0;
    
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
    actionsThisRound++;
    
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
        // Reset action count when someone raises - everyone must respond
        lastRaiserIndex = currentPlayerIndex;
        actionsThisRound = 1;
        break;
        
      case PlayerAction.allIn:
        final allInAmount = player.chips;
        pot += allInAmount;
        player.currentBet += allInAmount;
        final wasRaise = player.currentBet > currentBet;
        if (wasRaise) {
          currentBet = player.currentBet;
          // Reset action count when someone raises - everyone must respond
          lastRaiserIndex = currentPlayerIndex;
          actionsThisRound = 1;
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

    // Check if betting round is complete:
    // 1. Everyone has matched the current bet
    // 2. Action is about to return to the last raiser (or everyone has checked)
    final allMatched = activePlayers.every((p) => p.isAllIn || p.currentBet >= currentBet);
    final returnsToRaiser = lastRaiserIndex >= 0 && nextIndex == lastRaiserIndex;
    final playersToAct = activePlayers.where((p) => !p.isAllIn).length;
    final everyoneChecked = lastRaiserIndex < 0 && actionsThisRound >= playersToAct;
    
    print('   🔄 Next: ${players[nextIndex].name}, allMatched=$allMatched, returnsToRaiser=$returnsToRaiser, everyoneChecked=$everyoneChecked');
    print('      lastRaiserIndex=$lastRaiserIndex (${lastRaiserIndex >= 0 ? players[lastRaiserIndex].name : "none"}), actionsThisRound=$actionsThisRound');
    
    if (allMatched && (returnsToRaiser || everyoneChecked)) {
      print('   ✅ Betting round complete! Advancing phase...');
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
        return false;  // Someone still needs to call
      }
    }
    
    // Count how many players can still act (not folded, not all-in)
    final playersWhoCanAct = activePlayers.where((p) => !p.isAllIn).length;
    
    // If only one player can act, round is complete (everyone else folded/all-in)
    if (playersWhoCanAct <= 1) {
      return true;
    }
    
    // If there was a raise, the round ends when action returns to the raiser
    // (everyone has had a chance to respond to the raise)
    if (lastRaiserIndex >= 0) {
      // Find next active player from last raiser
      int checkIndex = (lastRaiserIndex + 1) % players.length;
      while (checkIndex != lastRaiserIndex) {
        final p = players[checkIndex];
        if (p.isActive && !p.isAllIn && p.currentBet < currentBet) {
          return false;  // This player hasn't responded to the raise yet
        }
        checkIndex = (checkIndex + 1) % players.length;
      }
      // Everyone has responded to the raise
      return true;
    }
    
    // No raise yet - round completes when everyone has acted (checked or called)
    return actionsThisRound >= playersWhoCanAct;
  }

  void _advancePhase() {
    // Reset bets for new round
    for (final player in players) {
      player.currentBet = 0;
    }
    currentBet = 0;
    lastRaiserIndex = -1;
    actionsThisRound = 0;
    
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

