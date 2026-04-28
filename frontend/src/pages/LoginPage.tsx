import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { IconTrade } from '../components/icons';

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
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = e?.response?.data?.message ?? e?.message ?? 'Something went wrong';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: '#1e2026' }}
    >
      {/* Dot grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #3c4049 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          opacity: 0.5,
        }}
      />
      {/* Radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, #1e2026 100%)',
        }}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-sm rounded-2xl px-8 py-10"
        style={{ background: '#252930', border: '1px solid #3c4049' }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
            style={{ background: 'linear-gradient(135deg, #f0b90b, #d4a309)' }}
          >
            <IconTrade size={22} style={{ color: '#1e2026' }} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#e2e8f0' }}>
            CryptoEx
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
            Professional Trading Platform
          </p>
        </div>

        {/* Tabs — underline style */}
        <div className="flex mb-7" style={{ borderBottom: '1px solid #3c4049' }}>
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              className="flex-1 pb-3 text-sm font-medium relative transition-colors"
              style={{ color: tab === t ? '#f0b90b' : '#6b7280' }}
            >
              {t === 'login' ? 'Sign In' : 'Create Account'}
              {tab === t && (
                <span
                  className="absolute bottom-0 left-0 right-0 rounded-t"
                  style={{ height: 2, background: '#f0b90b' }}
                />
              )}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#9ca3af' }}>
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input-field w-full px-3 py-2.5 rounded-lg text-sm text-gray-100"
              style={{ background: '#1e2026', border: '1px solid #3c4049' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#9ca3af' }}>
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-field w-full px-3 py-2.5 rounded-lg text-sm text-gray-100"
              style={{ background: '#1e2026', border: '1px solid #3c4049' }}
            />
          </div>

          {error && (
            <div
              className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg text-sm"
              style={{ background: 'rgba(246,70,93,0.08)', border: '1px solid rgba(246,70,93,0.2)', color: '#f6465d' }}
            >
              <span className="font-bold mt-px leading-none">!</span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-50 mt-1"
            style={{ background: '#f0b90b', color: '#1e2026' }}
          >
            {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
