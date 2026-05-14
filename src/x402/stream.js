// @kard/agent — x402 Payment Streams
//
// Programmable recurring/streamed payments on top of the x402 client.
//
// Examples:
//   "pay this agent 10% of revenue every 1 second, capped at $1000/day"
//   "pay $0.0001 per call, hard cap $50 per session"
//   "pay 0.5% of every settled trade as a referral fee"
//
// A stream is a declarative spec evaluated on a tick. Each tick:
//   1. compute the *current* tranche size from the formula (% of revenue, fixed, etc.)
//   2. enforce caps (per-tick, per-day, total session)
//   3. submit one x402 payment for that tranche
//   4. log + emit `tick` event with tx info
//
// Streams persist to ~/.kard/streams.json so they survive restarts.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { EventEmitter } from 'node:events'

const STREAMS_FILE = path.join(os.homedir(), '.kard', 'streams.json')

export class PaymentStream extends EventEmitter {
  /**
   * @param {object} cfg
   * @param {string} cfg.id
   * @param {string} cfg.recipient — payee address (or x402 service URL)
   * @param {string} cfg.token     — token symbol (USDT0, USDC, …)
   * @param {object} cfg.formula
   *   { kind:'fixed',    amount: 0.001 }
   *   { kind:'percent',  basis:'revenue'|'pnl'|'portfolio', pct: 0.10 }
   *   { kind:'callback', fn: (ctx)=>amount }   // SDK only
   * @param {object} [cfg.caps]
   *   { perTick?: number, perDay?: number, total?: number }
   * @param {number} cfg.intervalMs — tick frequency
   * @param {object} cfg.client     — x402 client instance (createX402Client)
   * @param {object} cfg.context    — provider for revenue/pnl/portfolio metrics
   *                                  must expose { getRevenue(), getPnl(), getPortfolioUSD() }
   */
  constructor (cfg) {
    super()
    this.id = cfg.id || `stream_${Date.now()}`
    this.recipient = cfg.recipient
    this.token = cfg.token || 'USDT0'
    this.formula = cfg.formula
    this.caps = cfg.caps || {}
    this.intervalMs = Math.max(250, cfg.intervalMs || 1000) // floor 250ms
    this.client = cfg.client
    this.context = cfg.context || {}

    this.startedAt = null
    this.totalPaid = 0
    this.dayKey = this._dayKey()
    this.dayPaid = 0
    this.tickCount = 0
    this.lastTickAt = null
    this.lastError = null
    this._timer = null
  }

  start () {
    if (this._timer) return
    this.startedAt = this.startedAt || Date.now()
    this._timer = setInterval(() => this._tick().catch(e => this._onError(e)), this.intervalMs)
    this.emit('started', { at: new Date().toISOString() })
  }

  stop () {
    if (this._timer) clearInterval(this._timer)
    this._timer = null
    this.emit('stopped', { totalPaid: this.totalPaid, ticks: this.tickCount })
  }

