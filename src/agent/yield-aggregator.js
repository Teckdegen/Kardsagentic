// @kard/agent — Yield Aggregator
//
// Cross-protocol, cross-chain yield discovery + ranking. Pulls live data from:
//   - DeFiLlama Yields API (every protocol that reports)
//   - Live Aave reserve APYs (per chain via this.aave map)
//   - Live Lucid yield-states (totalLocked / aaveDeposited / utilization)
//   - Live Hyperliquid funding rates (negative funding on stables = paid yield
//     for shorts; positive on PERPs we're long = headwind)
//
// Outputs: a ranked list of opportunities the LLM (or the rule engine) can
// turn into concrete actions: lending_supply, lucid_mint, perps_open with
// funding-bias, or a pointer to a third-party protocol via a skill.
//
// This is what makes "just trade" actually pay off — the agent always has a
// concrete next-best yield to chase, not just whatever's in the strategy preset.

import { CHAINS } from '../evm/chains.js'

const LLAMA_POOLS_URL = 'https://yields.llama.fi/pools'
const SAFE_TVL = 1_000_000     // $1M floor — below = thin liquidity, skip
const MAX_APY_REASONABLE = 50  // > 50% reported APY usually means incentive distortion

export class YieldAggregator {
  /**
   * @param {object} cfg
   * @param {Function} [cfg.fetchPools] — override (defaults to DeFiLlama)
   * @param {Map<string, AaveLending>} [cfg.aaveByChain] — per-chain Aave clients
   * @param {LucidKiteBridge} [cfg.lucid]
   * @param {HyperliquidPerps} [cfg.perps]
   * @param {SkillRegistry} [cfg.skills] — optional fallback
   * @param {KardConfig} [cfg.policy] — user chain/venue/action filters
   */
  constructor (cfg = {}) {
    this.fetchPools = cfg.fetchPools || (async () => {
      const r = await fetch(LLAMA_POOLS_URL)
      if (!r.ok) throw new Error(`defillama ${r.status}`)
      const data = await r.json()
      return data.data || []
    })
    this.aaveByChain = cfg.aaveByChain || new Map()
    this.lucid = cfg.lucid || null
    this.perps = cfg.perps || null
    this.skills = cfg.skills || null
    this.policy = cfg.policy || null
    this._cache = null
    this._cacheAt = 0
    this.cacheTtlMs = 5 * 60_000 // 5 min
  }

