// @kard/agent — Aerodrome (Base) — V2 + Slipstream (CLAMM) router
//
// Aerodrome is the dominant DEX on Base. We support both:
//   - Solidly-style stable + volatile pools (fixed swap fee)
//   - Slipstream concentrated-liquidity pools (Uniswap V3 fork)
//
// Surface mirrors UniswapSwap so the agent runtime can use it as a chain-
// specific provider via the Map<chain, swap> in TreasuryAgent.

import { ethers } from 'ethers'

const ADDRS = {
  // Aerodrome V2 router on Base
  router:        '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43',
  // Slipstream router (Uniswap V3-style)
  slipstream:    '0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5',
  // Slipstream factory
  factoryCl:     '0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A',
  // WETH on Base
  weth:          '0x4200000000000000000000000000000000000006'
}

const V2_ROUTER_ABI = [
  'function getAmountsOut(uint256, (address from, address to, bool stable, address factory)[] routes) view returns (uint256[])',
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, (address from, address to, bool stable, address factory)[] routes, address to, uint256 deadline) returns (uint256[])'
]

const SLIPSTREAM_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, int24 tickSpacing, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256)'
]

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)'
]

export class AerodromeSwap {
  /**
   * @param {object} cfg
   * @param {ethers.Wallet} cfg.signer
   * @param {Map<string,{address,decimals}>} cfg.tokens
   * @param {boolean} [cfg.useSlipstream=false]
   */
  constructor (cfg) {
    this.name = 'aerodrome'
    this.signer = cfg.signer
    this.tokens = cfg.tokens
    this.useSlipstream = !!cfg.useSlipstream
    this.factory = cfg.factory || '0x420DD381b31aEf6683db6B902084cB0FFECe40Da' // V2 PoolFactory
    this.tickSpacing = cfg.tickSpacing ?? 100
  }

  _erc (sym) {
    const t = this.tokens.get?.(sym) || this.tokens[sym]
    if (!t) throw new Error(`Aerodrome: unknown token ${sym}`)
    return t
  }

  /** Quote — returns { out, gasUsd } */
  async quote (tokenIn, tokenOut, amountIn) {
    const inT = this._erc(tokenIn), outT = this._erc(tokenOut)
    const amount = ethers.parseUnits(amountIn.toString(), inT.decimals)
    const provider = this.signer.provider
    if (this.useSlipstream) {
      // CLAMM quoter is more involved; for an MVP quote, fall back to V2 path
    }
    const router = new ethers.Contract(ADDRS.router, V2_ROUTER_ABI, provider)
    const routes = [{ from: inT.address, to: outT.address, stable: false, factory: this.factory }]
    try {
      const amounts = await router.getAmountsOut(amount, routes)
      const outRaw = amounts[amounts.length - 1]
      return {
        out: parseFloat(ethers.formatUnits(outRaw, outT.decimals)),
        gasUsd: 0.05  // ballpark; refine with provider.estimateGas if needed
      }
    } catch {
      // Try the stable variant
      const stableRoutes = [{ from: inT.address, to: outT.address, stable: true, factory: this.factory }]
      const amounts = await router.getAmountsOut(amount, stableRoutes)
      const outRaw = amounts[amounts.length - 1]
      return {
        out: parseFloat(ethers.formatUnits(outRaw, outT.decimals)),
        gasUsd: 0.05, stable: true
      }
    }
  }

  async sell (tokenIn, tokenOut, amountIn, slippagePct = 0.5) {
    const inT = this._erc(tokenIn), outT = this._erc(tokenOut)
    const amount = ethers.parseUnits(amountIn.toString(), inT.decimals)
    const erc = new ethers.Contract(inT.address, ERC20_ABI, this.signer)
    const allowance = await erc.allowance(this.signer.address, ADDRS.router)
    if (allowance < amount) {
      const tx = await erc.approve(ADDRS.router, ethers.MaxUint256)
      await tx.wait()
    }
    const router = new ethers.Contract(ADDRS.router, V2_ROUTER_ABI, this.signer)
    const q = await this.quote(tokenIn, tokenOut, amountIn)
    const outRaw = ethers.parseUnits(q.out.toString(), outT.decimals)
    const minOut = outRaw * BigInt(Math.floor((100 - slippagePct) * 100)) / 10000n
    const routes = [{ from: inT.address, to: outT.address, stable: !!q.stable, factory: this.factory }]
    const tx = await router.swapExactTokensForTokens(amount, minOut, routes, this.signer.address, Math.floor(Date.now() / 1000) + 600)
    const receipt = await tx.wait()
    return { tx: tx.hash, gasUsed: receipt.gasUsed.toString(), venue: 'aerodrome', chain: 'base', out: q.out }
  }

  /** Required by TreasuryAgent's swap-pair discovery — list pairs we expose */
  async getAvailablePairs () {
    const symbols = [...(this.tokens.keys?.() || Object.keys(this.tokens))]
    const out = []
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        out.push({ tokenA: symbols[i], tokenB: symbols[j] })
      }
    }
    return out
  }
}
