// @kard/agent — Cross-chain Treasurer
//
// Maintains a target USDC distribution across chains. Each cycle, computes
// drift vs target. If any chain drifts past `threshold`, proposes a `bridge`
// action (subject to `gas_budget_per_rebalance`).
//
// Config: ~/.kard/treasury.yml  (or .json)
//
//   target:
//     kiteai:    { USDC: 0.30 }        # 30% of total stables on Kite
//     arbitrum:  { USDC: 0.50 }        # 50% on Arb (perps margin + Lucid origin)
//     base:      { USDC: 0.20 }        # 20% on Base (Aerodrome / Pendle)
//   threshold: 0.10                    # rebalance if drift > 10%
//   gas_budget_per_rebalance: 5        # don't pay > $5 in fees to fix
//   min_move_usd: 50                   # don't bother moving < $50

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const TREASURY_FILE_YML = path.join(os.homedir(), '.kard', 'treasury.yml')
const TREASURY_FILE_JSON = path.join(os.homedir(), '.kard', 'treasury.json')

export class Treasurer {
  /**
   * @param {object} cfg
   * @param {import('./treasury.js').TreasuryAgent} cfg.agent
   * @param {import('../notifier.js').Notifier} [cfg.notifier]
   * @param {object} [cfg.config] — inline override for the YAML/JSON file
   */
  constructor (cfg) {
    this.agent = cfg.agent
    this.notifier = cfg.notifier
    this.config = cfg.config || this._loadConfig()
  }

  enabled () { return !!this.config?.target }

  /**
   * Refresh real on-chain balances for every chain in the target distribution.
   * Cached across a cycle so the proposeRebalance call is fast.
   */
  async refreshBalances () {
    if (!this.agent.gas) { this._balances = {}; return {} }
    try {
      this._balances = await this.agent.gas.stableBalances(['USDC', 'USDT'])
    } catch (e) {
      this.agent.log?.('treasurer', `balance refresh failed: ${e.message}`)
      this._balances = {}
    }
    return this._balances
  }

  _loadConfig () {
    if (fs.existsSync(TREASURY_FILE_JSON)) {
      try { return JSON.parse(fs.readFileSync(TREASURY_FILE_JSON, 'utf8')) } catch {}
    }
    if (fs.existsSync(TREASURY_FILE_YML)) {
      try {
        const raw = fs.readFileSync(TREASURY_FILE_YML, 'utf8')
        return parseSimpleYaml(raw)
      } catch (e) {
        console.error('[treasurer] config parse failed:', e.message)
      }
    }
    return null
  }

  /**
   * Compute drift across chains and propose at most one bridge action per cycle.
   * Returns null if no action needed, or a bridge action ready for the agent
   * to execute through its existing bridge surface.
   */
  proposeRebalance () {
    if (!this.enabled() || !this.agent.gas) return null
    const cfg = this.config
    const threshold = cfg.threshold ?? 0.10
    const gasBudget = cfg.gas_budget_per_rebalance ?? 5
    const minMove = cfg.min_move_usd ?? 50

    const balances = this._fetchBalances()
    const total = Object.values(balances).reduce((a, b) => a + (b.USDC || 0), 0)
    if (total <= 0) return null

    // Compute drift per chain
    const drifts = []
    for (const [chain, target] of Object.entries(cfg.target)) {
      const targetUsd = (target.USDC || 0) * total
      const actualUsd = balances[chain]?.USDC || 0
      const drift = actualUsd - targetUsd          // + = overweight, − = underweight
      const driftPct = total > 0 ? drift / total : 0
      drifts.push({ chain, targetUsd, actualUsd, drift, driftPct })
    }

    // Find largest overweight + largest underweight pair
    drifts.sort((a, b) => b.drift - a.drift)
    const over = drifts[0]
    const under = drifts[drifts.length - 1]
    if (!over || !under || over.chain === under.chain) return null

    // Only act if BOTH ends exceed threshold
    if (Math.abs(over.driftPct) < threshold || Math.abs(under.driftPct) < threshold) return null

    // Move the smaller of (overweight excess, underweight deficit)
    const moveUsd = Math.min(over.drift, -under.drift)
    if (moveUsd < minMove) return null

    // Estimate gas cost — refuse if too expensive
    // (caller should check gas pre-flight before submitting; we surface estimate)
    const action = {
      type: 'bridge',
      sourceChain: over.chain,
      targetChain: under.chain,
      asset: 'USDC',
      amount: Math.floor(moveUsd * 100) / 100,
      reason: `Treasurer: ${over.chain} overweight by ${(over.driftPct * 100).toFixed(1)}%, ${under.chain} underweight by ${(Math.abs(under.driftPct) * 100).toFixed(1)}%`,
      _gasBudget: gasBudget,
      priority: 'low',
      confidence: 0.95
    }

    this.notifier?.info('treasurer_propose',
      `Proposing rebalance: $${moveUsd.toFixed(2)} USDC ${over.chain} → ${under.chain}`,
      action)
    return action
  }

