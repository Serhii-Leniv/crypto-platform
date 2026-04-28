import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWallets, deposit, withdraw } from '../api/wallets';
import Spinner from '../components/Spinner';
import { IconTrendingUp, IconTrendingDown } from '../components/icons';
import type { WalletResponse } from '../types';

const CURRENCY_COLORS = ['#f0b90b', '#627eea', '#26a17b', '#e84142', '#0033ad', '#ff007a'];

function currencyColor(currency: string): string {
  let hash = 0;
  for (const c of currency) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return CURRENCY_COLORS[Math.abs(hash) % CURRENCY_COLORS.length];
}

function WalletCard({ w }: { w: WalletResponse }) {
  const color = currencyColor(w.currency);
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: '#252930', border: '1px solid #3c4049' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
          style={{ background: `${color}22`, color }}
        >
          {w.currency.slice(0, 1)}
        </div>
        <div>
          <p className="font-bold leading-none" style={{ color: '#e2e8f0' }}>{w.currency}</p>
          <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>Wallet</p>
        </div>
      </div>

      {/* Balances */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs" style={{ color: '#6b7280' }}>Total</span>
          <span className="font-mono text-sm font-semibold" style={{ color: '#e2e8f0' }}>
            {parseFloat(w.balance).toFixed(8)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs" style={{ color: '#6b7280' }}>Available</span>
          <span className="font-mono text-sm font-semibold" style={{ color: '#0ecb81' }}>
            {parseFloat(w.availableBalance).toFixed(8)}
          </span>
        </div>
        <div className="h-px" style={{ background: '#3c4049' }} />
        <div className="flex justify-between items-center">
          <span className="text-xs" style={{ color: '#6b7280' }}>Locked</span>
          <span className="font-mono text-sm" style={{ color: '#f0b90b' }}>
            {parseFloat(w.lockedBalance).toFixed(8)}
          </span>
        </div>
      </div>
    </div>
  );
}

type FundsFormProps = { action: 'deposit' | 'withdraw' };

function FundsForm({ action }: FundsFormProps) {
  const qc = useQueryClient();
  const [currency, setCurrency] = useState('USDT');
  const [amount, setAmount]     = useState('');
  const [msg, setMsg]           = useState('');
  const [err, setErr]           = useState('');

  const isDeposit = action === 'deposit';
  const accentColor = isDeposit ? '#0ecb81' : '#f6465d';

  const mutation = useMutation({
    mutationFn: action === 'deposit' ? deposit : withdraw,
    onSuccess: () => {
      setMsg(`${isDeposit ? 'Deposit' : 'Withdrawal'} successful`);
      setErr('');
      setAmount('');
      qc.invalidateQueries({ queryKey: ['wallets'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (e: unknown) => {
      const err_ = e as { response?: { data?: { message?: string } }; message?: string };
      setErr(err_?.response?.data?.message ?? err_?.message ?? 'Failed');
      setMsg('');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    setErr('');
    mutation.mutate({ currency: currency.toUpperCase(), amount });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: isDeposit ? 'rgba(14,203,129,0.12)' : 'rgba(246,70,93,0.12)',
            color: accentColor,
          }}
        >
          {isDeposit ? <IconTrendingUp size={16} /> : <IconTrendingDown size={16} />}
        </div>
        <h3 className="font-semibold capitalize" style={{ color: '#e2e8f0' }}>{action}</h3>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: '#9ca3af' }}>
          Currency
        </label>
        <input
          required
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="input-field w-full px-3 py-2.5 rounded-lg text-sm text-gray-100 font-semibold"
          style={{ background: '#1e2026', border: '1px solid #3c4049', textTransform: 'uppercase' }}
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: '#9ca3af' }}>
          Amount
        </label>
        <input
          required
          type="number"
          step="0.00000001"
          min="0.00000001"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00000000"
          className="input-field w-full px-3 py-2.5 rounded-lg text-sm text-gray-100 font-mono"
          style={{ background: '#1e2026', border: '1px solid #3c4049' }}
        />
      </div>

      {msg && (
        <div
          className="flex items-center gap-2 px-3.5 py-3 rounded-lg text-xs"
          style={{
            background: 'rgba(14,203,129,0.08)',
            border: '1px solid rgba(14,203,129,0.2)',
            color: '#0ecb81',
          }}
        >
          <span className="font-bold">✓</span>
          {msg}
        </div>
      )}
      {err && (
        <div
          className="flex items-center gap-2 px-3.5 py-3 rounded-lg text-xs"
          style={{
            background: 'rgba(246,70,93,0.08)',
            border: '1px solid rgba(246,70,93,0.2)',
            color: '#f6465d',
          }}
        >
          <span className="font-bold">!</span>
          {err}
        </div>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full py-2.5 rounded-xl text-sm font-bold tracking-wide disabled:opacity-50 transition-opacity uppercase"
        style={{ background: accentColor, color: '#fff', letterSpacing: '0.06em' }}
      >
        {mutation.isPending ? '…' : action === 'deposit' ? 'Deposit' : 'Withdraw'}
      </button>
    </form>
  );
}

export default function WalletsPage() {
  const { data, isLoading, error } = useQuery<WalletResponse[]>({
    queryKey: ['wallets'],
    queryFn: getWallets,
    refetchInterval: 5000,
  });

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6" style={{ color: '#e2e8f0' }}>Wallets</h2>

      {isLoading && <Spinner />}
      {error && <p className="text-sm" style={{ color: '#f6465d' }}>Failed to load wallets.</p>}

      {data && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4 mb-8">
          {data.length === 0 && (
            <p className="col-span-4 text-sm" style={{ color: '#6b7280' }}>
              No wallets yet. Make a deposit to get started.
            </p>
          )}
          {data.map((w) => <WalletCard key={w.id} w={w} />)}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 max-w-xl">
        <div
          className="rounded-xl p-5"
          style={{ background: '#252930', border: '1px solid #3c4049' }}
        >
          <FundsForm action="deposit" />
        </div>
        <div
          className="rounded-xl p-5"
          style={{ background: '#252930', border: '1px solid #3c4049' }}
        >
          <FundsForm action="withdraw" />
        </div>
      </div>
    </div>
  );
}
