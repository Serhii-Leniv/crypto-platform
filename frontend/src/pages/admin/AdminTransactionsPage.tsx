import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminGetTransactions, adminDeposit } from '../../api/admin';
import type { TransactionType, TransactionStatus } from '../../types';
import Spinner from '../../components/Spinner';

const TX_TYPES: TransactionType[] = ['DEPOSIT', 'WITHDRAWAL', 'LOCK', 'UNLOCK', 'TRADE_BUY', 'TRADE_SELL'];
const TX_STATUSES: TransactionStatus[] = ['PENDING', 'COMPLETED', 'FAILED'];

export default function AdminTransactionsPage() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Deposit form
  const [showDeposit, setShowDeposit] = useState(false);
  const [depUserId, setDepUserId] = useState('');
  const [depCurrency, setDepCurrency] = useState('');
  const [depAmount, setDepAmount] = useState('');

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['admin', 'transactions', typeFilter, statusFilter, currencyFilter],
    queryFn: () => adminGetTransactions({
      type: typeFilter || undefined,
      status: statusFilter || undefined,
      currency: currencyFilter || undefined,
    }),
  });

  const depositMutation = useMutation({
    mutationFn: () => adminDeposit({ userId: depUserId, currency: depCurrency, amount: depAmount }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'transactions'] });
      setDepUserId(''); setDepCurrency(''); setDepAmount('');
      setShowDeposit(false);
      setSuccessMsg('Deposit created successfully');
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (e: any) => setError(e.userMessage ?? 'Deposit failed'),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: '#f0b90b' }}>All Transactions</h1>
        <button
          onClick={() => setShowDeposit(v => !v)}
          className="px-4 py-2 rounded text-sm font-medium transition-colors"
          style={{ background: '#f0b90b', color: '#1e2026' }}
        >
          + Admin Deposit
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 rounded text-sm text-red-400" style={{ background: '#2a1a1a' }}>
          {error} <button className="ml-2 underline" onClick={() => setError(null)}>dismiss</button>
        </div>
      )}
      {successMsg && (
        <div className="mb-4 px-4 py-2 rounded text-sm text-green-400" style={{ background: '#1a2a1a' }}>
          {successMsg}
        </div>
      )}

      {showDeposit && (
        <div className="mb-6 p-4 rounded-lg" style={{ background: '#252930', border: '1px solid #3c4049' }}>
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Admin Deposit</h2>
          <div className="flex flex-wrap gap-3">
            <input
              placeholder="User ID (UUID)"
              value={depUserId}
              onChange={e => setDepUserId(e.target.value)}
              className="flex-1 min-w-48 px-3 py-2 rounded text-sm text-gray-100 bg-[#1e2026] border border-[#3c4049] focus:outline-none focus:border-yellow-400"
            />
            <input
              placeholder="Currency (e.g. USDT)"
              value={depCurrency}
              onChange={e => setDepCurrency(e.target.value)}
              className="w-40 px-3 py-2 rounded text-sm text-gray-100 bg-[#1e2026] border border-[#3c4049] focus:outline-none focus:border-yellow-400"
            />
            <input
              placeholder="Amount"
              type="number"
              value={depAmount}
              onChange={e => setDepAmount(e.target.value)}
              className="w-36 px-3 py-2 rounded text-sm text-gray-100 bg-[#1e2026] border border-[#3c4049] focus:outline-none focus:border-yellow-400"
            />
            <button
              onClick={() => depositMutation.mutate()}
              disabled={depositMutation.isPending || !depUserId || !depCurrency || !depAmount}
              className="px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
              style={{ background: '#f0b90b', color: '#1e2026' }}
            >
              Deposit
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded text-sm text-gray-100 bg-[#252930] border border-[#3c4049] focus:outline-none"
        >
          <option value="">All Types</option>
          {TX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded text-sm text-gray-100 bg-[#252930] border border-[#3c4049] focus:outline-none"
        >
          <option value="">All Statuses</option>
          {TX_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          placeholder="Currency filter"
          value={currencyFilter}
          onChange={e => setCurrencyFilter(e.target.value)}
          className="px-3 py-2 rounded text-sm text-gray-100 bg-[#252930] border border-[#3c4049] focus:outline-none w-36"
        />
      </div>

      <div className="rounded-lg overflow-hidden" style={{ background: '#252930', border: '1px solid #3c4049' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #3c4049' }}>
              {['Type', 'Amount', 'Currency', 'Status', 'Description', 'Date'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions?.map(tx => (
              <tr key={tx.id} style={{ borderBottom: '1px solid #3c4049' }}>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 rounded text-xs font-semibold" style={{ background: '#1e2026', color: '#f0b90b' }}>
                    {tx.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-100 font-mono">{tx.amount}</td>
                <td className="px-4 py-3 text-gray-300">{tx.currency}</td>
                <td className="px-4 py-3">
                  <span
                    className="text-xs"
                    style={{ color: tx.status === 'COMPLETED' ? '#4ade80' : tx.status === 'FAILED' ? '#f87171' : '#facc15' }}
                  >
                    {tx.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{tx.description ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(tx.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {transactions?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No transactions found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
