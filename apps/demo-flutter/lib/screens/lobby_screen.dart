import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

class GameInfo {
  final String id;
  final String name;
  final String icon;
  final String description;
  final String route;
  final String testKey;
  final String buttonText;

  const GameInfo({
    required this.id,
    required this.name,
    required this.icon,
    required this.description,
    required this.route,
    required this.testKey,
    this.buttonText = 'PLAY NOW',
  });
}

const games = [
  GameInfo(
    id: 'slots',
    name: 'Mega Slots',
    icon: '🎰',
    description: 'Spin to win big jackpots!',
    route: '/games/slots',
    testKey: 'slots_play_button',
  ),
  GameInfo(
    id: 'blackjack',
    name: 'Blackjack',
    icon: '🃏',
    description: 'Beat the dealer to 21!',
    route: '/games/blackjack',
    testKey: 'blackjack_play_button',
  ),
  GameInfo(
    id: 'roulette',
    name: 'Roulette',
    icon: '🎡',
    description: 'Bet on your lucky number!',
    route: '/games/roulette',
    testKey: 'roulette_play_button',
  ),
  GameInfo(
    id: 'poker',
    name: 'Texas Hold\'em',
    icon: '🂡',
    description: 'Beat the dealer at poker!',
    route: '/games/poker',
    testKey: 'poker_play_button',
  ),
  GameInfo(
    id: 'poker-table',
    name: 'Poker Table',
    icon: '🎴',
    description: 'Play with 3 AI opponents!',
    route: '/games/poker-table',
    testKey: 'poker_table_play_button',
    buttonText: 'PLAY POKER',
  ),
];

class LobbyScreen extends StatelessWidget {
  const LobbyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Text('🎰 ', style: TextStyle(fontSize: 24)),
            Text(
              'Casino Lobby',
              style: TextStyle(
                color: Color(0xFFFFD700),
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        actions: [
          // Balance Display
          Consumer<AuthProvider>(
            builder: (context, auth, _) => Container(
              key: const Key('balance_display'),
              margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF0A0A0F),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFF2A2A3A)),
              ),
              child: Row(
                children: [
                  const Text(
                    'Balance: ',
                    style: TextStyle(color: Colors.grey, fontSize: 14),
                  ),
                  Text(
                    '\$${auth.balance}',
                    style: const TextStyle(
                      color: Color(0xFFFFD700),
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ),
          // Logout Button
          IconButton(
            key: const Key('logout_button'),
            icon: const Icon(Icons.logout, color: Colors.red),
            onPressed: () {
              Provider.of<AuthProvider>(context, listen: false).logout();
              Navigator.pushReplacementNamed(context, '/');
            },
            tooltip: 'Logout',
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
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Welcome Message
              const Text(
                'Choose Your Game',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Select a game to start playing and win big!',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.grey,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 24),

              // Game Grid
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 16,
                  mainAxisSpacing: 16,
                  childAspectRatio: 0.85,
                ),
                itemCount: games.length,
                itemBuilder: (context, index) => GameCard(game: games[index]),
              ),

              const SizedBox(height: 32),

              // VIP Tournament Banner
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF8B5CF6), Color(0xFFFF00AA)],
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  children: [
                    const Text(
                      'VIP Tournament Starting Soon!',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Join now to compete for the grand prize!',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      key: const Key('join_now_button'),
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Tournament coming soon!'),
                          ),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFFFD700),
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 48,
                          vertical: 16,
                        ),
                      ),
                      child: const Text(
                        'JOIN NOW',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class GameCard extends StatelessWidget {
  final GameInfo game;

  const GameCard({super.key, required this.game});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF151520),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF2A2A3A)),
      ),
      child: Column(
        children: [
          // Game Icon Area
          Expanded(
            flex: 3,
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    const Color(0xFF8B5CF6).withOpacity(0.2),
                    const Color(0xFFFF00AA).withOpacity(0.2),
                  ],
                ),
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(16),
                ),
              ),
              child: Center(
                child: Text(
                  game.icon,
                  style: const TextStyle(fontSize: 48),
                ),
              ),
            ),
          ),

          // Game Info
          Expanded(
            flex: 4,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    game.name,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    game.description,
                    style: const TextStyle(
                      color: Colors.grey,
                      fontSize: 12,
                    ),
                  ),
                  const Spacer(),
                  ElevatedButton(
                    key: Key(game.testKey),
                    onPressed: () {
                      if (game.route.contains('slots') ||
                          game.route.contains('blackjack') ||
                          game.route.contains('poker') ||
                          game.route.contains('poker-table')) {
                        Navigator.pushNamed(context, game.route);
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('${game.name} coming soon!'),
                          ),
                        );
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF00FF88),
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: Text(
                      game.buttonText,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