  /**
   * Discover ranked opportunities matching constraints.
   *
   * @param {object} q
   * @param {string[]} [q.chains]      — filter to these chain keys
   * @param {string[]} [q.assets]      — filter to these symbols (USDC, USDT, ETH…)
   * @param {number}   [q.minTvl]      — TVL floor (default $1M)
   * @param {number}   [q.maxRiskTier] — 1=stable / 2=mixed / 3=exotic (default 2)
   * @param {number}   [q.limit=10]
   * @returns {Promise<{ opportunities, generatedAt, sources }>}
   */
  async discover (q = {}) {
    const limit = q.limit ?? 10
    const minTvl = q.minTvl ?? SAFE_TVL
    const maxRiskTier = q.maxRiskTier ?? 2
    const chains = q.chains?.map(s => s.toLowerCase())
    const assets = q.assets?.map(s => s.toUpperCase())

    const ops = []

    // 1) Native — Lucid Kite (if available)
    if (this.lucid) {
      try {
        for (const a of this.lucid.getAssets()) {
          if (assets && !assets.includes(a.symbol)) continue
          const ys = await this.lucid.getYieldState(a.symbol)
          // Implied APY heuristic = (deposited/locked) * Aave-on-lock-chain APY * (1 - 5% haircut)
          let aaveAPY = 0
          const aave = this.aaveByChain.get(a.lockChain)
          if (aave) {
            try {
              const apys = await aave.getAllReserveAPYs?.()
              aaveAPY = apys?.[a.symbol]?.supplyAPY || 0
            } catch {}
          }
          const aaveShare = ys.totalLocked > 0 ? (ys.aaveDeposited / ys.totalLocked) : 0.9
          const apy = aaveAPY * aaveShare * 0.95
          ops.push({
            source: 'lucid',
            chain: 'kiteai',
            asset: a.symbol,
            apy,
            tvl: ys.totalLocked,
            riskTier: 1,
            action: { type: 'lucid_mint', asset: a.symbol, sourceChain: a.lockChain, targetChain: 'kiteai' },
            note: `Lucid L-${a.symbol} (buffer ${ys.bufferRatio?.toFixed(1)}%, util ${(ys.utilizationBps / 100).toFixed(1)}%)`
          })
        }
      } catch (e) { /* skip */ }
    }

    // 2) Native — Aave per chain (live APYs)
    for (const [chain, aave] of this.aaveByChain) {
      if (chains && !chains.includes(chain)) continue
      try {
        const apys = await aave.getAllReserveAPYs?.()
        for (const [sym, rates] of Object.entries(apys || {})) {
          if (assets && !assets.includes(sym)) continue
          ops.push({
            source: 'aave',
            chain,
            asset: sym,
            apy: rates.supplyAPY || 0,
            tvl: null, // not surfaced by current reader
            riskTier: 1,
            action: { type: 'lending_supply', token: sym, chain }
          })
        }
      } catch { /* per-chain aave may fail */ }
    }

    // 3) DeFiLlama — every other protocol (Compound, Pendle, Curve, Beefy, …)
    try {
      const pools = await this._cachedPools()
      for (const p of pools) {
        const chainKey = (p.chain || '').toLowerCase()
        if (chains && !chains.includes(chainKey)) continue
        if (assets && !assets.includes(p.symbol?.toUpperCase())) continue
        if ((p.tvlUsd || 0) < minTvl) continue
        const apy = p.apyMean30d ?? p.apy ?? 0
        if (!apy || apy > MAX_APY_REASONABLE) continue   // skip incentive-juiced
        const riskTier = p.ilRisk === 'no' && p.exposure === 'single' ? 1
          : p.ilRisk === 'no' ? 2 : 3
        if (riskTier > maxRiskTier) continue
        ops.push({
          source: 'defillama',
          protocol: p.project,
          chain: chainKey,
          asset: p.symbol,
          apy: apy / 100,
          tvl: p.tvlUsd,
          riskTier,
          poolId: p.pool,
          action: { type: 'skill', name: 'defillama-yields', tool: 'pools', params: { poolId: p.pool } },
          note: `${p.project} pool — IL risk ${p.ilRisk}, exposure ${p.exposure}`
        })
      }
    } catch (e) { /* network — skip */ }

    // 4) Funding-rate yield via Hyperliquid (basis trade idea)
    if (this.perps) {
      try {
        const funding = await this.perps.getFunding()
        for (const [sym, f] of Object.entries(funding)) {
          if (Math.abs(f.funding) < 0.0001) continue
          // Annualised: hourly * 24 * 365
          const annualised = f.funding * 24 * 365
          if (Math.abs(annualised) < 0.05) continue   // < 5% APR — not worth it
          ops.push({
            source: 'hyperliquid',
            chain: 'hyperliquid',
            asset: sym,
            apy: Math.abs(annualised),
            tvl: f.openInterest,
            riskTier: 2,
            action: {
              type: 'perps_open',
              symbol: sym,
              side: f.funding > 0 ? 'short' : 'long', // collect funding
              note: 'basis-trade'
            },
            note: `funding ${(f.funding * 100).toFixed(3)}%/hr (${(annualised * 100).toFixed(1)}% APR)`
          })
        }
      } catch {}
    }

    // Apply user policy — drop opportunities on excluded chains / venues / assets
    const filtered = this.policy ? ops.filter(o => this.policy.filterOpportunity(o)) : ops
    filtered.sort((a, b) => (b.apy || 0) - (a.apy || 0))
    const top = filtered.slice(0, limit)
    return {
      generatedAt: new Date().toISOString(),
      sources: { lucid: !!this.lucid, aave: this.aaveByChain.size, defillama: true, perps: !!this.perps },
      opportunities: top
    }
  }

  async _cachedPools () {
    const now = Date.now()
    if (this._cache && now - this._cacheAt < this.cacheTtlMs) return this._cache
    this._cache = await this.fetchPools()
    this._cacheAt = now
    return this._cache
  }

  /** Names of chain keys the aggregator knows about (intersect with CHAINS) */
  knownChains () {
    return Object.keys(CHAINS)
  }
}
