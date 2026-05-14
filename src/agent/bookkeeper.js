// @kard/agent — Bookkeeper
//
// Tracks every executed action and computes realized/unrealized P&L.
// Persists to ~/.kard/ledger.ndjson so earnings survive restarts.
//
// Records:
//   - perps_open  → opens a "lot" with entryPx + size + side
//   - perps_close → closes lot(s) FIFO, emits realized PnL
//   - lending_supply / lucid_mint → opens a yield position with cost-basis
//   - lending_withdraw / lucid_burn → closes yield position, computes APY earned
//   - swap → records cost basis change for the new asset
//   - bridge → just a transfer; cost basis carries
//   - skill / passport.pay → tracks payments out as expense
//
// Anyone can ask the agent:
//   "total earnings since I started"
//   "what's my realized PnL on BTC perps?"
//   "show me every Lucid mint and what it earned"
//   …and the bookkeeper has the answer.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const LEDGER_FILE = path.join(os.homedir(), '.kard', 'ledger.ndjson')

export class Bookkeeper {
  constructor (cfg = {}) {
    this.path = cfg.path || LEDGER_FILE
    this.lots = new Map()       // symbol → [{ side, size, entryPx, ts, action }]
    this.yieldLots = new Map()  // key → { asset, amount, openTs, openPx, basisUSD, source }
    this.realized = []          // [{ symbol, pnl, holdMs, ts, source }]
    this.expenses = []          // [{ kind, amount, ts, recipient }]
    this.startedAt = null
    this.startEquity = null
    this._ensure()
    this._replay()
  }

  _ensure () {
    const dir = path.dirname(this.path)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }

  /** Replay the ledger to rebuild in-memory lot state on boot */
  _replay () {
    if (!fs.existsSync(this.path)) return
    const lines = fs.readFileSync(this.path, 'utf8').trim().split('\n')
    for (const l of lines) {
      try { this._applyEntry(JSON.parse(l), { skipPersist: true }) } catch {}
    }
  }

  /** Mark agent start with current equity — used as baseline for total P&L */
  markStart (equityUSD) {
    if (this.startedAt) return
    this.startedAt = new Date().toISOString()
    this.startEquity = equityUSD
    this._append({ kind: 'start', ts: this.startedAt, equityUSD })
  }

  /**
   * Record an executed action's economic effect.
   * Called from treasury.execute() success path with action + result + prices.
   */
  record (action, result, ctx = {}) {
    const px = ctx.priceFor?.(action.symbol || action.token || action.asset) || 0
    const ts = new Date().toISOString()
    let entry = null

