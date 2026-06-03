import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  getAllUsers, getAllOrders, getAllMarkets, setMarketStatus,
  type AdminUser,
} from '../api/admin';
import type { Market } from '../api/markets';
import { SkeletonRows } from '../components/Skeleton';
import { formatPrice, formatQuantity, formatTimeAgo } from '../lib/format';
import type { OrderResponse, OrderStatus, PageResponse } from '../types';

type Tab = 'overview' | 'metrics' | 'users' | 'orders' | 'markets';

const STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING:          '#0068ff',
  PARTIALLY_FILLED: '#60a5fa',
  FILLED:           '#00d09c',
  CANCELLED:        '#6c7684',
  TRIGGER_PENDING:  '#ffb800',
};

const MARKET_COLOR: Record<string, string> = {
  ACTIVE:   '#00d09c',
  HALTED:   '#ffb800',
  DELISTED: '#ff4d5e',
};

export default function AdminPage() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;

  return <AdminPageContent />;
}

function AdminPageContent() {
  const [tab, setTab] = useState<Tab>('overview');

  const { data: users,   isLoading: usersLoading }   = useQuery<AdminUser[]>({ queryKey: ['admin', 'users'],   queryFn: getAllUsers });
  const { data: orders,  isLoading: ordersLoading }  = useQuery<PageResponse<OrderResponse>>({ queryKey: ['admin', 'orders', 0, 50], queryFn: () => getAllOrders(0, 50), refetchInterval: 5000 });
  const { data: markets, isLoading: marketsLoading } = useQuery<Market[]>({ queryKey: ['admin', 'markets'], queryFn: getAllMarkets, refetchInterval: 10_000 });

  const overview = useMemo(() => {
    if (!users || !orders || !markets) return null;
    const openOrders = orders.content.filter((o) => o.status === 'PENDING' || o.status === 'PARTIALLY_FILLED').length;
    const filledOrders = orders.content.filter((o) => o.status === 'FILLED').length;
    const activeMarkets = markets.filter((m) => m.status === 'ACTIVE').length;
    const haltedMarkets = markets.filter((m) => m.status !== 'ACTIVE').length;
    return {
      totalUsers: users.length,
      admins: users.filter((u) => u.isAdmin).length,
      totalOrders: orders.totalElements,
      openOrders,
      filledOrders,
      activeMarkets,
      haltedMarkets,
    };
  }, [users, orders, markets]);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-xl font-semibold" style={{ color: '#f5f6f8' }}>Admin</h2>
        <span className="text-xs px-2 py-0.5" style={{ background: 'rgba(0,104,255,0.12)', color: '#0068ff', border: '1px solid #0068ff' }}>
          ADMIN MODE
        </span>
      </div>

      <div className="flex items-center gap-1 mb-4" style={{ borderBottom: '1px solid #2a3441' }}>
        {([
          { id: 'overview', label: 'Overview' },
          { id: 'metrics',  label: 'Metrics' },
          { id: 'users',    label: `Users${users ? ` (${users.length})` : ''}` },
          { id: 'orders',   label: `Orders${orders ? ` (${orders.totalElements})` : ''}` },
          { id: 'markets',  label: `Markets${markets ? ` (${markets.length})` : ''}` },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-3 py-2 text-sm relative transition-colors"
            style={{ color: tab === t.id ? '#0068ff' : '#a0a8b4' }}
          >
            {t.label}
            {tab === t.id && <span className="absolute bottom-0 left-0 right-0" style={{ height: 2, background: '#0068ff' }} />}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview overview={overview} />}
      {tab === 'metrics'  && <MetricsTab />}
      {tab === 'users'    && <UsersTable users={users}   isLoading={usersLoading} />}
      {tab === 'orders'   && <OrdersTable orders={orders} isLoading={ordersLoading} users={users} />}
      {tab === 'markets'  && <MarketsTable markets={markets} isLoading={marketsLoading} />}
    </div>
  );
}

function MetricsTab() {
  // Hostname swap: in-browser Grafana lives on the host's 3001, not the docker network.
  const grafanaHost = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : 'http://localhost:3001';
  const src = `${grafanaHost}/d/trading-engine/trading-engine-health?orgId=1&kiosk=tv&theme=dark&refresh=15s`;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: '#f5f6f8' }}>Trading engine health</h3>
          <p className="text-xs mt-0.5" style={{ color: '#6c7684' }}>
            Live Grafana dashboard — domain metrics from <span className="mono">order-matching</span> and <span className="mono">wallet-service</span>.
          </p>
        </div>
        <a
          href={`${grafanaHost}/d/trading-engine/trading-engine-health?orgId=1&theme=dark`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-3 py-1.5 transition-colors"
          style={{ background: '#11161d', border: '1px solid #2a3441', color: '#a0a8b4' }}
        >
          Open in Grafana →
        </a>
      </div>

      <div style={{ background: '#0a0e14', border: '1px solid #2a3441', height: 900 }}>
        <iframe
          src={src}
          title="Trading engine health"
          style={{ width: '100%', height: '100%', border: 0 }}
        />
      </div>

      <p className="text-[11px]" style={{ color: '#6c7684' }}>
        Embed uses Grafana anonymous viewer (configured in <span className="mono">docker-compose.yml</span>).
        If the panel is blank, ensure the Prometheus datasource is healthy and at least one trade has settled.
      </p>
    </div>
  );
}

