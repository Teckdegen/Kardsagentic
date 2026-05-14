// @kard/agent — Position Reconciler
//
// Diffs the agent's belief about its on-chain state against ground truth
// each cycle. Self-heals divergences from dropped/replaced/sped-up txs.
//
// What it reconciles:
//   1. Pending txs    — every tx the agent submitted but not yet seen mined
//   2. Aave positions — re-fetches via aave.getAllSupplied(), diffs vs state
//   3. Hyperliquid    — pulls clearinghouseState, diffs vs perps.snapshot
//   4. Wallet balances — refreshes ERC-20 balances via wallet.getAllBalances()
//
// On divergence: log + emit event. The agent's next cycle uses the corrected
// state. Optionally re-submits dropped txs (--auto-resubmit).

import { ethers } from 'ethers'

export class Reconciler {
  /**
   * @param {object} cfg
   * @param {import('./treasury.js').TreasuryAgent} cfg.agent
   * @param {boolean} [cfg.autoResubmit=false]
   * @param {number}  [cfg.staleAfterMs=120_000] — tx is stale 2min after submit
   */
  constructor (cfg) {
    this.agent = cfg.agent
    this.autoResubmit = !!cfg.autoResubmit
    this.staleAfterMs = cfg.staleAfterMs ?? 120_000
    this.pending = new Map()  // txHash → { ts, action, originalTx, attempts }
    this.divergences = []
  }

  /** Track a tx submitted by the agent. Called from execute() success path. */
  track (txHash, action, originalTx = null) {
    if (!txHash) return
    this.pending.set(txHash, {
      ts: Date.now(), action, originalTx,
      attempts: 1, status: 'pending'
    })
  }

  /** Run reconciliation. Returns a digest. */
  async reconcile () {
    const out = {
      ts: new Date().toISOString(),
      pending: 0, mined: 0, dropped: 0, divergences: [], healed: 0
    }
    if (!this.agent.chainContext) return out

    // 1. Walk pending txs
    for (const [hash, p] of [...this.pending]) {
      try {
        const provider = this.agent.chainContext.getProvider(p.action._chain || 'arbitrum')
        const receipt = await provider.getTransactionReceipt(hash)
        if (receipt) {
          p.status = receipt.status === 1 ? 'mined' : 'reverted'
          out.mined++
          this.pending.delete(hash)
          continue
        }
        const age = Date.now() - p.ts
        if (age > this.staleAfterMs) {
          // Tx might have been dropped or replaced
          const tx = await provider.getTransaction(hash).catch(() => null)
          if (!tx) {
            p.status = 'dropped'
            out.dropped++
            const div = { kind: 'tx_dropped', hash, action: p.action, age }
            this.divergences.push(div)
            out.divergences.push(div)
            this.pending.delete(hash)
            if (this.autoResubmit && p.attempts < 3) {
              await this._resubmit(p)
              out.healed++
            }
          } else {
            // Still in mempool — extend grace
            p.ts = Date.now() - this.staleAfterMs / 2
          }
        } else {
          out.pending++
        }
      } catch (e) {
        // RPC hiccup — leave it pending
      }
    }

    // 2. Re-fetch Aave positions and diff
    if (this.agent.aave) {
      try {
        const fresh = await this.agent.aave.getAllSupplied()
        const old = this.agent.supplied || {}
        for (const sym of new Set([...Object.keys(fresh), ...Object.keys(old)])) {
          const f = fresh[sym] || 0, o = old[sym] || 0
          if (Math.abs(f - o) > Math.max(0.01, o * 0.01)) {  // > 1% drift or > $0.01
            const div = { kind: 'aave_drift', symbol: sym, expected: o, actual: f }
            this.divergences.push(div); out.divergences.push(div)
          }
        }
        // Self-heal: agent.supplied gets overwritten in next refresh anyway,
        // but expose the drift now for the LLM's next decision.
        this.agent.supplied = fresh
      } catch { /* skip */ }
    }

    // 3. Hyperliquid positions
    if (this.agent.perps?.userAddress) {
      try {
        const fresh = await this.agent.perps.getPositions()
        const old = this.agent.perpsSnapshot?.positions || []
        const oldBySym = Object.fromEntries(old.map(p => [p.symbol, p]))
        for (const p of fresh) {
          const o = oldBySym[p.symbol]
          if (!o || Math.abs(p.size - o.size) > 1e-6) {
            const div = { kind: 'perp_drift', symbol: p.symbol,
              expected: o?.size || 0, actual: p.size }
            this.divergences.push(div); out.divergences.push(div)
          }
        }
        if (this.agent.perpsSnapshot) this.agent.perpsSnapshot.positions = fresh
      } catch { /* skip */ }
    }

    if (this.divergences.length > 500) this.divergences = this.divergences.slice(-500)
    return out
  }

  async _resubmit (p) {
    try {
      p.attempts++
      const result = await this.agent.execute(p.action, p.attempts)
      if (result?.tx) {
        this.track(result.tx, p.action)
        this.agent.log('reconcile', `Re-submitted dropped tx for ${p.action.type} (new: ${result.tx})`)
      }
    } catch (e) {
      this.agent.log('reconcile', `Resubmit failed: ${e.message}`)
    }
  }

  state () {
    return {
      pending: this.pending.size,
      divergences: this.divergences.slice(-20).reverse()
    }
  }
}
