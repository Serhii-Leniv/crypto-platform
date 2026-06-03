import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const DEMO_ACCOUNTS = [
  { email: 'alice@demo.io',   label: 'Alice',   tag: 'Admin' },
  { email: 'bob@demo.io',     label: 'Bob',     tag: 'Trader' },
  { email: 'charlie@demo.io', label: 'Charlie', tag: 'Trader' },
];

export default function LoginPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
      navigate('/dashboard');
    } catch (err: unknown) {
      const er = err as { response?: { data?: { message?: string } }; message?: string };
      setError(er?.response?.data?.message ?? er?.message ?? 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  async function quickLogin(em: string) {
    setEmail(em);
    setPassword('Password1');
    setError('');
    setLoading(true);
    try {
      await login(em, 'Password1');
      navigate('/dashboard');
    } catch (err: unknown) {
      const er = err as { response?: { data?: { message?: string } }; message?: string };
      setError(er?.response?.data?.message ?? er?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#0a0e14' }}>
      {/* ─── LEFT: brand / pitch ─── */}
      <div
        className="hidden lg:flex flex-col justify-between p-12 w-1/2 relative overflow-hidden"
        style={{ background: '#0d121a', borderRight: '1px solid #2a3441' }}
      >
        {/* Subtle radial accent */}
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,104,255,0.10), transparent 70%)' }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,208,156,0.06), transparent 70%)' }}
        />

        <div className="relative">
          <div className="text-2xl font-semibold" style={{ color: '#f5f6f8' }}>
            Kairos <span style={{ color: '#6c7684', fontWeight: 400 }}>Capital</span>
          </div>
          <div className="text-xs mt-1 mono" style={{ color: '#6c7684' }}>
            Real-exchange-grade trading platform
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-light leading-tight mb-6" style={{ color: '#f5f6f8' }}>
            Matching engine, settlement, and risk —{' '}
            <span style={{ color: '#0068ff' }}>built like an exchange.</span>
          </h1>
          <ul className="space-y-3 text-sm" style={{ color: '#a0a8b4' }}>
            <li className="flex gap-3">
              <span style={{ color: '#00d09c' }}>›</span>
              <span><span style={{ color: '#f5f6f8' }}>Price-time priority</span> matching with self-trade prevention.</span>
            </li>
            <li className="flex gap-3">
              <span style={{ color: '#00d09c' }}>›</span>
              <span><span style={{ color: '#f5f6f8' }}>Synchronous fund locking</span> before book entry — no trading on credit.</span>
            </li>
            <li className="flex gap-3">
              <span style={{ color: '#00d09c' }}>›</span>
              <span><span style={{ color: '#f5f6f8' }}>Atomic 4-wallet settlement</span> with maker / taker fees and slippage refunds.</span>
            </li>
            <li className="flex gap-3">
              <span style={{ color: '#00d09c' }}>›</span>
              <span><span style={{ color: '#f5f6f8' }}>GTC · IOC · FOK · POST_ONLY</span> plus stop-limit orders.</span>
            </li>
          </ul>
        </div>

        <div className="relative grid grid-cols-3 gap-3 max-w-md text-xs">
          <Metric value="< 5ms" label="settle p99" />
          <Metric value="14 levels" label="order book" />
          <Metric value="atomic"   label="4-wallet xfer" />
        </div>
      </div>

      {/* ─── RIGHT: form ─── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 relative">
        {/* Mobile brand */}
        <div className="lg:hidden mb-8 text-center">
          <div className="text-lg font-semibold" style={{ color: '#f5f6f8' }}>
            Kairos <span style={{ color: '#6c7684', fontWeight: 400 }}>Capital</span>
          </div>
        </div>

        <div className="w-full max-w-sm">
          <h2 className="text-lg font-semibold mb-1" style={{ color: '#f5f6f8' }}>
            {tab === 'login' ? 'Welcome back' : 'Create an account'}
          </h2>
          <p className="text-xs mb-6" style={{ color: '#6c7684' }}>
            {tab === 'login' ? 'Sign in to your Kairos account.' : 'Start trading in seconds.'}
          </p>

          <div className="flex mb-6" style={{ borderBottom: '1px solid #2a3441' }}>
            {(['login', 'register'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); }}
                className="pb-3 mr-6 text-sm relative transition-colors"
                style={{ color: tab === t ? '#f5f6f8' : '#6c7684' }}
              >
                {t === 'login' ? 'Sign in' : 'Register'}
                {tab === t && (
                  <span className="absolute bottom-0 left-0 right-0" style={{ height: 2, background: '#0068ff' }} />
                )}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#a0a8b4' }}>Email</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mono w-full px-3 py-2 text-sm"
                style={{ background: '#11161d', border: '1px solid #2a3441', color: '#f5f6f8' }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#a0a8b4' }}>Password</label>
              <input
                type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                className="mono w-full px-3 py-2 text-sm"
                style={{ background: '#11161d', border: '1px solid #2a3441', color: '#f5f6f8' }}
              />
            </div>

            {error && (
              <div
                className="px-3 py-2 text-xs"
                style={{ background: 'rgba(255,77,94,0.08)', border: '1px solid rgba(255,77,94,0.25)', color: '#ff4d5e' }}
              >
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full py-2.5 text-sm font-medium transition-opacity disabled:opacity-50"
              style={{ background: '#0068ff', color: '#fff' }}
            >
              {loading ? 'Signing in…' : tab === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="mt-8 pt-6" style={{ borderTop: '1px solid #1a2029' }}>
            <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: '#6c7684' }}>
              Try a demo account
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  onClick={() => quickLogin(a.email)}
                  disabled={loading}
                  className="flex flex-col items-start p-2.5 text-left transition-colors disabled:opacity-50"
                  style={{ background: '#11161d', border: '1px solid #2a3441' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#0068ff'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a3441'; }}
                >
                  <span className="text-xs font-medium" style={{ color: '#f5f6f8' }}>{a.label}</span>
                  <span className="text-[10px] mt-0.5" style={{ color: a.tag === 'Admin' ? '#0068ff' : '#6c7684' }}>
                    {a.tag}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[10px] mt-2.5" style={{ color: '#6c7684' }}>
              Password for all demo accounts: <span className="mono" style={{ color: '#a0a8b4' }}>Password1</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-3 py-2" style={{ background: '#11161d', border: '1px solid #2a3441' }}>
      <div className="mono text-sm font-semibold leading-tight" style={{ color: '#f5f6f8' }}>{value}</div>
      <div className="text-[10px] mt-0.5" style={{ color: '#6c7684' }}>{label}</div>
    </div>
  );
}
