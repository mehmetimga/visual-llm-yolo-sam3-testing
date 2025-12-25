'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Card types
interface Card {
  suit: string;
  value: string;
  numValue: number;
}

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let i = 0; i < VALUES.length; i++) {
      const value = VALUES[i];
      let numValue = i + 1;
      if (value === 'A') numValue = 11;
      else if (['J', 'Q', 'K'].includes(value)) numValue = 10;
      deck.push({ suit, value, numValue });
    }
  }
  return shuffle(deck);
}

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function calculateHand(cards: Card[]): number {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.value === 'A') {
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

type GameState = 'betting' | 'playing' | 'dealerTurn' | 'ended';

export default function BlackjackPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [balance, setBalance] = useState(1000);
  const [bet, setBet] = useState(25);
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [gameState, setGameState] = useState<GameState>('betting');
  const [message, setMessage] = useState('Place your bet and click Deal!');
  const [lastWin, setLastWin] = useState(0);

  useEffect(() => {
    // Check auth
    const storedUser = sessionStorage.getItem('user');
    const storedBalance = sessionStorage.getItem('balance');
    
    if (!storedUser) {
      router.push('/');
      return;
    }

    setBalance(Number(storedBalance) || 1000);
    setDeck(createDeck());
  }, [router]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawGame(ctx);
  }, [playerHand, dealerHand, gameState, bet, lastWin]);

  const drawGame = (ctx: CanvasRenderingContext2D) => {
    const canvas = ctx.canvas;
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#0f4c3a';  // Green felt color
    ctx.fillRect(0, 0, width, height);

    // Draw border
    ctx.strokeStyle = '#8b4513';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, width - 8, height - 8);

    // Draw table pattern
    ctx.strokeStyle = '#0a3a2e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 150, 0, Math.PI * 2);
    ctx.stroke();

    // Draw title
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 24px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BLACKJACK', width / 2, 35);

    // Draw dealer area
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DEALER', width / 2, 60);

    // Draw dealer cards
    const dealerY = 80;
    const cardWidth = 60;
    const cardHeight = 84;
    const dealerStartX = width / 2 - (dealerHand.length * (cardWidth + 10)) / 2;

    dealerHand.forEach((card, i) => {
      const x = dealerStartX + i * (cardWidth + 10);
      if (gameState === 'playing' && i === 1) {
        // Hide second card during player's turn
        drawCardBack(ctx, x, dealerY, cardWidth, cardHeight);
      } else {
        drawCard(ctx, card, x, dealerY, cardWidth, cardHeight);
      }
    });

    // Draw dealer score
    if (gameState !== 'betting' && dealerHand.length > 0) {
      const dealerScore = gameState === 'playing' 
        ? dealerHand[0].numValue 
        : calculateHand(dealerHand);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px Orbitron, sans-serif';
      ctx.fillText(
        gameState === 'playing' ? `${dealerScore} + ?` : `Score: ${dealerScore}`,
        width / 2,
        dealerY + cardHeight + 25
      );
    }

    // Draw player area
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Rajdhani, sans-serif';
    ctx.fillText('YOUR HAND', width / 2, 240);

    // Draw player cards
    const playerY = 255;
    const playerStartX = width / 2 - (playerHand.length * (cardWidth + 10)) / 2;

    playerHand.forEach((card, i) => {
      const x = playerStartX + i * (cardWidth + 10);
      drawCard(ctx, card, x, playerY, cardWidth, cardHeight);
    });

    // Draw player score
    if (playerHand.length > 0) {
      const playerScore = calculateHand(playerHand);
      ctx.fillStyle = playerScore > 21 ? '#ff4444' : '#00ff88';
      ctx.font = 'bold 24px Orbitron, sans-serif';
      ctx.fillText(`Score: ${playerScore}`, width / 2, playerY + cardHeight + 30);
    }

    // Draw game buttons based on state
    if (gameState === 'betting') {
      drawDealButton(ctx, width / 2, 430);
    } else if (gameState === 'playing') {
      drawHitStandButtons(ctx, width / 2, 430);
    }

    // Draw bet display
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 18px Orbitron, sans-serif';
    ctx.fillText(`Current Bet: $${bet}`, width / 2, height - 20);
  };

  const drawCard = (
    ctx: CanvasRenderingContext2D,
    card: Card,
    x: number,
    y: number,
    w: number,
    h: number
  ) => {
    // Card background
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 5);
    ctx.fill();

    // Card border
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Card content
    const isRed = card.suit === '♥' || card.suit === '♦';
    ctx.fillStyle = isRed ? '#cc0000' : '#000000';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Value top-left
    ctx.textAlign = 'left';
    ctx.fillText(card.value, x + 5, y + 15);
    
    // Suit center
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card.suit, x + w / 2, y + h / 2);
    
    // Value bottom-right (inverted)
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(card.value, x + w - 5, y + h - 10);
  };

  const drawCardBack = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ) => {
    // Card background
    ctx.fillStyle = '#1a237e';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 5);
    ctx.fill();

    // Pattern
    ctx.strokeStyle = '#3949ab';
    ctx.lineWidth = 1;
    for (let i = 0; i < w; i += 8) {
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i, y + h);
      ctx.stroke();
    }
    for (let i = 0; i < h; i += 8) {
      ctx.beginPath();
      ctx.moveTo(x, y + i);
      ctx.lineTo(x + w, y + i);
      ctx.stroke();
    }

    // Border
    ctx.strokeStyle = '#5c6bc0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 5);
    ctx.stroke();
  };

  const drawDealButton = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    const btnWidth = 150;
    const btnHeight = 50;

    // Button glow
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 15;

    // Button background
    const gradient = ctx.createLinearGradient(x - btnWidth / 2, y, x + btnWidth / 2, y);
    gradient.addColorStop(0, '#ffd700');
    gradient.addColorStop(1, '#ffaa00');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 10);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Button text
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 20px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DEAL', x, y);
  };

  const drawHitStandButtons = (ctx: CanvasRenderingContext2D, centerX: number, y: number) => {
    const btnWidth = 120;
    const btnHeight = 50;
    const spacing = 20;

    // HIT button
    const hitX = centerX - btnWidth / 2 - spacing;
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 15;
    
    let gradient = ctx.createLinearGradient(hitX - btnWidth / 2, y, hitX + btnWidth / 2, y);
    gradient.addColorStop(0, '#00ff88');
    gradient.addColorStop(1, '#00cc66');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(hitX - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 10);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 18px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HIT', hitX, y);

    // STAND button
    const standX = centerX + btnWidth / 2 + spacing;
    ctx.shadowColor = '#ff4444';
    ctx.shadowBlur = 15;
    
    gradient = ctx.createLinearGradient(standX - btnWidth / 2, y, standX + btnWidth / 2, y);
    gradient.addColorStop(0, '#ff4444');
    gradient.addColorStop(1, '#cc0000');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(standX - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 10);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Orbitron, sans-serif';
    ctx.fillText('STAND', standX, y);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = canvas.width;

    const btnY = 430;
    const btnHeight = 50;

    if (gameState === 'betting') {
      // Check DEAL button
      const btnWidth = 150;
      if (
        x >= width / 2 - btnWidth / 2 &&
        x <= width / 2 + btnWidth / 2 &&
        y >= btnY - btnHeight / 2 &&
        y <= btnY + btnHeight / 2
      ) {
        deal();
      }
    } else if (gameState === 'playing') {
      // Check HIT/STAND buttons
      const btnWidth = 120;
      const spacing = 20;
      const hitX = width / 2 - btnWidth / 2 - spacing;
      const standX = width / 2 + btnWidth / 2 + spacing;

      // HIT button
      if (
        x >= hitX - btnWidth / 2 &&
        x <= hitX + btnWidth / 2 &&
        y >= btnY - btnHeight / 2 &&
        y <= btnY + btnHeight / 2
      ) {
        hit();
      }

      // STAND button
      if (
        x >= standX - btnWidth / 2 &&
        x <= standX + btnWidth / 2 &&
        y >= btnY - btnHeight / 2 &&
        y <= btnY + btnHeight / 2
      ) {
        stand();
      }
    }
  };

  const deal = () => {
    if (balance < bet) {
      setMessage('Insufficient balance!');
      return;
    }

    // Deduct bet
    const newBalance = balance - bet;
    setBalance(newBalance);
    sessionStorage.setItem('balance', String(newBalance));

    // Create new deck and deal cards
    const newDeck = createDeck();
    const playerCards = [newDeck.pop()!, newDeck.pop()!];
    const dealerCards = [newDeck.pop()!, newDeck.pop()!];

    setDeck(newDeck);
    setPlayerHand(playerCards);
    setDealerHand(dealerCards);
    setGameState('playing');
    setMessage('Hit or Stand?');
    setLastWin(0);

    // Check for blackjack
    if (calculateHand(playerCards) === 21) {
      setTimeout(() => endGame(playerCards, dealerCards), 500);
    }
  };

  const hit = () => {
    if (gameState !== 'playing') return;

    const newDeck = [...deck];
    const newCard = newDeck.pop()!;
    const newHand = [...playerHand, newCard];

    setDeck(newDeck);
    setPlayerHand(newHand);

    const score = calculateHand(newHand);
    if (score > 21) {
      setGameState('ended');
      setMessage('BUST! You lose.');
    } else if (score === 21) {
      stand();
    }
  };

  const stand = async () => {
    if (gameState !== 'playing') return;

    setGameState('dealerTurn');
    setMessage("Dealer's turn...");

    // Dealer plays
    let currentDeck = [...deck];
    let currentDealerHand = [...dealerHand];

    while (calculateHand(currentDealerHand) < 17) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const newCard = currentDeck.pop()!;
      currentDealerHand = [...currentDealerHand, newCard];
      setDealerHand(currentDealerHand);
      setDeck(currentDeck);
    }

    endGame(playerHand, currentDealerHand);
  };

  const endGame = (player: Card[], dealer: Card[]) => {
    const playerScore = calculateHand(player);
    const dealerScore = calculateHand(dealer);

    setGameState('ended');

    let winAmount = 0;

    if (playerScore > 21) {
      setMessage('BUST! You lose.');
    } else if (dealerScore > 21) {
      winAmount = bet * 2;
      setMessage('Dealer busts! You win!');
    } else if (playerScore > dealerScore) {
      winAmount = bet * 2;
      setMessage(`You win! ${playerScore} vs ${dealerScore}`);
    } else if (playerScore < dealerScore) {
      setMessage(`Dealer wins. ${dealerScore} vs ${playerScore}`);
    } else {
      winAmount = bet;
      setMessage('Push! Bet returned.');
    }

    if (winAmount > 0) {
      setLastWin(winAmount);
      const newBalance = balance + winAmount;
      setBalance(newBalance);
      sessionStorage.setItem('balance', String(newBalance));
    }

    // Reset for new game after delay
    setTimeout(() => {
      setGameState('betting');
      setPlayerHand([]);
      setDealerHand([]);
      setMessage('Place your bet and click Deal!');
    }, 3000);
  };

  return (
    <main className="min-h-screen bg-casino-bg">
      {/* Header */}
      <header className="bg-casino-card border-b border-casino-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/lobby">
            <button
              data-testid="back-to-lobby"
              className="px-4 py-2 bg-casino-bg border border-casino-border rounded-lg 
                       text-gray-300 hover:border-casino-neon transition-colors"
              role="button"
              aria-label="Back to Lobby"
            >
              ← Back to Lobby
            </button>
          </Link>

          <h1 className="font-display text-2xl font-bold text-casino-accent">
            BLACKJACK
          </h1>

          <div 
            data-testid="balance-display"
            className="bg-casino-bg px-4 py-2 rounded-lg border border-casino-border"
          >
            <span className="text-gray-400 text-sm">Balance:</span>
            <span className="ml-2 font-display text-xl text-casino-accent">
              ${balance.toLocaleString()}
            </span>
          </div>
        </div>
      </header>

      {/* Game Canvas */}
      <div className="flex flex-col items-center justify-center py-8">
        <canvas
          ref={canvasRef}
          width={500}
          height={500}
          onClick={handleCanvasClick}
          className="rounded-xl cursor-pointer shadow-2xl"
          style={{ imageRendering: 'crisp-edges' }}
        />

        {/* Message */}
        <div className={`mt-4 text-2xl font-display ${lastWin > 0 ? 'text-casino-neon neon-text' : 'text-white'}`}>
          {message}
          {lastWin > 0 && ` (+$${lastWin})`}
        </div>

        {/* Instructions */}
        <div className="mt-6 text-center text-gray-400 text-sm max-w-md">
          <p>
            Click <span className="text-casino-accent">DEAL</span> to start, 
            then <span className="text-casino-neon">HIT</span> for another card or 
            <span className="text-red-400"> STAND</span> to keep your hand.
          </p>
          <p className="mt-2 text-casino-pink">
            💡 Note: All game buttons are canvas-rendered (no DOM testIds) - 
            perfect for testing vision-based automation!
          </p>
        </div>
      </div>
    </main>
  );
}

