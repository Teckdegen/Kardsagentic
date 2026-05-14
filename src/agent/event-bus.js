// @kard/agent — Event Bus
//
// Replaces "poll every N seconds" with "fire when something happens."
// Sources connect over WebSocket and emit normalized events; subscribers
// (the agent's cycle, alerting, learner) react.
//
// Wired sources:
//   - Hyperliquid WS         fills, liquidations, funding ticks
//   - Kite Passport hooks    session approved/expired/spent
//   - Aave rate updates      via on-chain ReserveDataUpdated subscription
//
// Adding a source: extend BaseSource and call `bus.add(source)`.

import { EventEmitter } from 'node:events'

export class EventBus extends EventEmitter {
  constructor () {
    super()
    this.sources = []
  }

  add (source) {
    source.on('event', (e) => this.emit('event', e))
    source.on('event', (e) => this.emit(`event:${e.type}`, e))
    this.sources.push(source)
    source.start?.()
    return source
  }

  stop () { for (const s of this.sources) s.stop?.() }

  state () {
    return this.sources.map(s => ({
      name: s.name, connected: s.connected, lastEventAt: s.lastEventAt
    }))
  }
}

class BaseSource extends EventEmitter {
  constructor (name) { super(); this.name = name; this.connected = false; this.lastEventAt = null }
  _emit (type, data) {
    this.lastEventAt = new Date().toISOString()
    this.emit('event', { source: this.name, type, ts: this.lastEventAt, data })
  }
}

/** Hyperliquid WebSocket — fills, funding, liquidations */
export class HyperliquidWsSource extends BaseSource {
  constructor (cfg = {}) {
    super('hyperliquid')
    this.url = cfg.url || (cfg.testnet ? 'wss://api.hyperliquid-testnet.xyz/ws' : 'wss://api.hyperliquid.xyz/ws')
    this.user = cfg.user || null
    this._ws = null
  }
  start () {
    if (this._ws) return
    const ws = new WebSocket(this.url)
    this._ws = ws
    ws.onopen = () => {
      this.connected = true
      // Subscribe to global events
      ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'allMids' } }))
      if (this.user) {
        ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'userFills', user: this.user } }))
        ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'userEvents', user: this.user } }))
      }
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.channel === 'allMids') this._emit('mids', msg.data)
        else if (msg.channel === 'userFills') this._emit('fill', msg.data)
        else if (msg.channel === 'userEvents') {
          // Liquidations + funding ticks come through this channel
          if (msg.data?.liquidation) this._emit('liquidation', msg.data.liquidation)
          else if (msg.data?.funding) this._emit('funding', msg.data.funding)
          else this._emit('user_event', msg.data)
        }
      } catch (e) {
        this._emit('error', { message: e.message })
      }
    }
    ws.onclose = () => { this.connected = false; setTimeout(() => this.start(), 3000) }
    ws.onerror = (e) => this._emit('error', { message: e.message })
  }
  stop () { this._ws?.close(); this._ws = null }
}

/**
 * On-chain log source — subscribes to provider.on(filter, handler).
 * Use for Aave reserve updates, Lucid mints/burns, KardAttestor events.
 */
export class OnChainSource extends BaseSource {
  constructor ({ name, provider, filters }) {
    super(name)
    this.provider = provider
    this.filters = filters // [{ filter, eventName }]
    this._listeners = []
  }
  start () {
    for (const { filter, eventName } of this.filters) {
      const handler = (log) => this._emit(eventName, log)
      this.provider.on(filter, handler)
      this._listeners.push({ filter, handler })
    }
    this.connected = true
  }
  stop () {
    for (const { filter, handler } of this._listeners) this.provider.off(filter, handler)
    this._listeners = []
    this.connected = false
  }
}

/**
 * Passport poller — Passport doesn't expose a streaming API yet, so we
 * poll `kpass user sessions` on a short interval and emit deltas.
 */
export class PassportPollSource extends BaseSource {
  constructor ({ passport, intervalMs = 30_000 }) {
    super('passport')
    this.passport = passport
    this.intervalMs = intervalMs
    this._timer = null
    this._lastSet = new Map()
  }
  start () {
    if (this._timer) return
    this.connected = true
    this._timer = setInterval(() => this._tick().catch(() => {}), this.intervalMs)
    this._tick().catch(() => {})
  }
  stop () { if (this._timer) clearInterval(this._timer); this.connected = false }
  async _tick () {
    const fresh = await this.passport.listSessions({ status: 'active' })
    const newSet = new Map(fresh.map(s => [s.id, s]))
    // detect changes
    for (const [id, s] of newSet) {
      const prev = this._lastSet.get(id)
      if (!prev) this._emit('session_active', s)
      else if (prev.spent !== s.spent) this._emit('session_spent', { ...s, delta: s.spent - prev.spent })
    }
    for (const [id, s] of this._lastSet) {
      if (!newSet.has(id)) this._emit('session_ended', s)
    }
    this._lastSet = newSet
  }
}
