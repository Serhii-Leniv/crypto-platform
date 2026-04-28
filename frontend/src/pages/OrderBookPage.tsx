import { useState } from 'react';
import Spinner from '../components/Spinner';
import type { OrderResponse } from '../types';
import { useOrderBookStream } from '../hooks/useOrderBookStream';

interface AggLevel { price: number; quantity: number; count: number; }

function aggregateOrders(orders: OrderResponse[]): AggLevel[] {
  const map = new Map<string, AggLevel>();
  for (const o of orders) {
    const remaining = parseFloat(o.quantity) - parseFloat(o.filledQuantity);
    if (remaining <= 0) continue;
    const key = parseFloat(o.price ?? '0').toFixed(2);
    const entry = map.get(key);
    if (entry) {
      entry.quantity += remaining;
      entry.count++;
    } else {
      map.set(key, { price: parseFloat(key), quantity: remaining, count: 1 });
    }
  }
  return Array.from(map.values());
}

function DepthTable({ orders, side, aggregated }: { orders: OrderResponse[]; side: 'BUY' | 'SELL'; aggregated: boolean }) {
  const color = side === 'BUY' ? '#0ecb81' : '#f6465d';
  const depthBg = side === 'BUY' ? 'rgba(14,203,129,0.07)' : 'rgba(246,70,93,0.07)';

  if (aggregated) {
    const levels = aggregateOrders(orders).sort((a, b) =>
      side === 'BUY' ? b.price - a.price : a.price - b.price
    );
    const maxQty = Math.max(...levels.map((l) => l.quantity), 1);

    return (
      <div className="flex-1 rounded-xl overflow-hidden" style={{ border: '1px solid #3c4049' }}>
        <div className="px-4 py-3 font-semibold text-sm flex items-center gap-2" style={{ background: '#252930', color }}>
          {side === 'BUY' ? 'Bids (Buy)' : 'Asks (Sell)'}
          <span className="text-xs font-normal text-gray-500">{levels.length} price levels</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#252930', borderBottom: '1px solid #3c4049' }}>
              <th className="px-4 py-2 text-left text-xs text-gray-400">Price</th>
              <th className="px-4 py-2 text-right text-xs text-gray-400">Total Qty</th>
              <th className="px-4 py-2 text-right text-xs text-gray-400">Orders</th>
            </tr>
          </thead>
          <tbody>
            {levels.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-500 text-xs">
                  No {side.toLowerCase()} orders
                </td>
              </tr>
            )}
            {levels.map((l) => {
              const pct = (l.quantity / maxQty) * 100;
              return (
                <tr key={l.price} style={{ borderBottom: '1px solid #2a2d35', position: 'relative' }} className="hover:bg-gray-800">
                  <td className="px-4 py-2 font-mono" style={{ color, position: 'relative' }}>
                    <div
                      style={{
                        position: 'absolute',
                        top: 0, bottom: 0, left: 0,
                        width: `${pct}%`,
                        background: depthBg,
                        pointerEvents: 'none',
                      }}
                    />
                    <span style={{ position: 'relative' }}>{l.price.toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-300 font-mono">{l.quantity.toFixed(6)}</td>
                  <td className="px-4 py-2 text-right text-gray-500 text-xs">{l.count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  const sorted = [...orders].sort((a, b) => {
    const pa = parseFloat(a.price ?? '0'), pb = parseFloat(b.price ?? '0');
    return side === 'BUY' ? pb - pa : pa - pb;
  });

  return (
    <div className="flex-1 rounded-xl overflow-hidden" style={{ border: '1px solid #3c4049' }}>
      <div className="px-4 py-3 font-semibold text-sm flex items-center gap-2" style={{ background: '#252930', color }}>
        {side === 'BUY' ? 'Bids (Buy)' : 'Asks (Sell)'}
        <span className="text-xs font-normal text-gray-500">{sorted.length} orders</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: '#252930', borderBottom: '1px solid #3c4049' }}>
            <th className="px-4 py-2 text-left text-xs text-gray-400">Price</th>
            <th className="px-4 py-2 text-right text-xs text-gray-400">Qty</th>
            <th className="px-4 py-2 text-right text-xs text-gray-400">Filled</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-gray-500 text-xs">
                No {side.toLowerCase()} orders
              </td>
            </tr>
          )}
          {sorted.map((o, idx) => (
            <tr key={`${o.price}-${idx}`} style={{ borderBottom: '1px solid #2a2d35' }} className="hover:bg-gray-800">
              <td className="px-4 py-2 font-mono" style={{ color }}>{parseFloat(o.price ?? '0').toFixed(2)}</td>
              <td className="px-4 py-2 text-right text-gray-300 font-mono">{parseFloat(o.quantity).toFixed(6)}</td>
              <td className="px-4 py-2 text-right text-gray-500 font-mono">{parseFloat(o.filledQuantity).toFixed(6)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OrderBookPage() {
  const [symbol, setSymbol] = useState('BTC-USDT');
  const [inputVal, setInputVal] = useState('BTC-USDT');
  const [aggregated, setAggregated] = useState(true);

  const { buyOrders, sellOrders, connected } = useOrderBookStream(symbol);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSymbol(inputVal.toUpperCase().trim());
  }

  const bestBid = buyOrders.reduce((best, o) => {
    const p = parseFloat(o.price ?? '0');
    return p > best ? p : best;
  }, 0);
  const bestAsk = sellOrders.reduce((best, o) => {
    const p = parseFloat(o.price ?? 'Infinity');
    return p < best ? p : best;
  }, Infinity);
  const spread = bestAsk !== Infinity && bestBid > 0 ? bestAsk - bestBid : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h2 className="text-xl font-semibold text-gray-100">Order Book</h2>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="BTC-USDT"
            className="px-3 py-1.5 rounded text-sm text-gray-100 outline-none focus:ring-1 focus:ring-yellow-400 w-36"
            style={{ background: '#252930', border: '1px solid #3c4049' }}
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded text-sm font-medium"
            style={{ background: '#f0b90b', color: '#1e2026' }}
          >
            Load
          </button>
        </form>

        <button
          onClick={() => setAggregated((v) => !v)}
          className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
          style={{
            background: aggregated ? '#3c4049' : '#1e2026',
            color: aggregated ? '#f0b90b' : '#9ca3af',
            border: '1px solid #3c4049',
          }}
        >
          {aggregated ? 'Aggregated ✓' : 'Raw Orders'}
        </button>

        {spread !== null && (
          <span className="text-xs text-gray-500">
            Spread: <span className="font-mono" style={{ color: '#f0b90b' }}>{spread.toFixed(2)}</span>
          </span>
        )}

        <span className="text-xs ml-auto" style={{ color: connected ? '#0ecb81' : '#9ca3af' }}>
          {connected ? '● Live' : '○ Connecting...'}
        </span>
      </div>

      {!connected && buyOrders.length === 0 && sellOrders.length === 0 && <Spinner />}

      <div className="flex gap-4">
        <DepthTable orders={buyOrders} side="BUY" aggregated={aggregated} />
        <DepthTable orders={sellOrders} side="SELL" aggregated={aggregated} />
      </div>
    </div>
  );
}
