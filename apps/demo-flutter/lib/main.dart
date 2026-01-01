import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'screens/login_screen.dart';
import 'screens/lobby_screen.dart';
import 'screens/games/slots_screen.dart';
import 'screens/games/blackjack_screen.dart';
import 'screens/games/poker_screen.dart';
import 'screens/games/poker_table_screen.dart';
import 'screens/games/debug_poker_setup_screen.dart';
import 'rive/cached_fonts.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Preload fonts for Rive
  await _preloadRiveFonts();
  
  runApp(const DemoCasinoApp());
}

/// Preload fonts for Rive action buttons
Future<void> _preloadRiveFonts() async {
  debugPrint('Preloading Rive fonts...');
  final fonts = [
    'assets/fonts/DM Sans-Regular.ttf',
    'assets/fonts/DM Sans-Medium.ttf',
    'assets/fonts/DM Sans-Bold.ttf',
    'assets/fonts/IBM Plex Sans Condensed-Regular.ttf',
    'assets/fonts/IBM Plex Sans Condensed-Medium.ttf',
    'assets/fonts/IBM Plex Sans Condensed-SemiBold.ttf',
    'assets/fonts/IBM Plex Sans Condensed-Bold.ttf',
    'assets/fonts/Aldrich-Regular.ttf',
  ];
  
  for (final font in fonts) {
    try {
      await CachedFonts.instance.addFont(font);
    } catch (e) {
      debugPrint('Warning: Could not load font $font: $e');
    }
  }
  debugPrint('Rive fonts preloaded: ${CachedFonts.instance.fontCount} fonts');
}

class DemoCasinoApp extends StatelessWidget {
  const DemoCasinoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthProvider(),
      child: MaterialApp(
        title: 'Demo Casino',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          brightness: Brightness.dark,
          primaryColor: const Color(0xFFFFD700),
          scaffoldBackgroundColor: const Color(0xFF0A0A0F),
          colorScheme: const ColorScheme.dark(
            primary: Color(0xFFFFD700),
            secondary: Color(0xFF00FF88),
            surface: Color(0xFF151520),
          ),
          fontFamily: 'Rajdhani',
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xFF151520),
            elevation: 0,
          ),
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: const Color(0xFF0A0A0F),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFF2A2A3A)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFF2A2A3A)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFF00FF88)),
            ),
          ),
          elevatedButtonTheme: ElevatedButtonThemeData(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFFFD700),
              foregroundColor: const Color(0xFF0A0A0F),
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              textStyle: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        initialRoute: '/',
        routes: {
          '/': (context) => const LoginScreen(),
          '/lobby': (context) => const LobbyScreen(),
          '/games/slots': (context) => const SlotsScreen(),
          '/games/blackjack': (context) => const BlackjackScreen(),
          '/games/poker': (context) => const PokerScreen(),
          '/games/poker-table': (context) => const PokerTableScreen(),
          '/games/debug-poker-setup': (context) => const DebugPokerSetupScreen(),
        },
      ),
    );
  }
}

