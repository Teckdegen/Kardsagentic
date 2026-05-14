---
name: hyperliquid-funding
description: Live perp funding rates and basis across all Hyperliquid markets. Use to identify funding-arb opportunities and to avoid entries that pay extreme funding.
triggers: [funding, basis, perp arb, funding rate]
tools:
  - id: meta_and_ctx
    description: Universe + per-asset context (mark, oracle, funding, OI) on MAINNET
    endpoint: POST https://api.hyperliquid.xyz/info
    body:
      type: metaAndAssetCtxs
  - id: meta_and_ctx_testnet
    description: Same data on TESTNET (use this when HYPERLIQUID_NETWORK=testnet)
    endpoint: POST https://api.hyperliquid-testnet.xyz/info
    body:
      type: metaAndAssetCtxs
  - id: all_mids
    description: Latest mid prices across all markets (mainnet)
    endpoint: POST https://api.hyperliquid.xyz/info
    body:
      type: allMids
  - id: all_mids_testnet
    description: Latest mid prices across all markets (testnet)
    endpoint: POST https://api.hyperliquid-testnet.xyz/info
    body:
      type: allMids
permissions:
  network: [hyperliquid.xyz, hyperliquid-testnet.xyz]
  reads: true
  writes: false
---

# Hyperliquid funding feed

Returned tuple from `meta_and_ctx`: `[meta, contexts]`. `contexts[i]` has
`funding` as a decimal hourly rate (positive = longs pay shorts). The
PERPS_TRADER strategy consults this every cycle and biases entries toward
markets where funding pays the agent's intended side.

Use the `_testnet` variants when developing — same shape, mock data, no
real-money risk. The Kard agent picks based on `HYPERLIQUID_NETWORK` env.
