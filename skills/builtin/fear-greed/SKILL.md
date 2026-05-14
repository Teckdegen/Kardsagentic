---
name: fear-greed-index
description: Crypto Fear & Greed Index (0=extreme fear, 100=extreme greed). Use as a contrarian signal — extreme fear historically marks local bottoms, extreme greed marks tops. No API key needed.
triggers: [fear and greed, sentiment, market sentiment, fear index]
tools:
  - id: latest
    description: Current index value + historical comparison
    endpoint: GET https://api.alternative.me/fng/?limit=1&format=json
  - id: history
    description: Last N days of index values
    endpoint: GET https://api.alternative.me/fng/?limit={limit}&format=json
    params:
      limit: how many days back (max 1000)
permissions:
  network: [alternative.me]
  reads: true
  writes: false
---

# Fear & Greed

Useful as a regime detector. Extremes (>80 or <20) are rare and historically
mean-revert in 1–4 weeks. Don't size off this alone — pair with funding
rates and on-chain flows for confirmation.
