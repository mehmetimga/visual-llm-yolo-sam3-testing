import 'dart:async';
import 'package:flutter/material.dart';
import '../../models/poker_game_state.dart';
import '../../services/poker_ai_service.dart';
import '../../widgets/playing_card.dart';

class PokerTableScreen extends StatefulWidget {
  const PokerTableScreen({super.key});

  @override
  State<PokerTableScreen> createState() => _PokerTableScreenState();
}

class _PokerTableScreenState extends State<PokerTableScreen> {
  late PokerTableState gameState;
  late PokerAIService aiService;
  bool isProcessingAI = false;
  int raiseAmount = 20;

  @override
  void initState() {
    super.initState();
    gameState = PokerTableState.newGame();
    aiService = PokerAIService();
  }

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D3B0F),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(child: _buildPokerTable()),
            _buildActionButtons(), // Always show - prevents redraw jumping
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.white70, size: 22),
            onPressed: () => Navigator.pop(context),
          ),
          const Spacer(),
          // Pot display
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFFFD700), Color(0xFFFFA000)],
              ),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFFFD700).withOpacity(0.4),
                  blurRadius: 8,
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('🏆', style: TextStyle(fontSize: 16)),
                const SizedBox(width: 6),
                Text(
                  '\$${gameState.pot}',
                  style: const TextStyle(
                    color: Colors.black,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          const Spacer(),
          const SizedBox(width: 48),
        ],
      ),
    );
  }

  Widget _buildPokerTable() {
    return LayoutBuilder(
      builder: (context, constraints) {
        final tableWidth = constraints.maxWidth * 0.92;
        final tableHeight = constraints.maxHeight * 0.75;
        
        return Stack(
          alignment: Alignment.center,
          children: [
            // Poker table
            Container(
              width: tableWidth,
              height: tableHeight,
              decoration: BoxDecoration(
                gradient: const RadialGradient(
                  colors: [Color(0xFF2E7D32), Color(0xFF1B5E20), Color(0xFF0D3B0F)],
                  stops: [0.0, 0.7, 1.0],
                ),
                borderRadius: BorderRadius.circular(tableHeight / 2),
                border: Border.all(color: const Color(0xFF5D4037), width: 8),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.5),
                    blurRadius: 30,
                    spreadRadius: 5,
                  ),
                ],
              ),
            ),
            
            // Inner table edge
            Container(
              width: tableWidth - 24,
              height: tableHeight - 24,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular((tableHeight - 24) / 2),
                border: Border.all(
                  color: const Color(0xFF8D6E63).withOpacity(0.5),
                  width: 2,
                ),
              ),
            ),

            // Community cards - center (moved down)
            Positioned(
              top: tableHeight * 0.45,
              child: _buildCommunityCards(),
            ),

            // Top player (Alex)
            Positioned(
              top: 8,
              child: _buildCompactPlayer(gameState.players[1]),
            ),

            // Left player (Beth)
            Positioned(
              left: 8,
              top: tableHeight * 0.35,
              child: _buildCompactPlayer(gameState.players[2]),
            ),

            // Right player (Carl)
            Positioned(
              right: 8,
              top: tableHeight * 0.35,
              child: _buildCompactPlayer(gameState.players[3]),
            ),

            // Bottom player (You)
            Positioned(
              bottom: 8,
              child: _buildHumanPlayer(),
            ),

            // Start/New Hand button
            if (gameState.phase == TablePhase.waiting || gameState.phase == TablePhase.finished)
              _buildStartButton(),

            // Winner overlay
            if (gameState.winnerMessage != null && gameState.phase == TablePhase.finished)
              _buildWinnerOverlay(),
          ],
        );
      },
    );
  }

  Widget _buildCommunityCards() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        if (index < gameState.communityCards.length) {
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 3),
            child: PlayingCardWidget(
              card: gameState.communityCards[index],
              width: 48,
              height: 70,
            ),
          );
        }
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 3),
          child: Container(
            width: 48,
            height: 70,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.08),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: Colors.white.withOpacity(0.15)),
            ),
          ),
        );
      }),
    );
  }

  Widget _buildCompactPlayer(PokerPlayer player) {
    final isActive = player.isCurrentTurn;
    final showCards = gameState.phase == TablePhase.showdown || 
                      gameState.phase == TablePhase.finished;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Name & chips
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: isActive ? const Color(0xFFFFD700) : Colors.black54,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(player.avatar, style: const TextStyle(fontSize: 14)),
              const SizedBox(width: 4),
              Text(
                player.name,
                style: TextStyle(
                  color: isActive ? Colors.black : Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
              if (player.isDealer) ...[
                const SizedBox(width: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                  decoration: BoxDecoration(
                    color: isActive ? Colors.black : const Color(0xFFFFD700),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    'D',
                    style: TextStyle(
                      color: isActive ? const Color(0xFFFFD700) : Colors.black,
                      fontSize: 9,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
              const SizedBox(width: 6),
              Text(
                '\$${player.chips}',
                style: TextStyle(
                  color: isActive ? Colors.green.shade800 : const Color(0xFF4CAF50),
                  fontWeight: FontWeight.bold,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
        
        const SizedBox(height: 6),
        
        // Cards
        if (player.hand.isNotEmpty)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: player.hand.map((card) => Padding(
              padding: const EdgeInsets.symmetric(horizontal: 1),
              child: PlayingCardWidget(
                card: card,
                faceDown: !showCards && !player.hasFolded,
                width: 36,
                height: 52,
              ),
            )).toList(),
          ),

        // Status
        if (player.hasFolded)
          const Padding(
            padding: EdgeInsets.only(top: 4),
            child: Text('FOLD', style: TextStyle(color: Colors.red, fontSize: 10, fontWeight: FontWeight.bold)),
          )
        else if (player.currentBet > 0)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.amber.shade700,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '\$${player.currentBet}',
                style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
              ),
            ),
          ),

        // Thinking bubble
        if (player.thinkingMessage != null)
          Container(
            margin: const EdgeInsets.only(top: 4),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            constraints: const BoxConstraints(maxWidth: 120),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 4)],
            ),
            child: Text(
              player.thinkingMessage!,
              style: const TextStyle(color: Colors.black87, fontSize: 10),
              textAlign: TextAlign.center,
            ),
          ),
      ],
    );
  }

  Widget _buildHumanPlayer() {
    final player = gameState.players[0];
    final isActive = player.isCurrentTurn;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Cards
        if (player.hand.isNotEmpty)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: player.hand.map((card) => Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: PlayingCardWidget(
                card: card,
                width: 56,
                height: 82,
              ),
            )).toList(),
          ),
        
        const SizedBox(height: 6),

        // Name bar with chips
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          decoration: BoxDecoration(
            gradient: isActive 
                ? const LinearGradient(colors: [Color(0xFFFFD700), Color(0xFFFFA000)])
                : null,
            color: isActive ? null : Colors.black54,
            borderRadius: BorderRadius.circular(16),
            border: isActive ? null : Border.all(color: const Color(0xFFFFD700).withOpacity(0.5)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '👤 YOU',
                style: TextStyle(
                  color: isActive ? Colors.black : const Color(0xFFFFD700),
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                '\$${player.chips}',
                style: TextStyle(
                  color: isActive ? Colors.green.shade800 : const Color(0xFF4CAF50),
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
              if (player.currentBet > 0) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade700,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    'Bet: \$${player.currentBet}',
                    style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
              if (player.isDealer) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  decoration: BoxDecoration(
                    color: isActive ? Colors.black : const Color(0xFFFFD700),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    'D',
                    style: TextStyle(
                      color: isActive ? const Color(0xFFFFD700) : Colors.black,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStartButton() {
    return ElevatedButton(
      onPressed: _startNewHand,
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFFFFD700),
        foregroundColor: Colors.black,
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
        elevation: 8,
        shadowColor: const Color(0xFFFFD700).withOpacity(0.5),
      ),
      child: Text(
        gameState.phase == TablePhase.waiting ? 'DEAL' : 'NEW HAND',
        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 1),
      ),
    );
  }

  Widget _buildWinnerOverlay() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.85),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFFD700), width: 2),
      ),
      child: Text(
        gameState.winnerMessage!,
        textAlign: TextAlign.center,
        style: const TextStyle(
          color: Color(0xFFFFD700),
          fontSize: 15,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildActionButtons() {
    final canCheck = gameState.canCheck;
    final toCall = gameState.amountToCall;
    final playerChips = gameState.currentPlayer.chips;
    final isMyTurn = gameState.isHumanTurn;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF1A1A1A), Color(0xFF0A0A0A)],
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.5),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Raise slider with gradient track
          Row(
            children: [
              const Text('Raise', style: TextStyle(color: Colors.white38, fontSize: 11)),
              const SizedBox(width: 8),
              Expanded(
                child: SliderTheme(
                  data: SliderTheme.of(context).copyWith(
                    trackHeight: 6,
                    activeTrackColor: const Color(0xFF4CAF50),
                    inactiveTrackColor: const Color(0xFF2E2E2E),
                    thumbColor: const Color(0xFF66BB6A),
                    thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 10),
                    overlayColor: const Color(0xFF4CAF50).withOpacity(0.2),
                    overlayShape: const RoundSliderOverlayShape(overlayRadius: 18),
                  ),
                  child: Slider(
                    value: raiseAmount.toDouble(),
                    min: 20,
                    max: (playerChips - toCall).clamp(20, 500).toDouble(),
                    divisions: 24,
                    onChanged: isMyTurn ? (value) => setState(() => raiseAmount = value.toInt()) : null,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                width: 60,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF4CAF50), Color(0xFF388E3C)],
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '\$$raiseAmount',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ),
            ],
          ),
          
          const SizedBox(height: 12),
          
          // Action buttons - always visible, disabled when not your turn
          Row(
            children: [
              Expanded(child: _actionBtn('FOLD', const Color(0xFFE53935), isMyTurn ? () => _executeHumanAction(PlayerAction.fold) : null)),
              const SizedBox(width: 8),
              Expanded(
                child: canCheck
                    ? _actionBtn('CHECK', const Color(0xFF1E88E5), isMyTurn ? () => _executeHumanAction(PlayerAction.check) : null)
                    : _actionBtn('CALL \$$toCall', const Color(0xFF43A047), isMyTurn ? () => _executeHumanAction(PlayerAction.call) : null),
              ),
              const SizedBox(width: 8),
              Expanded(child: _actionBtn('RAISE', const Color(0xFFFF9800), isMyTurn ? () => _executeHumanAction(PlayerAction.raise, raise: raiseAmount) : null)),
              const SizedBox(width: 8),
              Expanded(child: _actionBtn('ALL IN', const Color(0xFF8E24AA), isMyTurn ? () => _executeHumanAction(PlayerAction.allIn) : null)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _actionBtn(String label, Color color, VoidCallback? onPressed) {
    final isEnabled = onPressed != null;
    return ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: isEnabled ? color : color.withOpacity(0.3),
        foregroundColor: isEnabled ? Colors.white : Colors.white38,
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        elevation: isEnabled ? 4 : 0,
      ),
      child: Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
    );
  }
}


