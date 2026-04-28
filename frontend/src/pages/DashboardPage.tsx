import Spinner from '../components/Spinner';
import type { MarketDataResponse } from '../types';
import { useMarketDataStream } from '../hooks/useMarketDataStream';

function PriceChange({ value }: { value: string }) {
  const num = parseFloat(value);
  const isPos = num >= 0;
  return (
    <span style={{ color: isPos ? '#0ecb81' : '#f6465d' }}>
      {isPos ? '+' : ''}{num.toFixed(2)}%
    </span>
  );
}

function fmt(value: string, decimals = 2) {
  const n = parseFloat(value);
  if (isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function DashboardPage() {
  const { data, connected } = useMarketDataStream();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-100">Market Overview</h2>
        <span className="text-xs" style={{ color: connected ? '#0ecb81' : '#9ca3af' }}>
          {connected ? '● Live' : '○ Connecting...'}
        </span>
      </div>

      {!connected && data.length === 0 && <Spinner />}

      {data.length > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid #3c4049' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#252930', borderBottom: '1px solid #3c4049' }}>
                {['Symbol', 'Last Price', '24h Change', '24h Volume', '24h High', '24h Low', 'Trades'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No market data yet. Place some orders to generate activity.
                  </td>
                </tr>
              )}
              {data.map((row: MarketDataResponse) => (
                <tr
                  key={row.symbol}
                  style={{ borderBottom: '1px solid #3c4049' }}
                  className="hover:bg-gray-800 transition-colors"
                >
                  <td className="px-4 py-3 font-semibold text-gray-100">{row.symbol}</td>
                  <td className="px-4 py-3 text-gray-100">${fmt(row.lastPrice)}</td>
                  <td className="px-4 py-3">
                    <PriceChange value={row.priceChangePercent24h} />
                  </td>
                  <td className="px-4 py-3 text-gray-300">{fmt(row.volume24h, 4)}</td>
                  <td className="px-4 py-3 text-gray-300">${fmt(row.high24h)}</td>
                  <td className="px-4 py-3 text-gray-300">${fmt(row.low24h)}</td>
                  <td className="px-4 py-3 text-gray-300">{row.tradeCount24h.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {connected && data.length === 0 && (
        <p className="text-gray-500 text-sm mt-4">No market data yet. Place some orders to generate activity.</p>
      )}
    </div>
  );
}
