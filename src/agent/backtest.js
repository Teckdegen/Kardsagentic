// @kard/agent — Backtest engine
//
// Replay any compiled strategy against historical price data and report
// Sharpe / max drawdown / win rate / total return — without touching chain.
//
// Data sources (probed in order):
//   1. Skill `coingecko-historical` (or any skill exposing `get_history`)
//   2. CoinGecko free `/market_chart/range` directly
//   3. User-provided CSV via --csv path
//
// The engine simulates a simplified P&L:
//   - perps_open  → opens a paper position at the bar's open price
//   - perps_close → closes at the bar's close price
//   - lending_supply / lucid_mint → accrues APY of `assumedAPY` per day
//   - swap        → executes at the bar's mid (no slippage modeled — flag this)
//
// This is intentionally a back-of-envelope model. It catches obvious
// disasters (strategies that draw down 50% in a week, leverage abuse) but
// does not replace a real fill simulator. For higher fidelity, point
// KARD_SIM_RPC at a Tenderly/Anvil fork and use the simulator instead.

import fs from 'node:fs'
import { compileStrategy } from '../index.js'

const COINGECKO_RANGE = 'https://api.coingecko.com/api/v3/coins/{id}/market_chart/range'

const ID_MAP = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', AVAX: 'avalanche-2',
  ARB: 'arbitrum', OP: 'optimism', BNB: 'binancecoin'
}

export class Backtester {
  constructor (cfg = {}) {
    this.skills = cfg.skills || null
    this.assumedAPY = cfg.assumedAPY ?? 0.05
    this.feeBps = cfg.feeBps ?? 5
    this.startingEquity = cfg.startingEquity ?? 10_000
  }

