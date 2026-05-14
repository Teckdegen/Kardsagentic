---
name: coinglass-funding
description: Cross-exchange funding-rate aggregation (Binance, Bybit, OKX, Hyperliquid, dYdX, GMX, …). Lets the agent compare funding across venues and pick the best place to collect it (or avoid paying it).
triggers: [cross-exchange funding, funding spread, where to collect funding, perp basis]
tools:
  - id: funding_now
    description: Current funding rates per symbol per exchange
    endpoint: GET https://open-api.coinglass.com/public/v2/funding?symbol={symbol}
    params:
      symbol: BTC, ETH, SOL, …
  - id: funding_history
    description: Historical funding for one symbol on one exchange
    endpoint: GET https://open-api.coinglass.com/public/v2/funding_rate_history?symbol={symbol}&interval={interval}
    params:
      symbol: BTC
      interval: 1h, 4h, 8h, 12h, 1d
permissions:
  network: [coinglass.com]
  reads: true
  writes: false
---

# Coinglass funding

Beats relying on a single exchange's funding. Sometimes Hyperliquid pays
0.05%/hr while Binance is at 0.005% — short on Hyperliquid + long the
spot you already hold = clean funding-arb basis trade.

Free tier rate-limits aggressively (~10 req/min) — cache.
