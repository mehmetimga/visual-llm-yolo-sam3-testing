import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import '../models/poker_game_state.dart';

/// Service for AI poker decisions using Ollama LLM
class PokerAIService {
  static const String _defaultOllamaUrl = 'http://localhost:11434';
  static const String _defaultModel = 'llama3.2:3b';
  
  final String baseUrl;
  final String model;
  final Random _random = Random();

  PokerAIService({
    this.baseUrl = _defaultOllamaUrl,
    this.model = _defaultModel,
  });

  /// Get AI decision for a player
  Future<AIDecision> getDecision(
    PokerPlayer player,
    Map<String, dynamic> gameState,
  ) async {
    print('');
    print('🎯 AI TURN: ${player.name} (${player.personality})');
    print('   Hand: ${gameState['yourHand']}');
    print('   Chips: \$${gameState['yourChips']} | To Call: \$${gameState['amountToCall']}');
    
    try {
      // Try to get decision from LLM
      print('   📡 Calling Ollama LLM...');
      final decision = await _getLLMDecision(player, gameState);
      print('   ✅ LLM Response: ${decision.action.name.toUpperCase()} - "${decision.reasoning}"');
      return decision;
    } catch (e) {
      // Fallback to rule-based AI
      print('   ⚠️  LLM failed, using fallback AI: $e');
      final decision = _getFallbackDecision(player, gameState);
      print('   🤖 Fallback: ${decision.action.name.toUpperCase()} - "${decision.reasoning}"');
      return decision;
    }
  }

  Future<AIDecision> _getLLMDecision(
    PokerPlayer player,
    Map<String, dynamic> gameState,
  ) async {
    final prompt = _buildPrompt(player, gameState);
    
    final response = await http.post(
      Uri.parse('$baseUrl/api/generate'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'model': model,
        'prompt': prompt,
        'stream': false,
        'format': 'json',
        'options': {
          'temperature': 0.7,
          'num_predict': 200,
        },
      }),
    ).timeout(const Duration(seconds: 15));

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final responseText = data['response'] as String;
      
