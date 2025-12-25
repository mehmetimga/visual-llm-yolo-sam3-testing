import 'dart:math';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';

class PlayingCard {
  final String suit;
  final String value;
  final int numValue;

  PlayingCard({required this.suit, required this.value, required this.numValue});
}

const suits = ['♠', '♥', '♦', '♣'];
const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

List<PlayingCard> createDeck() {
  final deck = <PlayingCard>[];
  for (final suit in suits) {
    for (int i = 0; i < values.length; i++) {
      final value = values[i];
      int numValue = i + 1;
      if (value == 'A') numValue = 11;
      else if (['J', 'Q', 'K'].contains(value)) numValue = 10;
      deck.add(PlayingCard(suit: suit, value: value, numValue: numValue));
    }
  }
  deck.shuffle(Random());
  return deck;
}

int calculateHand(List<PlayingCard> cards) {
  int total = 0;
  int aces = 0;

  for (final card in cards) {
    if (card.value == 'A') {
      aces++;
      total += 11;
    } else {
      total += card.numValue;
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

enum GameState { betting, playing, dealerTurn, ended }

class BlackjackScreen extends StatefulWidget {
  const BlackjackScreen({super.key});

  @override
  State<BlackjackScreen> createState() => _BlackjackScreenState();
}

class _BlackjackScreenState extends State<BlackjackScreen> {
  List<PlayingCard> deck = [];
  List<PlayingCard> playerHand = [];
  List<PlayingCard> dealerHand = [];
  GameState gameState = GameState.betting;
  int bet = 25;
  int lastWin = 0;
  String message = 'Place your bet and tap Deal!';

  @override
  void initState() {
    super.initState();
    deck = createDeck();
  }

  void deal() {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.balance < bet) {
      setState(() {
        message = 'Insufficient balance!';
      });
      return;
    }

    auth.updateBalance(-bet);
    deck = createDeck();

    setState(() {
      playerHand = [deck.removeLast(), deck.removeLast()];
      dealerHand = [deck.removeLast(), deck.removeLast()];
      gameState = GameState.playing;
      lastWin = 0;
      message = 'Hit or Stand?';
    });

    // Check for blackjack
    if (calculateHand(playerHand) == 21) {
      Future.delayed(const Duration(milliseconds: 500), () => endGame());
    }
  }

  void hit() {
    if (gameState != GameState.playing) return;

    setState(() {
      playerHand.add(deck.removeLast());
    });

    final score = calculateHand(playerHand);
    if (score > 21) {
      setState(() {
        gameState = GameState.ended;
        message = 'BUST! You lose.';
      });
      resetAfterDelay();
    } else if (score == 21) {
      stand();
    }
  }

  Future<void> stand() async {
    if (gameState != GameState.playing) return;

    setState(() {
      gameState = GameState.dealerTurn;
      message = "Dealer's turn...";
    });

    // Dealer plays
    while (calculateHand(dealerHand) < 17) {
      await Future.delayed(const Duration(milliseconds: 500));
      if (mounted) {
        setState(() {
          dealerHand.add(deck.removeLast());
        });
      }
    }

    endGame();
  }

  void endGame() {
    final playerScore = calculateHand(playerHand);
    final dealerScore = calculateHand(dealerHand);
    final auth = Provider.of<AuthProvider>(context, listen: false);

    setState(() {
      gameState = GameState.ended;
    });

    int winAmount = 0;

    if (playerScore > 21) {
      message = 'BUST! You lose.';
    } else if (dealerScore > 21) {
      winAmount = bet * 2;
      message = 'Dealer busts! You win!';
    } else if (playerScore > dealerScore) {
      winAmount = bet * 2;
      message = 'You win! $playerScore vs $dealerScore';
    } else if (playerScore < dealerScore) {
      message = 'Dealer wins. $dealerScore vs $playerScore';
    } else {
      winAmount = bet;
      message = 'Push! Bet returned.';
    }

    if (winAmount > 0) {
      lastWin = winAmount;
      auth.updateBalance(winAmount);
    }

    setState(() {});
    resetAfterDelay();
  }

  void resetAfterDelay() {
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) {
        setState(() {
          gameState = GameState.betting;
          playerHand = [];
          dealerHand = [];
          message = 'Place your bet and tap Deal!';
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          key: const Key('back_to_lobby_button'),
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'BLACKJACK',
          style: TextStyle(
            color: Color(0xFFFFD700),
            fontWeight: FontWeight.bold,
          ),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFF0A0A0F),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFF2A2A3A)),
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
        width: double.infinity,
        height: double.infinity,
        child: CustomPaint(
          painter: BlackjackTablePainter(
            playerHand: playerHand,
            dealerHand: dealerHand,
            gameState: gameState,
            bet: bet,
            lastWin: lastWin,
            message: message,
          ),
          child: GestureDetector(
            onTapDown: (details) => handleTap(details.localPosition),
            behavior: HitTestBehavior.opaque,
          ),
        ),
      ),
    );
  }

  void handleTap(Offset position) {
    final size = MediaQuery.of(context).size;
    final btnY = size.height - 150;

    if (gameState == GameState.betting) {
      // Check DEAL button
      if (position.dy >= btnY - 25 &&
          position.dy <= btnY + 25 &&
          position.dx >= size.width / 2 - 75 &&
          position.dx <= size.width / 2 + 75) {
        deal();
      }
    } else if (gameState == GameState.playing) {
      final hitX = size.width / 2 - 80;
      final standX = size.width / 2 + 80;

      // HIT button
      if (position.dy >= btnY - 25 &&
          position.dy <= btnY + 25 &&
          position.dx >= hitX - 60 &&
          position.dx <= hitX + 60) {
        hit();
      }

      // STAND button
      if (position.dy >= btnY - 25 &&
          position.dy <= btnY + 25 &&
          position.dx >= standX - 60 &&
          position.dx <= standX + 60) {
        stand();
      }
    }
  }
}

