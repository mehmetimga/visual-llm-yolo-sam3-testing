import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../models/poker_game_state.dart';
import '../../services/poker_ai_service.dart';
import '../../widgets/playing_card.dart';
import '../../widgets/rive_action_buttons.dart';

// ═══════════════════════════════════════════════════════════════════════════
// STYLING TOKENS
// ═══════════════════════════════════════════════════════════════════════════

class PokerTheme {
  // Colors
  static const feltGreen = Color(0xFF1B5E20);
  static const feltDark = Color(0xFF0D3B0F);
  static const feltLight = Color(0xFF2E7D32);
  static const railBrown = Color(0xFF5D4037);
  static const gold = Color(0xFFFFD700);
  static const goldDark = Color(0xFFFFA000);
  
  // Button colors
  static const foldRed = Color(0xFFD32F2F);
  static const checkBlue = Color(0xFF1976D2);
  static const callGreen = Color(0xFF388E3C);
  static const raiseOrange = Color(0xFFF57C00);
  static const allInPurple = Color(0xFF7B1FA2);
  
  // Opacities
  static const foldedOpacity = 0.5;
  
  // Shadows
  static final cardShadow = BoxShadow(
    color: Colors.black.withOpacity(0.4),
    blurRadius: 4,
    offset: const Offset(1, 2),
  );
  
  // Animation durations
  static const pulseMs = 1500;
  static const fadeMs = 300;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // LAYOUT CONSTANTS (Y anchors as fractions of table height)
  // ═══════════════════════════════════════════════════════════════════════════
  static const double topOpponentY = 0.02;      // Top player position
  static const double sideOpponentY = 0.22;     // Left/Right player position
  static const double boardAnchorY = 0.48;      // Community cards Y (moved down)
  static const double potAnchorY = 0.66;        // Pot + chips below board (moved down)
  static const double heroCardsAnchorY = 0.80;  // Hero cards
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════

class PokerTableScreen extends StatefulWidget {
  const PokerTableScreen({super.key});