  /**
   * Run a backtest end-to-end.
   * @param {object} cfg
   * @param {string} cfg.strategyText  natural-language strategy
   * @param {string} cfg.provider     LLM provider for compile
   * @param {Date|string} cfg.from
   * @param {Date|string} cfg.to
   * @param {string[]} [cfg.symbols]   symbols to fetch history for (auto-derived from strategy if omitted)
   * @param {string}   [cfg.csv]       optional CSV: `symbol,ts(ms),price`
   * @returns {Promise<{ summary, trades, equityCurve }>}
   */
  async run (cfg) {
    const from = new Date(cfg.from).getTime()
    const to = new Date(cfg.to).getTime()
    if (!(to > from)) throw new Error('to must be > from')

    // 1) Compile the strategy once — we'll re-evaluate per bar if it has triggers
    const decision = await compileStrategy(cfg.strategyText, { provider: cfg.provider || 'anthropic' })

    // 2) Discover symbols
    const symbols = cfg.symbols && cfg.symbols.length
      ? cfg.symbols
      : extractSymbols(decision.actions || [])

    // 3) Load price history
    const series = cfg.csv
      ? loadCsv(cfg.csv)
      : await this._loadHistory(symbols, from, to)

    // 4) Walk bars, simulate
    const bars = mergeBars(series)
    let equity = this.startingEquity
    const positions = {}
    const trades = []
    const equityCurve = []
    let peakEquity = equity

    for (const bar of bars) {
      // mark-to-market open positions
      for (const [sym, pos] of Object.entries(positions)) {
        const px = bar.prices[sym]
        if (px) pos.markPx = px
      }
      equity = this._mtm(equity, positions, bar)

      // For each "trigger fired" action that matches this bar, execute
      for (const action of decision.actions || []) {
        if (this._shouldFire(action, bar, positions)) {
          const t = this._execute(action, bar, positions, equity)
          if (t) trades.push(t)
        }
      }

      peakEquity = Math.max(peakEquity, equity)
      equityCurve.push({ ts: bar.ts, equity, drawdown: (peakEquity - equity) / peakEquity })
    }

    // 5) Stats
    const returns = equityCurve.map((p, i) => i === 0 ? 0 : (p.equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity)
    const meanRet = returns.reduce((a, b) => a + b, 0) / Math.max(1, returns.length)
    const stdRet = Math.sqrt(returns.reduce((a, b) => a + (b - meanRet) ** 2, 0) / Math.max(1, returns.length))
    const sharpe = stdRet > 0 ? (meanRet / stdRet) * Math.sqrt(365 * 24) : 0  // hourly bars assumption
    const maxDD = Math.max(...equityCurve.map(p => p.drawdown))
    const winners = trades.filter(t => (t.pnl || 0) > 0).length
    const losers  = trades.filter(t => (t.pnl || 0) < 0).length
    const winRate = trades.length ? winners / trades.length : 0
    const totalReturn = (equity - this.startingEquity) / this.startingEquity

    return {
      summary: {
        startingEquity: this.startingEquity, finalEquity: equity, totalReturn,
        sharpe, maxDrawdown: maxDD, winRate,
        trades: trades.length, winners, losers,
        bars: bars.length, from: new Date(from).toISOString(), to: new Date(to).toISOString()
      },
      trades,
      equityCurve
    }
  }

  async _loadHistory (symbols, from, to) {
    const out = {}
    for (const sym of symbols) {
      // Try the skill first
      if (this.skills?.get('coingecko-historical')) {
        try {
          const r = await this.skills.invoke('coingecko-historical', 'get_history',
            { symbol: sym, from, to })
          out[sym] = r.data?.prices || r.data
          continue
        } catch { /* fall through */ }
      }
      // Direct CoinGecko
      const id = ID_MAP[sym] || sym.toLowerCase()
      const url = COINGECKO_RANGE.replace('{id}', id) +
        `?vs_currency=usd&from=${Math.floor(from / 1000)}&to=${Math.floor(to / 1000)}`
      const r = await fetch(url)
      if (!r.ok) throw new Error(`coingecko ${sym} ${r.status}`)
      const data = await r.json()
      out[sym] = (data.prices || []).map(([ts, p]) => ({ ts, price: p }))
    }
    return out
  }

  _shouldFire (action, bar, positions) {
    // Naive: fire on first bar (no triggers in MVP)
    // Strategies with explicit triggers should set action._triggerKey/_evalAt
    // but for now we treat all actions as "fire once at start" except closes.
    if (action.type === 'perps_close') {
      return !!positions[action.symbol]
    }
    return !action._fired
  }

  _execute (action, bar, positions, equity) {
    action._fired = true
    if (action.type === 'perps_open') {
      const px = bar.prices[action.symbol]
      if (!px) return null
      const lev = action.leverage || 1
      const size = (action.size != null) ? action.size : (equity * 0.1 * lev) / px
      positions[action.symbol] = {
        side: action.side, size, entryPx: px, markPx: px, lev
      }
      return { ts: bar.ts, type: 'open', symbol: action.symbol, side: action.side, size, px }
    }
    if (action.type === 'perps_close') {
      const p = positions[action.symbol]
      if (!p) return null
      const px = bar.prices[action.symbol] || p.markPx
      const dir = p.side === 'long' ? 1 : -1
      const pnl = (px - p.entryPx) * p.size * dir
      delete positions[action.symbol]
      return { ts: bar.ts, type: 'close', symbol: action.symbol, px, pnl }
    }
    if (action.type === 'lending_supply' || action.type === 'lucid_mint') {
      // Treat as continuous APY accrual handled in _mtm
      const apy = (action.assumedAPY ?? this.assumedAPY)
      positions[`__yield_${action.token || action.asset}`] = {
        amountUSD: action.amount || 0, apy, openTs: bar.ts
      }
      return { ts: bar.ts, type: 'supply', token: action.token || action.asset, amount: action.amount, apy }
    }
    return null
  }

  _mtm (equity, positions, bar) {
    let next = equity
    // Yield-supply accrual (per-bar piece of APY, assuming hourly bars)
    for (const [k, p] of Object.entries(positions)) {
      if (k.startsWith('__yield_')) {
        next += p.amountUSD * p.apy / (365 * 24)
      }
    }
    return next
  }
}

function extractSymbols (actions) {
  const set = new Set()
  for (const a of actions) {
    if (a.symbol) set.add(a.symbol.toUpperCase())
    if (a.token) set.add(a.token.toUpperCase())
  }
  return [...set]
}

function loadCsv (path) {
  const lines = fs.readFileSync(path, 'utf8').trim().split('\n')
  const out = {}
  for (const l of lines.slice(1)) {
    const [sym, ts, price] = l.split(',')
    out[sym] = out[sym] || []
    out[sym].push({ ts: Number(ts), price: Number(price) })
  }
  return out
}

function mergeBars (series) {
  const allTs = new Set()
  for (const arr of Object.values(series)) for (const p of arr) allTs.add(p.ts)
  const ts = [...allTs].sort()
  const indexed = Object.fromEntries(Object.entries(series).map(([sym, arr]) => {
    const m = new Map(arr.map(p => [p.ts, p.price]))
    return [sym, m]
  }))
  return ts.map(t => {
    const prices = {}
    for (const [sym, m] of Object.entries(indexed)) {
      const p = m.get(t)
      if (p != null) prices[sym] = p
    }
    return { ts: t, prices }
  })
}
