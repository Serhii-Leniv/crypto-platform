// k6 load test — measures the matching engine's place-order critical path directly,
// bypassing the gateway's per-user rate limit so we benchmark the engine, not the limiter.
//
// What this exercises end-to-end:
//   POST /api/v1/orders → validate trading pair
//                       → walletClient.lock (sync REST to wallet-service)
//                       → persist order
//                       → enter in-memory book
//                       → OrderMatchingEngine.matchOrder (under per-symbol ReentrantLock)
//                       → walletClient.settle (sync REST to wallet-service, atomic 4-wallet txn)
//                       → respond with final order status
//
// Why we hit order-matching directly:
//   The gateway rate-limits `/api/v1/orders` at 10 req/s per user (a deliberate product
//   feature) — at 20+ VUs that limiter would dominate the numbers. Hitting :8082 with the
//   pre-baked X-User-Id header (the gateway's normal forwarding shape) lets us measure the
//   engine itself. Auth correctness is unaffected — that's a different benchmark.
//
// Run:
//   docker run --rm --network host -v "$(pwd -W)/load:/scripts" -e BASE_URL=http://localhost:8082 \
//     grafana/k6 run --duration 30s --vus 50 /scripts/place-orders.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

const BASE_URL   = __ENV.BASE_URL   || 'http://localhost:8082';
const WALLET_URL = __ENV.WALLET_URL || 'http://localhost:8083';

// Demo user UUIDs (from R__seed_users.sql) — match the wallets seeded with balances.
const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB   = '22222222-2222-4222-8222-222222222222';

// One-time top-up so the benchmark measures engine throughput, not wallet exhaustion.
// Seeded balances are realistic for a demo, not for sustained load.
export function setup() {
  function deposit(userId, currency, amount) {
    const res = http.post(`${WALLET_URL}/api/v1/wallets/deposit`,
      JSON.stringify({ currency, amount }),
      { headers: { 'Content-Type': 'application/json', 'X-User-Id': userId } });
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`deposit ${currency} for ${userId} failed: ${res.status} ${res.body}`);
    }
  }
  // Each user gets a large enough float to survive a 60s × 100 VU run at qty 0.0001 BTC.
  deposit(ALICE, 'USDT', '10000000');
  deposit(ALICE, 'BTC',  '1000');
  deposit(BOB,   'USDT', '10000000');
  deposit(BOB,   'BTC',  '1000');
  return {};
}

const placeLatency = new Trend('place_order_latency_ms', true);
const placedOK     = new Counter('place_order_ok');
const placedFail   = new Counter('place_order_fail');
const insufficient = new Rate('insufficient_funds_rate');

export const options = {
  scenarios: {
    sustained: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 50),
      duration: __ENV.DURATION || '30s',
    },
  },
  thresholds: {
    place_order_latency_ms: ['p(99)<500', 'p(95)<200'],
    'place_order_ok':       ['count>500'],
  },
};

export default function () {
  // Alternate user × side so settled trades keep both wallets liquid.
  const isAlice = (__VU + __ITER) % 2 === 0;
  const userId  = isAlice ? ALICE : BOB;
  const side    = isAlice ? 'BUY' : 'SELL';

  // Small qty at near-market price → high likelihood of crossing the book.
  const body = JSON.stringify({
    symbol:      'BTC-USDT',
    side,
    orderType:   'LIMIT',
    quantity:    '0.0001',
    price:       '95000',
    timeInForce: 'GTC',
  });

  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/v1/orders`, body, {
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id':    userId,
    },
  });
  const elapsed = Date.now() - start;

  placeLatency.add(elapsed);
  if (res.status === 201 || res.status === 200) {
    placedOK.add(1);
    insufficient.add(false);
  } else {
    placedFail.add(1);
    // Wallet runs out → service returns 400 "Insufficient Funds" via the global handler.
    insufficient.add(res.status === 400 && res.body && res.body.includes('Insufficient'));
  }

  check(res, { 'placed (2xx)': (r) => r.status >= 200 && r.status < 300 });
}