  @override
  State<PokerTableScreen> createState() => _PokerTableScreenState();
}

class _PokerTableScreenState extends State<PokerTableScreen> 
    with TickerProviderStateMixin {
  late PokerTableState gameState;
  late PokerAIService aiService;
  bool isProcessingAI = false;
  int raiseAmount = 20;
  
  // Animations
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    gameState = PokerTableState.newGame();
    aiService = PokerAIService();
    
    _pulseController = AnimationController(
      duration: const Duration(milliseconds: PokerTheme.pulseMs),
      vsync: this,
    )..repeat(reverse: true);
    
    _pulseAnimation = Tween<double>(begin: 0.6, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GAME LOGIC
  // ═══════════════════════════════════════════════════════════════════════════

  void _startNewHand() {
    print('');
    print('═══════════════════════════════════════');
    print('🃏 NEW HAND STARTING');
    print('═══════════════════════════════════════');
    setState(() {
      gameState.startNewHand();
    });
    print('   Dealer: ${gameState.players[gameState.dealerIndex].name}');
    print('   Your cards: ${gameState.players[0].hand}');
    print('');
    _processAITurnsIfNeeded();
  }

  Future<void> _processAITurnsIfNeeded() async {
    while (gameState.phase != TablePhase.waiting &&
           gameState.phase != TablePhase.finished &&
           !gameState.currentPlayer.isHuman) {
      
      if (isProcessingAI) return;
      isProcessingAI = true;

      final aiPlayer = gameState.currentPlayer;
      
      setState(() {
        aiPlayer.thinkingMessage = '🤔 Thinking...';
      });

      await Future.delayed(const Duration(milliseconds: 800));

      final stateForAI = gameState.getStateForAI(aiPlayer);
      final decision = await aiService.getDecision(aiPlayer, stateForAI);

      setState(() {
        aiPlayer.thinkingMessage = decision.thinkingMessage;
      });

      await Future.delayed(const Duration(milliseconds: 600));

      setState(() {
        gameState.executeAction(decision.action, raiseAmount: decision.raiseAmount);
        isProcessingAI = false;
      });
      
      _logPhaseIfChanged();
      await Future.delayed(const Duration(milliseconds: 400));
    }
  }

  void _executeHumanAction(PlayerAction action, {int? raise}) {
    print('');
    print('👤 YOU: ${action.name.toUpperCase()}${raise != null ? " \$$raise" : ""}');
    setState(() {
      gameState.executeAction(action, raiseAmount: raise ?? raiseAmount);
    });
    _logPhaseIfChanged();
    _processAITurnsIfNeeded();
  }

  String? _lastPhase;
  void _logPhaseIfChanged() {
    final currentPhase = gameState.phase.name;
    if (_lastPhase != currentPhase) {
      _lastPhase = currentPhase;
      if (gameState.phase == TablePhase.flop) {
        print('');
        print('📍 FLOP: ${gameState.communityCards.take(3).toList()}');
      } else if (gameState.phase == TablePhase.turn) {
        print('📍 TURN: ${gameState.communityCards[3]}');
      } else if (gameState.phase == TablePhase.river) {
        print('📍 RIVER: ${gameState.communityCards[4]}');
      } else if (gameState.phase == TablePhase.showdown || gameState.phase == TablePhase.finished) {
        print('');
        print('🏆 ${gameState.winnerMessage ?? "Hand complete"}');
        print('═══════════════════════════════════════');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UI STATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════
  
  bool get _isHandComplete => gameState.phase == TablePhase.finished;
  bool get _isWaitingToStart => gameState.phase == TablePhase.waiting;
  bool get _isShowdown => gameState.phase == TablePhase.showdown || _isHandComplete;

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD
  // ═══════════════════════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: PokerTheme.feltDark,
      body: SafeArea(
        child: Column(
          children: [
            _buildMinimalHeader(),
            Expanded(child: _buildPokerTable()),
            _buildBottomPanel(),
          ],
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MINIMAL HEADER (no pot - pot moved to table center)
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildMinimalHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back_ios, color: Colors.white54, size: 20),
            onPressed: () => Navigator.pop(context),
          ),
          const Spacer(),
          // Table name/level indicator only
          Text(
            'TEXAS HOLD\'EM',
            style: TextStyle(
              color: Colors.white.withOpacity(0.6),
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.5,
            ),
          ),
          const Spacer(),
          const SizedBox(width: 48),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POKER TABLE
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildPokerTable() {
    return LayoutBuilder(
      builder: (context, constraints) {
        final tableWidth = constraints.maxWidth * 0.96;
        final tableHeight = constraints.maxHeight * 0.95;
        
        return Stack(
          alignment: Alignment.center,
          children: [
            // Table felt
            _buildTableFelt(tableWidth, tableHeight),
            
            // === PLAYERS (always full opacity - no blur/dim during reveal) ===
            
            // Top player (Alex)
            Positioned(
              top: tableHeight * PokerTheme.topOpponentY,
              child: _buildOpponentSeat(gameState.players[1]),
            ),
            // Left player (Beth)
            Positioned(
              left: 8,
              top: tableHeight * PokerTheme.sideOpponentY,
              child: _buildOpponentSeat(gameState.players[2]),
            ),
            // Right player (Carl)
            Positioned(
              right: 8,
              top: tableHeight * PokerTheme.sideOpponentY,
              child: _buildOpponentSeat(gameState.players[3]),
            ),
            
            // === COMMUNITY CARDS ===
            Positioned(
              top: tableHeight * PokerTheme.boardAnchorY,
              child: _buildCommunityCards(),
            ),
            
            // === POT (centered below community cards) ===
            Positioned(
              top: tableHeight * PokerTheme.potAnchorY,
              child: _buildCenteredPot(),
            ),

            // === HERO SEAT ===
            Positioned(
              top: tableHeight * PokerTheme.heroCardsAnchorY,
              child: _buildHeroSeat(),
            ),

            // === DEAL BUTTON (only when waiting) ===
            if (_isWaitingToStart)
              Positioned(
                top: tableHeight * 0.50,
                child: _buildDealButton(),
              ),

            // === WINNER BANNER (between player cards and table cards) ===
            if (gameState.winnerMessage != null && _isHandComplete)
              Positioned(
                top: tableHeight * 0.41,  // Just above community cards
                left: 20,
                right: 20,
                child: _buildWinnerBanner(),
              ),
          ],
        );
      },
    );
  }

  Widget _buildTableFelt(double width, double height) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(height / 2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.6),
            blurRadius: 30,
            spreadRadius: 5,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(height / 2),
        child: CustomPaint(
          painter: _FeltPainter(),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(height / 2),
              border: Border.all(color: PokerTheme.railBrown, width: 8),
            ),
            child: Container(
              margin: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular((height / 2) - 8),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.25),
                    blurRadius: 12,
                    spreadRadius: -4,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMUNITY CARDS (5 fixed slots)
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildCommunityCards() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(5, (index) {
          final hasCard = index < gameState.communityCards.length;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 3),
            child: hasCard
                ? _buildRevealedCard(gameState.communityCards[index])
                : _buildEmptySlot(),
          );
        }),
      ),
    );
  }

