// @kard/agent — User preferences / policy config
//
// Lives at ~/.kard/config.json. Survives restarts. Read by the agent on
// boot, applied at THREE enforcement points so policy is hard, not advisory:
//
//   1. LLM prompt       — model is told "ONLY use these chains/venues/actions"
//   2. Yield aggregator — opportunities filtered before ranking
//   3. Risk engine veto — any leaking action gets rejected before execute()
//
// Defense in depth — even if the LLM ignores the prompt, the runtime won't
// let it spend on something you've excluded.
//
// Schema:
//   {
//     chains:  { allow: ["kiteai","arbitrum"], deny: [] }   // OR
//     chains:  { deny: ["avalanche","celo"] }               // (allow defaults to all)
//     venues:  { allow: ["aave","lucid"], deny: ["hyperliquid"] }
//     actions: { deny: ["perps_open","perps_close"] }
//     assets:  { allow: ["USDC","USDT"], deny: ["MEME"] }
//     limits:  { max_per_market_pct: 0.15, max_total_leverage: 2 }    // overrides RiskEngine defaults
//   }

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const CONFIG_FILE = path.join(os.homedir(), '.kard', 'config.json')

const DEFAULTS = {
  chains:  { allow: null, deny: [] },     // null = all
  venues:  { allow: null, deny: [] },
  actions: { allow: null, deny: [] },
  assets:  { allow: null, deny: [] },
  limits:  {}
}

const ALL_VENUES   = ['aave', 'lucid', 'hyperliquid', 'gmx', 'uniswap', 'aerodrome', 'pendle', 'lido', 'etherfi', 'velora', 'usdt0', '1inch', 'cowswap']
const ALL_ACTIONS  = ['lending_supply', 'lending_withdraw', 'swap', 'bridge', 'lucid_mint', 'lucid_burn', 'perps_open', 'perps_close', 'skill', 'transfer', 'alert', 'hold']

export class KardConfig {
  constructor (cfg) {
    this.data = mergeDefault(cfg || this._load())
  }

