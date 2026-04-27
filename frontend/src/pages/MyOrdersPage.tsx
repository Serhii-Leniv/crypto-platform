import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyOrders, cancelOrder } from '../api/orders';
import Spinner from '../components/Spinner';
import type { OrderResponse, OrderStatus } from '../types';

function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, string> = {
    PENDING: '#f0b90b',
    PARTIALLY_FILLED: '#3b82f6',
    FILLED: '#0ecb81',
    CANCELLED: '#6b7280',
  };
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: map[status] + '22', color: map[status] }}
    >
      {status.replace('_', ' ')}
    </span>
  );
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
      <h2 className="text-xl font-semibold text-gray-100 mb-6">My Orders</h2>
      {isLoading && <Spinner />}
      {error && <p className="text-red-400">Failed to load orders.</p>}
      {data && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #3c4049' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#252930', borderBottom: '1px solid #3c4049' }}>
                {['ID', 'Symbol', 'Type', 'Side', 'Price', 'Qty', 'Filled', 'Status', 'Date', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    No orders yet.
                  </td>
                </tr>
              )}
              {data.map((o) => (
                <tr key={o.id} style={{ borderBottom: '1px solid #2a2d35' }} className="hover:bg-gray-800">
                  <td className="px-4 py-2 text-gray-500 font-mono text-xs">{o.id.slice(0, 8)}…</td>
                  <td className="px-4 py-2 font-semibold text-gray-100">{o.symbol}</td>
                  <td className="px-4 py-2 text-gray-300">{o.orderType}</td>
                  <td className="px-4 py-2">
                    <span style={{ color: o.side === 'BUY' ? '#0ecb81' : '#f6465d' }}>{o.side}</span>
                  </td>
                  <td className="px-4 py-2 font-mono text-gray-300">
                    {o.price ? `$${parseFloat(o.price).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-2 font-mono text-gray-300">{parseFloat(o.quantity).toFixed(6)}</td>
                  <td className="px-4 py-2 font-mono text-gray-500">{parseFloat(o.filledQuantity).toFixed(6)}</td>
                  <td className="px-4 py-2"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-2 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(o.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    {canCancel(o.status) && (
                      <button
                        onClick={() => cancelMutation.mutate(o.id)}
                        disabled={cancelMutation.isPending}
                        className="px-2 py-1 rounded text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                        style={{ border: '1px solid #f6465d33' }}
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
