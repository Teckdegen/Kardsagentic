// @kard/agent — Kard-side stop watcher (fallback)
//
// Used when venue-side trigger orders fail to register (verification flagged
// `ok: false`). Polls the venue's mid price and emits a `perps_close` action
// when the price crosses the stop or take-profit level.
//
// Polling interval is fast (1s) because we're holding price-level promises
// the venue couldn't.

export class StopWatcher {
  /**
   * @param {object} cfg
   * @param {import('./treasury.js').TreasuryAgent} cfg.agent
   */
  constructor (cfg) {
    this.agent = cfg.agent
    this.notifier = cfg.notifier
    this.watches = []  // [{ symbol, side, stopPx, tpPx, size, entryPx }]
    this.intervalMs = cfg.intervalMs ?? 1000
    this._timer = null
  }

  watch (params) {
    this.watches.push({ ...params, addedAt: Date.now() })
    if (!this._timer) this.start()
  }

  unwatch (symbol) { this.watches = this.watches.filter(w => w.symbol !== symbol) }

  start () { if (!this._timer) this._timer = setInterval(() => this._tick().catch(() => {}), this.intervalMs) }
  stop () { if (this._timer) { clearInterval(this._timer); this._timer = null } }

  async _tick () {
    if (!this.watches.length) { this.stop(); return }
    if (!this.agent.perps) return
    const mids = await this.agent.perps.getMids().catch(() => null)
    if (!mids) return
    const remaining = []
    for (const w of this.watches) {
      const px = mids[w.symbol]
      if (!px) { remaining.push(w); continue }
      const stopHit = w.side === 'long' ? (w.stopPx && px <= w.stopPx) : (w.stopPx && px >= w.stopPx)
      const tpHit   = w.side === 'long' ? (w.tpPx && px >= w.tpPx)     : (w.tpPx && px <= w.tpPx)
      if (stopHit || tpHit) {
        try {
          await this.agent.perps.closePosition(w.symbol, w.size)
          const dir = w.side === 'long' ? 1 : -1
          const pnl = (px - w.entryPx) * w.size * dir
          if (stopHit) this.notifier?.positionStopped({ symbol: w.symbol, side: w.side, entryPx: w.entryPx, stopPx: px, pnl })
          else this.notifier?.positionTakeProfit({ symbol: w.symbol, side: w.side, entryPx: w.entryPx, tpPx: px, pnl })
        } catch (e) {
          this.agent.log('stop_watch', `close failed for ${w.symbol}: ${e.message}`)
          remaining.push(w)
        }
      } else {
        remaining.push(w)
      }
    }
    this.watches = remaining
  }
}
