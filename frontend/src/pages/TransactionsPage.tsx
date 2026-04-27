import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTransactions } from '../api/wallets';
import Spinner from '../components/Spinner';
import type { TransactionResponse, TransactionType } from '../types';

const TYPE_COLORS: Record<TransactionType, string> = {
  DEPOSIT:    '#0ecb81',
  WITHDRAWAL: '#f6465d',
  LOCK:       '#f0b90b',
  UNLOCK:     '#3b82f6',
  TRADE_BUY:  '#0ecb81',
  TRADE_SELL: '#f6465d',
};

const PAGE_SIZE = 20;

function exportCSV(data: TransactionResponse[]) {
  const headers = ['Date', 'Type', 'Currency', 'Amount', 'Status', 'Reference', 'Description'];
  const rows = data.map((t) => [
    new Date(t.createdAt).toISOString(),
    t.type,
    t.currency,
    t.amount,
    t.status,
    t.referenceId ?? '',
    (t.description ?? '').replace(/"/g, '""'),
  ]);
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function TransactionsPage() {
  const [page, setPage] = useState(0);

  const { data, isLoading, error } = useQuery<TransactionResponse[]>({
    queryKey: ['transactions'],
    queryFn: getTransactions,
    refetchInterval: 10000,
  });

  const totalPages = data ? Math.ceil(data.length / PAGE_SIZE) : 0;
  const pageData = data ? data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-100">Transaction History</h2>
        {data && data.length > 0 && (
          <button
            onClick={() => exportCSV(data)}
            className="px-3 py-1.5 rounded text-xs font-medium text-gray-400 hover:text-gray-100 transition-colors"
            style={{ border: '1px solid #3c4049', background: '#252930' }}
          >
            Export CSV ↓
          </button>
        )}
      </div>

      {isLoading && <Spinner />}
      {error && <p className="text-red-400">Failed to load transactions.</p>}

      {data && (
        <>
          <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid #3c4049' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#252930', borderBottom: '1px solid #3c4049' }}>
                  {['Date', 'Type', 'Currency', 'Amount', 'Status', 'Reference', 'Description'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No transactions yet.
                    </td>
                  </tr>
                )}
                {pageData.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #2a2d35' }} className="hover:bg-gray-800">
                    <td className="px-4 py-2 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs font-medium" style={{ color: TYPE_COLORS[t.type] }}>
                        {t.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-semibold text-gray-100">{t.currency}</td>
                    <td className="px-4 py-2 font-mono text-gray-300">{parseFloat(t.amount).toFixed(8)}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs">{t.status}</td>
                    <td className="px-4 py-2 text-gray-600 font-mono text-xs">
                      {t.referenceId ? t.referenceId.slice(0, 8) + '…' : '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-400 text-xs">{t.description ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 rounded text-sm text-gray-400 hover:text-gray-100 disabled:opacity-30"
                style={{ border: '1px solid #3c4049' }}
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-400">
                Page {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 rounded text-sm text-gray-400 hover:text-gray-100 disabled:opacity-30"
                style={{ border: '1px solid #3c4049' }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
