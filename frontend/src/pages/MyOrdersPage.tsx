import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyOrders, cancelOrder } from '../api/orders';
import Spinner from '../components/Spinner';
import type { OrderResponse, OrderStatus } from '../types';

function StatusBadge({ status }: { status: OrderStatus }) {
  const config: Record<OrderStatus, { bg: string; color: string }> = {
    PENDING:          { bg: 'rgba(240,185,11,0.12)',  color: '#f0b90b' },
    PARTIALLY_FILLED: { bg: 'rgba(96,165,250,0.12)',  color: '#60a5fa' },
    FILLED:           { bg: 'rgba(14,203,129,0.12)',  color: '#0ecb81' },
    CANCELLED:        { bg: 'rgba(107,114,128,0.12)', color: '#9ca3af' },
  };
  const c = config[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ background: c.bg, color: c.color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: c.color }}
      />
      {status.replace('_', ' ')}
    </span>
  );
}

function SideBadge({ side }: { side: 'BUY' | 'SELL' }) {
  const isBuy = side === 'BUY';
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded text-xs font-semibold"
      style={{
        background: isBuy ? 'rgba(14,203,129,0.12)' : 'rgba(246,70,93,0.12)',
        color:      isBuy ? '#0ecb81' : '#f6465d',
      }}
    >
      {side}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function MyOrdersPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery<OrderResponse[]>({
    queryKey: ['my-orders'],
    queryFn: getMyOrders,
    refetchInterval: 5000,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelOrder,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-orders'] }),
  });

  const canCancel = (s: OrderStatus) => s === 'PENDING' || s === 'PARTIALLY_FILLED';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold" style={{ color: '#e2e8f0' }}>My Orders</h2>
        {data && data.length > 0 && (
          <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(240,185,11,0.1)', color: '#f0b90b' }}>
            {data.length} order{data.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {isLoading && <Spinner />}
      {error && <p className="text-sm" style={{ color: '#f6465d' }}>Failed to load orders.</p>}

      {data && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #3c4049' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#252930', borderBottom: '1px solid #3c4049' }}>
                {['ID', 'Symbol', 'Type', 'Side', 'Price', 'Qty', 'Filled', 'Status', 'Date', ''].map((h) => (
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
              {data.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-sm" style={{ color: '#6b7280' }}>
                    No orders yet. Head to Place Order to get started.
                  </td>
                </tr>
              )}
              {data.map((o) => (
                <tr
                  key={o.id}
                  style={{ borderBottom: '1px solid #2a2d35' }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                >
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: '#4b5563' }}>
                    {o.id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-semibold"
                      style={{ background: 'rgba(240,185,11,0.08)', color: '#f0b90b' }}
                    >
                      {o.symbol}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#9ca3af' }}>{o.orderType}</td>
                  <td className="px-4 py-3">
                    <SideBadge side={o.side} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: '#e2e8f0' }}>
                    {o.price ? `$${parseFloat(o.price).toFixed(2)}` : <span style={{ color: '#4b5563' }}>—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: '#9ca3af' }}>
                    {parseFloat(o.quantity).toFixed(6)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: '#4b5563' }}>
                    {parseFloat(o.filledQuantity).toFixed(6)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#6b7280' }}>
                    {fmtDate(o.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {canCancel(o.status) && (
                      <button
                        onClick={() => cancelMutation.mutate(o.id)}
                        disabled={cancelMutation.isPending}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
                        style={{
                          color: '#f6465d',
                          border: '1px solid rgba(246,70,93,0.25)',
                          background: 'transparent',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(246,70,93,0.08)'}
                        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
