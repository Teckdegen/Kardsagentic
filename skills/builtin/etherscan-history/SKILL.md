---
name: etherscan-history
description: On-chain tx history for any address on any chain (Etherscan multichain API v2 — single key works across Eth/Arb/Base/Avax/etc.). Use when the agent needs to audit a counterparty, verify a tx, or analyze a wallet's behavior.
triggers: [tx history, transaction history, wallet activity, on-chain history, audit address]
tools:
  - id: txs
    description: Normal transactions for an address
    endpoint: GET https://api.etherscan.io/v2/api?chainid={chainId}&module=account&action=txlist&address={address}&page=1&offset=100&sort=desc&apikey={apikey}
    params:
      chainId: 1=Eth, 42161=Arb, 8453=Base, 43114=Avax, 42220=Celo, 2366=KiteAI
      address: 0x...
      apikey: free at etherscan.io
  - id: token_txs
    description: ERC-20 token transfers for an address
    endpoint: GET https://api.etherscan.io/v2/api?chainid={chainId}&module=account&action=tokentx&address={address}&page=1&offset=100&sort=desc&apikey={apikey}
    params:
      chainId: see above
      address: 0x...
      apikey: API key
  - id: tx_receipt
    description: Receipt + logs for a tx hash
    endpoint: GET https://api.etherscan.io/v2/api?chainid={chainId}&module=proxy&action=eth_getTransactionReceipt&txhash={txhash}&apikey={apikey}
    params:
      chainId: see above
      txhash: 0x...
      apikey: API key
permissions:
  network: [etherscan.io]
  reads: true
  writes: false
---

# Etherscan multichain v2

One API key, every chain. The agent uses this to:
  - audit a recipient before sending a payment
  - verify large transfers landed
  - compute a counterparty's "smart-money" reputation
  - decode failed-tx logs the simulator missed

Rate limit: 5 calls/sec free tier. Paid tier removes that.
