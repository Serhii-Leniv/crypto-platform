import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getWallets, getTransactions } from '../api/wallets';
import { getMyOrders } from '../api/orders';
import { getAllMarketData } from '../api/market';
import Sparkline, { syntheticSparkline } from '../components/Sparkline';
import { Skeleton, SkeletonRows } from '../components/Skeleton';
import { formatCompactCurrency, formatPercent, formatPrice, formatTimeAgo } from '../lib/format';
import type { WalletResponse, TransactionResponse, MarketDataResponse, OrderResponse, PageResponse } from '../types';

function getUserEmail(): string {
  try {
    const rt = localStorage.getItem('refreshToken') ?? '';
    const payload = JSON.parse(atob(rt.split('.')[1]));
    return (payload.sub ?? payload.email ?? '') as string;
  } catch {
    return '';
  }
}

const STABLES = new Set(['USDT', 'USDC', 'BUSD', 'DAI']);

function valueInUsd(currency: string, balance: number, markets: MarketDataResponse[]): number {
  if (STABLES.has(currency)) return balance;
  const market = markets.find((m) => m.symbol === `${currency}-USDT`);
  if (!market) return 0;
  return balance * parseFloat(market.lastPrice);
}

export default function HomePage() {
  const email = getUserEmail();

  const { data: wallets } = useQuery<WalletResponse[]>({ queryKey: ['wallets'], queryFn: getWallets });
  const { data: markets } = useQuery<MarketDataResponse[]>({ queryKey: ['market-data'], queryFn: getAllMarketData });
  const { data: orders } = useQuery<PageResponse<OrderResponse>>({
    queryKey: ['my-orders', 0, 5],
    queryFn: () => getMyOrders(0, 5),
  });
  const { data: txs } = useQuery<PageResponse<TransactionResponse>>({
    queryKey: ['transactions', 0, 5],
    queryFn: () => getTransactions(0, 5),
  });

  const portfolio = useMemo(() => {
    if (!wallets || !markets) return null;
    let total = 0, locked = 0;
    for (const w of wallets) {
      const bal = parseFloat(w.balance);
      const lock = parseFloat(w.lockedBalance);
      total  += valueInUsd(w.currency, bal,  markets);
      locked += valueInUsd(w.currency, lock, markets);
    }
    return { total, available: total - locked, locked };
  }, [wallets, markets]);

  const openOrdersCount = orders?.content.filter(
    (o) => o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED'
  ).length ?? 0;

  const topMovers = useMemo<MarketDataResponse[]>(() => {
    if (!markets) return [];
    return [...markets]
      .sort((a, b) => Math.abs(parseFloat(b.priceChangePercent24h)) - Math.abs(parseFloat(a.priceChangePercent24h)))
      .slice(0, 5);
  }, [markets]);

  const recentTxs = txs?.content.slice(0, 5) ?? [];
  const recentOrders = orders?.content.slice(0, 5) ?? [];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold" style={{ color: '#f5f6f8' }}>Overview</h2>
        {email && (
          <p className="text-sm mt-1" style={{ color: '#6c7684' }}>
            Signed in as <span className="mono" style={{ color: '#a0a8b4' }}>{email}</span>
          </p>
        )}
      </div>

      {/* Portfolio summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Portfolio value"
          value={portfolio ? formatCompactCurrency(portfolio.total) : null}
          sub="USDT equivalent"
        />
        <StatCard
          label="Available"
          value={portfolio ? formatCompactCurrency(portfolio.available) : null}
          sub="Not locked in orders"
          tone="success"
        />
        <StatCard
          label="Locked"
          value={portfolio ? formatCompactCurrency(portfolio.locked) : null}
          sub="In open orders"
          tone={portfolio && portfolio.locked > 0 ? 'warn' : undefined}
        />
        <StatCard
          label="Open orders"
          value={orders ? String(openOrdersCount) : null}
          sub={orders ? `${orders.totalElements} total` : ''}
        />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 mb-8">
        <ActionLink to="/trade" label="Trade" primary />
        <ActionLink to="/dashboard" label="View markets" />
        <ActionLink to="/wallets" label="Deposit / withdraw" />
        <ActionLink to="/my-orders" label="My orders" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top movers */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: '#f5f6f8' }}>Top movers (24h)</h3>
            <Link to="/dashboard" className="text-xs" style={{ color: '#0068ff' }}>All markets →</Link>
          </div>
          <div style={{ border: '1px solid #2a3441' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#11161d', borderBottom: '1px solid #2a3441' }}>
                  <th className="px-3 py-2 text-left text-xs" style={{ color: '#6c7684' }}>Symbol</th>
                  <th className="px-3 py-2 text-right text-xs" style={{ color: '#6c7684' }}>Last</th>
                  <th className="px-3 py-2 text-right text-xs" style={{ color: '#6c7684' }}>Trend</th>
                  <th className="px-3 py-2 text-right text-xs" style={{ color: '#6c7684' }}>24h Δ</th>
                </tr>
              </thead>
              <tbody>
                {!markets && <SkeletonRows rows={5} cols={4} />}
                {topMovers.map((m) => {
                  const pct = parseFloat(m.priceChangePercent24h);
                  const price = parseFloat(m.lastPrice);
                  const pos = pct >= 0;
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid #1a2029' }}>
                      <td className="px-3 py-2 mono text-xs" style={{ color: '#f5f6f8' }}>{m.symbol}</td>
                      <td className="px-3 py-2 mono text-xs text-right" style={{ color: '#f5f6f8' }}>{formatPrice(price, '$')}</td>
                      <td className="px-3 py-2">
                        <div style={{ float: 'right' }}>
                          <Sparkline data={syntheticSparkline(m.symbol, price, pct)} width={64} height={20} />
                        </div>
                      </td>
                      <td className="px-3 py-2 mono text-xs text-right" style={{ color: pos ? '#00d09c' : '#ff4d5e' }}>
                        {formatPercent(pct)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Activity */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: '#f5f6f8' }}>Recent activity</h3>
            <Link to="/transactions" className="text-xs" style={{ color: '#0068ff' }}>All transactions →</Link>
          </div>
          <div style={{ border: '1px solid #2a3441' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#11161d', borderBottom: '1px solid #2a3441' }}>
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#6c7684' }}>Type</th>
                  <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: '#6c7684' }}>Amount</th>
                  <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: '#6c7684' }}>When</th>
                </tr>
              </thead>
              <tbody>
                {!txs && <SkeletonRows rows={5} cols={3} />}
                {txs && recentTxs.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-10 text-center text-xs" style={{ color: '#6c7684' }}>No activity yet</td></tr>
                )}
                {recentTxs.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #1a2029' }}>
                    <td className="px-3 py-2 text-xs" style={{ color: '#a0a8b4' }}>{t.type.replace('_', ' ')}</td>
                    <td className="px-3 py-2 mono text-xs text-right" style={{ color: '#f5f6f8' }}>
                      {parseFloat(t.amount).toLocaleString('en-US', { maximumFractionDigits: 8 })} {t.currency}
                    </td>
                    <td className="px-3 py-2 text-xs text-right" style={{ color: '#6c7684' }}>
                      {formatTimeAgo(t.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Recent orders */}
      {recentOrders.length > 0 && (
        <section className="mt-6">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: '#f5f6f8' }}>Recent orders</h3>
            <Link to="/my-orders" className="text-xs" style={{ color: '#0068ff' }}>All orders →</Link>
          </div>
          <div style={{ border: '1px solid #2a3441' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#11161d', borderBottom: '1px solid #2a3441' }}>
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#6c7684' }}>Pair</th>
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: '#6c7684' }}>Side</th>
                  <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: '#6c7684' }}>Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: '#6c7684' }}>Price</th>
                  <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: '#6c7684' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid #1a2029' }}>
                    <td className="px-3 py-2 mono text-xs" style={{ color: '#f5f6f8' }}>{o.symbol}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: o.side === 'BUY' ? '#00d09c' : '#ff4d5e' }}>{o.side}</td>
                    <td className="px-3 py-2 mono text-xs text-right" style={{ color: '#f5f6f8' }}>{parseFloat(o.quantity).toString()}</td>
                    <td className="px-3 py-2 mono text-xs text-right" style={{ color: '#a0a8b4' }}>
                      {o.price ? formatPrice(parseFloat(o.price)) : 'MKT'}
                    </td>
                    <td className="px-3 py-2 text-xs text-right" style={{ color: '#a0a8b4' }}>{o.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, tone }: {
  label: string;
  value: string | null;
  sub?: string;
  tone?: 'success' | 'warn';
}) {
  const valueColor = tone === 'success' ? '#00d09c' : tone === 'warn' ? '#ffb800' : '#f5f6f8';
  return (
    <div className="p-4" style={{ background: '#11161d', border: '1px solid #2a3441' }}>
      <p className="text-xs mb-1.5" style={{ color: '#6c7684' }}>{label}</p>
      <p className="mono text-lg leading-tight" style={{ color: valueColor }}>
        {value === null ? <Skeleton height={18} width="60%" /> : value}
      </p>
      {sub && <p className="text-xs mt-1" style={{ color: '#6c7684' }}>{sub}</p>}
    </div>
  );
}

function ActionLink({ to, label, primary }: { to: string; label: string; primary?: boolean }) {
  return (
    <Link
      to={to}
      className="px-3 py-2 text-sm transition-colors"
      style={primary
        ? { background: '#0068ff', color: '#fff' }
        : { background: '#11161d', color: '#a0a8b4', border: '1px solid #2a3441' }
      }
    >
      {label}
    </Link>
  );
}
