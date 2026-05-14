// @kard/agent — Pendle PT/YT (Arbitrum + Base)
//
// Pendle splits yield-bearing tokens into Principal Tokens (PT, fixed yield)
// and Yield Tokens (YT, variable yield). The agent uses PT to lock in a
// fixed APY on a stablecoin, or YT to lever exposure to APY changes.
//
// Pendle's Hosted SDK exposes a swap endpoint that returns calldata which
// our signer just submits. That's what this adapter wraps.
//
// Docs: https://api-v2.pendle.finance/sdk/docs

import { ethers } from 'ethers'

const SDK_BASE = 'https://api-v2.pendle.finance/sdk/api/v1'

const CHAIN_ID = { arbitrum: 42161, base: 8453, ethereum: 1 }

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)'
]

export class PendleAdapter {
  /**
   * @param {object} cfg
   * @param {'arbitrum'|'base'} cfg.chain
   * @param {ethers.Wallet} cfg.signer
   */
  constructor (cfg) {
    this.name = 'pendle'
    this.chain = cfg.chain
    this.chainId = CHAIN_ID[cfg.chain]
    if (!this.chainId) throw new Error(`Pendle: unsupported chain ${cfg.chain}`)
    this.signer = cfg.signer
  }

  /** List active PT markets — fixed-APY opportunities the agent can chase */
  async getMarkets () {
    const r = await fetch(`${SDK_BASE}/${this.chainId}/markets/active`)
    if (!r.ok) throw new Error(`pendle ${r.status}`)
    const data = await r.json()
    return data.markets || data.results || []
  }

  /** Get a quote: amountIn USDC → PT-asset, fixed APY at maturity */
  async quotePtIn ({ marketAddress, tokenIn, amountIn, slippage = 0.005 }) {
    const url = `${SDK_BASE}/${this.chainId}/markets/${marketAddress}/swap`
    const params = new URLSearchParams({
      receiver: this.signer.address,
      slippage: String(slippage),
      enableAggregator: 'true',
      tokenIn,
      amountIn,
      tokenOut: marketAddress + '/PT'   // SDK wants the PT pseudo-token
    })
    const r = await fetch(`${url}?${params}`)
    if (!r.ok) throw new Error(`pendle quote ${r.status}: ${await r.text()}`)
    return r.json()
  }

  /** Buy PT — locks in the current fixed APY */
  async buyPt ({ marketAddress, tokenIn, amountIn, slippage }) {
    const quote = await this.quotePtIn({ marketAddress, tokenIn, amountIn, slippage })
    if (!quote?.tx) throw new Error('Pendle SDK returned no tx')

    // Approve if router needs it
    if (quote.tx.target && quote.approveTo) {
      const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, this.signer)
      const allowance = await tokenContract.allowance(this.signer.address, quote.approveTo)
      if (allowance < BigInt(amountIn)) {
        const tx = await tokenContract.approve(quote.approveTo, ethers.MaxUint256)
        await tx.wait()
      }
    }
    const tx = await this.signer.sendTransaction({
      to: quote.tx.to,
      data: quote.tx.data,
      value: quote.tx.value || 0
    })
    const receipt = await tx.wait()
    return {
      tx: tx.hash, gasUsed: receipt.gasUsed.toString(),
      venue: 'pendle', chain: this.chain, market: marketAddress,
      ptOut: quote.data?.amountOut, fixedAPY: quote.data?.impliedApy
    }
  }

  /** Sell PT (or YT) back for the underlying */
  async sellPt ({ marketAddress, tokenOut, amountIn, slippage = 0.005 }) {
    const url = `${SDK_BASE}/${this.chainId}/markets/${marketAddress}/swap`
    const params = new URLSearchParams({
      receiver: this.signer.address,
      slippage: String(slippage),
      enableAggregator: 'true',
      tokenIn: marketAddress + '/PT',
      amountIn,
      tokenOut
    })
    const r = await fetch(`${url}?${params}`)
    if (!r.ok) throw new Error(`pendle ${r.status}`)
    const quote = await r.json()
    const tx = await this.signer.sendTransaction({
      to: quote.tx.to, data: quote.tx.data, value: quote.tx.value || 0
    })
    const receipt = await tx.wait()
    return { tx: tx.hash, gasUsed: receipt.gasUsed.toString(), venue: 'pendle', chain: this.chain }
  }

  /** Available PT markets ranked by fixed APY (the agent's "park stablecoin" rail) */
  async rankByApy ({ asset = 'USDC', limit = 10 } = {}) {
    const markets = await this.getMarkets()
    return markets
      .filter(m => (m.underlyingAsset?.symbol || m.symbol || '').toUpperCase().includes(asset.toUpperCase()))
      .map(m => ({
        market: m.address,
        symbol: m.symbol,
        apy: parseFloat(m.impliedApy || m.aggregatedApy || '0'),
        expiry: m.expiry,
        tvlUsd: parseFloat(m.liquidity?.usd || '0')
      }))
      .sort((a, b) => b.apy - a.apy)
      .slice(0, limit)
  }
}
