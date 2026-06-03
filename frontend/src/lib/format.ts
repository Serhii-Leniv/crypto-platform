/**
 * Consistent number formatting across the app — matches institutional platforms
 * where dense data tables need short, scannable numerics.
 */

/** Compact currency: $95,234 → $95.2K, $18420750 → $18.4M, $0.55 → $0.55. */
export function formatCompactCurrency(value: number | string, currency = '$'): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${currency}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${currency}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${currency}${(abs / 1e3).toFixed(2)}K`;
  if (abs >= 1)   return `${sign}${currency}${abs.toFixed(2)}`;
  return `${sign}${currency}${abs.toFixed(abs >= 0.01 ? 4 : 6)}`;
}

/** Full price with adaptive decimals: 95234.56, 0.5482, 0.000123. */
export function formatPrice(value: number | string, prefix = ''): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  let decimals = 2;
  if (abs < 1)    decimals = 4;
  if (abs < 0.1)  decimals = 5;
  if (abs < 0.01) decimals = 6;
  return prefix + n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Signed percent: 2.27 → "+2.27%", -1.85 → "-1.85%". */
export function formatPercent(value: number | string, decimals = 2): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!isFinite(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(decimals)}%`;
}

/** Plain number with thousands separators. */
export function formatNumber(value: number | string, decimals = 0): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Quantity with min decimals, strips trailing zeros: 0.00500000 → "0.005". */
export function formatQuantity(value: number | string): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (!isFinite(n)) return '—';
  const str = n.toFixed(8);
  return str.replace(/\.?0+$/, '');
}

/** Relative time: "2m ago", "5h ago", "Jun 1". */
export function formatTimeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}
