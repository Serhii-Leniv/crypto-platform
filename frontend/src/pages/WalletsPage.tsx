import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWallets, deposit, withdraw } from '../api/wallets';
import { getAllMarketData } from '../api/market';
import { getMarkets, type Market } from '../api/markets';
import Sparkline, { syntheticSparkline } from '../components/Sparkline';
import PieChart from '../components/PieChart';
import { SkeletonRows, Skeleton } from '../components/Skeleton';
import { IconTrendingUp, IconTrendingDown } from '../components/icons';
import { formatCompactCurrency, formatPrice, formatQuantity } from '../lib/format';
import type { WalletResponse, MarketDataResponse } from '../types';

const STABLES = new Set(['USDT', 'USDC', 'BUSD', 'DAI']);
const PALETTE = ['#0068ff', '#00d09c', '#ffb800', '#ff4d5e', '#9b6bff', '#26a17b', '#e84142', '#0033ad'];

function colorFor(_currency: string, idx: number): string {
  // Stables tend to be similar; deterministic palette index by position keeps colors stable across renders.
  return PALETTE[idx % PALETTE.length];
}

interface EnrichedWallet extends WalletResponse {
  usdValue: number;
  availableUsd: number;
  lockedUsd: number;
  lastPrice: number;
  change24h: number;
  isStable: boolean;
}

function enrich(wallets: WalletResponse[], markets: MarketDataResponse[]): EnrichedWallet[] {
  return wallets.map((w) => {
    const isStable = STABLES.has(w.currency);
    let lastPrice = 0;
    let change24h = 0;
    if (isStable) {
      lastPrice = 1;
    } else {
      const m = markets.find((mk) => mk.symbol === `${w.currency}-USDT`);
      if (m) {
        lastPrice = parseFloat(m.lastPrice);
        change24h = parseFloat(m.priceChangePercent24h);
      }
    }
    const balance      = parseFloat(w.balance);
    const available    = parseFloat(w.availableBalance);
    const locked       = parseFloat(w.lockedBalance);
    return {
      ...w,
      lastPrice,
      change24h,
      isStable,
      usdValue:     balance   * lastPrice,
      availableUsd: available * lastPrice,
      lockedUsd:    locked    * lastPrice,
    };
  });
}