interface OverviewStats {
  totalUsers: number; admins: number; totalOrders: number;
  openOrders: number; filledOrders: number;
  activeMarkets: number; haltedMarkets: number;
}

function Overview({ overview }: { overview: OverviewStats | null }) {
  const cards: { label: string; value: string; sub?: string; tone?: 'success' | 'warn' }[] = overview ? [
    { label: 'Users',            value: String(overview.totalUsers), sub: `${overview.admins} admin${overview.admins === 1 ? '' : 's'}` },
    { label: 'Total orders',     value: String(overview.totalOrders) },
    { label: 'Open orders',      value: String(overview.openOrders), tone: 'success' },
    { label: 'Filled',           value: String(overview.filledOrders) },
    { label: 'Active markets',   value: String(overview.activeMarkets), tone: 'success' },
    { label: 'Halted/delisted',  value: String(overview.haltedMarkets), tone: overview.haltedMarkets > 0 ? 'warn' : undefined },
  ] : [];

  if (!overview) return <p className="text-sm" style={{ color: '#6c7684' }}>Loading…</p>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => {
        const color = c.tone === 'success' ? '#00d09c' : c.tone === 'warn' ? '#ffb800' : '#f5f6f8';
        return (
          <div key={c.label} className="p-4" style={{ background: '#11161d', border: '1px solid #2a3441' }}>
            <p className="text-xs mb-1.5" style={{ color: '#6c7684' }}>{c.label}</p>
            <p className="mono text-xl leading-tight" style={{ color }}>{c.value}</p>
            {c.sub && <p className="text-xs mt-1" style={{ color: '#6c7684' }}>{c.sub}</p>}
          </div>
        );
      })}
    </div>
  );
}
function UsersTable({ users, isLoading }: { users?: AdminUser[]; isLoading: boolean }) {
  return (
    <div style={{ border: '1px solid #2a3441' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: '#11161d', borderBottom: '1px solid #2a3441' }}>
            <th className="px-3 py-2 text-left text-xs" style={{ color: '#6c7684' }}>Email</th>
            <th className="px-3 py-2 text-left text-xs" style={{ color: '#6c7684' }}>User ID</th>
            <th className="px-3 py-2 text-left text-xs" style={{ color: '#6c7684' }}>Role</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && <SkeletonRows rows={4} cols={3} />}
          {!isLoading && users && users.length === 0 && (
            <tr><td colSpan={3} className="px-3 py-8 text-center text-xs" style={{ color: '#6c7684' }}>No users.</td></tr>
          )}
          {users?.map((u) => (
            <tr key={u.id} style={{ borderBottom: '1px solid #1a2029' }}>
              <td className="px-3 py-2.5 mono text-xs" style={{ color: '#f5f6f8' }}>{u.email}</td>
              <td className="px-3 py-2.5 mono text-xs" style={{ color: '#6c7684' }}>{u.id}</td>
              <td className="px-3 py-2.5">
                {u.isAdmin ? (
                  <span className="text-xs px-2 py-0.5" style={{ background: 'rgba(0,104,255,0.12)', color: '#0068ff' }}>Admin</span>
                ) : (
                  <span className="text-xs" style={{ color: '#6c7684' }}>User</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTable({ orders, isLoading, users }: { orders?: PageResponse<OrderResponse>; isLoading: boolean; users?: AdminUser[] }) {
  const byUserId = useMemo(() => new Map((users ?? []).map((u) => [u.id, u.email])), [users]);
  return (
    <div style={{ border: '1px solid #2a3441' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: '#11161d', borderBottom: '1px solid #2a3441' }}>
            <th className="px-3 py-2 text-left text-xs" style={{ color: '#6c7684' }}>Time</th>
            <th className="px-3 py-2 text-left text-xs" style={{ color: '#6c7684' }}>User</th>
            <th className="px-3 py-2 text-left text-xs" style={{ color: '#6c7684' }}>Pair</th>
            <th className="px-3 py-2 text-left text-xs" style={{ color: '#6c7684' }}>Side</th>
            <th className="px-3 py-2 text-right text-xs" style={{ color: '#6c7684' }}>Price</th>
            <th className="px-3 py-2 text-right text-xs" style={{ color: '#6c7684' }}>Qty</th>
            <th className="px-3 py-2 text-left text-xs" style={{ color: '#6c7684' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && <SkeletonRows rows={6} cols={7} />}
          {!isLoading && orders && orders.content.length === 0 && (
            <tr><td colSpan={7} className="px-3 py-8 text-center text-xs" style={{ color: '#6c7684' }}>No orders.</td></tr>
          )}
          {orders?.content.map((o) => (
            <tr key={o.id} style={{ borderBottom: '1px solid #1a2029' }}>
              <td className="px-3 py-2.5 text-xs" style={{ color: '#6c7684' }}>{formatTimeAgo(o.createdAt)}</td>
              <td className="px-3 py-2.5 mono text-xs" style={{ color: '#a0a8b4' }}>
                {byUserId.get(o.userId) ?? o.userId.slice(0, 8)}
              </td>
              <td className="px-3 py-2.5 mono text-xs" style={{ color: '#f5f6f8' }}>{o.symbol}</td>
              <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: o.side === 'BUY' ? '#00d09c' : '#ff4d5e' }}>{o.side}</td>
              <td className="px-3 py-2.5 mono text-xs text-right" style={{ color: '#f5f6f8' }}>
                {o.price ? formatPrice(o.price, '$') : <span style={{ color: '#6c7684' }}>MKT</span>}
              </td>
              <td className="px-3 py-2.5 mono text-xs text-right" style={{ color: '#a0a8b4' }}>{formatQuantity(o.quantity)}</td>
              <td className="px-3 py-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: STATUS_COLOR[o.status] }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLOR[o.status] }} />
                  {o.status.replace('_', ' ')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarketsTable({ markets, isLoading }: { markets?: Market[]; isLoading: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const mut = useMutation({
    mutationFn: ({ symbol, status }: { symbol: string; status: 'ACTIVE' | 'HALTED' }) => setMarketStatus(symbol, status),
    onSuccess: (m) => {
      toast(`${m.symbol} → ${m.status}`, 'success');
      qc.invalidateQueries({ queryKey: ['admin', 'markets'] });
      qc.invalidateQueries({ queryKey: ['markets'] });
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } } };
      toast(err?.response?.data?.detail ?? 'Failed to update market', 'error');
    },
  });

  return (
    <div style={{ border: '1px solid #2a3441' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: '#11161d', borderBottom: '1px solid #2a3441' }}>
            <th className="px-3 py-2 text-left text-xs" style={{ color: '#6c7684' }}>Symbol</th>
            <th className="px-3 py-2 text-left text-xs" style={{ color: '#6c7684' }}>Base / Quote</th>
            <th className="px-3 py-2 text-right text-xs" style={{ color: '#6c7684' }}>Min qty</th>
            <th className="px-3 py-2 text-right text-xs" style={{ color: '#6c7684' }}>Tick size</th>
            <th className="px-3 py-2 text-left text-xs" style={{ color: '#6c7684' }}>Status</th>
            <th className="px-3 py-2 text-right text-xs" style={{ color: '#6c7684' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && <SkeletonRows rows={6} cols={6} />}
          {markets?.map((m) => {
            const isActive = m.status === 'ACTIVE';
            return (
              <tr key={m.symbol} style={{ borderBottom: '1px solid #1a2029' }}>
                <td className="px-3 py-2.5 mono text-xs" style={{ color: '#f5f6f8' }}>{m.symbol}</td>
                <td className="px-3 py-2.5 mono text-xs" style={{ color: '#a0a8b4' }}>{m.baseCurrency} / {m.quoteCurrency}</td>
                <td className="px-3 py-2.5 mono text-xs text-right" style={{ color: '#a0a8b4' }}>{parseFloat(m.minQuantity)}</td>
                <td className="px-3 py-2.5 mono text-xs text-right" style={{ color: '#a0a8b4' }}>{parseFloat(m.tickSize)}</td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: MARKET_COLOR[m.status] ?? '#a0a8b4' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: MARKET_COLOR[m.status] ?? '#6c7684' }} />
                    {m.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    onClick={() => mut.mutate({ symbol: m.symbol, status: isActive ? 'HALTED' : 'ACTIVE' })}
                    disabled={mut.isPending}
                    className="text-xs px-2.5 py-1 transition-colors disabled:opacity-40"
                    style={{
                      color: isActive ? '#ffb800' : '#00d09c',
                      border: '1px solid ' + (isActive ? 'rgba(255,184,0,0.3)' : 'rgba(0,208,156,0.3)'),
                      background: 'transparent',
                    }}
                  >
                    {isActive ? 'Halt' : 'Activate'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