  _fetchBalances () {
    // Real per-chain ERC-20 reads via GasManager.stableBalances() — populated
    // by refreshBalances() each cycle. Fallback to in-memory snapshot if the
    // refresh hasn't run yet.
    if (this._balances && Object.keys(this._balances).length) return this._balances
    const out = {}
    const gas = this.agent._lastGasSnapshot || {}
    for (const chain of Object.keys(gas)) {
      out[chain] = {
        USDC: chain === this._primaryChain()
          ? (this.agent.balances?.USDC || 0)
          : (this.agent.lucidBalances?.[chain]?.USDC || 0)
      }
    }
    return out
  }

  _primaryChain () {
    // Detect from the wallet's connected RPC
    return this.agent.chainContext?.keyForChainId(this.agent.wallet?.signer?.provider?._network?.chainId) || 'arbitrum'
  }

  describe () {
    if (!this.enabled()) return '(no treasury config — set ~/.kard/treasury.yml)'
    const c = this.config
    const lines = ['Treasury policy:']
    for (const [chain, t] of Object.entries(c.target || {})) {
      lines.push(`  ${chain.padEnd(12)} target USDC ${(t.USDC * 100).toFixed(0)}%`)
    }
    lines.push(`  threshold: ${(c.threshold || 0.10) * 100}% drift`)
    lines.push(`  gas budget: $${c.gas_budget_per_rebalance ?? 5}`)
    return lines.join('\n')
  }
}

/** Tiny YAML parser — handles our specific shape (no anchors, no multiline) */
function parseSimpleYaml (src) {
  const out = {}
  const lines = src.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#'))
  let stack = [{ indent: -1, obj: out }]
  for (const line of lines) {
    const indent = line.match(/^\s*/)[0].length
    const t = line.trim()
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop()
    const top = stack[stack.length - 1]
    const kv = t.match(/^([^:]+):\s*(.*)$/)
    if (!kv) continue
    const key = kv[1].trim()
    let val = kv[2]
    if (val === '') {
      const child = {}
      top.obj[key] = child
      stack.push({ indent, obj: child })
    } else if (val.startsWith('{')) {
      // inline map: { USDC: 0.3 }
      const inner = val.slice(1, -1).split(',').reduce((a, p) => {
        const [k, v] = p.split(':').map(s => s.trim())
        a[k] = coerce(v); return a
      }, {})
      top.obj[key] = inner
    } else {
      top.obj[key] = coerce(val)
    }
  }
  return out
}
function coerce (v) {
  if (v === 'true') return true; if (v === 'false') return false
  if (/^-?\d+$/.test(v)) return parseInt(v); if (/^-?\d*\.\d+$/.test(v)) return parseFloat(v)
  return v.replace(/^['"]|['"]$/g, '')
}
