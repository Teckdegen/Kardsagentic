// @kard/agent — Risk Engine
//
// Sits between the LLM's proposal and execute(). Hard veto, not advisory.
// Either an action passes every check or it never reaches the chain.
//
// Enforces:
//   - max_per_market_pct       single-market exposure cap (% of equity)
//   - max_bucket_pct           correlated-bucket cap (e.g. all L1 betas → "majors")
//   - max_total_leverage       sum of all open notionals / equity
//   - max_daily_drawdown_pct   pause everything if equity drops > X% in 24h
//   - kill_switch              hard stop file flag (~/.kard/KILL); zero new actions
//   - per-action gas budget    reject if expected gas > N% of trade USD value
//
// Buckets (correlation groups) — assets that tend to move together count once
// against `max_bucket_pct`. Default groupings are conservative and tunable.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const KILL_FILE = path.join(os.homedir(), '.kard', 'KILL')
const USER_LIMITS_FILE = path.join(os.homedir(), '.kard', 'risk-limits.json')

const DEFAULT_BUCKETS = {
  stables:   ['USDC', 'USDT', 'USDC.e', 'DAI', 'L-USDC', 'L-USDT', 'USDT0'],
  majors:    ['BTC', 'ETH', 'WETH', 'L-WETH'],
  l1s:       ['SOL', 'AVAX', 'BNB', 'NEAR'],
  l2_alts:   ['ARB', 'OP', 'MATIC', 'STRK'],
  defi:      ['AAVE', 'UNI', 'CRV', 'MKR', 'COMP', 'PENDLE'],
  meme:      ['DOGE', 'WIF', 'PEPE', 'BONK']
}

const DEFAULT_LIMITS = {
  max_per_market_pct: 0.20,        // 20% of equity in any one market
  max_bucket_pct: 0.50,            // 50% in any correlated bucket
  max_total_leverage: 3.0,         // 3x gross
  max_daily_drawdown_pct: 0.08,    // 8% in 24h → halt
  max_gas_pct_of_trade: 0.02,      // 2% of trade size on gas, max
  min_trade_usd: 5,                // skip dust
  hard_max_leverage: 5,            // never exceed regardless of LLM/strategy
  hard_max_position_usd: 1_000_000 // sanity cap
}

export class RiskEngine {
  constructor (cfg = {}) {
    const userLimits = loadUserLimits()
    const envLimits = loadEnvLimits()
    // Priority: user file > env vars > code defaults > constructor override
    this.limits = { ...DEFAULT_LIMITS, ...envLimits, ...userLimits, ...(cfg.limits || {}) }
    this.buckets = { ...DEFAULT_BUCKETS, ...(cfg.buckets || {}) }
    this.equityHistory = []           // [{ ts, equity }]
    this.maxHistoryPoints = 1440      // 24h at 1-minute resolution
    this.vetoes = []                  // recent rejections for audit
    this.maxVetoes = 200
  }

  /** Add an equity sample. Caller is the agent.refresh() path. */
  recordEquity (equityUSD, ts = Date.now()) {
    this.equityHistory.push({ ts, equity: equityUSD })
    // prune older than 24h or beyond max points
    const cutoff = ts - 24 * 3600 * 1000
    this.equityHistory = this.equityHistory.filter(p => p.ts >= cutoff).slice(-this.maxHistoryPoints)
  }

  /** Map a symbol to its bucket name (or 'other') */
  bucketFor (symbol) {
    const s = (symbol || '').toUpperCase()
    for (const [name, syms] of Object.entries(this.buckets)) {
      if (syms.includes(s)) return name
    }
    return 'other'
  }

  /** True if the kill switch file exists (manual halt) */
  isKilled () {
    return fs.existsSync(KILL_FILE)
  }

