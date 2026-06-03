# 0008 — Maker / taker fees credited to a house wallet

**Status:** Accepted
**Date:** 2026-06-03

## Context

Fees are charged at settlement time in the asset the user *receives* (buyer pays a base-currency fee, seller pays a quote-currency fee). The original implementation computed the fee, subtracted it from the credit, and stopped. The fee amount didn't go anywhere — it was lost from the math entirely.

For a real exchange this is wrong on two counts:

1. **Accounting**: the platform's revenue is the accumulated fees. Letting them evaporate means no view of P&L and no balance sheet for the exchange operator.
2. **Conservation**: the sum of all wallet movements per trade is no longer zero. Subtle bugs in fee math become impossible to catch because there's no symmetric counter-entry to validate against.

## Decision

Introduce a synthetic **house user** with a fixed UUID (`00000000-0000-0000-0000-00000000feee`) and route every collected fee into that user's per-currency wallet.

Inside `WalletService.settleTrade(...)`, after the four user-wallet movements and before the slippage refund:

```java
if (buyerFee.signum() > 0) {
    Wallet houseBase = getOrCreateWalletLocked(HOUSE_USER_ID, baseCurrency);
    houseBase.deposit(buyerFee);
    walletRepository.save(houseBase);
    // + transaction record + metrics.recordFeeCollected(baseCurrency, buyerFee);
}
// same shape for sellerFee in quoteCurrency
```

The fee deposits happen inside the same `@Transactional` as the four core movements — atomicity guarantees from [ADR-0002](0002-atomic-settlement-transaction.md) apply unchanged. House wallets are created lazily on first fee per currency via `getOrCreateWalletLocked(...)`.

A new Micrometer counter `wallet_fees_collected_total{currency}` exposes cumulative fee revenue per currency for the Grafana dashboard.

## Consequences

- **Conservation invariant restored**: per trade, `Σ deposits = Σ debits`. Any future divergence in fee math will surface as a balance check failure.
- **Revenue is observable**: `sum by (currency)(wallet_fees_collected_total)` in Prometheus answers "how much did the exchange make in BTC this hour?".
- **House wallet shows up in admin tooling**: the existing `transactionRepository.findByUserIdOrderByCreatedAtDesc(HOUSE_USER_ID, ...)` returns the full fee history. No new endpoint needed.
- **No auth-side user**: `HOUSE_USER_ID` exists only as a wallet-service identity. There's no row for it in `auth_db.users` and no JWT issuable for it. Acceptable because nothing outside wallet-service writes to or reads from these wallets; the wallet API endpoints scope by `userId` from the gateway header and the house ID never appears in a JWT.
- **Withdrawing fees**: out of scope. Real exchanges have an internal treasury workflow; here it would be an admin endpoint that transfers from the house wallet to a configured external address. Documented as a follow-up.
- **First-fee creates wallet rows quietly**: a `house_user × currency` wallet is created on the first trade that produces a fee in that currency. There is no pre-seed step — clones get clean books and house wallets materialise on demand.

## Alternatives considered

- **Leave fees in the void (the previous behaviour)**: rejected — fails conservation and produces no revenue signal.
- **One global "fees" wallet per currency** (not user-scoped): would require a new table or schema, breaks wallet-service's `(userId, currency)` uniqueness assumption. Synthetic user is a thinner change.
- **Multiple house accounts** (one per fee category — maker fee account, taker fee account, slippage account): more granular but no use case yet. Single house user keeps the model simple; can split later via a new ADR if reporting requirements diverge.
- **Track fees only as a Prometheus counter, no DB credit**: gives the dashboard but no `Σ deposits = Σ debits` invariant, and no historical fee ledger per trade. Rejected.