    switch (action.type) {
      case 'perps_open': {
        const lots = this.lots.get(action.symbol) || []
        lots.push({
          side: action.side, size: action.size,
          entryPx: action.limitPx || px, leverage: action.leverage || 1,
          openedTs: ts, tx: result.tx
        })
        this.lots.set(action.symbol, lots)
        entry = {
          kind: 'perp_open', ts, symbol: action.symbol, side: action.side,
          size: action.size, entryPx: action.limitPx || px, tx: result.tx
        }
        break
      }
      case 'perps_close': {
        const lots = this.lots.get(action.symbol) || []
        if (!lots.length) break
        const closeSize = action.size || lots.reduce((a, l) => a + l.size, 0)
        const closePx = action.limitPx || px
        let remaining = closeSize, totalPnl = 0, opened = []
        // FIFO close
        while (remaining > 0 && lots.length) {
          const lot = lots[0]
          const take = Math.min(remaining, lot.size)
          const dir = lot.side === 'long' ? 1 : -1
          const pnl = (closePx - lot.entryPx) * take * dir
          totalPnl += pnl
          opened.push({ entryPx: lot.entryPx, size: take, holdMs: Date.parse(ts) - Date.parse(lot.openedTs) })
          lot.size -= take
          remaining -= take
          if (lot.size <= 1e-9) lots.shift()
        }
        if (lots.length === 0) this.lots.delete(action.symbol)
        else this.lots.set(action.symbol, lots)
        const r = { symbol: action.symbol, pnl: totalPnl, holdMs: opened[0]?.holdMs || 0, ts, source: 'perps' }
        this.realized.push(r)
        entry = { kind: 'perp_close', ts, symbol: action.symbol, closePx, size: closeSize, pnl: totalPnl, opened }
        break
      }
      case 'lending_supply':
      case 'lucid_mint': {
        const key = `${action.type}:${action.token || action.asset}:${result.tx}`
        const basisUSD = (action.amount || 0) * (px || 1)
        this.yieldLots.set(key, {
          asset: action.token || action.asset, amount: action.amount,
          openTs: ts, openPx: px || 1, basisUSD,
          source: action.type, tx: result.tx
        })
        entry = { kind: 'yield_open', ts, key, asset: action.token || action.asset, amount: action.amount, basisUSD }
        break
      }
      case 'lending_withdraw':
      case 'lucid_burn': {
        // Find oldest matching yield lot
        const sym = action.token || action.asset
        const matching = [...this.yieldLots.entries()]
          .filter(([k, l]) => l.asset === sym)
          .sort((a, b) => Date.parse(a[1].openTs) - Date.parse(b[1].openTs))
        let remaining = action.amount, totalEarned = 0
        for (const [k, lot] of matching) {
          if (remaining <= 0) break
          const take = Math.min(remaining, lot.amount)
          const heldMs = Date.parse(ts) - Date.parse(lot.openTs)
          // Earnings inferred from amount-out vs basis (approx — caller may override via ctx.amountOut)
          const earned = ((ctx.amountOut || take) - take) * (px || 1)
          totalEarned += earned
          remaining -= take
          lot.amount -= take
          if (lot.amount <= 1e-9) this.yieldLots.delete(k)
        }
        const r = { symbol: sym, pnl: totalEarned, holdMs: 0, ts, source: 'yield' }
        this.realized.push(r)
        entry = { kind: 'yield_close', ts, asset: sym, amount: action.amount, earned: totalEarned }
        break
      }
      case 'swap': {
        entry = {
          kind: 'swap', ts,
          tokenIn: action.tokenIn, tokenOut: action.tokenOut,
          amount: action.amount, tx: result.tx,
          gasUsed: result.gasUsed
        }
        break
      }
      case 'bridge':
      case 'lucid_mint':
      case 'lucid_burn': {
        entry = { kind: 'bridge', ts, action: action.type, tx: result.tx }
        break
      }
      case 'skill': {
        // Skills can be expense-incurring (e.g. Passport pay via skill)
        if (action.name?.includes('pay') || action.name?.includes('passport')) {
          this.expenses.push({ kind: 'skill', amount: action.params?.amount || 0, ts, recipient: action.params?.recipient })
        }
        entry = { kind: 'skill', ts, name: action.name, tool: action.tool }
        break
      }
    }

    if (entry) this._append(entry)
    return entry
  }

  /** Record an x402 stream tick or one-off payment as expense */
  recordPayment ({ amount, recipient, source = 'x402' }) {
    const entry = { kind: 'expense', source, amount, recipient, ts: new Date().toISOString() }
    this.expenses.push({ ...entry })
    this._append(entry)
  }

  /** Record incoming payment (when an x402 service receives) */
  recordRevenue ({ amount, payer, source = 'x402' }) {
    const entry = { kind: 'revenue', source, amount, payer, ts: new Date().toISOString() }
    this.realized.push({ symbol: 'USD', pnl: amount, holdMs: 0, ts: entry.ts, source })
    this._append(entry)
  }

  // ─────────── Queries ───────────

  /** Total realized PnL since agent start (USD) */
  totalRealizedPnl () {
    return this.realized.reduce((a, r) => a + (r.pnl || 0), 0)
  }

  /** Total expenses (payments out) */
  totalExpenses () {
    return this.expenses.reduce((a, e) => a + (e.amount || 0), 0)
  }

  /** Per-symbol realized P&L */
  pnlBySymbol () {
    const out = {}
    for (const r of this.realized) out[r.symbol] = (out[r.symbol] || 0) + r.pnl
    return out
  }

  /** Per-source breakdown (perps / yield / x402 / …) */
  pnlBySource () {
    const out = {}
    for (const r of this.realized) out[r.source] = (out[r.source] || 0) + r.pnl
    return out
  }

