import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyOrders, cancelOrder } from '../api/orders';
import { SkeletonRows } from '../components/Skeleton';
import { IconChevronLeft, IconChevronRight } from '../components/icons';
import { formatPrice, formatQuantity, formatTimeAgo } from '../lib/format';
import type { OrderResponse, OrderStatus, PageResponse } from '../types';

type FilterTab = 'all' | 'open' | 'filled' | 'cancelled';

const PAGE_SIZE = 50;

const STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING:          '#0068ff',
  PARTIALLY_FILLED: '#60a5fa',
  FILLED:           '#00d09c',
  CANCELLED:        '#6c7684',
  TRIGGER_PENDING:  '#ffb800',
};

function isOpen(s: OrderStatus): boolean {
  return s === 'PENDING' || s === 'PARTIALLY_FILLED' || s === 'TRIGGER_PENDING';
}

function FillBar({ filled, total }: { filled: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (filled / total) * 100) : 0;
  return (
    <div className="inline-flex items-center gap-2">
      <div className="w-12 h-1" style={{ background: '#1a2029' }}>
        <div className="h-full" style={{ width: `${pct}%`, background: pct >= 100 ? '#00d09c' : pct > 0 ? '#0068ff' : 'transparent' }} />
      </div>
      <span className="mono text-[10px]" style={{ color: '#6c7684', width: 30 }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

export default function MyOrdersPage() {
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<FilterTab>('all');
  const [symbolFilter, setSymbolFilter] = useState<string>('');
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery<PageResponse<OrderResponse>>({
    queryKey: ['my-orders', page],
    queryFn: () => getMyOrders(page, PAGE_SIZE),
    refetchInterval: 5000,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelOrder,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-orders'] }),
  });

  const orders = data?.content ?? [];

  // Counts across the current page (since we load 50 at a time)
  const counts = useMemo(() => ({
    all:       orders.length,
    open:      orders.filter((o) => isOpen(o.status)).length,
    filled:    orders.filter((o) => o.status === 'FILLED').length,
    cancelled: orders.filter((o) => o.status === 'CANCELLED').length,
  }), [orders]);

  const uniqueSymbols = useMemo(() => {
    const s = new Set(orders.map((o) => o.symbol));
    return [...s].sort();
  }, [orders]);

  const filtered = useMemo(() => {
    let rows = orders;
    if (tab === 'open')      rows = rows.filter((o) => isOpen(o.status));
    if (tab === 'filled')    rows = rows.filter((o) => o.status === 'FILLED');
    if (tab === 'cancelled') rows = rows.filter((o) => o.status === 'CANCELLED');
    if (symbolFilter)        rows = rows.filter((o) => o.symbol === symbolFilter);
    return rows;
  }, [orders, tab, symbolFilter]);

  const openOrdersToCancel = filtered.filter((o) => isOpen(o.status));

  function cancelAll() {
    if (openOrdersToCancel.length === 0) return;
    if (!confirm(`Cancel ${openOrdersToCancel.length} open order${openOrdersToCancel.length === 1 ? '' : 's'}?`)) return;
    openOrdersToCancel.forEach((o) => cancelMutation.mutate(o.id));
  }

  const totalPages = data?.totalPages ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold" style={{ color: '#f5f6f8' }}>My Orders</h2>
        <span className="text-xs mono" style={{ color: '#6c7684' }}>
          {data ? `${data.totalElements} total` : ''}
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-3" style={{ borderBottom: '1px solid #2a3441' }}>
        {([
          { id: 'all',       label: 'All',       count: counts.all },
          { id: 'open',      label: 'Open',      count: counts.open },
          { id: 'filled',    label: 'Filled',    count: counts.filled },
          { id: 'cancelled', label: 'Cancelled', count: counts.cancelled },
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
        <div className="ml-auto flex items-center gap-2">
          {uniqueSymbols.length > 1 && (
            <select
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              className="mono text-xs px-2 py-1"
              style={{ background: '#11161d', border: '1px solid #2a3441', color: '#a0a8b4' }}
            >
              <option value="">All symbols</option>
              {uniqueSymbols.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {tab === 'open' && openOrdersToCancel.length > 0 && (
            <button
              onClick={cancelAll}
              disabled={cancelMutation.isPending}
              className="text-xs px-2.5 py-1 transition-colors disabled:opacity-40"
              style={{ background: 'transparent', border: '1px solid rgba(255,77,94,0.3)', color: '#ff4d5e' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,77,94,0.08)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              Cancel all open ({openOrdersToCancel.length})
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm mb-3" style={{ color: '#ff4d5e' }}>Failed to load orders.</p>}

      <div style={{ border: '1px solid #2a3441' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#11161d', borderBottom: '1px solid #2a3441' }}>
              <th className="px-3 py-2 text-left text-xs" style={{ color: '#6c7684' }}>Time</th>
              <th className="px-3 py-2 text-left text-xs" style={{ color: '#6c7684' }}>Pair</th>
              <th className="px-3 py-2 text-left text-xs" style={{ color: '#6c7684' }}>Side</th>
              <th className="px-3 py-2 text-left text-xs" style={{ color: '#6c7684' }}>Type</th>
              <th className="px-3 py-2 text-right text-xs" style={{ color: '#6c7684' }}>Price</th>
              <th className="px-3 py-2 text-right text-xs" style={{ color: '#6c7684' }}>Quantity</th>
              <th className="px-3 py-2 text-right text-xs" style={{ color: '#6c7684' }}>Fill</th>
              <th className="px-3 py-2 text-left text-xs" style={{ color: '#6c7684' }}>Status</th>
              <th className="px-3 py-2 text-left text-xs" style={{ color: '#6c7684' }}>ID</th>
              <th className="px-3 py-2 text-right text-xs" style={{ color: '#6c7684' }}></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <SkeletonRows rows={6} cols={10} />}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-sm" style={{ color: '#6c7684' }}>
                {tab === 'all' ? 'No orders yet. Open Trade to place one.'
                : tab === 'open' ? 'No open orders.'
                : `No ${tab} orders.`}
              </td></tr>
            )}
            {filtered.map((o) => {
              const filled = parseFloat(o.filledQuantity);
              const total  = parseFloat(o.quantity);
              return (
                <tr key={o.id} style={{ borderBottom: '1px solid #1a2029' }}>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: '#6c7684' }}>
                    {formatTimeAgo(o.createdAt)}
                  </td>
                  <td className="px-3 py-2.5 mono text-xs" style={{ color: '#f5f6f8' }}>{o.symbol}</td>
                  <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: o.side === 'BUY' ? '#00d09c' : '#ff4d5e' }}>
                    {o.side}
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: '#a0a8b4' }}>{o.orderType}</td>
                  <td className="px-3 py-2.5 mono text-xs text-right" style={{ color: '#f5f6f8' }}>
                    {o.price ? formatPrice(o.price, '$') : <span style={{ color: '#6c7684' }}>MKT</span>}
                  </td>
                  <td className="px-3 py-2.5 mono text-xs text-right" style={{ color: '#a0a8b4' }}>{formatQuantity(o.quantity)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <FillBar filled={filled} total={total} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: STATUS_COLOR[o.status] }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLOR[o.status] }} />
                      {o.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 mono text-xs" style={{ color: '#6c7684' }}>{o.id.slice(0, 8)}</td>
                  <td className="px-3 py-2.5 text-right">
                    {isOpen(o.status) && (
                      <button
                        onClick={() => cancelMutation.mutate(o.id)}
                        disabled={cancelMutation.isPending}
                        className="text-xs px-2 py-0.5 transition-colors disabled:opacity-40"
                        style={{ color: '#ff4d5e', border: '1px solid rgba(255,77,94,0.25)', background: 'transparent' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,77,94,0.08)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                      >
                        Cancel
                      </button>
                    )}
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
