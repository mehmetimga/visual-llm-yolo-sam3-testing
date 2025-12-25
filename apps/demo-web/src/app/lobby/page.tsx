'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Game {
  id: string;
  name: string;
  icon: string;
  description: string;
  href: string;
  testId: string;
}

const games: Game[] = [
  {
    id: 'slots',
    name: 'Mega Slots',
    icon: '🎰',
    description: 'Spin to win big jackpots!',
    href: '/games/slots',
    testId: 'slots-game',
  },
  {
    id: 'blackjack',
    name: 'Blackjack Pro',
    icon: '🃏',
    description: 'Beat the dealer to 21!',
    href: '/games/blackjack',
    testId: 'blackjack-game',
  },
  {
    id: 'roulette',
    name: 'Roulette',
    icon: '🎡',
    description: 'Bet on your lucky number!',
    href: '/games/roulette',
    testId: 'roulette-play',
  },
  {
    id: 'poker',
    name: 'Video Poker',
    icon: '🂡',
    description: 'Play classic video poker!',
    href: '/games/poker',
    testId: 'poker-play',
  },
];

export default function LobbyPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    // Check auth
    const storedUser = sessionStorage.getItem('user');
    const storedBalance = sessionStorage.getItem('balance');
    
    if (!storedUser) {
      router.push('/');
      return;
    }

    setUser(storedUser);
    setBalance(Number(storedBalance) || 1000);
  }, [router]);

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('balance');
    router.push('/');
  };

  if (!user) {
    return null; // Loading or redirecting
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="bg-casino-card border-b border-casino-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="font-display text-2xl font-bold text-casino-accent">
              🎰 Casino Lobby
            </h1>
          </div>

          <div className="flex items-center gap-6">
            {/* Balance Display */}
            <div 
              data-testid="balance-display"
              className="bg-casino-bg px-4 py-2 rounded-lg border border-casino-border"
            >
              <span className="text-gray-400 text-sm">Balance:</span>
              <span className="ml-2 font-display text-xl text-casino-accent">
                ${balance.toLocaleString()}
              </span>
            </div>

            {/* User Info */}
            <div className="flex items-center gap-3">
              <span className="text-gray-300">Welcome, <span className="text-casino-neon">{user}</span></span>
              <button
                data-testid="logout-btn"
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600/20 border border-red-500/50 rounded-lg 
                         text-red-400 hover:bg-red-600/30 transition-colors"
                role="button"
                aria-label="Logout"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Message */}
        <div className="text-center mb-8">
          <h2 className="font-display text-3xl text-white mb-2">
            Choose Your Game
          </h2>
          <p className="text-gray-400">
            Select a game to start playing and win big!
          </p>
        </div>

        {/* Game Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>

        {/* Join Now Feature (for testing) */}
        <div className="mt-12 text-center">
          <div className="bg-gradient-to-r from-casino-purple to-casino-pink p-8 rounded-2xl inline-block">
            <h3 className="font-display text-2xl text-white mb-4">
              VIP Tournament Starting Soon!
            </h3>
            <p className="text-gray-200 mb-6">
              Join now to compete for the grand prize!
            </p>
            <button
              data-testid="join-now"
              className="px-8 py-4 bg-casino-accent text-casino-bg font-display font-bold 
                       text-lg rounded-lg casino-btn gold-glow"
              role="button"
              aria-label="Join Now"
            >
              JOIN NOW
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-gray-500 text-sm border-t border-casino-border">
        <p>Demo Casino App - For AI UI Testing</p>
      </footer>
    </main>
  );
}

function GameCard({ game }: { game: Game }) {
  return (
    <div className="bg-casino-card border border-casino-border rounded-xl overflow-hidden 
                    hover:border-casino-neon transition-all duration-300 group card-shine">
      {/* Game Preview Area */}
      <div className="h-40 bg-gradient-to-br from-casino-purple/20 to-casino-pink/20 
                      flex items-center justify-center">
        <span className="text-6xl group-hover:scale-110 transition-transform duration-300">
          {game.icon}
        </span>
      </div>

      {/* Game Info */}
      <div className="p-4">
        <h3 className="font-display text-xl text-white mb-1">{game.name}</h3>
        <p className="text-gray-400 text-sm mb-4">{game.description}</p>
        
        <Link href={game.href}>
          <button
            data-testid={game.testId}
            className="w-full py-3 bg-gradient-to-r from-casino-neon to-emerald-500 
                     text-casino-bg font-display font-bold rounded-lg casino-btn
                     hover:shadow-neon transition-shadow"
            role="button"
            aria-label={`Play ${game.name}`}
          >
            PLAY NOW
          </button>
        </Link>
      </div>
    </div>
  );
}