  /// Card with subtle glow highlight during reveal (no global blur)
  Widget _buildRevealedCard(PlayingCard card) {
    final isRevealing = _isShowdown;
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(6),
        boxShadow: [
          PokerTheme.cardShadow,
          if (isRevealing)
            BoxShadow(
              color: PokerTheme.gold.withOpacity(0.15),
              blurRadius: 6,
              spreadRadius: 1,
            ),
        ],
      ),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: Colors.white.withOpacity(0.15),
            width: 0.5,
          ),
        ),
        child: PlayingCardWidget(card: card, width: 60, height: 87), // Same as hero
      ),
    );
  }

  Widget _buildEmptySlot() {
    return Container(
      width: 60,
      height: 87,
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.08),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: Colors.white.withOpacity(0.06),
          width: 1,
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CENTERED POT (below community cards)
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildCenteredPot() {
    if (gameState.pot == 0) return const SizedBox.shrink();
    
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Chip stack visual
        _buildChipStack(),
        const SizedBox(height: 4),
        // Pot amount with glow
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [PokerTheme.gold, PokerTheme.goldDark],
            ),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: PokerTheme.gold.withOpacity(0.35),
                blurRadius: 10,
                spreadRadius: 1,
              ),
            ],
          ),
          child: Text(
            '\$${gameState.pot}',
            style: const TextStyle(
              color: Colors.black,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildChipStack() {
    return SizedBox(
      width: 50,
      height: 36,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Positioned(
            bottom: 0,
            child: _buildPokerChip(Colors.red.shade700, 28),
          ),
          Positioned(
            bottom: 6,
            left: 2,
            child: _buildPokerChip(Colors.blue.shade700, 28),
          ),
          Positioned(
            bottom: 12,
            right: 2,
            child: _buildPokerChip(Colors.green.shade700, 28),
          ),
        ],
      ),
    );
  }

  Widget _buildPokerChip(Color color, double size) {
    return CustomPaint(
      size: Size(size, size),
      painter: _PokerChipPainter(color),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OPPONENT SEATS (no opacity change during reveal - always readable)
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildOpponentSeat(PokerPlayer player) {
    final isActive = player.isCurrentTurn;
    final isFolded = player.hasFolded;
    final showCards = _isShowdown;

    // NO global opacity - keep player info always readable
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Name badge - ALWAYS fully visible and readable
        _buildPlayerBadge(player, isActive, isFolded),
        
        const SizedBox(height: 5),
        
        // Cards (bigger size, only cards get dimmed if folded)
        if (player.hand.isNotEmpty)
          _buildOpponentCards(player, showCards, isFolded),

        // Status indicators
        if (isFolded)
          _buildFoldLabel()
        else if (player.currentBet > 0)
          _buildBetChip(player.currentBet),

        // Thinking bubble
        if (player.thinkingMessage != null && !isFolded)
          _buildThinkingBubble(player.thinkingMessage!),
      ],
    );
  }

  Widget _buildPlayerBadge(PokerPlayer player, bool isActive, [bool isFolded = false]) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: isActive 
            ? PokerTheme.gold 
            : Colors.black.withOpacity(isFolded ? 0.6 : 0.8),
        borderRadius: BorderRadius.circular(14),
        border: isActive 
            ? Border.all(color: Colors.white.withOpacity(0.4), width: 1)
            : null,
        boxShadow: isActive ? [
          BoxShadow(color: PokerTheme.gold.withOpacity(0.4), blurRadius: 8),
        ] : null,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(player.avatar, style: const TextStyle(fontSize: 14)),
          const SizedBox(width: 5),
          Text(
            player.name,
            style: TextStyle(
              color: isActive ? Colors.black : (isFolded ? Colors.white60 : Colors.white),
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
          if (player.isDealer) ...[
            const SizedBox(width: 5),
            _buildDealerChip(isActive),
          ],
          const SizedBox(width: 8),
          Text(
            '\$${player.chips}',
            style: TextStyle(
              color: isActive ? Colors.green.shade800 : (isFolded ? const Color(0xFF66BB6A) : const Color(0xFF81C784)),
              fontWeight: FontWeight.bold,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOpponentCards(PokerPlayer player, bool showCards, bool isFolded) {
    final isRevealed = showCards || isFolded;
    
    return Opacity(
      opacity: isFolded ? 0.6 : 1.0,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: player.hand.map((card) {
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2),
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(6),
                boxShadow: [
                  PokerTheme.cardShadow,
                  if (isRevealed && !isFolded)
                    BoxShadow(
                      color: PokerTheme.gold.withOpacity(0.15),
                      blurRadius: 4,
                    ),
                ],
              ),
              child: PlayingCardWidget(
                card: card,
                faceDown: !showCards && !isFolded,
                width: 60,  // Same as hero
                height: 87, // Same as hero
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildDealerChip(bool isActive) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
      decoration: BoxDecoration(
        color: isActive ? Colors.black : PokerTheme.gold,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        'D',
        style: TextStyle(
          color: isActive ? PokerTheme.gold : Colors.black,
          fontSize: 8,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildFoldLabel() {
    return const Padding(
      padding: EdgeInsets.only(top: 3),
      child: Text(
        'FOLD',
        style: TextStyle(
          color: Colors.red,
          fontSize: 8,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildBetChip(int amount) {
    return Padding(
      padding: const EdgeInsets.only(top: 3),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [Colors.amber.shade600, Colors.amber.shade800],
          ),
          borderRadius: BorderRadius.circular(8),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.3),
              blurRadius: 2,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        child: Text(
          '\$$amount',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 9,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  Widget _buildThinkingBubble(String message) {
    return Container(
      margin: const EdgeInsets.only(top: 4),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      constraints: const BoxConstraints(maxWidth: 100),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 4),
        ],
      ),
      child: Text(
        message,
        style: const TextStyle(color: Colors.black87, fontSize: 9),
        textAlign: TextAlign.center,
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HERO SEAT
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildHeroSeat() {
    final player = gameState.players[0];
    final isActive = player.isCurrentTurn;

    return AnimatedBuilder(
      animation: _pulseAnimation,
      builder: (context, child) {
        return Container(
          padding: const EdgeInsets.all(6),
          decoration: isActive ? BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                color: PokerTheme.gold.withOpacity(0.25 * _pulseAnimation.value),
                blurRadius: 20,
                spreadRadius: 3,
              ),
            ],
          ) : null,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Hero cards (bigger)
              if (player.hand.isNotEmpty)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: player.hand.map((card) => Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 3),
                    child: Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: Colors.white.withOpacity(0.2),
                          width: 1,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.5),
                            blurRadius: 8,
                            offset: const Offset(2, 4),
                          ),
                        ],
                      ),
                      child: PlayingCardWidget(card: card, width: 60, height: 87), // Bigger
                    ),
                  )).toList(),
                ),
              
              const SizedBox(height: 6),

              // Hero info bar
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  gradient: isActive 
                      ? const LinearGradient(colors: [PokerTheme.gold, PokerTheme.goldDark])
                      : null,
                  color: isActive ? null : Colors.black.withOpacity(0.75),
                  borderRadius: BorderRadius.circular(18),
                  border: isActive ? null : Border.all(
                    color: PokerTheme.gold.withOpacity(0.4),
                    width: 1,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '👤 YOU',
                      style: TextStyle(
                        color: isActive ? Colors.black : PokerTheme.gold,
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                      ),
                    ),
                    if (player.isDealer) ...[
                      const SizedBox(width: 5),
                      _buildDealerChip(isActive),
                    ],
                    const SizedBox(width: 8),
                    Text(
                      '\$${player.chips}',
                      style: TextStyle(
                        color: isActive ? Colors.green.shade800 : const Color(0xFF81C784),
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                    if (player.currentBet > 0) ...[
                      const SizedBox(width: 6),
                      _buildBetChip(player.currentBet),
                    ],
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEAL BUTTON & WINNER BANNER
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildDealButton() {
    return ElevatedButton(
      onPressed: _startNewHand,
      style: ElevatedButton.styleFrom(
        backgroundColor: PokerTheme.gold,
        foregroundColor: Colors.black,
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
        elevation: 8,
        shadowColor: PokerTheme.gold.withOpacity(0.5),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
      child: const Text(
        'DEAL',
        style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, letterSpacing: 1.5),
      ),
    );
  }

  Widget _buildWinnerBanner() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.9),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: PokerTheme.gold, width: 2),
        boxShadow: [
          BoxShadow(
            color: PokerTheme.gold.withOpacity(0.25),
            blurRadius: 12,
          ),
        ],
      ),
      child: Text(
        gameState.winnerMessage!,
        textAlign: TextAlign.center,
        style: const TextStyle(
          color: PokerTheme.gold,
          fontSize: 13,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOTTOM PANEL (Action buttons OR "Deal Again" CTA)
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildBottomPanel() {
    // ISSUE 3: Show "Deal Again" when hand is complete
    if (_isHandComplete) {
      return _buildDealAgainPanel();
    }
    
    // Normal action panel during play
    return _buildActionPanel();
  }

  /// Issue 3: "DEAL AGAIN" CTA replaces action buttons after hand ends
  Widget _buildDealAgainPanel() {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF1C1C1C), Color(0xFF0F0F0F)],
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.5),
            blurRadius: 10,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SizedBox(
        width: double.infinity,
        child: ElevatedButton(
          onPressed: _startNewHand,
          style: ElevatedButton.styleFrom(
            backgroundColor: PokerTheme.gold,
            foregroundColor: Colors.black,
            padding: const EdgeInsets.symmetric(vertical: 16),
            elevation: 8,
            shadowColor: PokerTheme.gold.withOpacity(0.4),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          child: const Text(
            'DEAL AGAIN',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.5,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildActionPanel() {
    final canCheck = gameState.canCheck;
    final toCall = gameState.amountToCall;
    final playerChips = gameState.currentPlayer.chips;
    final isMyTurn = gameState.isHumanTurn;
    final pot = gameState.pot;
    final maxRaise = (playerChips - toCall).clamp(20, 500);

    // Use Rive animated buttons
    return RiveActionButtons(
      isEnabled: isMyTurn,
      canCheck: canCheck,
      callAmount: toCall,
      raiseAmount: raiseAmount,
      minRaise: 20,
      maxRaise: maxRaise,
      pot: pot,
      onFold: () => _executeHumanAction(PlayerAction.fold),
      onCheck: () => _executeHumanAction(PlayerAction.check),
      onCall: () => _executeHumanAction(PlayerAction.call),
      onRaise: (amount) => _executeHumanAction(PlayerAction.raise, raise: amount),
      onAllIn: () => _executeHumanAction(PlayerAction.allIn),
      onSliderChanged: (value) => setState(() => raiseAmount = value),
    );
  }

  // Keep original Flutter buttons as backup (can be toggled for A/B testing)
  Widget _buildActionPanelFlutter() {
    final canCheck = gameState.canCheck;
    final toCall = gameState.amountToCall;
    final playerChips = gameState.currentPlayer.chips;
    final isMyTurn = gameState.isHumanTurn;
    
    final pot = gameState.pot;
    final halfPot = (pot / 2).round();
    final maxRaise = (playerChips - toCall).clamp(20, 500);

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF1C1C1C), Color(0xFF0F0F0F)],
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.5),
            blurRadius: 10,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildBetSlider(isMyTurn, toCall, playerChips, halfPot, pot, maxRaise),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _actionBtn(
                  'FOLD',
                  PokerTheme.foldRed,
                  isMyTurn ? () => _executeHumanAction(PlayerAction.fold) : null,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: canCheck
                    ? _actionBtn(
                        'CHECK',
                        PokerTheme.checkBlue,
                        isMyTurn ? () => _executeHumanAction(PlayerAction.check) : null,
                      )
                    : _actionBtn(
                        'CALL \$$toCall',
                        PokerTheme.callGreen,
                        isMyTurn ? () => _executeHumanAction(PlayerAction.call) : null,
                      ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: AnimatedBuilder(
                  animation: _pulseAnimation,
                  builder: (context, child) {
                    return _actionBtn(
                      'RAISE',
                      PokerTheme.raiseOrange,
                      isMyTurn ? () => _executeHumanAction(PlayerAction.raise, raise: raiseAmount) : null,
                      isPulsing: isMyTurn,
                      pulseValue: _pulseAnimation.value,
                    );
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _actionBtn(
                  'ALL IN',
                  PokerTheme.allInPurple,
                  isMyTurn ? () => _executeHumanAction(PlayerAction.allIn) : null,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBetSlider(bool isMyTurn, int toCall, int chips, int halfPot, int pot, int maxRaise) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _sliderLabel('Min', 20, maxRaise),
              _sliderLabel('½ Pot', halfPot, maxRaise),
              _sliderLabel('Pot', pot, maxRaise),
              _sliderLabel('Max', maxRaise, maxRaise),
            ],
          ),
        ),
        const SizedBox(height: 2),
        Row(
          children: [
            Expanded(
              child: SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  trackHeight: 6,
                  activeTrackColor: const Color(0xFF66BB6A),
                  inactiveTrackColor: const Color(0xFF2A2A2A),
                  thumbColor: const Color(0xFF4CAF50),
                  thumbShape: const RoundSliderThumbShape(
                    enabledThumbRadius: 10,
                    elevation: 3,
                  ),
                  overlayColor: const Color(0xFF4CAF50).withOpacity(0.2),
                  overlayShape: const RoundSliderOverlayShape(overlayRadius: 18),
                ),
                child: Slider(
                  value: raiseAmount.toDouble().clamp(20, maxRaise.toDouble()),
                  min: 20,
                  max: maxRaise.toDouble(),
                  divisions: 24,
                  onChanged: isMyTurn 
                      ? (value) => setState(() => raiseAmount = value.toInt())
                      : null,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Container(
              width: 64,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF4CAF50), Color(0xFF388E3C)],
                ),
                borderRadius: BorderRadius.circular(8),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF4CAF50).withOpacity(0.3),
                    blurRadius: 4,
                  ),
                ],
              ),
              child: Text(
                '\$$raiseAmount',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _sliderLabel(String label, int value, int max) {
    final isActive = (raiseAmount - value).abs() < 15;
    return GestureDetector(
      onTap: () => setState(() => raiseAmount = value.clamp(20, max)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
        child: Text(
          label,
          style: TextStyle(
            color: isActive ? const Color(0xFF81C784) : Colors.white38,
            fontSize: 9,
            fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ),
    );
  }

  Widget _actionBtn(String label, Color color, VoidCallback? onPressed, {
    bool isPulsing = false,
    double pulseValue = 1.0,
  }) {
    final isEnabled = onPressed != null;
    
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        boxShadow: isEnabled ? [
          BoxShadow(
            color: color.withOpacity(isPulsing ? 0.35 * pulseValue : 0.25),
            blurRadius: isPulsing ? 8 * pulseValue : 4,
            offset: const Offset(0, 2),
          ),
        ] : null,
      ),
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: isEnabled ? color : color.withOpacity(0.2),
          foregroundColor: isEnabled ? Colors.white : Colors.white24,
          padding: const EdgeInsets.symmetric(vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          elevation: isEnabled ? 3 : 0,
        ),
        child: Text(
          label,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 10),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FELT PAINTER
// ═══════════════════════════════════════════════════════════════════════════

class _FeltPainter extends CustomPainter {
  final math.Random _random = math.Random(42);
  
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(0, 0, size.width, size.height);
    
    final gradient = RadialGradient(
      center: Alignment.center,
      radius: 0.8,
      colors: [
        PokerTheme.feltLight,
        PokerTheme.feltGreen,
        PokerTheme.feltDark,
      ],
      stops: const [0.0, 0.5, 1.0],
    );
    canvas.drawRect(rect, Paint()..shader = gradient.createShader(rect));
    
    final noisePaint = Paint()..color = Colors.black.withOpacity(0.03);
    for (int i = 0; i < 600; i++) {
      final x = _random.nextDouble() * size.width;
      final y = _random.nextDouble() * size.height;
      final r = _random.nextDouble() * 1.2;
      canvas.drawCircle(Offset(x, y), r, noisePaint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Realistic poker chip painter
class _PokerChipPainter extends CustomPainter {
  final Color color;
  
  _PokerChipPainter(this.color);
  
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    
    // Shadow
    canvas.drawCircle(
      center + const Offset(1, 2),
      radius,
      Paint()..color = Colors.black.withOpacity(0.4),
    );
    
    // Main chip body
    canvas.drawCircle(
      center,
      radius,
      Paint()..color = color,
    );
    
    // Outer white ring
    canvas.drawCircle(
      center,
      radius * 0.92,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = radius * 0.12,
    );
    
    // Edge stripes (casino chip style)
    final stripePaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = radius * 0.15
      ..strokeCap = StrokeCap.butt;
    
    for (int i = 0; i < 8; i++) {
      final angle = (i * math.pi / 4);
      final startX = center.dx + radius * 0.75 * math.cos(angle);
      final startY = center.dy + radius * 0.75 * math.sin(angle);
      final endX = center.dx + radius * 0.98 * math.cos(angle);
      final endY = center.dy + radius * 0.98 * math.sin(angle);
      canvas.drawLine(Offset(startX, startY), Offset(endX, endY), stripePaint);
    }
    
    // Inner circle
    canvas.drawCircle(
      center,
      radius * 0.55,
      Paint()..color = color.withOpacity(0.9),
    );
    
    // Inner ring
    canvas.drawCircle(
      center,
      radius * 0.5,
      Paint()
        ..color = Colors.white.withOpacity(0.8)
        ..style = PaintingStyle.stroke
        ..strokeWidth = radius * 0.08,
    );
    
    // Center highlight
    canvas.drawCircle(
      center - Offset(radius * 0.15, radius * 0.15),
      radius * 0.15,
      Paint()..color = Colors.white.withOpacity(0.3),
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => 
      oldDelegate is _PokerChipPainter && oldDelegate.color != color;
}