  /** Realized P&L since some duration string (24h, 7d, 30d) */
  pnlSince (durationStr) {
    const ms = parseDuration(durationStr)
    if (!ms) return null
    const cutoff = Date.now() - ms
    return this.realized
      .filter(r => Date.parse(r.ts) >= cutoff)
      .reduce((a, r) => a + r.pnl, 0)
  }

  /** Open positions snapshot */
  openPositions () {
    const perps = []
    for (const [sym, lots] of this.lots) {
      for (const lot of lots) perps.push({ symbol: sym, ...lot })
    }
    const yields = [...this.yieldLots.values()]
    return { perps, yields }
  }

  /** Total earnings summary the agent and chat-bot can speak */
  earnings (currentEquity) {
    const realized = this.totalRealizedPnl()
    const expenses = this.totalExpenses()
    const equityDelta = (this.startEquity != null && currentEquity != null)
      ? currentEquity - this.startEquity : null
    const days = this.startedAt
      ? Math.max(1, (Date.now() - Date.parse(this.startedAt)) / 86400_000) : 1
    return {
      since: this.startedAt,
      startEquity: this.startEquity,
      currentEquity,
      equityDelta,
      realizedPnl: realized,
      expenses,
      net: realized - expenses,
      pnlBySymbol: this.pnlBySymbol(),
      pnlBySource: this.pnlBySource(),
      pnl24h: this.pnlSince('24h'),
      pnl7d: this.pnlSince('7d'),
      pnl30d: this.pnlSince('30d'),
      annualisedReturn: this.startEquity > 0
        ? ((realized - expenses) / this.startEquity) * (365 / days)
        : null,
      tradeCount: this.realized.length,
      openPositions: this.openPositions()
    }
  }

  /** Recent N entries from the ledger */
  recent (n = 50) {
    if (!fs.existsSync(this.path)) return []
    const lines = fs.readFileSync(this.path, 'utf8').trim().split('\n').slice(-n)
    return lines.map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  }

  // ─────────── internals ───────────

  _append (entry) {
    try { fs.appendFileSync(this.path, JSON.stringify(entry) + '\n') } catch {}
  }

  _applyEntry (e, opts = {}) {
    // Replay rebuilds in-memory state; never re-persist
    switch (e.kind) {
      case 'start':
        this.startedAt = e.ts; this.startEquity = e.equityUSD
        break
      case 'perp_open': {
        const lots = this.lots.get(e.symbol) || []
        lots.push({ side: e.side, size: e.size, entryPx: e.entryPx, openedTs: e.ts })
        this.lots.set(e.symbol, lots)
        break
      }
      case 'perp_close':
        this.realized.push({ symbol: e.symbol, pnl: e.pnl, holdMs: e.opened?.[0]?.holdMs || 0, ts: e.ts, source: 'perps' })
        // Remove closed size FIFO
        const lots = this.lots.get(e.symbol) || []
        let r = e.size
        while (r > 0 && lots.length) {
          const lot = lots[0]
          const take = Math.min(r, lot.size); lot.size -= take; r -= take
          if (lot.size <= 1e-9) lots.shift()
        }
        if (lots.length === 0) this.lots.delete(e.symbol)
        else this.lots.set(e.symbol, lots)
        break
      case 'yield_open':
        this.yieldLots.set(e.key, { asset: e.asset, amount: e.amount, openTs: e.ts, basisUSD: e.basisUSD, source: e.kind })
        break
      case 'yield_close':
        this.realized.push({ symbol: e.asset, pnl: e.earned, holdMs: 0, ts: e.ts, source: 'yield' })
        break
      case 'expense':
        this.expenses.push(e)
        break
      case 'revenue':
        this.realized.push({ symbol: 'USD', pnl: e.amount, holdMs: 0, ts: e.ts, source: e.source })
        break
    }
  }
}

function parseDuration (s) {
  const m = String(s).match(/^(\d+)(d|h|m|s)$/)
  if (!m) return null
  return parseInt(m[1]) * { d: 86400_000, h: 3600_000, m: 60_000, s: 1000 }[m[2]]
}