  /**
   * Evaluate a proposed action against current portfolio state.
   *
   * @param {object} action — { type, symbol, token, side, size, amount, leverage, … }
   * @param {object} state  — portfolio snapshot:
   *   {
   *     equityUSD, positions: { [symbol]: notionalUSD },
   *     openLeverage,        // current gross / equity
   *     priceFor(symbol),    // resolver
   *     gasEstimateUSD,      // optional
   *     lastTradeUSD         // optional
   *   }
   * @returns {object} { ok, reason?, clamped?: object }
   */
  evaluate (action, state) {
    // 0. Kill switch
    if (this.isKilled()) {
      return this._veto(action, 'kill switch active (~/.kard/KILL exists)')
    }

    // 1. Daily drawdown circuit breaker
    const dd = this._dailyDrawdown(state.equityUSD)
    if (dd != null && dd >= this.limits.max_daily_drawdown_pct) {
      return this._veto(action, `daily drawdown ${(dd * 100).toFixed(2)}% ≥ limit ${(this.limits.max_daily_drawdown_pct * 100).toFixed(2)}% — halting`)
    }

    // 2. Action-type-specific checks
    if (action.type === 'perps_open') {
      return this._evalPerp(action, state)
    }
    if (action.type === 'lending_supply' || action.type === 'lucid_mint' || action.type === 'swap') {
      return this._evalSpotOrSupply(action, state)
    }
    // Allow everything else (alerts, holds, withdrawals, skill calls) through
    return { ok: true }
  }

  _evalPerp (action, state) {
    // Hard leverage clamp
    const lev = action.leverage ?? 1
    let clampedLeverage = lev
    if (lev > this.limits.hard_max_leverage) {
      clampedLeverage = this.limits.hard_max_leverage
    }

    const px = state.priceFor?.(action.symbol) || 0
    const notional = (action.size || 0) * px
    if (notional < this.limits.min_trade_usd) {
      return this._veto(action, `notional ${notional.toFixed(2)} < min ${this.limits.min_trade_usd}`)
    }
    if (notional > this.limits.hard_max_position_usd) {
      return this._veto(action, `notional ${notional.toFixed(0)} > hard cap ${this.limits.hard_max_position_usd}`)
    }

    const eq = state.equityUSD || 0
    if (eq <= 0) return this._veto(action, 'equity is zero')

    // Per-market cap
    const existing = state.positions?.[action.symbol] || 0
    const newMarketExposure = (existing + notional) / eq
    if (newMarketExposure > this.limits.max_per_market_pct) {
      return this._veto(action, `${action.symbol} exposure ${(newMarketExposure * 100).toFixed(1)}% > ${(this.limits.max_per_market_pct * 100).toFixed(1)}% per-market cap`)
    }

    // Correlated bucket cap
    const bucket = this.bucketFor(action.symbol)
    const bucketTotal = Object.entries(state.positions || {})
      .filter(([sym]) => this.bucketFor(sym) === bucket)
      .reduce((a, [, v]) => a + v, 0) + notional
    if ((bucketTotal / eq) > this.limits.max_bucket_pct) {
      return this._veto(action, `bucket "${bucket}" exposure ${((bucketTotal / eq) * 100).toFixed(1)}% > ${(this.limits.max_bucket_pct * 100).toFixed(1)}% cap`)
    }

    // Gross-leverage cap
    const totalNotional = Object.values(state.positions || {}).reduce((a, b) => a + b, 0) + notional
    const gross = totalNotional / eq
    if (gross > this.limits.max_total_leverage) {
      return this._veto(action, `gross leverage ${gross.toFixed(2)}x > ${this.limits.max_total_leverage}x cap`)
    }

    // Gas / size sanity
    if (state.gasEstimateUSD && notional > 0 && state.gasEstimateUSD / notional > this.limits.max_gas_pct_of_trade) {
      return this._veto(action, `gas ${state.gasEstimateUSD.toFixed(2)} > ${(this.limits.max_gas_pct_of_trade * 100).toFixed(1)}% of notional`)
    }

    return clampedLeverage !== lev
      ? { ok: true, clamped: { leverage: clampedLeverage, originalLeverage: lev } }
      : { ok: true }
  }

