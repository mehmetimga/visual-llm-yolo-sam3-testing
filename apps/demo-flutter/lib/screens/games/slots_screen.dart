import 'dart:math';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';

const symbols = ['🍒', '🍋', '🍊', '🍇', '7️⃣', '💎', '🎰'];
const symbolValues = {
  '🍒': 2,
  '🍋': 3,
  '🍊': 5,
  '🍇': 10,
  '7️⃣': 25,
  '💎': 50,
  '🎰': 100,
};

class SlotsScreen extends StatefulWidget {
  const SlotsScreen({super.key});

  @override
  State<SlotsScreen> createState() => _SlotsScreenState();
}

class _SlotsScreenState extends State<SlotsScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  List<String> reels = ['🍒', '🍋', '7️⃣'];
  bool spinning = false;
  int bet = 10;
  int lastWin = 0;
  String message = '';

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
    );
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> spin() async {
    if (spinning) return;

    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.balance < bet) {
      setState(() {
        message = 'Insufficient balance!';
      });
      return;
    }

    setState(() {
      spinning = true;
      lastWin = 0;
      message = '';
    });

    // Deduct bet
    auth.updateBalance(-bet);

    // Spin animation
    final random = Random();
    for (int i = 0; i < 20; i++) {
      await Future.delayed(const Duration(milliseconds: 100));
      if (mounted) {
        setState(() {
          reels = [
            symbols[random.nextInt(symbols.length)],
            symbols[random.nextInt(symbols.length)],
            symbols[random.nextInt(symbols.length)],
          ];
        });
      }
    }

    // Final result
    final finalReels = [
      symbols[random.nextInt(symbols.length)],
      symbols[random.nextInt(symbols.length)],
      symbols[random.nextInt(symbols.length)],
    ];

    if (mounted) {
      setState(() {
        reels = finalReels;
        spinning = false;
      });

      // Check win
      if (finalReels[0] == finalReels[1] && finalReels[1] == finalReels[2]) {
        final winAmount = bet * (symbolValues[finalReels[0]] ?? 1);
        setState(() {
          lastWin = winAmount;
          message = '🎉 JACKPOT! ${finalReels[0]}${finalReels[0]}${finalReels[0]} 🎉';
        });
        auth.updateBalance(winAmount);
      } else if (finalReels[0] == finalReels[1] ||
          finalReels[1] == finalReels[2]) {
        final matchSymbol =
            finalReels[0] == finalReels[1] ? finalReels[0] : finalReels[1];
        final winAmount =
            ((bet * (symbolValues[matchSymbol] ?? 1)) * 0.3).round();
        setState(() {
          lastWin = winAmount;
          message = 'Nice! Pair of $matchSymbol';
        });
        auth.updateBalance(winAmount);
      }
    }
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
          'MEGA SLOTS',
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
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0xFF0A0A0F),
              Color(0xFF151520),
            ],
          ),
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Slot Machine Frame
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: const Color(0xFF151520),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: const Color(0xFFFF00AA),
                    width: 4,
                  ),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0xFFFF00AA),
                      blurRadius: 20,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    // Title
                    const Text(
                      '🎰 MEGA SLOTS 🎰',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFFFFD700),
                        shadows: [
                          Shadow(
                            color: Color(0xFFFFD700),
                            blurRadius: 10,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Reels - CustomPaint for canvas rendering (no Key/testId!)
                    CustomPaint(
                      size: const Size(300, 120),
                      painter: SlotReelsPainter(reels: reels, spinning: spinning),
                    ),
                    const SizedBox(height: 20),

                    // Win Display
                    Text(
                      lastWin > 0 ? 'WIN: \$$lastWin' : 'SPIN TO WIN!',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: lastWin > 0
                            ? const Color(0xFF00FF88)
                            : Colors.white,
                        shadows: lastWin > 0
                            ? const [
                                Shadow(
                                  color: Color(0xFF00FF88),
                                  blurRadius: 10,
                                ),
                              ]
                            : null,
                      ),
                    ),
                    const SizedBox(height: 24),

                    // SPIN Button - CustomPaint (no Key/testId - requires vision!)
                    GestureDetector(
                      onTap: spinning ? null : spin,
                      child: CustomPaint(
                        size: const Size(200, 60),
                        painter: SpinButtonPainter(disabled: spinning),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Bet Controls - CustomPaint (no Key/testId - requires vision!)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        GestureDetector(
                          onTap: () {
                            if (bet > 5) {
                              setState(() {
                                bet -= 5;
                              });
                            }
                          },
                          child: CustomPaint(
                            size: const Size(50, 50),
                            painter: BetControlPainter(text: '-'),
                          ),
                        ),
                        const SizedBox(width: 20),
                        Text(
                          'BET: \$$bet',
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(width: 20),
                        GestureDetector(
                          onTap: () {
                            if (bet < 100) {
                              setState(() {
                                bet += 5;
                              });
                            }
                          },
                          child: CustomPaint(
                            size: const Size(50, 50),
                            painter: BetControlPainter(text: '+'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Message
              if (message.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 24),
                  child: Text(
                    message,
                    style: const TextStyle(
                      fontSize: 20,
                      color: Color(0xFF00FF88),
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),

              // Info
              const Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  '💡 Note: SPIN and BET buttons are canvas-rendered\n(no Keys) - requires vision-based automation!',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Color(0xFFFF00AA),
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// Custom painters for canvas-rendered elements (no accessibility/Keys)

class SlotReelsPainter extends CustomPainter {
  final List<String> reels;
  final bool spinning;

  SlotReelsPainter({required this.reels, required this.spinning});

  @override
  void paint(Canvas canvas, Size size) {
    final reelWidth = size.width / 3 - 10;
    final reelHeight = size.height;

    for (int i = 0; i < 3; i++) {
      final x = i * (reelWidth + 15) + 10;

      // Reel background
      final bgPaint = Paint()
        ..color = const Color(0xFF1A1A2E)
        ..style = PaintingStyle.fill;
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(x, 0, reelWidth, reelHeight),
          const Radius.circular(8),
        ),
        bgPaint,
      );

      // Reel border
      final borderPaint = Paint()
        ..color = const Color(0xFFFFD700)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3;
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(x, 0, reelWidth, reelHeight),
          const Radius.circular(8),
        ),
        borderPaint,
      );

      // Symbol
      final textPainter = TextPainter(
        text: TextSpan(
          text: reels[i],
          style: const TextStyle(fontSize: 50),
        ),
        textDirection: TextDirection.ltr,
      );
      textPainter.layout();
      textPainter.paint(
        canvas,
        Offset(
          x + (reelWidth - textPainter.width) / 2,
          (reelHeight - textPainter.height) / 2,
        ),
      );
    }
  }

  @override
  bool shouldRepaint(covariant SlotReelsPainter oldDelegate) {
    return oldDelegate.reels != reels || oldDelegate.spinning != spinning;
  }
}

class SpinButtonPainter extends CustomPainter {
  final bool disabled;

  SpinButtonPainter({required this.disabled});

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(0, 0, size.width, size.height);
    final rrect = RRect.fromRectAndRadius(rect, const Radius.circular(15));

    // Gradient
    final gradient = LinearGradient(
      colors: disabled
          ? [const Color(0xFF444444), const Color(0xFF333333)]
          : [const Color(0xFF00FF88), const Color(0xFF00CC66)],
    );

    final paint = Paint()..shader = gradient.createShader(rect);
    canvas.drawRRect(rrect, paint);

    // Border
    final borderPaint = Paint()
      ..color = disabled ? const Color(0xFF555555) : const Color(0xFF00FFAA)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3;
    canvas.drawRRect(rrect, borderPaint);

    // Text
    final textPainter = TextPainter(
      text: TextSpan(
        text: disabled ? 'SPINNING...' : '🎰 SPIN 🎰',
        style: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.bold,
          color: disabled ? const Color(0xFF888888) : const Color(0xFF0A0A0F),
        ),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(
      canvas,
      Offset(
        (size.width - textPainter.width) / 2,
        (size.height - textPainter.height) / 2,
      ),
    );
  }

  @override
  bool shouldRepaint(covariant SpinButtonPainter oldDelegate) {
    return oldDelegate.disabled != disabled;
  }
}

class BetControlPainter extends CustomPainter {
  final String text;

  BetControlPainter({required this.text});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;

    // Background
    final bgPaint = Paint()
      ..color = const Color(0xFF1A1A2E)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, radius, bgPaint);

    // Border
    final borderPaint = Paint()
      ..color = const Color(0xFFFFD700)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3;
    canvas.drawCircle(center, radius, borderPaint);

    // Text
    final textPainter = TextPainter(
      text: TextSpan(
        text: text,
        style: const TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.bold,
          color: Color(0xFFFFD700),
        ),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(
      canvas,
      Offset(
        center.dx - textPainter.width / 2,
        center.dy - textPainter.height / 2,
      ),
    );
  }

  @override
  bool shouldRepaint(covariant BetControlPainter oldDelegate) {
    return oldDelegate.text != text;
  }
}