      return _parseResponse(responseText, player, gameState);
    } else {
      throw Exception('Ollama error: ${response.statusCode}');
    }
  }

  String _buildPrompt(PokerPlayer player, Map<String, dynamic> gameState) {
    final personality = gameState['personality'] ?? 'balanced';
    final hand = (gameState['yourHand'] as List).join(', ');
    final community = (gameState['communityCards'] as List).join(', ');
    final pot = gameState['pot'];
    final toCall = gameState['amountToCall'];
    final chips = gameState['yourChips'];
    final phase = gameState['phase'];
    
    String personalityPrompt = '';
    switch (personality) {
      case 'aggressive':
        personalityPrompt = 'You are an aggressive player who likes to raise and bluff.';
        break;
      case 'conservative':
        personalityPrompt = 'You are a conservative player who only bets with strong hands.';
        break;
      case 'unpredictable':
        personalityPrompt = 'You are unpredictable - sometimes bluff, sometimes play tight.';
        break;
      default:
        personalityPrompt = 'You play a balanced poker strategy.';
    }

    return '''You are ${player.name}, an AI poker player in a Texas Hold'em game.
$personalityPrompt

Current situation:
- Phase: $phase
- Your hand: $hand
- Community cards: ${community.isEmpty ? 'None yet' : community}
- Pot: \$$pot
- Amount to call: \$$toCall
- Your chips: \$$chips

What is your action? Respond with ONLY valid JSON:
{"action": "fold|check|call|raise", "raise_amount": 0, "thinking": "brief reason"}

If raising, set raise_amount (minimum 20). If not raising, set to 0.
''';
  }

  AIDecision _parseResponse(
    String response,
    PokerPlayer player,
    Map<String, dynamic> gameState,
  ) {
    try {
      // Try to extract JSON from response
      final jsonMatch = RegExp(r'\{[^}]+\}').firstMatch(response);
      if (jsonMatch != null) {
        final json = jsonDecode(jsonMatch.group(0)!);
        final actionStr = (json['action'] as String?)?.toLowerCase() ?? 'check';
        final raiseAmount = (json['raise_amount'] as num?)?.toInt() ?? 0;
        final thinking = json['thinking'] as String? ?? 'Hmm...';
        
        PlayerAction action;
        switch (actionStr) {
          case 'fold':
            action = PlayerAction.fold;
            break;
          case 'call':
            action = PlayerAction.call;
            break;
          case 'raise':
            action = PlayerAction.raise;
            break;
          case 'allin':
          case 'all-in':
          case 'all_in':
            action = PlayerAction.allIn;
            break;
          default:
            action = PlayerAction.check;
        }

        // Validate action
        final toCall = gameState['amountToCall'] as int;
        if (action == PlayerAction.check && toCall > 0) {
          action = PlayerAction.call; // Must call if there's a bet
        }

        return AIDecision(
          action: action,
          raiseAmount: raiseAmount > 0 ? raiseAmount : 20,
          reasoning: thinking,
          thinkingMessage: _getThinkingEmoji(action) + ' ' + thinking,
        );
      }
    } catch (e) {
      print('Error parsing LLM response: $e');
    }
    
    // Fallback if parsing fails
    return _getFallbackDecision(player, gameState);
  }

  String _getThinkingEmoji(PlayerAction action) {
    switch (action) {
      case PlayerAction.fold:
        return '😔';
      case PlayerAction.check:
        return '🤔';
      case PlayerAction.call:
        return '👍';
      case PlayerAction.raise:
        return '😏';
      case PlayerAction.allIn:
        return '🔥';
    }
  }

  /// Fallback rule-based AI when LLM is unavailable
  AIDecision _getFallbackDecision(
    PokerPlayer player,
    Map<String, dynamic> gameState,
  ) {
    final personality = gameState['personality'] ?? 'balanced';
    final toCall = gameState['amountToCall'] as int;
    final pot = gameState['pot'] as int;
    final chips = gameState['yourChips'] as int;
    final hand = gameState['yourHand'] as List;
    
    // Simple hand strength evaluation
    final handStrength = _evaluateHandStrength(hand, gameState['communityCards'] as List);
    
    PlayerAction action;
    int raiseAmount = 0;
    String thinking;

    // Decision based on personality and hand strength
    if (personality == 'aggressive') {
      if (handStrength > 0.3 || _random.nextDouble() < 0.3) {
        if (handStrength > 0.6 && chips > toCall + 40) {
          action = PlayerAction.raise;
          raiseAmount = 20 + (pot * 0.3).toInt();
          thinking = "I'm feeling lucky! Let's raise.";
        } else if (toCall > 0) {
          action = PlayerAction.call;
          thinking = "I'll call and see what happens.";
        } else {
          action = PlayerAction.check;
          thinking = "Checking for now.";
        }
      } else {
        action = toCall > chips * 0.2 ? PlayerAction.fold : PlayerAction.call;
        thinking = action == PlayerAction.fold 
            ? "Too risky, I fold." 
            : "Let me call this.";
      }
    } else if (personality == 'conservative') {
      if (handStrength > 0.5) {
        if (toCall > 0) {
          action = PlayerAction.call;
          thinking = "Decent hand, I'll call.";
        } else {
          action = PlayerAction.check;
          thinking = "I'll check.";
        }
      } else if (toCall > chips * 0.1) {
        action = PlayerAction.fold;
        thinking = "Not worth the risk.";
      } else if (toCall > 0) {
        action = PlayerAction.call;
        thinking = "Small bet, I'll call.";
      } else {
        action = PlayerAction.check;
        thinking = "Checking.";
      }
    } else {
      // Unpredictable
      final roll = _random.nextDouble();
      if (roll < 0.2 && handStrength < 0.4) {
        // Bluff!
        action = PlayerAction.raise;
        raiseAmount = 30;
        thinking = "Let's bluff! 😈";
      } else if (handStrength > 0.4 || roll < 0.5) {
        action = toCall > 0 ? PlayerAction.call : PlayerAction.check;
        thinking = toCall > 0 ? "I'll call." : "Check.";
      } else {
        action = PlayerAction.fold;
        thinking = "Nah, I'm out.";
      }
    }

    // Can't call/raise with no chips
    if ((action == PlayerAction.call || action == PlayerAction.raise) && chips <= toCall) {
      if (handStrength > 0.6) {
        action = PlayerAction.allIn;
        thinking = "All in! 🎰";
      } else {
        action = PlayerAction.fold;
        thinking = "Can't afford this...";
      }
    }

    return AIDecision(
      action: action,
      raiseAmount: raiseAmount,
      reasoning: thinking,
      thinkingMessage: _getThinkingEmoji(action) + ' ' + thinking,
    );
  }

  double _evaluateHandStrength(List hand, List community) {
    // Simple hand strength heuristic (0.0 to 1.0)
    double strength = 0.0;
    
    // Check for high cards
    for (final card in hand) {
      final cardStr = card.toString();
      if (cardStr.contains('A')) strength += 0.15;
      else if (cardStr.contains('K')) strength += 0.12;
      else if (cardStr.contains('Q')) strength += 0.1;
      else if (cardStr.contains('J')) strength += 0.08;
      else if (cardStr.contains('10')) strength += 0.06;
    }
    
    // Check for pairs in hand
    if (hand.length >= 2) {
      final v1 = hand[0].toString().replaceAll(RegExp(r'[♠♥♦♣]'), '');
      final v2 = hand[1].toString().replaceAll(RegExp(r'[♠♥♦♣]'), '');
      if (v1 == v2) strength += 0.3; // Pocket pair
      
      // Check for suited
      final s1 = hand[0].toString().replaceAll(RegExp(r'[^♠♥♦♣]'), '');
      final s2 = hand[1].toString().replaceAll(RegExp(r'[^♠♥♦♣]'), '');
      if (s1 == s2) strength += 0.1; // Suited
    }
    
    // Bonus for community card matches
    for (final hCard in hand) {
      final hVal = hCard.toString().replaceAll(RegExp(r'[♠♥♦♣]'), '');
      for (final cCard in community) {
        final cVal = cCard.toString().replaceAll(RegExp(r'[♠♥♦♣]'), '');
        if (hVal == cVal) strength += 0.2; // Pair with board
      }
    }
    
    return strength.clamp(0.0, 1.0);
  }
}

