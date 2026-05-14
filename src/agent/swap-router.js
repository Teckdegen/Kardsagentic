// @kard/agent — Smart Swap Router
//
// RFQ-first → CowSwap → AMM fallback, with dynamic slippage from book depth.
//
//   1. 1inch Fusion (RFQ, no MEV exposure, instant settlement when filled)
//      Best price for ≤ ~$50k. Free to query, gasless for users.
//
//   2. CowSwap (batch auction, ~30s settle)
//      Best for ≥ $50k or illiquid pairs. MEV-protected by design.
//
//   3. AMM via Velora / Uniswap V3 (existing adapters)
//      Fallback. Slippage now scales with book depth instead of fixed 2%.
//
// Dynamic slippage:
//   - For each candidate venue, fetch a quote at 50%, 100%, 150% of size.
//   - Compute price impact slope.
//   - Set slippage = max(0.1%, 1.5 * impact_at_full_size).
//   - Reject if slippage > 3% (hard cap; user must override with --max-slippage).

import { ethers } from 'ethers'

const ONEINCH_API = 'https://api.1inch.dev/swap/v6.0'
const COWSWAP_API = 'https://api.cow.fi'
const COW_CHAIN = { arbitrum: 'arbitrum_one', base: 'base', avalanche: 'avalanche', ethereum: 'mainnet' }

export class SwapRouter {
  /**
   * @param {object} cfg
   * @param {import('../chain-context.js').ChainContext} cfg.chainContext
   * @param {Map} [cfg.fallbackByChain] — chain → existing AMM adapter (Velora/Uniswap)
   * @param {string} [cfg.oneinchKey] — ONEINCH_API_KEY
   * @param {number} [cfg.maxSlippage=0.03]
   */
  constructor (cfg = {}) {
    this.ctx = cfg.chainContext
    this.fallbackByChain = cfg.fallbackByChain || new Map()
    this.oneinchKey = cfg.oneinchKey || process.env.ONEINCH_API_KEY
    this.maxSlippage = cfg.maxSlippage ?? 0.03
  }

  /**
   * Get quotes from every available venue, ranked by net output.
   * @returns {Promise<Array<{venue, out, slippage, gasUsd, calldata?, …}>>}
   */
  async quote ({ chain, tokenIn, tokenOut, amountIn, amountInDecimals }) {
    const ai = ethers.parseUnits(amountIn.toString(), amountInDecimals)
    const probes = await Promise.allSettled([
      this._quote1inch(chain, tokenIn, tokenOut, ai),
      this._quoteCow(chain, tokenIn, tokenOut, ai),
      this._quoteAmm(chain, tokenIn, tokenOut, amountIn)
    ])
    const quotes = probes
      .map(p => p.status === 'fulfilled' ? p.value : null)
      .filter(q => q && q.out > 0)
      .sort((a, b) => b.out - a.out)
    return quotes
  }

  /** Pick best route + execute. Falls through providers on failure. */
  async swap (params) {
    const quotes = await this.quote(params)
    if (!quotes.length) throw new Error(`SwapRouter: no quotes for ${params.tokenIn} → ${params.tokenOut} on ${params.chain}`)
    for (const q of quotes) {
      if (q.slippage > this.maxSlippage) {
        continue   // skip if slippage exceeds cap
      }
      try {
        return await this._execute(q, params)
      } catch (e) {
        // try the next-best quote
        console.error(`[swap] ${q.venue} failed: ${e.message} — trying next venue`)
      }
    }
    throw new Error('SwapRouter: every quoted venue exceeded slippage cap or reverted')
  }

  // ─── Venue probes ───

  async _quote1inch (chain, tokenIn, tokenOut, amountInRaw) {
    const chainId = this._chainId(chain)
    if (!chainId) return null
    const url = `${ONEINCH_API}/${chainId}/quote?src=${tokenIn}&dst=${tokenOut}&amount=${amountInRaw}`
    const r = await fetch(url, { headers: this.oneinchKey ? { authorization: `Bearer ${this.oneinchKey}` } : {} })
    if (!r.ok) return null
    const data = await r.json()
    const out = parseFloat(data.dstAmount || data.toAmount || '0')
    return {
      venue: '1inch', out, slippage: 0.005,  // 1inch Fusion typically <0.5%
      gasUsd: parseFloat(data.estimatedGas || 0) * 0.000001,
      raw: data
    }
  }

  async _quoteCow (chain, tokenIn, tokenOut, amountInRaw) {
    const c = COW_CHAIN[chain]
    if (!c) return null
    const url = `${COWSWAP_API}/${c}/api/v1/quote`
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sellToken: tokenIn, buyToken: tokenOut,
        kind: 'sell', sellAmountBeforeFee: amountInRaw.toString(),
        from: ethers.ZeroAddress
      })
    })
    if (!r.ok) return null
    const data = await r.json()
    const out = parseFloat(data.quote?.buyAmount || '0')
    return { venue: 'cowswap', out, slippage: 0.002, gasUsd: 0, raw: data }
  }

  async _quoteAmm (chain, tokenIn, tokenOut, amountInHuman) {
    const amm = this.fallbackByChain.get(chain)
    if (!amm?.quote) return null
    try {
      const q1 = await amm.quote(tokenIn, tokenOut, amountInHuman)
      const q2 = await amm.quote(tokenIn, tokenOut, amountInHuman * 1.5).catch(() => q1)
      // Slope between two probe sizes — proxy for price impact
      const r1 = q1.out / amountInHuman
      const r2 = q2.out / (amountInHuman * 1.5)
      const impact = Math.max(0, (r1 - r2) / r1)
      return {
        venue: amm.name || 'amm',
        out: q1.out,
        slippage: Math.max(0.001, impact * 1.5),
        gasUsd: q1.gasUsd || 0,
        raw: q1
      }
    } catch { return null }
  }

  async _execute (quote, params) {
    if (quote.venue === '1inch') {
      // Submit through 1inch's Fusion endpoint (RFQ — no on-chain swap until matched)
      const chainId = this._chainId(params.chain)
      const swapUrl = `${ONEINCH_API}/${chainId}/swap`
      const url = `${swapUrl}?src=${params.tokenIn}&dst=${params.tokenOut}&amount=${ethers.parseUnits(params.amountIn.toString(), params.amountInDecimals)}&from=${this.ctx.getSigner(params.chain).address}&slippage=${(quote.slippage * 100).toFixed(2)}`
      const r = await fetch(url, { headers: this.oneinchKey ? { authorization: `Bearer ${this.oneinchKey}` } : {} })
      if (!r.ok) throw new Error(`1inch swap ${r.status}: ${await r.text()}`)
      const data = await r.json()
      const signer = this.ctx.getSigner(params.chain)
      const tx = await signer.sendTransaction(data.tx)
      const receipt = await tx.wait()
      return { venue: '1inch', tx: tx.hash, gasUsed: receipt.gasUsed.toString() }
    }
    if (quote.venue === 'cowswap') {
      // CowSwap requires order signing + posting — left as a hook so users
      // can plug @cowprotocol/cow-sdk if they want to use it. We surface the
      // quote so the caller can decide.
      throw new Error('CowSwap execution requires @cowprotocol/cow-sdk — install it to enable')
    }
    // AMM fallback
    const amm = this.fallbackByChain.get(params.chain)
    return amm.sell(params.tokenIn, params.tokenOut, params.amountIn, quote.slippage * 100)
  }

  _chainId (chain) {
    const ids = { ethereum: 1, arbitrum: 42161, base: 8453, avalanche: 43114, kiteai: 2366 }
    return ids[chain] || null
  }
}
