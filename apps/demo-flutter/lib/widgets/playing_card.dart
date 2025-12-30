import 'package:flutter/material.dart';
import 'dart:math' as math;

/// Represents a playing card with suit and value
class PlayingCard {
  final String suit; // ♠, ♥, ♦, ♣
  final String value; // A, 2-10, J, Q, K
  final int rank; // 1-13 for sorting

  PlayingCard({required this.suit, required this.value, required this.rank});

  bool get isRed => suit == '♥' || suit == '♦';
  
  String get suitName {
    switch (suit) {
      case '♠': return 'spades';
      case '♥': return 'hearts';
      case '♦': return 'diamonds';
      case '♣': return 'clubs';
      default: return 'unknown';
    }
  }

  String get valueName {
    switch (value) {
      case 'A': return 'ace';
      case 'J': return 'jack';
      case 'Q': return 'queen';
      case 'K': return 'king';
      default: return value;
    }
  }

  /// Get the asset path for this card's PNG image
  String get assetPath => 'assets/cards/${valueName}_of_$suitName.png';

  @override
  String toString() => '$value$suit';
  
  @override
  bool operator ==(Object other) =>
      other is PlayingCard && other.suit == suit && other.value == value;
  
  @override
  int get hashCode => suit.hashCode ^ value.hashCode;
}

/// Creates a standard 52-card deck
List<PlayingCard> createStandardDeck() {
  final suits = ['♠', '♥', '♦', '♣'];
  final values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  final deck = <PlayingCard>[];
  
  for (final suit in suits) {
    for (int i = 0; i < values.length; i++) {
      deck.add(PlayingCard(suit: suit, value: values[i], rank: i + 1));
    }
  }
  
  deck.shuffle(math.Random());
  return deck;
}

/// A playing card widget - PNG images for faces, CustomPaint for backs
class PlayingCardWidget extends StatelessWidget {
  final PlayingCard? card;
  final bool faceDown;
  final double width;
  final double height;
  final bool highlighted;

