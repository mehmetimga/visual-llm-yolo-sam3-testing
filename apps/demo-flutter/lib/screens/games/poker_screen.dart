import 'dart:math';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/playing_card.dart';
import '../../utils/poker_hand_evaluator.dart';

enum PokerPhase { betting, preFlop, flop, turn, river, showdown, ended }

class PokerScreen extends StatefulWidget {
  const PokerScreen({super.key});

  @override
  State<PokerScreen> createState() => _PokerScreenState();
}

class _PokerScreenState extends State<PokerScreen> with TickerProviderStateMixin {
  List<PlayingCard> deck = [];
  List<PlayingCard> playerHand = [];
  List<PlayingCard> dealerHand = [];
  List<PlayingCard> communityCards = [];
  
  PokerPhase phase = PokerPhase.betting;
  int pot = 0;
  int playerBet = 0;
  int dealerBet = 0;
  int currentBet = 25;
  int minBet = 25;
  String message = 'Place your bet to start!';
  String? winnerMessage;
  bool showDealerCards = false;
  
  late AnimationController _dealAnimController;
  
  @override
  void initState() {
    super.initState();
    deck = createStandardDeck();
    _dealAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
  }

  @override
  void dispose() {
    _dealAnimController.dispose();
    super.dispose();
  }

  void startNewHand() {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.balance < currentBet * 2) {
      setState(() {
        message = 'Insufficient balance!';
      });
      return;
    }

    deck = createStandardDeck();
    
    // Blinds
    playerBet = currentBet;
    dealerBet = currentBet;
    pot = currentBet * 2;
    auth.updateBalance(-currentBet);

