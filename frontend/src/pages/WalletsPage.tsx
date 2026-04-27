import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWallets, deposit, withdraw } from '../api/wallets';
import Spinner from '../components/Spinner';
import type { WalletResponse } from '../types';

function WalletCard({ w }: { w: WalletResponse }) {
  return (
    <div className="rounded-xl p-5" style={{ background: '#252930', border: '1px solid #3c4049' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-lg text-gray-100">{w.currency}</span>
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Total</span>
          <span className="font-mono text-gray-100">{parseFloat(w.balance).toFixed(8)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Available</span>
          <span className="font-mono" style={{ color: '#0ecb81' }}>{parseFloat(w.availableBalance).toFixed(8)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Locked</span>
          <span className="font-mono text-yellow-400">{parseFloat(w.lockedBalance).toFixed(8)}</span>
        </div>
      </div>
    </div>
  );
}

type FundsFormProps = { action: 'deposit' | 'withdraw' };
function FundsForm({ action }: FundsFormProps) {
  const qc = useQueryClient();
  const [currency, setCurrency] = useState('USDT');
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const mutation = useMutation({
    mutationFn: action === 'deposit' ? deposit : withdraw,
    onSuccess: () => {
      setMsg(`${action === 'deposit' ? 'Deposit' : 'Withdrawal'} successful`);
      setErr('');
      setAmount('');
      qc.invalidateQueries({ queryKey: ['wallets'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (e: any) => {
      setErr(e?.response?.data?.message ?? e?.message ?? 'Failed');
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
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="font-semibold text-gray-100 capitalize">{action}</h3>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Currency</label>
        <input
          required
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="w-full px-3 py-2 rounded text-sm text-gray-100 outline-none focus:ring-1 focus:ring-yellow-400"
          style={{ background: '#1e2026', border: '1px solid #3c4049' }}
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Amount</label>
        <input
          required
          type="number"
          step="0.00000001"
          min="0.00000001"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-3 py-2 rounded text-sm text-gray-100 outline-none focus:ring-1 focus:ring-yellow-400"
          style={{ background: '#1e2026', border: '1px solid #3c4049' }}
        />
      </div>
      {msg && <p className="text-sm text-green-400">{msg}</p>}
      {err && <p className="text-sm text-red-400">{err}</p>}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full py-2 rounded text-sm font-semibold disabled:opacity-50"
        style={{
          background: action === 'deposit' ? '#0ecb81' : '#f6465d',
          color: '#fff',
        }}
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
      <h2 className="text-xl font-semibold text-gray-100 mb-6">Wallets</h2>

      {isLoading && <Spinner />}
      {error && <p className="text-red-400">Failed to load wallets.</p>}

      {data && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4 mb-8">
          {data.length === 0 && (
            <p className="col-span-4 text-gray-500">No wallets yet. Make a deposit to get started.</p>
          )}
          {data.map((w) => <WalletCard key={w.id} w={w} />)}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 max-w-xl">
        <div className="rounded-xl p-5" style={{ background: '#252930', border: '1px solid #3c4049' }}>
          <FundsForm action="deposit" />
        </div>
        <div className="rounded-xl p-5" style={{ background: '#252930', border: '1px solid #3c4049' }}>
          <FundsForm action="withdraw" />
        </div>
      </div>
    </div>
  );
}
