import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTransactions } from '../api/wallets';
import Spinner from '../components/Spinner';
import { IconDownload, IconChevronLeft, IconChevronRight } from '../components/icons';
import type { TransactionResponse, TransactionType } from '../types';

const TYPE_CONFIG: Record<TransactionType, { bg: string; color: string; label: string }> = {
  DEPOSIT:    { bg: 'rgba(14,203,129,0.12)',  color: '#0ecb81', label: 'Deposit'    },
  WITHDRAWAL: { bg: 'rgba(246,70,93,0.12)',   color: '#f6465d', label: 'Withdrawal' },
  LOCK:       { bg: 'rgba(240,185,11,0.12)',  color: '#f0b90b', label: 'Lock'       },
  UNLOCK:     { bg: 'rgba(96,165,250,0.12)',  color: '#60a5fa', label: 'Unlock'     },
  TRADE_BUY:  { bg: 'rgba(14,203,129,0.12)',  color: '#0ecb81', label: 'Trade Buy'  },
  TRADE_SELL: { bg: 'rgba(246,70,93,0.12)',   color: '#f6465d', label: 'Trade Sell' },
};

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: '#0ecb81',
  PENDING:   '#f0b90b',
  FAILED:    '#f6465d',
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
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function TransactionsPage() {
  const [page, setPage] = useState(0);

  const { data, isLoading, error } = useQuery<TransactionResponse[]>({
    queryKey: ['transactions'],
    queryFn: getTransactions,
    refetchInterval: 10000,
  });

  const totalPages = data ? Math.ceil(data.length / PAGE_SIZE) : 0;
  const pageData   = data ? data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold" style={{ color: '#e2e8f0' }}>Transaction History</h2>
        {data && data.length > 0 && (
          <button
            onClick={() => exportCSV(data)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ border: '1px solid #3c4049', background: '#252930', color: '#9ca3af' }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af'}
          >
            <IconDownload size={13} />
            Export CSV
          </button>
        )}
      </div>

      {isLoading && <Spinner />}
      {error && <p className="text-sm" style={{ color: '#f6465d' }}>Failed to load transactions.</p>}

      {data && (
        <>
          <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid #3c4049' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#252930', borderBottom: '1px solid #3c4049' }}>
                  {['Date', 'Type', 'Currency', 'Amount', 'Status', 'Reference', 'Description'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap"
                      style={{ color: '#6b7280' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: '#6b7280' }}>
                      No transactions yet.
                    </td>
                  </tr>
                )}
                {pageData.map((t) => (
                  <tr
                    key={t.id}
                    style={{ borderBottom: '1px solid #2a2d35' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                  >
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: '#6b7280' }}>
                      {fmtDate(t.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                        style={{ background: TYPE_CONFIG[t.type].bg, color: TYPE_CONFIG[t.type].color }}
                      >
                        {TYPE_CONFIG[t.type].label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-xs" style={{ color: '#e2e8f0' }}>
                      {t.currency}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs" style={{ color: '#9ca3af' }}>
                      {parseFloat(t.amount).toFixed(8)}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium" style={{ color: STATUS_COLORS[t.status] ?? '#9ca3af' }}>
                      {t.status}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs" style={{ color: '#4b5563' }}>
                      {t.referenceId ? t.referenceId.slice(0, 8) + '…' : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: '#6b7280' }}>
                      {t.description ?? '—'}
                    </td>
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-30"
                style={{ border: '1px solid #3c4049', background: '#252930', color: '#9ca3af' }}
              >
                <IconChevronLeft size={14} />
                Prev
              </button>
              <span className="px-3 py-1.5 text-sm font-mono" style={{ color: '#6b7280' }}>
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-30"
                style={{ border: '1px solid #3c4049', background: '#252930', color: '#9ca3af' }}
              >
                Next
                <IconChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
