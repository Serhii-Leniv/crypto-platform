import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminGetOrders, adminCancelOrder } from '../../api/admin';
import type { OrderStatus, OrderSide } from '../../types';
import Spinner from '../../components/Spinner';

const ORDER_STATUSES: OrderStatus[] = ['PENDING', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED'];
const ORDER_SIDES: OrderSide[] = ['BUY', 'SELL'];

export default function AdminOrdersPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [symbolFilter, setSymbolFilter] = useState('');
  const [sideFilter, setSideFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin', 'orders', statusFilter, symbolFilter, sideFilter],
    queryFn: () => adminGetOrders({
      status: statusFilter || undefined,
      symbol: symbolFilter || undefined,
      side: sideFilter || undefined,
    }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => adminCancelOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'orders'] }),
    onError: (e: any) => setError(e.userMessage ?? 'Failed to cancel order'),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>;

  return (
    <div>
      <h1 className="text-xl font-bold mb-6" style={{ color: '#f0b90b' }}>All Orders</h1>

      {error && (
        <div className="mb-4 px-4 py-2 rounded text-sm text-red-400" style={{ background: '#2a1a1a' }}>
          {error} <button className="ml-2 underline" onClick={() => setError(null)}>dismiss</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded text-sm text-gray-100 bg-[#252930] border border-[#3c4049] focus:outline-none"
        >
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={sideFilter}
          onChange={e => setSideFilter(e.target.value)}
          className="px-3 py-2 rounded text-sm text-gray-100 bg-[#252930] border border-[#3c4049] focus:outline-none"
        >
          <option value="">All Sides</option>
          {ORDER_SIDES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          placeholder="Symbol (e.g. BTC-USDT)"
          value={symbolFilter}
          onChange={e => setSymbolFilter(e.target.value)}
          className="px-3 py-2 rounded text-sm text-gray-100 bg-[#252930] border border-[#3c4049] focus:outline-none w-44"
        />
      </div>

      <div className="rounded-lg overflow-x-auto" style={{ background: '#252930', border: '1px solid #3c4049' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #3c4049' }}>
              {['Symbol', 'Side', 'Type', 'Price', 'Qty', 'Filled', 'Status', 'Date', 'Action'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders?.map(order => {
              const isFinal = order.status === 'FILLED' || order.status === 'CANCELLED';
              return (
                <tr key={order.id} style={{ borderBottom: '1px solid #3c4049' }}>
                  <td className="px-4 py-3 text-gray-100 font-medium">{order.symbol}</td>
                  <td className="px-4 py-3">
                    <span style={{ color: order.side === 'BUY' ? '#4ade80' : '#f87171' }} className="font-semibold">
                      {order.side}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{order.orderType}</td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{order.price ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{order.quantity}</td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{order.filledQuantity}</td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs"
                      style={{
                        color: order.status === 'FILLED' ? '#4ade80'
                          : order.status === 'CANCELLED' ? '#6b7280'
                          : order.status === 'PARTIALLY_FILLED' ? '#facc15'
                          : '#93c5fd',
                      }}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(order.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {!isFinal && (
                      <button
                        onClick={() => cancelMutation.mutate(order.id)}
                        disabled={cancelMutation.isPending}
                        className="px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50"
                        style={{ background: '#3c1a1a', color: '#f87171', border: '1px solid #7f1d1d' }}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {orders?.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">No orders found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