    setState(() {
      playerHand = [deck.removeLast(), deck.removeLast()];
      dealerHand = [deck.removeLast(), deck.removeLast()];
      communityCards = [];
      phase = PokerPhase.preFlop;
      showDealerCards = false;
      winnerMessage = null;
      message = 'Pre-Flop: Check, Raise, or Fold?';
    });
  }

  void playerCheck() {
    if (phase == PokerPhase.ended || phase == PokerPhase.betting) return;
    
    // Dealer's turn (simple AI)
    _dealerAction();
    _advancePhase();
  }

  void playerRaise() {
    if (phase == PokerPhase.ended || phase == PokerPhase.betting) return;
    
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.balance < minBet) {
      setState(() {
        message = 'Insufficient balance to raise!';
      });
      return;
    }

    auth.updateBalance(-minBet);
    playerBet += minBet;
    pot += minBet;

    // Dealer responds
    _dealerAction(playerRaised: true);
    _advancePhase();
  }

  void playerFold() {
    if (phase == PokerPhase.ended || phase == PokerPhase.betting) return;
    
    setState(() {
      phase = PokerPhase.ended;
      winnerMessage = 'You folded. Dealer wins!';
      message = 'Tap to play again';
    });
    
    _resetAfterDelay();
  }

  void _dealerAction({bool playerRaised = false}) {
    final random = Random();
    
    // Simple AI logic
    bool shouldRaise = false;
    
    if (dealerHand.length >= 2) {
      // Check dealer's hole cards strength
      final card1Value = _getCardStrength(dealerHand[0]);
      final card2Value = _getCardStrength(dealerHand[1]);
      final isPair = dealerHand[0].value == dealerHand[1].value;
      final isSuited = dealerHand[0].suit == dealerHand[1].suit;
      
      // Raise with strong hands or occasionally bluff
      shouldRaise = isPair || 
                   (card1Value >= 10 && card2Value >= 10) ||
                   (isSuited && card1Value >= 9) ||
                   random.nextDouble() < 0.1; // 10% bluff
    }

    if (playerRaised) {
      // Match the raise
      pot += minBet;
      dealerBet += minBet;
    }
    
    if (shouldRaise && !playerRaised && random.nextDouble() < 0.3) {
      // Dealer raises
      pot += minBet;
      dealerBet += minBet;
    }
  }

  int _getCardStrength(PlayingCard card) {
    switch (card.value) {
      case 'A': return 14;
      case 'K': return 13;
      case 'Q': return 12;
      case 'J': return 11;
      default: return int.tryParse(card.value) ?? 0;
    }
  }

  void _advancePhase() {
    setState(() {
      switch (phase) {
        case PokerPhase.preFlop:
          // Deal flop (3 cards)
          communityCards.addAll([
            deck.removeLast(),
            deck.removeLast(),
            deck.removeLast(),
          ]);
          phase = PokerPhase.flop;
          message = 'Flop: Check, Raise, or Fold?';
          break;
          
        case PokerPhase.flop:
          // Deal turn (1 card)
          communityCards.add(deck.removeLast());
          phase = PokerPhase.turn;
          message = 'Turn: Check, Raise, or Fold?';
          break;
          
        case PokerPhase.turn:
          // Deal river (1 card)
          communityCards.add(deck.removeLast());
          phase = PokerPhase.river;
          message = 'River: Check, Raise, or Fold?';
          break;
          
        case PokerPhase.river:
          // Showdown
          _showdown();
          break;
          
        default:
          break;
      }
    });
  }

  void _showdown() {
    setState(() {
      showDealerCards = true;
      phase = PokerPhase.showdown;
    });

    // Evaluate hands
    final allPlayerCards = [...playerHand, ...communityCards];
    final allDealerCards = [...dealerHand, ...communityCards];

    final playerEval = PokerHandEvaluator.evaluate(allPlayerCards);
    final dealerEval = PokerHandEvaluator.evaluate(allDealerCards);

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final comparison = playerEval.compareTo(dealerEval);

    setState(() {
      phase = PokerPhase.ended;
      
      if (comparison > 0) {
        // Player wins
        auth.updateBalance(pot);
        winnerMessage = 'You win \$$pot!';
        message = '${playerEval.description} beats ${dealerEval.description}';
      } else if (comparison < 0) {
        // Dealer wins
        winnerMessage = 'Dealer wins!';
        message = '${dealerEval.description} beats ${playerEval.description}';
      } else {
        // Tie - split pot
        final halfPot = pot ~/ 2;
        auth.updateBalance(halfPot);
        winnerMessage = 'Split pot! You get \$$halfPot';
        message = 'Both have ${playerEval.description}';
      }
    });

    _resetAfterDelay();
  }

  void _resetAfterDelay() {
    Future.delayed(const Duration(seconds: 4), () {
      if (mounted) {
        setState(() {
          phase = PokerPhase.betting;
          playerHand = [];
          dealerHand = [];
          communityCards = [];
          pot = 0;
          playerBet = 0;
          dealerBet = 0;
          showDealerCards = false;
          winnerMessage = null;
          message = 'Place your bet to start!';
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    
    return Scaffold(
      backgroundColor: const Color(0xFF0F4C3A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A3A2E),
        leading: IconButton(
          key: const Key('back_to_lobby_button'),
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'TEXAS HOLD\'EM',
          style: TextStyle(
            color: Color(0xFFFFD700),
            fontWeight: FontWeight.bold,
            letterSpacing: 2,
          ),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFF0A0A0F),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFFFD700).withOpacity(0.5)),
            ),
            child: Text(
              '\$${auth.balance}',
              style: const TextStyle(
                color: Color(0xFFFFD700),
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment.center,
            radius: 1.2,
            colors: [Color(0xFF1A6B52), Color(0xFF0F4C3A), Color(0xFF0A3A2E)],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              const SizedBox(height: 8),
              
              // Dealer section
              _buildDealerSection(),
              
              const SizedBox(height: 16),
              
              // Community cards
              _buildCommunityCards(),
              
              const SizedBox(height: 16),
              
              // Pot display
              _buildPotDisplay(),
              
              const Spacer(),
              
              // Player section
              _buildPlayerSection(),
              
              const SizedBox(height: 16),
              
              // Action buttons
              _buildActionButtons(),
              
              const SizedBox(height: 8),
              
              // Message
              _buildMessage(),
              
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDealerSection() {
    return Column(
      children: [
        const Text(
          'DEALER',
          style: TextStyle(
            color: Colors.white70,
            fontSize: 14,
            letterSpacing: 2,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (dealerHand.isEmpty)
              ...[
                const CardSlot(width: 50, height: 73),
                const SizedBox(width: 8),
                const CardSlot(width: 50, height: 73),
              ]
            else
              ...dealerHand.map((card) => Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: PlayingCardWidget(
                  card: card,
                  faceDown: !showDealerCards,
                  width: 50,
                  height: 73,
                ),
              )),
          ],
        ),
      ],
    );
  }

  Widget _buildCommunityCards() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.2),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFFD700).withOpacity(0.3)),
      ),
      child: Column(
        children: [
          const Text(
            'COMMUNITY CARDS',
            style: TextStyle(
              color: Colors.white70,
              fontSize: 12,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(5, (index) {
              if (index < communityCards.length) {
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2),
                  child: PlayingCardWidget(
                    card: communityCards[index],
                    width: 45,
                    height: 65,
                  ),
                );
              }
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: CardSlot(width: 45, height: 65),
              );
            }),
          ),
        ],
      ),
    );
  }

  Widget _buildPotDisplay() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFFD700), Color(0xFFFFAA00)],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFFD700).withOpacity(0.4),
            blurRadius: 12,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            '🏆',
            style: TextStyle(fontSize: 20),
          ),
          const SizedBox(width: 8),
          Text(
            'POT: \$$pot',
            style: const TextStyle(
              color: Colors.black,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlayerSection() {
    return Column(
      children: [
        const Text(
          'YOUR HAND',
          style: TextStyle(
            color: Colors.white70,
            fontSize: 14,
            letterSpacing: 2,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (playerHand.isEmpty)
              ...[
                const CardSlot(width: 70, height: 102),
                const SizedBox(width: 12),
                const CardSlot(width: 70, height: 102),
              ]
            else
              ...playerHand.map((card) => Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6),
                child: PlayingCardWidget(
                  card: card,
                  width: 70,
                  height: 102,
                ),
              )),
          ],
        ),
        if (playerHand.isNotEmpty && communityCards.length >= 3) ...[
          const SizedBox(height: 8),
          _buildHandPreview(),
        ],
      ],
    );
  }

  Widget _buildHandPreview() {
    try {
      final allCards = [...playerHand, ...communityCards];
      if (allCards.length >= 5) {
        final eval = PokerHandEvaluator.evaluate(allCards);
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.4),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            eval.description,
            style: const TextStyle(
              color: Color(0xFFFFD700),
              fontSize: 14,
              fontWeight: FontWeight.bold,
            ),
          ),
        );
      }
    } catch (_) {}
    return const SizedBox.shrink();
  }

  Widget _buildActionButtons() {
    final isPlayable = phase != PokerPhase.betting && phase != PokerPhase.ended;
    
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          if (phase == PokerPhase.betting || phase == PokerPhase.ended)
            _buildButton(
              'DEAL',
              const Color(0xFFFFD700),
              Colors.black,
              startNewHand,
              key: 'deal_button',
            )
          else ...[
            _buildButton(
              'FOLD',
              const Color(0xFFFF4444),
              Colors.white,
              isPlayable ? playerFold : null,
              key: 'fold_button',
            ),
            _buildButton(
              'CHECK',
              const Color(0xFF4CAF50),
              Colors.white,
              isPlayable ? playerCheck : null,
              key: 'check_button',
            ),
            _buildButton(
              'RAISE\n+\$$minBet',
              const Color(0xFF2196F3),
              Colors.white,
              isPlayable ? playerRaise : null,
              key: 'raise_button',
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildButton(
    String text,
    Color bgColor,
    Color textColor,
    VoidCallback? onPressed, {
    required String key,
  }) {
    return ElevatedButton(
      key: Key(key),
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: bgColor,
        foregroundColor: textColor,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        elevation: 4,
      ),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: const TextStyle(
          fontWeight: FontWeight.bold,
          fontSize: 14,
        ),
      ),
    );
  }

  Widget _buildMessage() {
    return Column(
      children: [
        if (winnerMessage != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            decoration: BoxDecoration(
              color: winnerMessage!.contains('win') 
                  ? const Color(0xFF4CAF50).withOpacity(0.2)
                  : const Color(0xFFFF4444).withOpacity(0.2),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: winnerMessage!.contains('win')
                    ? const Color(0xFF4CAF50)
                    : const Color(0xFFFF4444),
              ),
            ),
            child: Text(
              winnerMessage!,
              style: TextStyle(
                color: winnerMessage!.contains('win')
                    ? const Color(0xFF4CAF50)
                    : const Color(0xFFFF4444),
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        const SizedBox(height: 8),
        Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Colors.white70,
            fontSize: 14,
          ),
        ),
      ],
    );
  }
}

