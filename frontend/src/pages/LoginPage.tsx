import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

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
      const msg = e?.response?.data?.message ?? e?.message ?? 'Authentication failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: '#0a0e14' }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <span className="text-lg font-semibold" style={{ color: '#f5f6f8' }}>Kairos Capital</span>
        </div>

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
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field mono w-full px-3 py-2 text-sm"
              style={{ background: '#11161d', border: '1px solid #2a3441', color: '#f5f6f8' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#a0a8b4' }}>Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field mono w-full px-3 py-2 text-sm"
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
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: '#0068ff', color: '#fff' }}
          >
            {loading ? 'Signing in…' : tab === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="text-xs mt-8" style={{ color: '#6c7684' }}>
          Demo: <span
            className="mono cursor-pointer"
            style={{ color: '#a0a8b4' }}
            onClick={() => { setEmail('alice@demo.io'); setPassword('Password1'); setTab('login'); }}
          >alice@demo.io</span>
          {' / '}
          <span
            className="mono cursor-pointer"
            style={{ color: '#a0a8b4' }}
            onClick={() => { setEmail('bob@demo.io'); setPassword('Password1'); setTab('login'); }}
          >bob@demo.io</span>
          {' / '}
          <span
            className="mono cursor-pointer"
            style={{ color: '#a0a8b4' }}
            onClick={() => { setEmail('charlie@demo.io'); setPassword('Password1'); setTab('login'); }}
          >charlie@demo.io</span>
          {' — password '}
          <span className="mono" style={{ color: '#a0a8b4' }}>Password1</span>
        </p>
      </div>
    </div>
  );
}
