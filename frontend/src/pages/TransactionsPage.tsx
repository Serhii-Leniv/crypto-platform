import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTransactions } from '../api/wallets';
import { SkeletonRows } from '../components/Skeleton';
import { IconDownload, IconChevronLeft, IconChevronRight } from '../components/icons';
import { formatQuantity, formatTimeAgo } from '../lib/format';
import type { TransactionResponse, TransactionType } from '../types';

type FilterTab = 'all' | 'deposits' | 'withdrawals' | 'trades' | 'locks';

const TYPE_LABEL: Record<TransactionType, string> = {
  DEPOSIT:    'Deposit',
  WITHDRAWAL: 'Withdrawal',
  LOCK:       'Lock',
  UNLOCK:     'Unlock',
  TRADE_BUY:  'Trade buy',
  TRADE_SELL: 'Trade sell',
};

const TYPE_COLOR: Record<TransactionType, string> = {
  DEPOSIT:    '#00d09c',
  WITHDRAWAL: '#ff4d5e',
  LOCK:       '#ffb800',
  UNLOCK:     '#60a5fa',
  TRADE_BUY:  '#00d09c',
  TRADE_SELL: '#ff4d5e',
};

// Whether the amount should be displayed as a positive (in) or negative (out) movement.
const TYPE_INFLOW: Record<TransactionType, boolean | null> = {
  DEPOSIT:    true,
  WITHDRAWAL: false,
  LOCK:       null,
  UNLOCK:     null,
  TRADE_BUY:  true,
  TRADE_SELL: false,
};

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: '#00d09c',
  PENDING:   '#0068ff',
  FAILED:    '#ff4d5e',
};

const TAB_TYPES: Record<FilterTab, TransactionType[]> = {
  all:         ['DEPOSIT', 'WITHDRAWAL', 'LOCK', 'UNLOCK', 'TRADE_BUY', 'TRADE_SELL'],
  deposits:    ['DEPOSIT'],
  withdrawals: ['WITHDRAWAL'],
  trades:      ['TRADE_BUY', 'TRADE_SELL'],
  locks:       ['LOCK', 'UNLOCK'],
};

const PAGE_SIZE = 50;

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

