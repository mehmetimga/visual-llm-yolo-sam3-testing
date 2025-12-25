'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Slot symbols with their values
const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '7️⃣', '💎', '🎰'];
const SYMBOL_VALUES: Record<string, number> = {
  '🍒': 2,
  '🍋': 3,
  '🍊': 5,
  '🍇': 10,
  '7️⃣': 25,
  '💎': 50,
  '🎰': 100,
};

export default function SlotsPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [balance, setBalance] = useState(1000);
  const [bet, setBet] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState(['🍒', '🍋', '7️⃣']);
  const [lastWin, setLastWin] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Check auth
    const storedUser = sessionStorage.getItem('user');
    const storedBalance = sessionStorage.getItem('balance');
    
    if (!storedUser) {
      router.push('/');
      return;
    }

    setBalance(Number(storedBalance) || 1000);
  }, [router]);

  useEffect(() => {
    // Initialize canvas
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw game
    drawGame(ctx, reels, spinning, lastWin, bet);
  }, [reels, spinning, lastWin, bet]);

  const drawGame = (
    ctx: CanvasRenderingContext2D,
    currentReels: string[],
    isSpinning: boolean,
    win: number,
    currentBet: number
  ) => {
    const canvas = ctx.canvas;
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    // Draw slot machine frame
    drawSlotFrame(ctx, width, height);

    // Draw reels
    const reelWidth = 120;
    const reelHeight = 120;
    const startX = (width - reelWidth * 3 - 40) / 2;
    const startY = 80;

    for (let i = 0; i < 3; i++) {
      const x = startX + i * (reelWidth + 20);
      
      // Reel background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(x, startY, reelWidth, reelHeight);
      
      // Reel border
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, startY, reelWidth, reelHeight);

      // Symbol
      ctx.font = isSpinning ? '60px sans-serif' : '70px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      if (isSpinning) {
        // Show random symbol while spinning
        const randomSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        ctx.fillText(randomSymbol, x + reelWidth / 2, startY + reelHeight / 2);
      } else {
        ctx.fillText(currentReels[i], x + reelWidth / 2, startY + reelHeight / 2);
      }
    }

    // Draw win display
    ctx.fillStyle = win > 0 ? '#00ff88' : '#ffffff';
    ctx.font = 'bold 32px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(win > 0 ? `WIN: $${win}` : 'SPIN TO WIN!', width / 2, startY + reelHeight + 50);

    // Draw SPIN button (Canvas-rendered - no data-testid!)
    drawSpinButton(ctx, width / 2, height - 150, isSpinning);

    // Draw bet controls (Canvas-rendered - no data-testid!)
    drawBetControls(ctx, width / 2, height - 70, currentBet);
  };

  const drawSlotFrame = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Outer frame with neon glow
    ctx.shadowColor = '#ff00aa';
    ctx.shadowBlur = 20;
    ctx.strokeStyle = '#ff00aa';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, width - 40, height - 40);
    
    // Inner frame
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, width - 60, height - 60);

    // Title
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 28px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 10;
    ctx.fillText('🎰 MEGA SLOTS 🎰', width / 2, 55);
    ctx.shadowBlur = 0;
  };

  const drawSpinButton = (ctx: CanvasRenderingContext2D, x: number, y: number, isSpinning: boolean) => {
    const btnWidth = 200;
    const btnHeight = 60;

    // Button glow
    ctx.shadowColor = isSpinning ? '#666' : '#00ff88';
    ctx.shadowBlur = isSpinning ? 0 : 20;

    // Button background with gradient
    const gradient = ctx.createLinearGradient(x - btnWidth / 2, y, x + btnWidth / 2, y);
    if (isSpinning) {
      gradient.addColorStop(0, '#444');
      gradient.addColorStop(1, '#333');
    } else {
      gradient.addColorStop(0, '#00ff88');
      gradient.addColorStop(1, '#00cc66');
    }
    
    // Draw rounded rectangle
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x - btnWidth / 2, y - btnHeight / 2, btnWidth, btnHeight, 15);
    ctx.fill();

    // Button border
    ctx.strokeStyle = isSpinning ? '#555' : '#00ffaa';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Button text
    ctx.shadowBlur = 0;
    ctx.fillStyle = isSpinning ? '#888' : '#0a0a0f';
    ctx.font = 'bold 24px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isSpinning ? 'SPINNING...' : '🎰 SPIN 🎰', x, y);
  };

  const drawBetControls = (ctx: CanvasRenderingContext2D, x: number, y: number, currentBet: number) => {
    const btnSize = 50;
    const spacing = 120;

    // Minus button
    drawControlButton(ctx, x - spacing, y, btnSize, '-');

    // Bet display
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`BET: $${currentBet}`, x, y);

    // Plus button
    drawControlButton(ctx, x + spacing, y, btnSize, '+');
  };

  const drawControlButton = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, text: string) => {
    // Button glow
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 10;

    // Button background
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Button border
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Button text
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = canvas.width;
    const height = canvas.height;

    // Check SPIN button click
    const spinBtnX = width / 2;
    const spinBtnY = height - 150;
    const spinBtnWidth = 200;
    const spinBtnHeight = 60;

    if (
      x >= spinBtnX - spinBtnWidth / 2 &&
      x <= spinBtnX + spinBtnWidth / 2 &&
      y >= spinBtnY - spinBtnHeight / 2 &&
      y <= spinBtnY + spinBtnHeight / 2 &&
      !spinning
    ) {
      spin();
      return;
    }

    // Check bet controls
    const betY = height - 70;
    const btnSize = 50;
    const spacing = 120;

    // Minus button
    if (Math.hypot(x - (spinBtnX - spacing), y - betY) < btnSize / 2) {
      setBet(b => Math.max(5, b - 5));
      return;
    }

    // Plus button
    if (Math.hypot(x - (spinBtnX + spacing), y - betY) < btnSize / 2) {
      setBet(b => Math.min(100, b + 5));
      return;
    }
  };

  const spin = async () => {
    if (spinning || balance < bet) return;

    setSpinning(true);
    setLastWin(0);
    setMessage('');

    // Deduct bet
    const newBalance = balance - bet;
    setBalance(newBalance);
    sessionStorage.setItem('balance', String(newBalance));

    // Spin animation (random symbols for 2 seconds)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate final reels
    const finalReels = [
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
    ];

    setReels(finalReels);
    setSpinning(false);

    // Check win
    if (finalReels[0] === finalReels[1] && finalReels[1] === finalReels[2]) {
      // Three of a kind
      const winAmount = bet * SYMBOL_VALUES[finalReels[0]];
      setLastWin(winAmount);
      setMessage(`🎉 JACKPOT! ${finalReels[0]}${finalReels[0]}${finalReels[0]} 🎉`);
      const updatedBalance = newBalance + winAmount;
      setBalance(updatedBalance);
      sessionStorage.setItem('balance', String(updatedBalance));
    } else if (finalReels[0] === finalReels[1] || finalReels[1] === finalReels[2]) {
      // Two of a kind
      const matchSymbol = finalReels[0] === finalReels[1] ? finalReels[0] : finalReels[1];
      const winAmount = Math.floor(bet * SYMBOL_VALUES[matchSymbol] * 0.3);
      setLastWin(winAmount);
      setMessage(`Nice! Pair of ${matchSymbol}`);
      const updatedBalance = newBalance + winAmount;
      setBalance(updatedBalance);
      sessionStorage.setItem('balance', String(updatedBalance));
    }
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
            MEGA SLOTS
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
          height={450}
          onClick={handleCanvasClick}
          className="border-4 border-casino-purple rounded-xl cursor-pointer shadow-neon-pink"
          style={{ imageRendering: 'crisp-edges' }}
        />

        {/* Message */}
        {message && (
          <div className="mt-4 text-2xl font-display text-casino-neon neon-text">
            {message}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 text-center text-gray-400 text-sm max-w-md">
          <p>
            Click the <span className="text-casino-neon">SPIN</span> button on the canvas to play!
          </p>
          <p className="mt-2">
            Match 3 symbols for a jackpot, or 2 for a smaller win.
          </p>
          <p className="mt-2 text-casino-pink">
            💡 Note: The SPIN and BET buttons are canvas-rendered (no DOM testIds) - 
            perfect for testing vision-based automation!
          </p>
        </div>
      </div>
    </main>
  );
}

