---
name: pyth-prices
description: High-frequency price oracle from Pyth Network. Sub-second updates, 400+ assets including crypto, equities, FX. Use when you need fresher prices than CoinGecko's 1-min cache.
triggers: [oracle, fresh price, high-frequency price, pyth]
tools:
  - id: latest
    description: Latest price for a list of price feed IDs
    endpoint: GET https://hermes.pyth.network/v2/updates/price/latest?ids[]={ids}
    params:
      ids: comma-separated feed IDs (Crypto.BTC/USD, Crypto.ETH/USD, …) — see https://pyth.network/developers/price-feed-ids
  - id: vaa
    description: Latest signed price update VAA (for posting to chain)
    endpoint: GET https://hermes.pyth.network/api/latest_vaas?ids[]={ids}
    params:
      ids: feed IDs
permissions:
  network: [pyth.network]
  reads: true
  writes: false
---

# Pyth Network prices

Pyth aggregates pro-trader prices from ~95 first-party publishers. Updates
multiple times per second; the `confidence` field tells you how much
publishers disagree (wider = treat with caution).

The `vaa` tool returns a signed price-update payload you can post on-chain
to settle a Pyth-priced contract — useful for Pendle / GMX V2 style
oracles.
