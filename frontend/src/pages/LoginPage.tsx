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
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Something went wrong';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#1e2026' }}>
      <div
        className="w-full max-w-md rounded-xl p-8"
        style={{ background: '#252930', border: '1px solid #3c4049' }}
      >
        <h1 className="text-2xl font-bold text-center mb-6" style={{ color: '#f0b90b' }}>
          CryptoEx
        </h1>

        {/* Tabs */}
        <div className="flex rounded-lg overflow-hidden mb-6" style={{ background: '#1e2026' }}>
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 text-sm font-medium capitalize transition-colors"
              style={{
                background: tab === t ? '#f0b90b' : 'transparent',
                color: tab === t ? '#1e2026' : '#9ca3af',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded text-sm text-gray-100 outline-none focus:ring-1 focus:ring-yellow-400"
              style={{ background: '#1e2026', border: '1px solid #3c4049' }}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded text-sm text-gray-100 outline-none focus:ring-1 focus:ring-yellow-400"
              style={{ background: '#1e2026', border: '1px solid #3c4049' }}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 rounded px-3 py-2" style={{ background: 'rgba(239,68,68,0.1)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded font-semibold text-sm transition-opacity disabled:opacity-50"
            style={{ background: '#f0b90b', color: '#1e2026' }}
          >
            {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