export default function TransactionsPage() {
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<FilterTab>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['transactions', page],
    queryFn: () => getTransactions(page, PAGE_SIZE),
    refetchInterval: 10_000,
  });

  const txs = data?.content ?? [];

  const counts = useMemo(() => ({
    all:         txs.length,
    deposits:    txs.filter((t) => t.type === 'DEPOSIT').length,
    withdrawals: txs.filter((t) => t.type === 'WITHDRAWAL').length,
    trades:      txs.filter((t) => t.type === 'TRADE_BUY' || t.type === 'TRADE_SELL').length,
    locks:       txs.filter((t) => t.type === 'LOCK' || t.type === 'UNLOCK').length,
  }), [txs]);

  const currencies = useMemo(() => {
    const s = new Set(txs.map((t) => t.currency));
    return [...s].sort();
  }, [txs]);

  const filtered = useMemo(() => {
    const types = TAB_TYPES[tab];
    return txs.filter((t) => types.includes(t.type) && (!currencyFilter || t.currency === currencyFilter));
  }, [txs, tab, currencyFilter]);

  const totalPages = data?.totalPages ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold" style={{ color: '#f5f6f8' }}>Transactions</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs mono" style={{ color: '#6c7684' }}>
            {data ? `${data.totalElements} total` : ''}
          </span>
          {filtered.length > 0 && (
            <button
              onClick={() => exportCSV(filtered)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors"
              style={{ border: '1px solid #2a3441', background: '#11161d', color: '#a0a8b4' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#f5f6f8'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#a0a8b4'; }}
              title="Download visible rows as CSV"
            >
              <IconDownload size={12} /> CSV
            </button>
          )}
        </div>
      </div>

      {/* Tabs + currency filter */}
      <div className="flex items-center gap-1 mb-3" style={{ borderBottom: '1px solid #2a3441' }}>
        {([
          { id: 'all',         label: 'All',         count: counts.all },
          { id: 'deposits',    label: 'Deposits',    count: counts.deposits },
          { id: 'withdrawals', label: 'Withdrawals', count: counts.withdrawals },
          { id: 'trades',      label: 'Trades',      count: counts.trades },
          { id: 'locks',       label: 'Locks',       count: counts.locks },
        ] as { id: FilterTab; label: string; count: number }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-3 py-2 text-sm relative transition-colors"
            style={{ color: tab === t.id ? '#0068ff' : '#a0a8b4' }}
          >
            {t.label}
            {t.count > 0 && <span className="ml-1 mono text-xs" style={{ color: tab === t.id ? '#0068ff' : '#6c7684' }}>({t.count})</span>}
            {tab === t.id && <span className="absolute bottom-0 left-0 right-0" style={{ height: 2, background: '#0068ff' }} />}
          </button>
        ))}
        <div className="ml-auto">
          {currencies.length > 1 && (
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="mono text-xs px-2 py-1"
              style={{ background: '#11161d', border: '1px solid #2a3441', color: '#a0a8b4' }}
            >
              <option value="">All currencies</option>
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
      </div>

      {error && <p className="text-sm mb-3" style={{ color: '#ff4d5e' }}>Failed to load transactions.</p>}

      <div style={{ border: '1px solid #2a3441' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#11161d', borderBottom: '1px solid #2a3441' }}>
              <th className="px-3 py-2 text-left text-xs" style={{ color: '#6c7684' }}>Time</th>
              <th className="px-3 py-2 text-left text-xs" style={{ color: '#6c7684' }}>Type</th>
              <th className="px-3 py-2 text-left text-xs" style={{ color: '#6c7684' }}>Activity</th>
              <th className="px-3 py-2 text-right text-xs" style={{ color: '#6c7684' }}>Amount</th>
              <th className="px-3 py-2 text-right text-xs" style={{ color: '#6c7684' }}>Ref</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <SkeletonRows rows={6} cols={5} />}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm" style={{ color: '#6c7684' }}>
                {tab === 'all' && !currencyFilter ? 'No transactions yet.' : 'No transactions match the current filter.'}
              </td></tr>
            )}
            {filtered.map((t) => {
              const color = TYPE_COLOR[t.type];
              const inflow = TYPE_INFLOW[t.type];
              const amount = parseFloat(t.amount);
              const sign = inflow === true ? '+' : inflow === false ? '−' : '';
              const amountColor = inflow === true ? '#00d09c' : inflow === false ? '#ff4d5e' : '#a0a8b4';
              const fallback = `${TYPE_LABEL[t.type]} of ${formatQuantity(amount)} ${t.currency}`;
              return (
                <tr key={t.id} style={{ borderBottom: '1px solid #1a2029' }}>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap align-top" style={{ color: '#6c7684' }} title={new Date(t.createdAt).toLocaleString()}>
                    {formatTimeAgo(t.createdAt)}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap" style={{ color }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                      {TYPE_LABEL[t.type]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-sm align-top" style={{ color: '#f5f6f8' }}>
                    {t.description ?? fallback}
                    {t.status !== 'COMPLETED' && (
                      <span className="ml-2 text-xs" style={{ color: STATUS_COLOR[t.status] ?? '#a0a8b4' }}>· {t.status}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 mono text-xs text-right align-top whitespace-nowrap" style={{ color: amountColor }}>
                    {sign}{formatQuantity(amount)} <span style={{ color: '#6c7684' }}>{t.currency}</span>
                  </td>
                  <td className="px-3 py-2.5 mono text-xs text-right align-top" style={{ color: '#6c7684' }} title={t.referenceId ?? ''}>
                    {t.referenceId ? t.referenceId.slice(0, 8) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-end mt-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors disabled:opacity-30"
            style={{ border: '1px solid #2a3441', background: '#11161d', color: '#a0a8b4' }}
          >
            <IconChevronLeft size={14} /> Prev
          </button>
          <span className="px-3 py-1.5 text-sm mono" style={{ color: '#6c7684' }}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors disabled:opacity-30"
            style={{ border: '1px solid #2a3441', background: '#11161d', color: '#a0a8b4' }}
          >
            Next <IconChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
