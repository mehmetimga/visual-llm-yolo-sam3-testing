'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simple demo authentication
    if (username === 'demo' && (password === 'pw' || password === 'password123')) {
      // Store auth state
      sessionStorage.setItem('user', username);
      sessionStorage.setItem('balance', '1000');
      router.push('/lobby');
    } else {
      setError('Invalid credentials. Try demo/pw');
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold text-casino-accent neon-text mb-2">
            🎰 MEGA CASINO
          </h1>
          <p className="text-gray-400 font-body">
            AI UI Testing Demo
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-casino-card border border-casino-border rounded-2xl p-8 card-shine">
          <h2 className="font-display text-2xl text-center text-white mb-6">
            Welcome Back
          </h2>

          <form onSubmit={handleLogin} className="space-y-6">
            {/* Username Input */}
            <div>
              <label 
                htmlFor="username" 
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Username
              </label>
              <input
                id="username"
                data-testid="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full px-4 py-3 bg-casino-bg border border-casino-border rounded-lg 
                         text-white placeholder-gray-500 focus:border-casino-neon transition-colors"
                role="textbox"
                aria-label="Username"
              />
            </div>

            {/* Password Input */}
            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                data-testid="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 bg-casino-bg border border-casino-border rounded-lg 
                         text-white placeholder-gray-500 focus:border-casino-neon transition-colors"
                role="textbox"
                aria-label="Password"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div 
                data-testid="error-message"
                className="text-red-400 text-sm text-center bg-red-900/20 py-2 px-4 rounded-lg"
              >
                {error}
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              data-testid="login-btn"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-casino-accent to-yellow-600 
                       text-casino-bg font-display font-bold text-lg rounded-lg 
                       casino-btn gold-glow disabled:opacity-50 disabled:cursor-not-allowed"
              role="button"
              aria-label="Log In"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Logging in...
                </span>
              ) : (
                'Log In'
              )}
            </button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              Demo: <span className="text-casino-neon">demo</span> / <span className="text-casino-neon">pw</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>For AI UI Automation Testing PoC</p>
        </div>
      </div>
    </main>
  );
}

