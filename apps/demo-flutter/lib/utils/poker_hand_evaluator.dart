import '../widgets/playing_card.dart';

/// Poker hand rankings from highest to lowest
enum HandRank {
  royalFlush,
  straightFlush,
  fourOfAKind,
  fullHouse,
  flush,
  straight,
  threeOfAKind,
  twoPair,
  onePair,
  highCard,
}

extension HandRankExtension on HandRank {
  String get displayName {
    switch (this) {
      case HandRank.royalFlush:
        return 'Royal Flush';
      case HandRank.straightFlush:
        return 'Straight Flush';
      case HandRank.fourOfAKind:
        return 'Four of a Kind';
      case HandRank.fullHouse:
        return 'Full House';
      case HandRank.flush:
        return 'Flush';
      case HandRank.straight:
        return 'Straight';
      case HandRank.threeOfAKind:
        return 'Three of a Kind';
      case HandRank.twoPair:
        return 'Two Pair';
      case HandRank.onePair:
        return 'One Pair';
      case HandRank.highCard:
        return 'High Card';
    }
  }

  int get value {
    // Higher value = better hand
    return 10 - index;
  }
}

/// Result of evaluating a poker hand
class HandEvaluation {
  final HandRank rank;
  final List<int> tiebreakers; // For comparing hands of same rank
  final List<PlayingCard> bestFiveCards;
  final String description;

  HandEvaluation({
    required this.rank,
    required this.tiebreakers,
    required this.bestFiveCards,
    required this.description,
  });

  /// Compare two hands. Returns positive if this hand wins, negative if other wins, 0 if tie.
  int compareTo(HandEvaluation other) {
    // First compare ranks
    final rankDiff = rank.value - other.rank.value;
    if (rankDiff != 0) return rankDiff;

    // Same rank, compare tiebreakers
    for (int i = 0; i < tiebreakers.length && i < other.tiebreakers.length; i++) {
      final diff = tiebreakers[i] - other.tiebreakers[i];
      if (diff != 0) return diff;
    }

    return 0; // True tie
  }

  bool beats(HandEvaluation other) => compareTo(other) > 0;
  bool ties(HandEvaluation other) => compareTo(other) == 0;
}

/// Evaluates poker hands from 5-7 cards
class PokerHandEvaluator {
  /// Evaluate the best 5-card hand from the given cards
  static HandEvaluation evaluate(List<PlayingCard> cards) {
    if (cards.length < 5) {
      throw ArgumentError('Need at least 5 cards to evaluate');
    }

    if (cards.length == 5) {
      return _evaluateFiveCards(cards);
    }

    // Find the best 5-card combination
    HandEvaluation? bestHand;
    final combinations = _getCombinations(cards, 5);

    for (final combo in combinations) {
      final eval = _evaluateFiveCards(combo);
      if (bestHand == null || eval.compareTo(bestHand) > 0) {
        bestHand = eval;
      }
    }

    return bestHand!;
  }

  static HandEvaluation _evaluateFiveCards(List<PlayingCard> cards) {
    assert(cards.length == 5);

    // Sort by rank (Ace high = 14)
    final sorted = List<PlayingCard>.from(cards)
      ..sort((a, b) => _getRankValue(b) - _getRankValue(a));

    final isFlush = _isFlush(sorted);
    final isStraight = _isStraight(sorted);
    final rankCounts = _getRankCounts(sorted);

    // Check for royal flush
    if (isFlush && isStraight && _getRankValue(sorted[0]) == 14) {
      return HandEvaluation(
        rank: HandRank.royalFlush,
        tiebreakers: [14],
        bestFiveCards: sorted,
        description: 'Royal Flush!',
      );
    }

    // Check for straight flush
    if (isFlush && isStraight) {
      return HandEvaluation(
        rank: HandRank.straightFlush,
        tiebreakers: [_getRankValue(sorted[0])],
        bestFiveCards: sorted,
        description: 'Straight Flush - ${sorted[0].value} high',
      );
    }

    // Check for four of a kind
    final fourOfAKind = _findNOfAKind(rankCounts, 4);
    if (fourOfAKind != null) {
      final kicker = sorted.firstWhere((c) => _getRankValue(c) != fourOfAKind);
      return HandEvaluation(
        rank: HandRank.fourOfAKind,
        tiebreakers: [fourOfAKind, _getRankValue(kicker)],
        bestFiveCards: sorted,
        description: 'Four of a Kind - ${_rankValueToString(fourOfAKind)}s',
      );
    }

    // Check for full house
    final threeOfAKind = _findNOfAKind(rankCounts, 3);
    final pair = _findNOfAKind(rankCounts, 2);
    if (threeOfAKind != null && pair != null) {
      return HandEvaluation(
        rank: HandRank.fullHouse,
        tiebreakers: [threeOfAKind, pair],
        bestFiveCards: sorted,
        description: 'Full House - ${_rankValueToString(threeOfAKind)}s over ${_rankValueToString(pair)}s',
      );
    }

    // Check for flush
    if (isFlush) {
      return HandEvaluation(
        rank: HandRank.flush,
        tiebreakers: sorted.map(_getRankValue).toList(),
        bestFiveCards: sorted,
        description: 'Flush - ${sorted[0].value} high',
      );
    }

    // Check for straight
    if (isStraight) {
      return HandEvaluation(
        rank: HandRank.straight,
        tiebreakers: [_getStraightHighCard(sorted)],
        bestFiveCards: sorted,
        description: 'Straight - ${sorted[0].value} high',
      );
    }

    // Check for three of a kind
    if (threeOfAKind != null) {
      final kickers = sorted
          .where((c) => _getRankValue(c) != threeOfAKind)
          .map(_getRankValue)
          .toList();
      return HandEvaluation(
        rank: HandRank.threeOfAKind,
        tiebreakers: [threeOfAKind, ...kickers],
        bestFiveCards: sorted,
        description: 'Three of a Kind - ${_rankValueToString(threeOfAKind)}s',
      );
    }

    // Check for two pair
    final pairs = _findAllPairs(rankCounts);
    if (pairs.length >= 2) {
      pairs.sort((a, b) => b - a);
      final kicker = sorted
          .firstWhere((c) => !pairs.contains(_getRankValue(c)));
      return HandEvaluation(
        rank: HandRank.twoPair,
        tiebreakers: [pairs[0], pairs[1], _getRankValue(kicker)],
        bestFiveCards: sorted,
        description: 'Two Pair - ${_rankValueToString(pairs[0])}s and ${_rankValueToString(pairs[1])}s',
      );
    }

    // Check for one pair
    if (pair != null) {
      final kickers = sorted
          .where((c) => _getRankValue(c) != pair)
          .map(_getRankValue)
          .toList();
      return HandEvaluation(
        rank: HandRank.onePair,
        tiebreakers: [pair, ...kickers],
        bestFiveCards: sorted,
        description: 'One Pair - ${_rankValueToString(pair)}s',
      );
    }

    // High card
    return HandEvaluation(
      rank: HandRank.highCard,
      tiebreakers: sorted.map(_getRankValue).toList(),
      bestFiveCards: sorted,
      description: 'High Card - ${sorted[0].value}',
    );
  }

