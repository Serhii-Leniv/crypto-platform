import { useEffect, useState } from 'react';
import { isWatched, toggleWatch } from '../lib/watchlist';

export default function StarButton({ symbol, size = 14 }: { symbol: string; size?: number }) {
  const [on, setOn] = useState(() => isWatched(symbol));

  useEffect(() => {
    const handler = () => setOn(isWatched(symbol));
    window.addEventListener('watchlist-changed', handler);
    return () => window.removeEventListener('watchlist-changed', handler);
  }, [symbol]);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        setOn(toggleWatch(symbol));
      }}
      className="inline-flex p-0.5"
      style={{ color: on ? '#ffb800' : '#3a4654', background: 'transparent' }}
      aria-label={on ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
      title={on ? 'Unstar' : 'Star'}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
