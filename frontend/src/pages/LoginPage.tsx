import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

type AuthMode = 'login' | 'register';

// Generates a random sparkline path for the animated background
function generateSparklinePath(width: number, height: number, points: number): string {
  const step = width / (points - 1);
  let y = height * 0.5;
  const pts: string[] = [];
  for (let i = 0; i < points; i++) {
    y += (Math.random() - 0.48) * (height * 0.12);
    y = Math.max(height * 0.1, Math.min(height * 0.9, y));
    pts.push(`${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register, isAuthenticated, isLoading, error, clearError } = useAuthStore();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [localError, setLocalError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Sparkline animation
  const [sparkPaths, setSparkPaths] = useState<string[]>([]);

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    // Generate initial sparklines
    const paths = Array.from({ length: 5 }, () => generateSparklinePath(800, 400, 80));
    setSparkPaths(paths);

    // Animate: regenerate every 4s
    const interval = setInterval(() => {
      setSparkPaths(Array.from({ length: 5 }, () => generateSparklinePath(800, 400, 80)));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setLocalError('');
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (!email.trim() || !password.trim()) {
      setLocalError('All fields are required');
      return;
    }
    if (password.length < 4) {
      setLocalError('Password must be at least 4 characters');
      return;
    }

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, role);
      }
      setShowSuccess(true);
      setTimeout(() => navigate('/', { replace: true }), 600);
    } catch (err: any) {
      // Try mock/demo mode when backend is offline
      if (err.message?.includes('fetch') || err.message?.includes('Failed')) {
        handleDemoLogin();
      }
    }
  };

  // Demo mode — simulate auth when backend is offline
  const handleDemoLogin = () => {
    const mockToken = btoa(JSON.stringify({ alg: 'HS256' })) + '.' +
      btoa(JSON.stringify({ sub: email, role: mode === 'register' ? role : 'admin', exp: Date.now() / 1000 + 86400 })) + '.mock';
    localStorage.setItem('ss_token', mockToken);
    localStorage.setItem('ss_user', JSON.stringify({ email, role: mode === 'register' ? role : 'admin' }));
    // Directly set auth state
    useAuthStore.setState({
      user: { email, role: mode === 'register' ? role : 'admin' },
      token: mockToken,
      isAuthenticated: true,
      isAdmin: mode === 'register' ? role === 'admin' : true,
      isLoading: false,
      error: null,
    });
    setShowSuccess(true);
    setTimeout(() => navigate('/', { replace: true }), 600);
  };

  const displayError = localError || error;

  return (
    <div className="h-screen w-screen flex bg-bg overflow-hidden relative">
      {/* Scanline overlay applied via index.css on #root */}

      {/* Left panel — Animated chart background */}
      <div className="hidden lg:flex w-[55%] relative items-center justify-center overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(0, 229, 160, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 229, 160, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }} />

        {/* Animated sparklines */}
        <svg viewBox="0 0 800 400" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          {sparkPaths.map((d, i) => (
            <path
              key={`${i}-${d.slice(0, 20)}`}
              d={d}
              fill="none"
              stroke={i === 0 ? '#00e5a0' : `rgba(0, 229, 160, ${0.06 + i * 0.04})`}
              strokeWidth={i === 0 ? 2 : 1}
              className="transition-all duration-[3000ms] ease-in-out"
            />
          ))}
          {/* Gradient fill under main line */}
          {sparkPaths[0] && (
            <>
              <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00e5a0" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#00e5a0" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={`${sparkPaths[0]} L800,400 L0,400 Z`}
                fill="url(#sparkGrad)"
                className="transition-all duration-[3000ms] ease-in-out"
              />
            </>
          )}
        </svg>

        {/* Branding overlay */}
        <div className="relative z-10 text-center">
          {/* Diamond logo */}
          <div className="w-16 h-16 mx-auto mb-6 relative">
            <div className="absolute inset-0 border-2 border-accent-mint" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} />
            <div className="absolute inset-2 border border-accent-mint/30" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} />
          </div>
          <h1 className="font-display font-bold text-4xl text-text-primary tracking-[0.4em] mb-2">
            STOCKSENSE
          </h1>
          <p className="font-mono text-xs text-text-muted tracking-[0.2em]">
            AI TRADING INTELLIGENCE
          </p>
          <div className="mt-6 flex items-center justify-center gap-4 font-mono text-[10px] text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-accent-mint animate-pulse" />
              LIVE MARKET
            </span>
            <span>·</span>
            <span>POISON DETECTION</span>
            <span>·</span>
            <span>CONTINUOUS UNLEARN</span>
          </div>

          {/* Ticker strip */}
          <div className="mt-8 flex items-center justify-center gap-6 font-mono text-xs">
            <span className="text-accent-mint">AAPL <span className="text-text-muted">—</span> <span className="text-accent-mint">LIVE</span></span>
          </div>
        </div>

        {/* Vertical divider */}
        <div className="absolute right-0 top-[15%] bottom-[15%] w-px bg-gradient-to-b from-transparent via-accent-mint/30 to-transparent" />
      </div>

      {/* Right panel — Auth form */}
      <div className="flex-1 flex items-center justify-center px-6 lg:px-16">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="w-10 h-10 mx-auto mb-3 relative">
              <div className="absolute inset-0 border-2 border-accent-mint" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} />
            </div>
            <h1 className="font-display font-bold text-2xl text-text-primary tracking-[0.3em]">STOCKSENSE</h1>
          </div>

          {/* Mode toggle */}
          <div className="flex mb-6 border border-border">
            {(['login', 'register'] as AuthMode[]).map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-2.5 font-mono text-xs tracking-wider uppercase transition-all duration-200 ${
                  mode === m
                    ? 'bg-accent-mint/10 text-accent-mint border-b-2 border-accent-mint'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {m === 'login' ? 'SIGN IN' : 'REGISTER'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block font-mono text-[10px] text-text-muted uppercase tracking-wider mb-1.5">
                EMAIL
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="operator@stocksense.io"
                autoComplete="email"
                className="w-full bg-bg-panel border border-border text-text-primary font-mono text-sm px-3 py-2.5 outline-none focus:border-accent-mint transition-colors placeholder:text-text-muted/40"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block font-mono text-[10px] text-text-muted uppercase tracking-wider mb-1.5">
                PASSWORD
              </label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="w-full bg-bg-panel border border-border text-text-primary font-mono text-sm px-3 py-2.5 outline-none focus:border-accent-mint transition-colors placeholder:text-text-muted/40"
              />
            </div>

            {/* Role selector (register only) */}
            {mode === 'register' && (
              <div>
                <label className="block font-mono text-[10px] text-text-muted uppercase tracking-wider mb-1.5">
                  ROLE
                </label>
                <div className="flex gap-2">
                  {(['user', 'admin'] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`flex-1 py-2 font-mono text-xs border transition-all duration-200 ${
                        role === r
                          ? r === 'admin'
                            ? 'border-accent-warning text-accent-warning bg-accent-warning/10'
                            : 'border-accent-mint text-accent-mint bg-accent-mint/10'
                          : 'border-border text-text-muted hover:text-text-primary hover:border-text-muted/30'
                      }`}
                    >
                      {r === 'user' ? '◈ USER' : '⚡ ADMIN'}
                    </button>
                  ))}
                </div>
                {role === 'admin' && (
                  <p className="mt-1.5 font-mono text-[9px] text-accent-warning/70">
                    Admin access: full control plane, poison injection, unlearn triggers
                  </p>
                )}
              </div>
            )}

            {/* Error display */}
            {displayError && (
              <div className="px-3 py-2 border border-accent-danger/40 bg-accent-danger/5 font-mono text-xs text-accent-danger flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-accent-danger rounded-full animate-pulse-red shrink-0" />
                {displayError}
              </div>
            )}

            {/* Success display */}
            {showSuccess && (
              <div className="px-3 py-2 border border-accent-mint/40 bg-accent-mint/5 font-mono text-xs text-accent-mint flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-accent-mint rounded-full shrink-0" />
                Authenticated — redirecting...
              </div>
            )}

            {/* Submit */}
            <button
              id="auth-submit"
              type="submit"
              disabled={isLoading || showSuccess}
              className={`w-full py-3 border font-mono text-sm tracking-wider transition-all duration-200 ${
                isLoading || showSuccess
                  ? 'border-accent-mint/30 text-accent-mint/30 cursor-not-allowed'
                  : 'border-accent-mint text-accent-mint hover:bg-accent-mint hover:text-bg active:scale-[0.98]'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 border border-accent-mint/50 border-t-accent-mint animate-spin" style={{ borderRadius: '0' }} />
                  AUTHENTICATING...
                </span>
              ) : showSuccess ? (
                '✓ ACCESS GRANTED'
              ) : mode === 'login' ? (
                'AUTHENTICATE'
              ) : (
                'CREATE ACCOUNT'
              )}
            </button>
          </form>

          {/* Demo mode hint */}
          <div className="mt-6 text-center">
            <p className="font-mono text-[9px] text-text-muted/50">
              DEMO MODE · Backend offline? Auth simulated locally
            </p>
          </div>

          {/* Bottom version tag */}
          <div className="mt-8 flex items-center justify-between font-mono text-[9px] text-text-muted/30">
            <span>v0.1.0</span>
            <span>Qwen1.5-0.5B · AscentPlusDescent</span>
          </div>
        </div>
      </div>
    </div>
  );
}