  async _tick () {
    // Day rollover
    const day = this._dayKey()
    if (day !== this.dayKey) { this.dayKey = day; this.dayPaid = 0 }

    // Total cap reached → stop
    if (this.caps.total != null && this.totalPaid >= this.caps.total) {
      this.stop(); this.emit('cap_reached', { which: 'total', value: this.caps.total }); return
    }

    // Compute tranche
    let amount = await this._computeAmount()
    if (!amount || amount <= 0) {
      this.tickCount++; this.emit('tick', { skipped: true, amount: 0 }); return
    }

    // Apply caps
    if (this.caps.perTick != null) amount = Math.min(amount, this.caps.perTick)
    if (this.caps.perDay  != null) amount = Math.min(amount, Math.max(0, this.caps.perDay - this.dayPaid))
    if (this.caps.total   != null) amount = Math.min(amount, Math.max(0, this.caps.total  - this.totalPaid))
    if (amount <= 0) {
      this.emit('cap_reached', { which: 'day-or-total' }); return
    }

    // Submit payment
    let result
    try {
      // Two transport modes:
      //   - x402 service URL → POST with x402 headers (handled by client.fetch)
      //   - raw recipient address → direct token transfer
      if (/^https?:\/\//.test(this.recipient)) {
        result = await this.client.fetch(this.recipient, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ stream: this.id, tick: this.tickCount, amount })
        })
        result = { ok: true, status: result.status }
      } else {
        result = await this.client.pay({ to: this.recipient, amount, token: this.token })
      }
    } catch (e) {
      this._onError(e); return
    }

    this.totalPaid += amount
    this.dayPaid   += amount
    this.tickCount++
    this.lastTickAt = new Date().toISOString()
    this.emit('tick', { amount, totalPaid: this.totalPaid, dayPaid: this.dayPaid, result })
  }

  async _computeAmount () {
    const f = this.formula
    if (!f) return 0
    if (f.kind === 'fixed') return f.amount
    if (f.kind === 'callback') return await f.fn({
      stream: this, totalPaid: this.totalPaid, ticks: this.tickCount
    })
    if (f.kind === 'percent') {
      let basis = 0
      switch (f.basis) {
        case 'revenue':    basis = await (this.context.getRevenue?.() ?? 0); break
        case 'pnl':        basis = await (this.context.getPnl?.() ?? 0); break
        case 'portfolio':  basis = await (this.context.getPortfolioUSD?.() ?? 0); break
        case 'delta':      basis = await (this.context.getDeltaSinceLastTick?.() ?? 0); break
        default: basis = 0
      }
      return Math.max(0, basis * f.pct)
    }
    return 0
  }

  _onError (e) {
    this.lastError = { ts: new Date().toISOString(), message: e.message }
    this.emit('error', e)
  }

  _dayKey () { return new Date().toISOString().slice(0, 10) }

  toJSON () {
    return {
      id: this.id, recipient: this.recipient, token: this.token,
      formula: this.formula, caps: this.caps, intervalMs: this.intervalMs,
      startedAt: this.startedAt && new Date(this.startedAt).toISOString(),
      totalPaid: this.totalPaid, dayPaid: this.dayPaid, tickCount: this.tickCount,
      lastTickAt: this.lastTickAt, lastError: this.lastError
    }
  }
}

/** Manager: schedules many streams, persists their specs, auto-rearms on restart */
export class StreamManager {
  constructor ({ client, context, autoRestore = true } = {}) {
    this.client = client
    this.context = context
    this.streams = new Map()
    this._load()
    if (autoRestore && this._restored?.length) {
      // Rebuild PaymentStream instances from persisted specs and start them.
      // Skips streams whose context callbacks were lost (callback formula).
      for (const spec of this._restored) {
        if (spec.formula?.kind === 'callback') continue
        try {
          const s = new PaymentStream({ ...spec, client: this.client, context: this.context })
          // Carry persisted accounting forward so caps stay accurate.
          s.totalPaid = spec.totalPaid || 0
          s.dayPaid   = spec.dayPaid   || 0
          s.tickCount = spec.tickCount || 0
          this.streams.set(s.id, s)
          s.on('tick', () => this._save())
          s.on('stopped', () => this._save())
          s.start()
        } catch (e) {
          console.error(`[stream] restore failed for ${spec.id}: ${e.message}`)
        }
      }
    }
  }

  add (spec) {
    const s = new PaymentStream({ ...spec, client: this.client, context: this.context })
    this.streams.set(s.id, s)
    s.on('tick', () => this._save())
    s.on('stopped', () => this._save())
    s.start()
    this._save()
    return s
  }

  remove (id) {
    const s = this.streams.get(id)
    if (s) s.stop()
    this.streams.delete(id)
    this._save()
  }

  list () { return [...this.streams.values()].map(s => s.toJSON()) }

  _save () {
    try {
      const dir = path.dirname(STREAMS_FILE)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(STREAMS_FILE, JSON.stringify({
        streams: this.list()
      }, null, 2))
    } catch (e) {
      console.error('[stream] save failed:', e.message)
    }
  }

  _load () {
    try {
      if (fs.existsSync(STREAMS_FILE)) {
        const data = JSON.parse(fs.readFileSync(STREAMS_FILE, 'utf8'))
        // Note: only metadata is restored; the active timers must be re-armed
        // by whoever manages lifecycle, since the x402 client + context are
        // injected at construction time.
        this._restored = data.streams || []
      }
    } catch { /* nothing to restore */ }
  }
}
