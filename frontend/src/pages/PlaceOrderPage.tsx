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
  const [symbol, setSymbol]       = useState('BTC-USDT');
  const [orderType, setOrderType] = useState<OrderType>('LIMIT');
  const [side, setSide]           = useState<OrderSide>('BUY');
  const [price, setPrice]         = useState('');
  const [quantity, setQuantity]   = useState('');

  const { data: wallets } = useQuery<WalletResponse[]>({
    queryKey: ['wallets'],
    queryFn: getWallets,
  });

  const parts = symbol.toUpperCase().split(/[-/]/);
  const baseCurrency  = parts[0] ?? '';
  const quoteCurrency = parts[1] ?? '';
  const requiredCurrency = side === 'BUY' ? quoteCurrency : baseCurrency;

  const wallet    = wallets?.find((w) => w.currency === requiredCurrency);
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
    onError: (err: unknown) => {
      const e = err as { userMessage?: string; response?: { data?: { message?: string } }; message?: string };
      toast(e?.userMessage ?? e?.response?.data?.message ?? 'Failed to place order', 'error');
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

  const buyActive  = side === 'BUY';
  const sellActive = side === 'SELL';

  return (
    <div className="max-w-md">
      <h2 className="text-xl font-semibold mb-6" style={{ color: '#e2e8f0' }}>Place Order</h2>

      <div
        className="rounded-2xl p-6"
        style={{ background: '#252930', border: '1px solid #3c4049' }}
      >
        {/* BUY / SELL toggle */}
        <div
          className="flex rounded-xl overflow-hidden mb-6"
          style={{ background: '#1e2026', border: '1px solid #3c4049' }}
        >
          <button
            type="button"
            onClick={() => setSide('BUY')}
            className="flex-1 py-3 text-sm font-bold tracking-widest uppercase transition-all duration-200"
            style={{
              background: buyActive ? '#0ecb81' : 'transparent',
              color:      buyActive ? '#fff' : '#6b7280',
            }}
          >
            Buy
          </button>
          <button
            type="button"
            onClick={() => setSide('SELL')}
            className="flex-1 py-3 text-sm font-bold tracking-widest uppercase transition-all duration-200"
            style={{
              background: sellActive ? '#f6465d' : 'transparent',
              color:      sellActive ? '#fff' : '#6b7280',
            }}
          >
            Sell
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Symbol */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#9ca3af' }}>
              Trading Pair
            </label>
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold pointer-events-none"
                style={{ color: '#4b5563' }}
              >
                PAIR
              </span>
              <input
                required
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="BTC-USDT"
                className="input-field w-full pl-14 pr-3 py-2.5 rounded-lg text-sm font-semibold text-gray-100"
                style={{
                  background: '#1e2026',
                  border: '1px solid #3c4049',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              />
            </div>
          </div>

          {/* Order Type */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#9ca3af' }}>
              Order Type
            </label>
            <div
              className="flex rounded-lg overflow-hidden"
              style={{ background: '#1e2026', border: '1px solid #3c4049' }}
            >
              {(['LIMIT', 'MARKET'] as OrderType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOrderType(t)}
                  className="flex-1 py-2 text-sm font-medium transition-all duration-150"
                  style={{
                    background: orderType === t ? 'rgba(240,185,11,0.12)' : 'transparent',
                    color:      orderType === t ? '#f0b90b' : '#6b7280',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Price (LIMIT only) */}
          {orderType === 'LIMIT' && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#9ca3af' }}>
                Price <span style={{ color: '#4b5563' }}>({quoteCurrency})</span>
              </label>
              <input
                required
                type="number"
                step="0.00000001"
                min="0.00000001"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="input-field w-full px-3 py-2.5 rounded-lg text-sm text-gray-100 font-mono"
                style={{ background: '#1e2026', border: '1px solid #3c4049' }}
              />
            </div>
          )}

          {/* Quantity */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#9ca3af' }}>
              Quantity <span style={{ color: '#4b5563' }}>({baseCurrency})</span>
            </label>
            <input
              required
              type="number"
              step="0.00000001"
              min="0.00000001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.00000000"
              className="input-field w-full px-3 py-2.5 rounded-lg text-sm text-gray-100 font-mono"
              style={{ background: '#1e2026', border: '1px solid #3c4049' }}
            />
          </div>

          {/* Balance summary */}
          <div
            className="rounded-xl p-4 space-y-2.5"
            style={{ background: '#1a1d23', border: '1px solid #2a2d35' }}
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium" style={{ color: '#6b7280' }}>
                Available {requiredCurrency}
              </span>
              <span
                className="font-mono text-sm font-semibold"
                style={{ color: available !== null ? '#0ecb81' : '#4b5563' }}
              >
                {available !== null ? available.toFixed(8) : wallets ? '0.00000000' : '—'}
              </span>
            </div>
            {requiredAmount !== null && (
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium" style={{ color: '#6b7280' }}>
                  Required {requiredCurrency}
                </span>
                <span
                  className="font-mono text-sm font-semibold"
                  style={{ color: hasEnough ? '#f0b90b' : '#f6465d' }}
                >
                  ≈ {requiredAmount.toFixed(8)}
                </span>
              </div>
            )}
            {!hasEnough && (
              <div
                className="flex items-center gap-2 pt-2.5 mt-1"
                style={{ borderTop: '1px solid rgba(246,70,93,0.2)' }}
              >
                <span className="text-xs font-semibold" style={{ color: '#f6465d' }}>!</span>
                <span className="text-xs" style={{ color: '#f6465d' }}>
                  Insufficient balance — deposit funds first.
                </span>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={mutation.isPending || !hasEnough}
            className="w-full py-3.5 rounded-xl font-bold text-sm tracking-widest uppercase transition-opacity disabled:opacity-40 mt-1"
            style={{
              background: side === 'BUY' ? '#0ecb81' : '#f6465d',
              color: '#fff',
              letterSpacing: '0.1em',
            }}
          >
            {mutation.isPending
              ? 'Placing Order…'
              : `${side} ${symbol.toUpperCase()}`
            }
          </button>
        </form>
      </div>
    </div>
  );
}
