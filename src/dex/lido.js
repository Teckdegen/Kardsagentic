// @kard/agent — Lido + EtherFi LRT routing (Arbitrum + Base bridged)
//
// Stays on chains we already support — no Ethereum mainnet trades.
// Both Lido (wstETH) and EtherFi (weETH) have bridged versions on Arbitrum
// and Base. We route ETH → wstETH or weETH via the existing SwapRouter (1inch
// → CowSwap → AMM), then surface the *real-yield* APR by querying the
// liquid-staking provider's APY endpoint.
//
// What this adds vs. just swapping:
//   - canonical token addresses (so the LLM emits the right `tokenOut`)
//   - real-yield APR (so the YieldAggregator includes LRTs in opportunities)
//   - "stake" / "unstake" semantics in the action vocabulary
//
// Pure stake/unstake on the underlying ETH chain isn't supported here per
// "no Ethereum trades" rule — users bridge to L2 first.

import { ethers } from 'ethers'

const TOKENS = {
  arbitrum: {
    wstETH: '0x5979D7b546E38E414F7E9822514be443A4800529',
    weETH:  '0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe',
    WETH:   '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
  },
  base: {
    wstETH: '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452',
    weETH:  '0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A',
    WETH:   '0x4200000000000000000000000000000000000006'
  }
}

// Public APY endpoints
const LIDO_APR_URL = 'https://eth-api.lido.fi/v1/protocol/steth/apr/last'
const ETHERFI_APR_URL = 'https://www.etherfi.bid/api/etherfi/apr'

// rate() returns wstETH/stETH ratio in 1e18 — used to convert wstETH balance to stETH-equivalent
const WSTETH_ABI = ['function stEthPerToken() view returns (uint256)']

export class LrtRouter {
  /**
   * @param {object} cfg
   * @param {'arbitrum'|'base'} cfg.chain
   * @param {ethers.Wallet} cfg.signer
   * @param {import('../agent/swap-router.js').SwapRouter} cfg.swapRouter
   */
  constructor (cfg) {
    this.chain = cfg.chain
    if (!TOKENS[this.chain]) throw new Error(`LRT: unsupported chain ${this.chain}`)
    this.signer = cfg.signer
    this.swap = cfg.swapRouter
    this.tokens = TOKENS[this.chain]
  }

  /** Live APR for both products (annualised, decimal — 0.034 = 3.4%) */
  async getApr () {
    const out = {}
    try {
      const r = await fetch(LIDO_APR_URL)
      if (r.ok) {
        const d = await r.json()
        out.wstETH = parseFloat(d.data?.apr || d.apr || 0) / 100
      }
    } catch {}
    try {
      const r = await fetch(ETHERFI_APR_URL)
      if (r.ok) {
        const d = await r.json()
        out.weETH = parseFloat(d?.latest_aprs?.[0]?.value || d?.apr || 0) / 100
      }
    } catch {}
    return out
  }

  /** Stake = swap WETH → wstETH (or weETH) on the current chain */
  async stake ({ amount, asset = 'wstETH', slippage = 0.005 }) {
    const tokenOut = this.tokens[asset]
    if (!tokenOut) throw new Error(`LRT: unknown asset ${asset}`)
    return this.swap.swap({
      chain: this.chain,
      tokenIn: this.tokens.WETH,
      tokenOut,
      amountIn: amount,
      amountInDecimals: 18
    })
  }

  /** Unstake = swap LRT → WETH on this chain (avoids the 1-week mainnet exit queue) */
  async unstake ({ amount, asset = 'wstETH', slippage = 0.005 }) {
    const tokenIn = this.tokens[asset]
    if (!tokenIn) throw new Error(`LRT: unknown asset ${asset}`)
    return this.swap.swap({
      chain: this.chain,
      tokenIn,
      tokenOut: this.tokens.WETH,
      amountIn: amount,
      amountInDecimals: 18
    })
  }

  /** Convert wstETH balance → stETH-equivalent for portfolio sizing */
  async wstEthToStEth (balance) {
    const c = new ethers.Contract(this.tokens.wstETH, WSTETH_ABI, this.signer.provider)
    const rate = await c.stEthPerToken()
    return Number(balance) * Number(ethers.formatUnits(rate, 18))
  }

  /** Surface as a YieldAggregator-compatible opportunity */
  async opportunities () {
    const apr = await this.getApr()
    return [
      apr.wstETH != null && {
        source: 'lido', chain: this.chain, asset: 'wstETH',
        apy: apr.wstETH, riskTier: 1,
        action: { type: 'skill', name: 'lrt-router', tool: 'stake', params: { asset: 'wstETH' } },
        note: `Lido wstETH (bridged on ${this.chain})`
      },
      apr.weETH != null && {
        source: 'etherfi', chain: this.chain, asset: 'weETH',
        apy: apr.weETH, riskTier: 1,
        action: { type: 'skill', name: 'lrt-router', tool: 'stake', params: { asset: 'weETH' } },
        note: `EtherFi weETH (bridged on ${this.chain})`
      }
    ].filter(Boolean)
  }
}