class BlackjackTablePainter extends CustomPainter {
  final List<PlayingCard> playerHand;
  final List<PlayingCard> dealerHand;
  final GameState gameState;
  final int bet;
  final int lastWin;
  final String message;

  BlackjackTablePainter({
    required this.playerHand,
    required this.dealerHand,
    required this.gameState,
    required this.bet,
    required this.lastWin,
    required this.message,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // Green felt background
    final bgPaint = Paint()..color = const Color(0xFF0F4C3A);
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height), bgPaint);

    // Table border
    final borderPaint = Paint()
      ..color = const Color(0xFF8B4513)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 8;
    canvas.drawRect(
      Rect.fromLTWH(4, 4, size.width - 8, size.height - 8),
      borderPaint,
    );

    // Decorative circle
    final circlePaint = Paint()
      ..color = const Color(0xFF0A3A2E)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    canvas.drawCircle(
      Offset(size.width / 2, size.height / 2),
      150,
      circlePaint,
    );

    // Title
    _drawText(canvas, 'BLACKJACK', Offset(size.width / 2, 35),
        const Color(0xFFFFD700), 24, true);

    // Dealer label
    _drawText(canvas, 'DEALER', Offset(size.width / 2, 60), Colors.white, 16, false);

    // Draw dealer cards
    final cardWidth = 50.0;
    final cardHeight = 70.0;
    final dealerY = 80.0;
    final dealerStartX = size.width / 2 - (dealerHand.length * (cardWidth + 10)) / 2;

    for (int i = 0; i < dealerHand.length; i++) {
      final x = dealerStartX + i * (cardWidth + 10);
      if (gameState == GameState.playing && i == 1) {
        _drawCardBack(canvas, x, dealerY, cardWidth, cardHeight);
      } else {
        _drawCard(canvas, dealerHand[i], x, dealerY, cardWidth, cardHeight);
      }
    }

    // Dealer score
    if (dealerHand.isNotEmpty) {
      final dealerScore = gameState == GameState.playing
          ? '${dealerHand[0].numValue} + ?'
          : 'Score: ${calculateHand(dealerHand)}';
      _drawText(canvas, dealerScore, Offset(size.width / 2, dealerY + cardHeight + 20),
          Colors.white, 18, true);
    }

    // Player label
    _drawText(canvas, 'YOUR HAND', Offset(size.width / 2, 220), Colors.white, 16, false);

    // Draw player cards
    final playerY = 240.0;
    final playerStartX = size.width / 2 - (playerHand.length * (cardWidth + 10)) / 2;

    for (int i = 0; i < playerHand.length; i++) {
      final x = playerStartX + i * (cardWidth + 10);
      _drawCard(canvas, playerHand[i], x, playerY, cardWidth, cardHeight);
    }

    // Player score
    if (playerHand.isNotEmpty) {
      final playerScore = calculateHand(playerHand);
      final scoreColor = playerScore > 21 ? const Color(0xFFFF4444) : const Color(0xFF00FF88);
      _drawText(canvas, 'Score: $playerScore', Offset(size.width / 2, playerY + cardHeight + 25),
          scoreColor, 22, true);
    }

    // Game buttons
    final btnY = size.height - 150;
    if (gameState == GameState.betting) {
      _drawDealButton(canvas, Offset(size.width / 2, btnY));
    } else if (gameState == GameState.playing) {
      _drawHitStandButtons(canvas, size.width / 2, btnY);
    }

