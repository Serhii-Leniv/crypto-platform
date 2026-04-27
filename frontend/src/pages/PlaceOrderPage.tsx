import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { placeOrder } from '../api/orders';
import { getWallets } from '../api/wallets';
import { useToast } from '../context/ToastContext';
import type { OrderSide, OrderType, WalletResponse } from '../types';

export default function PlaceOrderPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [symbol, setSymbol] = useState('BTC-USDT');
  const [orderType, setOrderType] = useState<OrderType>('LIMIT');
  const [side, setSide] = useState<OrderSide>('BUY');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');

  const { data: wallets } = useQuery<WalletResponse[]>({
    queryKey: ['wallets'],
    queryFn: getWallets,
  });

  const parts = symbol.toUpperCase().split(/[-/]/);
  const baseCurrency = parts[0] ?? '';
  const quoteCurrency = parts[1] ?? '';
  const requiredCurrency = side === 'BUY' ? quoteCurrency : baseCurrency;

  const wallet = wallets?.find((w) => w.currency === requiredCurrency);
  const available = wallet ? parseFloat(wallet.availableBalance) : null;

  let requiredAmount: number | null = null;
  if (side === 'BUY' && orderType === 'LIMIT' && price && quantity) {
    requiredAmount = parseFloat(price) * parseFloat(quantity);
  } else if (side === 'SELL' && quantity) {
    requiredAmount = parseFloat(quantity);
  }

  const hasEnough = available === null || requiredAmount === null || available >= requiredAmount;

  const mutation = useMutation({
    mutationFn: placeOrder,
    onSuccess: (data) => {
      toast(`Order ${data.id.slice(0, 8)}… placed — status: ${data.status}`, 'success');
      setQuantity('');
      setPrice('');
      qc.invalidateQueries({ queryKey: ['my-orders'] });
      qc.invalidateQueries({ queryKey: ['wallets'] });
    },
    onError: (err: any) => {
      toast(err?.userMessage ?? err?.response?.data?.message ?? 'Failed to place order', 'error');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({
      symbol: symbol.toUpperCase(),
      orderType,
      side,
      price: orderType === 'LIMIT' ? price : undefined,
      quantity,
    });
  }

  const btnBg = side === 'BUY' ? '#0ecb81' : '#f6465d';

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-semibold text-gray-100 mb-6">Place Order</h2>

      <div className="rounded-xl p-6 space-y-5" style={{ background: '#252930', border: '1px solid #3c4049' }}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Symbol */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Symbol</label>
            <input
              required
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="BTC-USDT"
              className="w-full px-3 py-2 rounded text-sm text-gray-100 outline-none focus:ring-1 focus:ring-yellow-400"
              style={{ background: '#1e2026', border: '1px solid #3c4049' }}
            />
          </div>

          {/* Order Type */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Order Type</label>
            <div className="flex rounded-lg overflow-hidden" style={{ background: '#1e2026' }}>
              {(['LIMIT', 'MARKET'] as OrderType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOrderType(t)}
                  className="flex-1 py-2 text-sm font-medium transition-colors"
                  style={{
                    background: orderType === t ? '#f0b90b' : 'transparent',
                    color: orderType === t ? '#1e2026' : '#9ca3af',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Side */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Side</label>
            <div className="flex rounded-lg overflow-hidden" style={{ background: '#1e2026' }}>
              {(['BUY', 'SELL'] as OrderSide[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  className="flex-1 py-2 text-sm font-medium transition-colors"
                  style={{
                    background: side === s ? (s === 'BUY' ? '#0ecb81' : '#f6465d') : 'transparent',
                    color: side === s ? '#fff' : '#9ca3af',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Price (LIMIT only) */}
          {orderType === 'LIMIT' && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Price ({quoteCurrency})</label>
              <input
                required
                type="number"
                step="0.00000001"
                min="0.00000001"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="45000.00"
                className="w-full px-3 py-2 rounded text-sm text-gray-100 outline-none focus:ring-1 focus:ring-yellow-400"
                style={{ background: '#1e2026', border: '1px solid #3c4049' }}
              />
            </div>
          )}

          {/* Quantity */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Quantity ({baseCurrency})</label>
            <input
              required
              type="number"
              step="0.00000001"
              min="0.00000001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.1"
              className="w-full px-3 py-2 rounded text-sm text-gray-100 outline-none focus:ring-1 focus:ring-yellow-400"
              style={{ background: '#1e2026', border: '1px solid #3c4049' }}
            />
          </div>

          {/* Balance & cost summary */}
          <div className="rounded p-3 space-y-1.5 text-xs" style={{ background: '#1e2026', border: '1px solid #3c4049' }}>
            <div className="flex justify-between">
              <span className="text-gray-400">Available {requiredCurrency}</span>
              <span className="font-mono" style={{ color: available !== null ? '#0ecb81' : '#6b7280' }}>
                {available !== null ? available.toFixed(8) : wallets ? '0.00000000' : '—'}
              </span>
            </div>
            {requiredAmount !== null && (
              <div className="flex justify-between">
                <span className="text-gray-400">Required {requiredCurrency}</span>
                <span className="font-mono" style={{ color: hasEnough ? '#f0b90b' : '#f6465d' }}>
                  {requiredAmount.toFixed(8)}
                </span>
              </div>
            )}
            {!hasEnough && (
              <p style={{ color: '#f6465d' }}>
                Insufficient {requiredCurrency} — deposit funds first.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={mutation.isPending || !hasEnough}
            className="w-full py-2.5 rounded font-semibold text-sm transition-opacity disabled:opacity-50"
            style={{ background: btnBg, color: '#fff' }}
          >
            {mutation.isPending ? 'Placing…' : `${side} ${symbol.toUpperCase()}`}
          </button>
        </form>
      </div>
    </div>
  );
}