  const PlayingCardWidget({
    super.key,
    this.card,
    this.faceDown = false,
    this.width = 60,
    this.height = 87,
    this.highlighted = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(6),
        boxShadow: [
          BoxShadow(
            color: highlighted 
                ? const Color(0xFFFFD700).withOpacity(0.6)
                : Colors.black.withOpacity(0.4),
            blurRadius: highlighted ? 12 : 5,
            offset: const Offset(2, 3),
            spreadRadius: highlighted ? 2 : 0,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(6),
        child: faceDown || card == null ? _buildCardBack() : _buildCardFace(),
      ),
    );
  }

  /// Build card face using PNG image
  Widget _buildCardFace() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Image.asset(
        card!.assetPath,
        fit: BoxFit.contain,
        width: width,
        height: height,
        errorBuilder: (context, error, stackTrace) {
          return _buildFallbackCard();
        },
      ),
    );
  }

  /// Build card back using CustomPaint (casino style)
  Widget _buildCardBack() {
    return CustomPaint(
      size: Size(width, height),
      painter: _CardBackPainter(),
    );
  }

  Widget _buildFallbackCard() {
    final color = card!.isRed ? const Color(0xFFCC0000) : Colors.black;
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Center(
        child: Text(
          '${card!.value}\n${card!.suit}',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: color,
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}

/// Custom painter for casino-style card back
class _CardBackPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(0, 0, size.width, size.height);
    final rrect = RRect.fromRectAndRadius(rect, const Radius.circular(6));

    // Clip to rounded rectangle
    canvas.save();
    canvas.clipRRect(rrect);

    // Dark gradient background
    final gradient = const LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [Color(0xFF1A237E), Color(0xFF311B92), Color(0xFF4A148C)],
    );
    canvas.drawRect(rect, Paint()..shader = gradient.createShader(rect));

    // Diamond pattern
    final patternPaint = Paint()
      ..color = const Color(0xFF5C6BC0).withOpacity(0.3)
      ..style = PaintingStyle.fill;

    for (double y = 4; y < size.height - 4; y += 8) {
      for (double x = 4; x < size.width - 4; x += 8) {
        final offset = ((y ~/ 8) % 2 == 0) ? 4.0 : 0.0;
        _drawDiamond(canvas, Offset(x + offset, y), 3, patternPaint);
      }
    }

    // Center emblem - casino chip style
    final centerX = size.width / 2;
    final centerY = size.height / 2;
    
    // Outer gold ring
    canvas.drawCircle(
      Offset(centerX, centerY),
      size.width * 0.32,
      Paint()..color = const Color(0xFFFFD700),
    );
    
    // Inner dark circle
    canvas.drawCircle(
      Offset(centerX, centerY),
      size.width * 0.27,
      Paint()..color = const Color(0xFF1A237E),
    );
    
    // Inner gold circle
    canvas.drawCircle(
      Offset(centerX, centerY),
      size.width * 0.18,
      Paint()..color = const Color(0xFFFFD700),
    );
    
    // Center dot
    canvas.drawCircle(
      Offset(centerX, centerY),
      size.width * 0.08,
      Paint()..color = const Color(0xFF1A237E),
    );

    // Decorative dots around center
    final dotPaint = Paint()..color = const Color(0xFFFFD700);
    for (int i = 0; i < 8; i++) {
      final angle = (i * math.pi / 4);
      final radius = size.width * 0.22;
      final x = centerX + radius * math.cos(angle);
      final y = centerY + radius * math.sin(angle);
      canvas.drawCircle(Offset(x, y), 2, dotPaint);
    }

    canvas.restore();

    // Gold border
    canvas.drawRRect(
      rrect,
      Paint()
        ..style = PaintingStyle.stroke
        ..color = const Color(0xFFFFD700)
        ..strokeWidth = 2,
    );

    // Inner decorative border
    final innerRRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(3, 3, size.width - 6, size.height - 6),
      const Radius.circular(4),
    );
    canvas.drawRRect(
      innerRRect,
      Paint()
        ..style = PaintingStyle.stroke
        ..color = const Color(0xFFFFD700).withOpacity(0.5)
        ..strokeWidth = 1,
    );
  }

  void _drawDiamond(Canvas canvas, Offset center, double size, Paint paint) {
    final path = Path()
      ..moveTo(center.dx, center.dy - size)
      ..lineTo(center.dx + size * 0.6, center.dy)
      ..lineTo(center.dx, center.dy + size)
      ..lineTo(center.dx - size * 0.6, center.dy)
      ..close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Widget to display a row of cards with overlap
class CardHand extends StatelessWidget {
  final List<PlayingCard> cards;
  final List<bool> faceDown;
  final double cardWidth;
  final double cardHeight;
  final double overlap;
  final List<int> highlightedIndices;

  const CardHand({
    super.key,
    required this.cards,
    this.faceDown = const [],
    this.cardWidth = 60,
    this.cardHeight = 87,
    this.overlap = 0.4,
    this.highlightedIndices = const [],
  });

  @override
  Widget build(BuildContext context) {
    if (cards.isEmpty) return const SizedBox.shrink();
    
    final totalWidth = cardWidth + (cards.length - 1) * cardWidth * (1 - overlap);
    
    return SizedBox(
      width: totalWidth,
      height: cardHeight,
      child: Stack(
        children: List.generate(cards.length, (index) {
          final isFaceDown = index < faceDown.length ? faceDown[index] : false;
          final isHighlighted = highlightedIndices.contains(index);
          
          return Positioned(
            left: index * cardWidth * (1 - overlap),
            child: PlayingCardWidget(
              card: cards[index],
              faceDown: isFaceDown,
              width: cardWidth,
              height: cardHeight,
              highlighted: isHighlighted,
            ),
          );
        }),
      ),
    );
  }
}

/// Empty card slot placeholder
class CardSlot extends StatelessWidget {
  final double width;
  final double height;

  const CardSlot({
    super.key,
    this.width = 60,
    this.height = 87,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.1),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: Colors.white.withOpacity(0.3),
          width: 2,
        ),
      ),
    );
  }
}
