---
name: coingecko-historical
description: Historical OHLC + market_chart for any CoinGecko-listed asset. Used by the backtester and any "compare X over Y days" analysis.
triggers: [historical price, history, backtest, ohlc, last week price]
tools:
  - id: range
    description: hourly close prices in a date range
    endpoint: GET https://api.coingecko.com/api/v3/coins/{id}/market_chart/range?vs_currency=usd&from={from}&to={to}
    params:
      id: coin id (bitcoin, ethereum, solana, …)
      from: unix-seconds start
      to: unix-seconds end
  - id: ohlc
    description: 4h OHLC bars for the last N days
    endpoint: GET https://api.coingecko.com/api/v3/coins/{id}/ohlc?vs_currency=usd&days={days}
    params:
      id: coin id
      days: 1, 7, 14, 30, 90, 180, 365, max
permissions:
  network: [coingecko.com]
  reads: true
  writes: false
---

# CoinGecko historical

Free tier ~10–30 req/min. The Backtester uses `range` automatically. For
custom analyses ("how often did ETH funding flip when price was below
20-day MA?") combine this with hyperliquid-funding history.