    // Message
    _drawText(canvas, message, Offset(size.width / 2, size.height - 80),
        lastWin > 0 ? const Color(0xFF00FF88) : Colors.white, 18, true);

    // Bet display
    _drawText(canvas, 'Current Bet: \$$bet', Offset(size.width / 2, size.height - 40),
        const Color(0xFFFFD700), 16, true);
  }

  void _drawText(Canvas canvas, String text, Offset position, Color color,
      double fontSize, bool bold) {
    final textPainter = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          fontSize: fontSize,
          fontWeight: bold ? FontWeight.bold : FontWeight.normal,
          color: color,
        ),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(
      canvas,
      Offset(position.dx - textPainter.width / 2, position.dy - textPainter.height / 2),
    );
  }

  void _drawCard(Canvas canvas, PlayingCard card, double x, double y,
      double w, double h) {
    // Card background
    final bgPaint = Paint()..color = Colors.white;
    final rrect = RRect.fromRectAndRadius(
      Rect.fromLTWH(x, y, w, h),
      const Radius.circular(5),
    );
    canvas.drawRRect(rrect, bgPaint);

    // Card border
    final borderPaint = Paint()
      ..color = const Color(0xFF333333)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    canvas.drawRRect(rrect, borderPaint);

    // Card content
    final isRed = card.suit == '♥' || card.suit == '♦';
    final color = isRed ? const Color(0xFFCC0000) : Colors.black;

    // Value
    final valuePainter = TextPainter(
      text: TextSpan(
        text: card.value,
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: color),
      ),
      textDirection: TextDirection.ltr,
    );
    valuePainter.layout();
    valuePainter.paint(canvas, Offset(x + 4, y + 4));

    // Suit
    final suitPainter = TextPainter(
      text: TextSpan(
        text: card.suit,
        style: TextStyle(fontSize: 24, color: color),
      ),
      textDirection: TextDirection.ltr,
    );
    suitPainter.layout();
    suitPainter.paint(
      canvas,
      Offset(x + (w - suitPainter.width) / 2, y + (h - suitPainter.height) / 2),
    );
  }

  void _drawCardBack(Canvas canvas, double x, double y, double w, double h) {
    final bgPaint = Paint()..color = const Color(0xFF1A237E);
    final rrect = RRect.fromRectAndRadius(
      Rect.fromLTWH(x, y, w, h),
      const Radius.circular(5),
    );
    canvas.drawRRect(rrect, bgPaint);

    // Pattern
    final patternPaint = Paint()
      ..color = const Color(0xFF3949AB)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (double i = 0; i < w; i += 6) {
      canvas.drawLine(Offset(x + i, y), Offset(x + i, y + h), patternPaint);
    }

    // Border
    final borderPaint = Paint()
      ..color = const Color(0xFF5C6BC0)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    canvas.drawRRect(rrect, borderPaint);
  }

  void _drawDealButton(Canvas canvas, Offset center) {
    final rect = Rect.fromCenter(center: center, width: 150, height: 50);
    final rrect = RRect.fromRectAndRadius(rect, const Radius.circular(10));

    final gradient = const LinearGradient(
      colors: [Color(0xFFFFD700), Color(0xFFFFAA00)],
    );
    final paint = Paint()..shader = gradient.createShader(rect);
    canvas.drawRRect(rrect, paint);

    _drawText(canvas, 'DEAL', center, Colors.black, 20, true);
  }

  void _drawHitStandButtons(Canvas canvas, double centerX, double y) {
    // HIT button
    final hitRect = Rect.fromCenter(
      center: Offset(centerX - 80, y),
      width: 100,
      height: 50,
    );
    final hitRRect = RRect.fromRectAndRadius(hitRect, const Radius.circular(10));
    final hitGradient = const LinearGradient(
      colors: [Color(0xFF00FF88), Color(0xFF00CC66)],
    );
    canvas.drawRRect(hitRRect, Paint()..shader = hitGradient.createShader(hitRect));
    _drawText(canvas, 'HIT', Offset(centerX - 80, y), Colors.black, 18, true);

    // STAND button
    final standRect = Rect.fromCenter(
      center: Offset(centerX + 80, y),
      width: 100,
      height: 50,
    );
    final standRRect = RRect.fromRectAndRadius(standRect, const Radius.circular(10));
    final standGradient = const LinearGradient(
      colors: [Color(0xFFFF4444), Color(0xFFCC0000)],
    );
    canvas.drawRRect(standRRect, Paint()..shader = standGradient.createShader(standRect));
    _drawText(canvas, 'STAND', Offset(centerX + 80, y), Colors.white, 18, true);
  }

  @override
  bool shouldRepaint(covariant BlackjackTablePainter oldDelegate) {
    return true;
  }
}