function FundsForm({ currencies, walletsByCurrency }: {
  currencies: string[];
  walletsByCurrency: Map<string, EnrichedWallet>;
}) {
  const qc = useQueryClient();
  const [action, setAction]     = useState<'deposit' | 'withdraw'>('deposit');
  const [currency, setCurrency] = useState(currencies[0] ?? 'USDT');
  const [amount, setAmount]     = useState('');
  const [msg, setMsg]           = useState('');
  const [err, setErr]           = useState('');

  const isDeposit = action === 'deposit';
  const accentColor = isDeposit ? '#00d09c' : '#ff4d5e';
  const wallet = walletsByCurrency.get(currency);
  const available = wallet ? parseFloat(wallet.availableBalance) : 0;

  const mutation = useMutation({
    mutationFn: isDeposit ? deposit : withdraw,
    onSuccess: () => {
      setMsg(`${isDeposit ? 'Deposit' : 'Withdrawal'} successful`);
      setErr('');
      setAmount('');
      qc.invalidateQueries({ queryKey: ['wallets'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (e: unknown) => {
      const err_ = e as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      setErr(err_?.response?.data?.detail ?? err_?.response?.data?.message ?? err_?.message ?? 'Failed');
      setMsg('');
    },
  });

  function reset() {
    setMsg('');
    setErr('');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    reset();
    mutation.mutate({ currency: currency.toUpperCase(), amount });
  }

  const amountNum = parseFloat(amount || '0');
  const overdraft = !isDeposit && amountNum > 0 && amountNum > available;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Action toggle — Deposit / Withdraw */}
      <div className="flex" style={{ background: '#0a0e14', border: '1px solid #2a3441' }}>
        <button
          type="button"
          onClick={() => { setAction('deposit');  reset(); }}
          className="flex-1 py-2 text-sm font-semibold transition-colors inline-flex items-center justify-center gap-1.5"
          style={{ background: isDeposit ? '#00d09c' : 'transparent', color: isDeposit ? '#fff' : '#6c7684' }}
        >
          <IconTrendingUp size={14} /> Deposit
        </button>
        <button
          type="button"
          onClick={() => { setAction('withdraw'); reset(); }}
          className="flex-1 py-2 text-sm font-semibold transition-colors inline-flex items-center justify-center gap-1.5"
          style={{ background: !isDeposit ? '#ff4d5e' : 'transparent', color: !isDeposit ? '#fff' : '#6c7684' }}
        >
          <IconTrendingDown size={14} /> Withdraw
        </button>
      </div>

      <div>
        <label className="block text-xs mb-1" style={{ color: '#a0a8b4' }}>Currency</label>
        <select
          required
          value={currency}
          onChange={(e) => { setCurrency(e.target.value); reset(); }}
          className="input-field mono w-full px-3 py-2 text-sm"
          style={{ background: '#0a0e14', border: '1px solid #2a3441', color: '#f5f6f8' }}
        >
          {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <label className="flex items-baseline justify-between text-xs mb-1" style={{ color: '#a0a8b4' }}>
          <span>Amount</span>
          {!isDeposit && (
            <span className="mono" style={{ color: '#6c7684' }}>
              available {formatQuantity(available)}
            </span>
          )}
        </label>
        <input
          required
          type="number"
          step="0.00000001"
          min="0.00000001"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="input-field mono w-full px-3 py-2 text-sm"
          style={{ background: '#0a0e14', border: '1px solid ' + (overdraft ? '#ff4d5e' : '#2a3441'), color: '#f5f6f8' }}
        />
        {!isDeposit && available > 0 && (
          <div className="flex gap-1 mt-1.5">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setAmount((Math.floor(available * pct / 100 * 1e8) / 1e8).toString())}
                className="flex-1 py-0.5 text-[10px] transition-colors"
                style={{ background: '#0a0e14', border: '1px solid #2a3441', color: '#a0a8b4' }}
              >
                {pct === 100 ? 'Max' : `${pct}%`}
              </button>
            ))}
          </div>
        )}
        {overdraft && <p className="text-xs mt-1" style={{ color: '#ff4d5e' }}>Exceeds available balance</p>}
      </div>

      {msg && (
        <p className="text-xs px-3 py-2" style={{ background: 'rgba(0,208,156,0.08)', border: '1px solid rgba(0,208,156,0.25)', color: '#00d09c' }}>{msg}</p>
      )}
      {err && (
        <p className="text-xs px-3 py-2" style={{ background: 'rgba(255,77,94,0.08)', border: '1px solid rgba(255,77,94,0.25)', color: '#ff4d5e' }}>{err}</p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending || overdraft}
        className="w-full py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
        style={{ background: accentColor, color: '#fff' }}
      >
        {mutation.isPending ? '…' : isDeposit ? `Deposit ${currency}` : `Withdraw ${currency}`}
      </button>
    </form>
  );
}

