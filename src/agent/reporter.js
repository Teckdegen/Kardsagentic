// @kard/agent — Periodic Reporter
//
// Generates and dispatches periodic agent reports at any interval.
//
//   - "every 3 seconds"  → fast HUD-style status
//   - "every 5 minutes"  → portfolio + opportunities + open positions
//   - "every hour"       → full earnings + reasoning recap
//
// Sinks: console, file, chat (Telegram/Discord/Slack), webhook URL.
// Multiple sinks can be active at once.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const DEFAULT_LOG = path.join(os.homedir(), '.kard', 'reports.ndjson')

export class Reporter {
  /**
   * @param {object} cfg
   * @param {import('./treasury.js').TreasuryAgent} cfg.agent
   * @param {string|number} cfg.interval — '3s' | '5m' | '1h' | ms number
   * @param {'fast'|'normal'|'full'} [cfg.mode='normal']
   * @param {object} [cfg.sinks] — { console: true, file: '~/...ndjson', chat: { adapter, channelId }, webhook: 'https://...' }
   */
  constructor (cfg) {
    this.agent = cfg.agent
    this.intervalMs = parseInterval(cfg.interval) ?? 60_000
    this.mode = cfg.mode || 'normal'
    this.sinks = cfg.sinks || { console: true }
    this._timer = null
    this._tick = 0
  }

  start () {
    if (this._timer) return
    this._timer = setInterval(() => this.report().catch(e => console.error('[report]', e.message)), this.intervalMs)
    // Immediate first report so the user sees something right away
    this.report().catch(() => {})
  }

  stop () {
    if (this._timer) { clearInterval(this._timer); this._timer = null }
  }

  /** Build + dispatch one report */
  async report () {
    this._tick++
    const snap = this.agent.getSnapshot()
    const earnings = this.agent.bookkeeper?.earnings(snap.portfolio?.totalUSD) || null
    const payload = {
      ts: new Date().toISOString(),
      tick: this._tick,
      mode: this.mode,
      ...this._build(snap, earnings)
    }
    await this._dispatch(payload)
    return payload
  }

  _build (snap, earnings) {
    if (this.mode === 'fast') {
      return {
        equity: snap.portfolio?.totalUSD,
        cycle: snap.cycle,
        active: snap.active,
        pnl24h: earnings?.pnl24h,
        openPositions: earnings?.openPositions?.perps?.length || 0,
        topOpp: snap.opportunities?.opportunities?.[0]?.apy
      }
    }
    if (this.mode === 'normal') {
      return {
        strategy: snap.strategy?.name,
        equity: snap.portfolio?.totalUSD,
        cycle: snap.cycle,
        pnl24h: earnings?.pnl24h,
        pnl7d: earnings?.pnl7d,
        realizedTotal: earnings?.realizedPnl,
        openPerps: earnings?.openPositions?.perps,
        topOpportunities: snap.opportunities?.opportunities?.slice(0, 3),
        risk: snap.risk?.kill ? 'KILLED' : `dd=${(snap.risk?.drawdown || 0 * 100).toFixed(2)}%`,
        attestations: snap.attestations?.recent?.length || 0
      }
    }
    // 'full'
    return {
      strategy: snap.strategy?.name,
      equity: snap.portfolio?.totalUSD,
      earnings,
      reasoningTrail: snap.reasoningTrail?.slice(-5),
      opportunities: snap.opportunities?.opportunities?.slice(0, 8),
      perps: snap.perps,
      lucid: snap.lucid?.yieldStates,
      passport: snap.passport,
      risk: snap.risk,
      reconcile: snap.reconcile,
      gas: snap.gasSnapshot
    }
  }

  async _dispatch (payload) {
    const text = this._format(payload)
    if (this.sinks.console) console.log(text)
    if (this.sinks.file) {
      const f = this.sinks.file === true ? DEFAULT_LOG : this.sinks.file
      try {
        fs.mkdirSync(path.dirname(f), { recursive: true })
        fs.appendFileSync(f, JSON.stringify(payload) + '\n')
      } catch {}
    }
    if (this.sinks.chat?.adapter && this.sinks.chat?.channelId) {
      try { await this.sinks.chat.adapter.send(this.sinks.chat.channelId, text) } catch {}
    }
    if (this.sinks.webhook) {
      try {
        await fetch(this.sinks.webhook, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } catch {}
    }
  }

  _format (p) {
    if (p.mode === 'fast') {
      const arrow = (p.pnl24h ?? 0) >= 0 ? '↑' : '↓'
      return `[${p.ts.slice(11, 19)}] eq=$${(p.equity || 0).toFixed(2)} cy#${p.cycle} ${arrow}24h=$${(p.pnl24h || 0).toFixed(2)} pos=${p.openPositions} top=${((p.topOpp || 0) * 100).toFixed(1)}%`
    }
    if (p.mode === 'normal') {
      const lines = [
        `*Kard report* (cycle #${p.cycle})`,
        `Strategy: ${p.strategy || 'none'} · Equity: $${(p.equity || 0).toFixed(2)}`,
        `PnL: 24h $${(p.pnl24h || 0).toFixed(2)} · 7d $${(p.pnl7d || 0).toFixed(2)} · total $${(p.realizedTotal || 0).toFixed(2)}`,
        `Risk: ${p.risk}`,
        `Open perps: ${(p.openPerps || []).map(x => `${x.symbol} ${x.side} ${x.size}@${x.entryPx?.toFixed(2)}`).join(', ') || 'none'}`,
        `Top opportunities:`,
        ...(p.topOpportunities || []).map(o => `  • ${(o.apy * 100).toFixed(2)}% ${o.source} ${o.chain} ${o.asset || ''}`),
        `Attestations: ${p.attestations}`
      ]
      return lines.join('\n')
    }
    return JSON.stringify(p, null, 2)
  }
}

function parseInterval (s) {
  if (s == null) return null
  if (typeof s === 'number') return s
  const m = String(s).match(/^(\d+)(ms|s|m|h)$/)
  if (!m) return null
  return parseInt(m[1]) * { ms: 1, s: 1000, m: 60_000, h: 3_600_000 }[m[2]]
}
