/**
 * Tiny localStorage-backed watchlist of starred symbols.
 * No backend roundtrip — preferences are personal and survive across reloads.
 */
const KEY = 'kairos.watchlist.v1';

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function write(s: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...s]));
    window.dispatchEvent(new Event('watchlist-changed'));
  } catch { /* localStorage unavailable */ }
}

export function getWatchlist(): Set<string> {
  return read();
}

export function isWatched(symbol: string): boolean {
  return read().has(symbol);
}

export function toggleWatch(symbol: string): boolean {
  const s = read();
  if (s.has(symbol)) {
    s.delete(symbol);
  } else {
    s.add(symbol);
  }
  write(s);
  return s.has(symbol);
}