export default function WalletsPage() {
  const { data: wallets, isLoading } = useQuery<WalletResponse[]>({
    queryKey: ['wallets'],
    queryFn: getWallets,
    refetchInterval: 5000,
  });
  const { data: tickers } = useQuery<MarketDataResponse[]>({
    queryKey: ['market-data'],
    queryFn: getAllMarketData,
    staleTime: 10_000,
  });
  const { data: markets } = useQuery<Market[]>({
    queryKey: ['markets'],
    queryFn: getMarkets,
    staleTime: 60_000,
  });
  const [sortBy, setSortBy] = useState<'value' | 'name'>('value');

  const enriched = useMemo<EnrichedWallet[]>(() => {
    if (!wallets || !tickers) return [];
    return enrich(wallets, tickers);
  }, [wallets, tickers]);

  const sorted = useMemo(() => {
    const rows = enriched.slice();
    rows.sort((a, b) => sortBy === 'value' ? b.usdValue - a.usdValue : a.currency.localeCompare(b.currency));
    return rows;
  }, [enriched, sortBy]);

  const totalUsd     = enriched.reduce((s, w) => s + w.usdValue, 0);
  const totalAvail   = enriched.reduce((s, w) => s + w.availableUsd, 0);
  const totalLocked  = enriched.reduce((s, w) => s + w.lockedUsd, 0);

  const slices = useMemo(
    () => enriched
      .filter((w) => w.usdValue > 0.01)
      .sort((a, b) => b.usdValue - a.usdValue)
      .map((w, idx) => ({ label: w.currency, value: w.usdValue, color: colorFor(w.currency, idx) })),
    [enriched],
  );

  // Deposit/withdraw currency options — union of seeded markets + already-held wallet currencies.
  const fundOptions = useMemo<string[]>(() => {
    const set = new Set<string>();
    markets?.forEach((m) => { set.add(m.baseCurrency); set.add(m.quoteCurrency); });
    enriched.forEach((w) => set.add(w.currency));
    return [...set].sort();
  }, [markets, enriched]);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6" style={{ color: '#f5f6f8' }}>Portfolio</h2>

      {/* Top: total + donut + breakdown stat cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatBox label="Total value"  value={isLoading ? null : formatCompactCurrency(totalUsd)} />
          <StatBox label="Available"    value={isLoading ? null : formatCompactCurrency(totalAvail)} tone="success" />
          <StatBox label="Locked"       value={isLoading ? null : formatCompactCurrency(totalLocked)} tone={totalLocked > 0 ? 'warn' : undefined} />
          <StatBox label="Currencies"   value={isLoading ? null : String(enriched.length)} />
          <StatBox label="Largest"      value={isLoading ? null : (slices[0]?.label ?? '—')}
                   sub={slices[0] ? `${((slices[0].value / totalUsd) * 100).toFixed(1)}%` : ''} />
          <StatBox label="Stable %"     value={isLoading ? null : `${((enriched.filter(w => w.isStable).reduce((s, w) => s + w.usdValue, 0) / Math.max(totalUsd, 1)) * 100).toFixed(0)}%`} />
        </div>

        <div className="flex flex-col items-center justify-center p-4" style={{ background: '#11161d', border: '1px solid #2a3441' }}>
          <PieChart
            slices={slices}
            size={170}
            thickness={28}
            centerTop="Total"
            centerBottom={isLoading ? '' : formatCompactCurrency(totalUsd)}
          />
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-3 max-w-full">
            {slices.slice(0, 6).map((s) => (
              <span key={s.label} className="inline-flex items-center gap-1.5 text-xs" style={{ color: '#a0a8b4' }}>
                <span className="w-2 h-2" style={{ background: s.color }} />
                <span className="mono">{s.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Wallets table */}
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-semibold" style={{ color: '#f5f6f8' }}>Assets</h3>
        <div className="flex items-center gap-1 text-xs">
          <span style={{ color: '#6c7684' }}>Sort:</span>
          {(['value', 'name'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className="px-2 py-0.5 transition-colors"
              style={{
                background: sortBy === s ? 'rgba(0,104,255,0.12)' : 'transparent',
                color: sortBy === s ? '#0068ff' : '#a0a8b4',
              }}
            >
              {s === 'value' ? 'Value' : 'Name'}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8" style={{ border: '1px solid #2a3441' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#11161d', borderBottom: '1px solid #2a3441' }}>
              <th className="px-3 py-2 text-left text-xs" style={{ color: '#6c7684' }}>Asset</th>
              <th className="px-3 py-2 text-right text-xs" style={{ color: '#6c7684' }}>Balance</th>
              <th className="px-3 py-2 text-right text-xs" style={{ color: '#6c7684' }}>Available</th>
              <th className="px-3 py-2 text-right text-xs" style={{ color: '#6c7684' }}>Locked</th>
              <th className="px-3 py-2 text-right text-xs" style={{ color: '#6c7684' }}>Price</th>
              <th className="px-3 py-2 text-right text-xs" style={{ color: '#6c7684' }}>24h Δ</th>
              <th className="px-3 py-2 text-right text-xs" style={{ color: '#6c7684' }}>Trend</th>
              <th className="px-3 py-2 text-right text-xs" style={{ color: '#6c7684' }}>USD value</th>
              <th className="px-3 py-2 text-right text-xs" style={{ color: '#6c7684' }}>Share</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <SkeletonRows rows={5} cols={9} />}
            {!isLoading && sorted.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-sm" style={{ color: '#6c7684' }}>
                No wallets yet — make a deposit below.
              </td></tr>
            )}
            {sorted.map((w, idx) => {
              const share = totalUsd > 0 ? (w.usdValue / totalUsd) * 100 : 0;
              const color = colorFor(w.currency, idx);
              return (
                <tr key={w.id} style={{ borderBottom: '1px solid #1a2029' }}>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2" style={{ background: color }} />
                      <span className="mono text-sm" style={{ color: '#f5f6f8' }}>{w.currency}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 mono text-xs text-right" style={{ color: '#f5f6f8' }}>{formatQuantity(w.balance)}</td>
                  <td className="px-3 py-2.5 mono text-xs text-right" style={{ color: '#a0a8b4' }}>{formatQuantity(w.availableBalance)}</td>
                  <td className="px-3 py-2.5 mono text-xs text-right" style={{ color: parseFloat(w.lockedBalance) > 0 ? '#ffb800' : '#6c7684' }}>
                    {formatQuantity(w.lockedBalance)}
                  </td>
                  <td className="px-3 py-2.5 mono text-xs text-right" style={{ color: '#a0a8b4' }}>
                    {w.isStable ? '$1.00' : w.lastPrice > 0 ? formatPrice(w.lastPrice, '$') : '—'}
                  </td>
                  <td className="px-3 py-2.5 mono text-xs text-right" style={{ color: w.isStable ? '#6c7684' : w.change24h >= 0 ? '#00d09c' : '#ff4d5e' }}>
                    {w.isStable ? '—' : `${w.change24h >= 0 ? '+' : ''}${w.change24h.toFixed(2)}%`}
                  </td>
                  <td className="px-3 py-2.5">
                    <div style={{ float: 'right' }}>
                      {w.isStable ? (
                        <span className="text-xs" style={{ color: '#6c7684' }}>—</span>
                      ) : w.lastPrice > 0 ? (
                        <Sparkline data={syntheticSparkline(w.currency + '-USDT', w.lastPrice, w.change24h)} width={64} height={20} />
                      ) : <span className="text-xs" style={{ color: '#6c7684' }}>—</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 mono text-xs text-right" style={{ color: '#f5f6f8' }}>{formatCompactCurrency(w.usdValue)}</td>
                  <td className="px-3 py-2.5 text-xs text-right" style={{ color: '#a0a8b4' }}>
                    <div className="inline-flex items-center gap-2">
                      <div className="w-12 h-1.5" style={{ background: '#1a2029' }}>
                        <div className="h-full" style={{ width: `${share}%`, background: color }} />
                      </div>
                      <span className="mono text-[10px]" style={{ color: '#6c7684', width: 36 }}>{share.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Single deposit / withdraw form with action toggle */}
      <div className="max-w-md p-4" style={{ background: '#11161d', border: '1px solid #2a3441' }}>
        <FundsForm
          currencies={fundOptions}
          walletsByCurrency={new Map(enriched.map((w) => [w.currency, w]))}
        />
      </div>
    </div>
  );
}

function StatBox({ label, value, sub, tone }: { label: string; value: string | null; sub?: string; tone?: 'success' | 'warn' }) {
  const color = tone === 'success' ? '#00d09c' : tone === 'warn' ? '#ffb800' : '#f5f6f8';
  return (
    <div className="p-4" style={{ background: '#11161d', border: '1px solid #2a3441' }}>
      <p className="text-xs mb-1.5" style={{ color: '#6c7684' }}>{label}</p>
      <p className="mono text-lg leading-tight" style={{ color }}>
        {value === null ? <Skeleton height={18} width="60%" /> : value}
      </p>
      {sub && <p className="text-xs mt-1 mono" style={{ color: '#6c7684' }}>{sub}</p>}
    </div>
  );
}
