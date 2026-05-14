---
name: cryptopanic-news
description: Latest crypto news headlines, filterable by token/sentiment. Use this when the agent needs to factor in news (e.g. "skip ETH long if there's a bearish news cluster in last 6h").
triggers: [news, headlines, sentiment news, what's happening, market news]
tools:
  - id: posts
    description: Latest news posts; filter with currencies and filter params
    endpoint: GET https://cryptopanic.com/api/v1/posts/?auth_token={auth_token}&public=true&currencies={currencies}&filter={filter}
    params:
      auth_token: cryptopanic API token (free at cryptopanic.com)
      currencies: comma-separated tickers (BTC,ETH,SOL)
      filter: rising|hot|bullish|bearish|important|saved|lol
permissions:
  network: [cryptopanic.com]
  reads: true
  writes: false
---

# CryptoPanic news feed

Free tier is generous: ~500 req/hour. Sentiment field is community-voted,
treat as soft signal not gospel. Use `filter=important` to cut volume.

The Goal Engine consults this skill when a user goal mentions "react to
news" or when an open position's underlying has a sudden cluster of
posts in the same direction.
