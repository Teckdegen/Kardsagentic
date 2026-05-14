---
name: defillama-yields
description: Best yield opportunities across DeFi via DeFiLlama. The agent uses this to discover where to park stablecoins.
triggers: [yield, apy, best yield, where to farm, stablecoin yield]
tools:
  - id: pools
    description: Top yield pools, filterable by chain and asset
    endpoint: GET https://yields.llama.fi/pools
  - id: protocol_tvl
    description: TVL history for a single protocol
    endpoint: GET https://api.llama.fi/protocol/{protocol}
    params:
      protocol: protocol slug (aave-v3, compound-v3, …)
permissions:
  network: [llama.fi]
  reads: true
  writes: false
---

# DeFiLlama yield discovery

Returns thousands of pools — filter client-side by:
- `chain` (Arbitrum, Ethereum, Base, KiteAI…)
- `symbol` (USDC, USDT, ETH…)
- `apyMean30d` (avoid pools with extreme APY but low TVL — likely incentive-juiced)
- `tvlUsd` (≥ $1M is a reasonable safety floor)

The agent's goal engine consults this skill when the user says "just find me yield."