  static int _getRankValue(PlayingCard card) {
    switch (card.value) {
      case 'A':
        return 14;
      case 'K':
        return 13;
      case 'Q':
        return 12;
      case 'J':
        return 11;
      default:
        return int.tryParse(card.value) ?? 0;
    }
  }

  static String _rankValueToString(int value) {
    switch (value) {
      case 14:
        return 'Ace';
      case 13:
        return 'King';
      case 12:
        return 'Queen';
      case 11:
        return 'Jack';
      default:
        return value.toString();
    }
  }

  static bool _isFlush(List<PlayingCard> cards) {
    final suit = cards[0].suit;
    return cards.every((c) => c.suit == suit);
  }

  static bool _isStraight(List<PlayingCard> cards) {
    final values = cards.map(_getRankValue).toList()..sort((a, b) => b - a);

    // Check normal straight
    bool isNormal = true;
    for (int i = 0; i < values.length - 1; i++) {
      if (values[i] - values[i + 1] != 1) {
        isNormal = false;
        break;
      }
    }
    if (isNormal) return true;

    // Check wheel (A-2-3-4-5)
    if (values[0] == 14 && values[1] == 5 && values[2] == 4 && 
        values[3] == 3 && values[4] == 2) {
      return true;
    }

    return false;
  }

  static int _getStraightHighCard(List<PlayingCard> cards) {
    final values = cards.map(_getRankValue).toList()..sort((a, b) => b - a);
    
    // Check for wheel (A-2-3-4-5) - in this case, 5 is high
    if (values[0] == 14 && values[1] == 5) {
      return 5;
    }
    
    return values[0];
  }

  static Map<int, int> _getRankCounts(List<PlayingCard> cards) {
    final counts = <int, int>{};
    for (final card in cards) {
      final rank = _getRankValue(card);
      counts[rank] = (counts[rank] ?? 0) + 1;
    }
    return counts;
  }

  static int? _findNOfAKind(Map<int, int> counts, int n) {
    for (final entry in counts.entries) {
      if (entry.value == n) return entry.key;
    }
    return null;
  }

  static List<int> _findAllPairs(Map<int, int> counts) {
    return counts.entries
        .where((e) => e.value == 2)
        .map((e) => e.key)
        .toList();
  }

  /// Generate all combinations of k elements from list
  static List<List<PlayingCard>> _getCombinations(List<PlayingCard> cards, int k) {
    final result = <List<PlayingCard>>[];
    _generateCombinations(cards, k, 0, [], result);
    return result;
  }

  static void _generateCombinations(
    List<PlayingCard> cards,
    int k,
    int start,
    List<PlayingCard> current,
    List<List<PlayingCard>> result,
  ) {
    if (current.length == k) {
      result.add(List.from(current));
      return;
    }

    for (int i = start; i < cards.length; i++) {
      current.add(cards[i]);
      _generateCombinations(cards, k, i + 1, current, result);
      current.removeLast();
    }
  }
}

