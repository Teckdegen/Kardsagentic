---
name: coingecko-price
description: Live spot prices and 24h change from CoinGecko free API. Use whenever the user or a strategy needs a market price.
triggers: [price, quote, spot, market price, how much is]
tools:
  - id: get_price
    description: USD price + 24h change for one or more coins
    endpoint: GET https://api.coingecko.com/api/v3/simple/price?ids={ids}&vs_currencies=usd&include_24hr_change=true
    params:
      ids: comma-separated coin ids (bitcoin, ethereum, solana, …)
  - id: trending
    description: Top trending coins right now
    endpoint: GET https://api.coingecko.com/api/v3/search/trending
permissions:
  network: [coingecko.com]
  reads: true
  writes: false
---

# CoinGecko price feed

Free public API. Rate-limited to ~10–30 req/min so cache aggressively if you
poll. Coin IDs use CoinGecko's slug (`bitcoin` not `BTC`). For symbol-to-id
mapping the agent can call `/coins/list` once and cache.