  _evalSpotOrSupply (action, state) {
    const sym = action.token || action.tokenIn || action.asset
    const eq = state.equityUSD || 0
    if (eq <= 0) return { ok: true }   // first-run: nothing to compare against

    // Approximate USD value of this action — caller-supplied or via priceFor
    const px = state.priceFor?.(sym) || (sym?.includes('USD') ? 1 : 0)
    const usd = (action.amount || 0) * px
    if (usd > 0 && usd < this.limits.min_trade_usd) {
      return this._veto(action, `trade ${usd.toFixed(2)} USD < min ${this.limits.min_trade_usd}`)
    }
    return { ok: true }
  }

  _dailyDrawdown (currentEquity) {
    if (!this.equityHistory.length || !currentEquity) return null
    const peak = Math.max(...this.equityHistory.map(p => p.equity), currentEquity)
    if (peak <= 0) return null
    return Math.max(0, (peak - currentEquity) / peak)
  }

  _veto (action, reason) {
    const v = { ts: new Date().toISOString(), action: { type: action.type, symbol: action.symbol, token: action.token }, reason }
    this.vetoes.push(v)
    if (this.vetoes.length > this.maxVetoes) this.vetoes = this.vetoes.slice(-this.maxVetoes)
    return { ok: false, reason }
  }

  recentVetoes (n = 20) { return this.vetoes.slice(-n).reverse() }

  /** Snapshot for the dashboard / chat /status */
  state (currentEquity) {
    return {
      kill: this.isKilled(),
      drawdown: this._dailyDrawdown(currentEquity),
      limits: this.limits,
      buckets: Object.keys(this.buckets),
      vetoes: this.recentVetoes(5)
    }
  }
}

/** CLI helper: write the kill file */
export function pullKillSwitch () {
  const dir = path.dirname(KILL_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(KILL_FILE, new Date().toISOString())
}

/** CLI helper: clear the kill file */
export function releaseKillSwitch () {
  if (fs.existsSync(KILL_FILE)) fs.unlinkSync(KILL_FILE)
}

// ─── User-configurable risk limits ───

/** Load user limits from ~/.kard/risk-limits.json */
function loadUserLimits () {
  try {
    if (fs.existsSync(USER_LIMITS_FILE)) {
      return JSON.parse(fs.readFileSync(USER_LIMITS_FILE, 'utf8'))
    }
  } catch {}
  return {}
}

/** Load limits from environment variables */
function loadEnvLimits () {
  const env = {}
  if (process.env.KARD_MAX_DRAWDOWN) env.max_daily_drawdown_pct = parseFloat(process.env.KARD_MAX_DRAWDOWN) / 100
  if (process.env.KARD_MAX_LEVERAGE) env.max_total_leverage = parseFloat(process.env.KARD_MAX_LEVERAGE)
  if (process.env.KARD_MAX_POSITION_USD) env.hard_max_position_usd = parseFloat(process.env.KARD_MAX_POSITION_USD)
  if (process.env.KARD_MAX_PER_MARKET) env.max_per_market_pct = parseFloat(process.env.KARD_MAX_PER_MARKET) / 100
  if (process.env.KARD_MAX_BUCKET) env.max_bucket_pct = parseFloat(process.env.KARD_MAX_BUCKET) / 100
  if (process.env.KARD_MIN_TRADE_USD) env.min_trade_usd = parseFloat(process.env.KARD_MIN_TRADE_USD)
  if (process.env.KARD_HARD_MAX_LEVERAGE) env.hard_max_leverage = parseFloat(process.env.KARD_HARD_MAX_LEVERAGE)
  return env
}

/** Save user limits to ~/.kard/risk-limits.json */
export function saveUserLimits (limits) {
  const dir = path.dirname(USER_LIMITS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(USER_LIMITS_FILE, JSON.stringify(limits, null, 2))
}

/** Get current effective limits (merged) */
export function getEffectiveLimits () {
  const userLimits = loadUserLimits()
  const envLimits = loadEnvLimits()
  return { ...DEFAULT_LIMITS, ...envLimits, ...userLimits }
}

/** Set a single user limit */
export function setUserLimit (key, value) {
  const current = loadUserLimits()
  current[key] = value
  saveUserLimits(current)
  return current
}

/** Reset user limits to defaults */
export function resetUserLimits () {
  if (fs.existsSync(USER_LIMITS_FILE)) fs.unlinkSync(USER_LIMITS_FILE)
}
