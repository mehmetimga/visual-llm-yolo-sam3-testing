import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import '../../models/debug_state.dart';
import 'poker_table_screen.dart';

/// Debug setup screen for YOLO training data capture.
/// Allows selecting a specific game state before entering the poker table.
/// The poker table itself remains clean (no debug UI in screenshots).
class DebugPokerSetupScreen extends StatelessWidget {
  const DebugPokerSetupScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0F),
      appBar: AppBar(
        leading: Semantics(
          identifier: 'debug_back_button',
          label: 'debug_back_button',
          button: true,
          child: IconButton(
            key: const Key('debug_back_button'),
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.pop(context),
          ),
        ),
        title: const Text(
          'Debug: Select Game State',
          style: TextStyle(color: Colors.white),
        ),
        backgroundColor: const Color(0xFF151520),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(16),
            color: const Color(0xFF1A1A2E),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '🎯 YOLO Training Mode',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFFFD700),
                  ),
                ),
                SizedBox(height: 8),
                Text(
                  'Select a game state to capture screenshots for training.\n'
                  'The poker table will start in the selected state.',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey,
                  ),
                ),
              ],
            ),
          ),
          
          // State selection list
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: DebugState.trainingStates.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final state = DebugState.trainingStates[index];
                return _StateCard(state: state);
              },
            ),
          ),
          
          // Footer with instructions
          Container(
            padding: const EdgeInsets.all(16),
            color: const Color(0xFF151520),
            child: Row(
              children: [
                const Icon(Icons.info_outline, color: Colors.grey, size: 16),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    kDebugMode 
                      ? 'Debug mode active - screenshots will be clean'
                      : 'Production mode - debug features disabled',
                    style: const TextStyle(color: Colors.grey, fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StateCard extends StatelessWidget {
  final DebugState state;

  const _StateCard({required this.state});

  Color _getStateColor() {
    switch (state.name) {
      case 'CHECK':
        return const Color(0xFF1976D2);
      case 'CALL':
        return const Color(0xFF388E3C);
      case 'DEAL':
        return const Color(0xFFF57C00);
      case 'FLOP':
        return const Color(0xFF7B1FA2);
      case 'TURN':
        return const Color(0xFF00ACC1);
      case 'RIVER':
        return const Color(0xFFD32F2F);
      case 'RAISE':
        return const Color(0xFFFF5722);
      case 'NORMAL':
        return const Color(0xFF9E9E9E);
      default:
        return Colors.grey;
    }
  }

  IconData _getStateIcon() {
    switch (state.name) {
      case 'CHECK':
        return Icons.check_circle;
      case 'CALL':
        return Icons.phone_in_talk;
      case 'DEAL':
        return Icons.replay;
      case 'FLOP':
        return Icons.filter_3;
      case 'TURN':
        return Icons.filter_4;
      case 'RIVER':
        return Icons.filter_5;
      case 'RAISE':
        return Icons.trending_up;
      case 'NORMAL':
        return Icons.shuffle;
      default:
        return Icons.help;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _getStateColor();
    // Test key for automation: debug_state_CHECK, debug_state_CALL, etc.
    final testKey = 'debug_state_${state.name}';
    
    return Semantics(
      identifier: testKey,
      label: testKey,
      button: true,
      child: Material(
        key: Key(testKey),
        color: const Color(0xFF1A1A2E),
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(
                builder: (_) => PokerTableScreen(debugState: state),
              ),
            );
          },
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withOpacity(0.3)),
          ),
          child: Row(
            children: [
              // Icon
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(_getStateIcon(), color: color, size: 24),
              ),
              const SizedBox(width: 16),
              
              // State info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      state.name,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: color,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      state.description,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Colors.grey,
                      ),
                    ),
                    if (state.phase != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Phase: ${state.phase!.name} | Cards: ${state.communityCardCount ?? 0}',
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              
              // Arrow
              Icon(
                Icons.chevron_right,
                color: color.withOpacity(0.5),
              ),
            ],
          ),
        ),
      ),
      ),
    );
  }
}