  _load () {
    if (!fs.existsSync(CONFIG_FILE)) return {}
    try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) }
    catch { return {} }
  }

  save () {
    const dir = path.dirname(CONFIG_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.data, null, 2))
  }

  /**
   * Get/set via dotted path: `config.set('chains.deny', ['avalanche'])`
   * Or merged: `config.set('chains', { deny: ['avalanche'] })`
   */
  set (key, value) {
    const parts = key.split('.')
    let o = this.data
    for (let i = 0; i < parts.length - 1; i++) {
      o[parts[i]] = o[parts[i]] || {}
      o = o[parts[i]]
    }
    o[parts[parts.length - 1]] = value
    this.save()
    return this.data
  }
  get (key) {
    return key.split('.').reduce((a, k) => a?.[k], this.data)
  }
  reset () { this.data = { ...DEFAULTS }; this.save() }

  // ─── Policy queries ───

  isChainAllowed (chain) { return ok(chain, this.data.chains) }
  isVenueAllowed (venue) { return ok(venue, this.data.venues) }
  isActionAllowed (type) { return ok(type, this.data.actions) }
  isAssetAllowed (asset) { return ok(asset, this.data.assets) }

  /** Apply the asset/chain/venue/action policy to a single proposed action. */
  evaluate (action) {
    if (!this.isActionAllowed(action.type)) {
      return { ok: false, reason: `action.type "${action.type}" denied by user config` }
    }
    const chain = action.chain || action.sourceChain || action.targetChain
    if (chain && !this.isChainAllowed(chain)) {
      return { ok: false, reason: `chain "${chain}" denied by user config` }
    }
    const asset = action.token || action.asset || action.tokenIn || action.symbol
    if (asset && !this.isAssetAllowed(asset)) {
      return { ok: false, reason: `asset "${asset}" denied by user config` }
    }
    // Venue inferred from action.type
    const venue = inferVenue(action)
    if (venue && !this.isVenueAllowed(venue)) {
      return { ok: false, reason: `venue "${venue}" denied by user config` }
    }
    return { ok: true }
  }

  /** Block an opportunity from showing up in the YieldAggregator results */
  filterOpportunity (op) {
    if (op.chain && !this.isChainAllowed(op.chain)) return false
    if (op.asset && !this.isAssetAllowed(op.asset)) return false
    if (op.source && !this.isVenueAllowed(op.source)) return false
    return true
  }

  /** Compact text summary the LLM reads in its system prompt */
  describeForPrompt () {
    const lines = ['', '=== USER POLICY (HARD CONSTRAINTS — never propose violations) ===']
    if (this.data.chains.deny?.length)   lines.push(`Excluded chains: ${this.data.chains.deny.join(', ')}`)
    if (this.data.chains.allow?.length)  lines.push(`Allowed chains ONLY: ${this.data.chains.allow.join(', ')}`)
    if (this.data.venues.deny?.length)   lines.push(`Excluded venues: ${this.data.venues.deny.join(', ')}`)
    if (this.data.venues.allow?.length)  lines.push(`Allowed venues ONLY: ${this.data.venues.allow.join(', ')}`)
    if (this.data.actions.deny?.length)  lines.push(`Forbidden actions: ${this.data.actions.deny.join(', ')}  ← never emit these`)
    if (this.data.actions.allow?.length) lines.push(`Allowed actions ONLY: ${this.data.actions.allow.join(', ')}`)
    if (this.data.assets.deny?.length)   lines.push(`Excluded assets: ${this.data.assets.deny.join(', ')}`)
    if (this.data.assets.allow?.length)  lines.push(`Allowed assets ONLY: ${this.data.assets.allow.join(', ')}`)
    return lines.length > 2 ? lines.join('\n') : ''
  }

  /** Pretty-print for `kard config show` */
  describe () {
    const c = this.data
    return [
      'Kard user policy (~/.kard/config.json):',
      `  chains   allow=${list(c.chains.allow)}  deny=${list(c.chains.deny)}`,
      `  venues   allow=${list(c.venues.allow)}  deny=${list(c.venues.deny)}`,
      `  actions  allow=${list(c.actions.allow)}  deny=${list(c.actions.deny)}`,
      `  assets   allow=${list(c.assets.allow)}  deny=${list(c.assets.deny)}`,
      `  limits   ${JSON.stringify(c.limits)}`
    ].join('\n')
  }
}

function ok (value, { allow, deny } = {}) {
  if (deny?.length && deny.includes(value)) return false
  if (allow?.length && !allow.includes(value)) return false
  return true
}

function inferVenue (a) {
  if (a.type === 'perps_open' || a.type === 'perps_close') return 'hyperliquid' // (or gmx — caller can override)
  if (a.type === 'lucid_mint' || a.type === 'lucid_burn') return 'lucid'
  if (a.type === 'lending_supply' || a.type === 'lending_withdraw') return 'aave'
  if (a.type === 'swap')   return a.venue || 'uniswap'
  if (a.type === 'bridge') return 'usdt0'
  return null
}

function mergeDefault (cfg) {
  return {
    chains:  { ...DEFAULTS.chains,  ...(cfg.chains  || {}) },
    venues:  { ...DEFAULTS.venues,  ...(cfg.venues  || {}) },
    actions: { ...DEFAULTS.actions, ...(cfg.actions || {}) },
    assets:  { ...DEFAULTS.assets,  ...(cfg.assets  || {}) },
    limits:  { ...DEFAULTS.limits,  ...(cfg.limits  || {}) }
  }
}

function list (arr) { return !arr || arr.length === 0 ? '*' : arr.join(',') }

let _global = null
export function defaultConfig () {
  if (!_global) _global = new KardConfig()
  return _global
}

export { ALL_VENUES, ALL_ACTIONS }
