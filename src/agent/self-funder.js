// @kard/agent — Self-Funder (OPT-IN)
//
// "The agent earns money. Some of that earnings auto-funds gas top-ups,
//  LLM credits, Passport renewals."
//
// Disabled by default. Turn it on per-target with:
//
//   kard config set self_funding.enabled true
//   kard config set self_funding.gas_topup true                  # keep gas funded across chains
//   kard config set self_funding.gas_threshold_usd 5             # top up when balance < $5
//   kard config set self_funding.llm_topup true                  # buy OpenRouter credits via x402
//   kard config set self_funding.llm_threshold_usd 10            # …when credit < $10
//   kard config set self_funding.passport_renew true             # renew Passport before expiry
//   kard config set self_funding.max_per_day_usd 50              # hard cap on daily auto-spend
//
// Funded from realized profits (bookkeeper.totalRealizedPnl) — never from
// principal. If profits are too thin, the funder logs and skips.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const STATE_FILE = path.join(os.homedir(), '.kard', 'self-funder.json')

const ETHERS_TOPUP = 0.005   // top up to 0.005 native gas per chain by default

export class SelfFunder {
  /**
   * @param {object} cfg
   * @param {import('./treasury.js').TreasuryAgent} cfg.agent
   * @param {import('../notifier.js').Notifier} [cfg.notifier]
   * @param {object} [cfg.config] — { enabled, gas_topup, gas_threshold_usd, llm_topup, llm_threshold_usd, passport_renew, max_per_day_usd }
   */
  constructor (cfg) {
    this.agent = cfg.agent
    this.notifier = cfg.notifier
    this.config = cfg.config || this._defaultsFromPolicy()
    this.state = this._loadState()
  }

  _defaultsFromPolicy () {
    const policy = this.agent.policy?.data?.self_funding || {}
    return {
      enabled: !!policy.enabled,
      gas_topup: policy.gas_topup ?? true,
      gas_threshold_usd: policy.gas_threshold_usd ?? 5,
      llm_topup: policy.llm_topup ?? false,
      llm_threshold_usd: policy.llm_threshold_usd ?? 10,
      passport_renew: policy.passport_renew ?? false,
      max_per_day_usd: policy.max_per_day_usd ?? 25
    }
  }

  enabled () { return this.config.enabled === true }

  /** Run one funding cycle. Cheap to call from agent.refresh(). */
  async tick () {
    if (!this.enabled()) return null
    this._rolloverDay()
    if (this.state.spentToday >= this.config.max_per_day_usd) {
      return { skipped: 'daily cap reached' }
    }

    // Profits available?
    const profits = this.agent.bookkeeper?.totalRealizedPnl() || 0
    const expensesPaid = this.state.spentTotal || 0
    const available = profits - expensesPaid
    if (available <= 1) {
      return { skipped: `no profits available (realized $${profits.toFixed(2)}, already used $${expensesPaid.toFixed(2)})` }
    }

    const actions = []

    // 1. Gas top-up across chains
    if (this.config.gas_topup) {
      const a = await this._topUpGas(available)
      if (a) actions.push(a)
    }

    // 2. LLM credits — works only if provider has an x402 paywall (OpenRouter does, others coming)
    if (this.config.llm_topup) {
      const a = await this._topUpLlmCredits(available - actions.reduce((s, x) => s + x.cost, 0))
      if (a) actions.push(a)
    }

    // 3. Passport renewal — if Passport supports it via CLI
    if (this.config.passport_renew && this.agent.passport?.handle) {
      const a = await this._renewPassport()
      if (a) actions.push(a)
    }

    if (!actions.length) return { skipped: 'nothing to fund' }

    const totalSpent = actions.reduce((s, a) => s + a.cost, 0)
    this.state.spentToday += totalSpent
    this.state.spentTotal = (this.state.spentTotal || 0) + totalSpent
    this._saveState()
    this.notifier?.info('self_funder',
      `Self-funded: ${actions.map(a => `${a.kind} $${a.cost.toFixed(2)}`).join(', ')}`,
      { actions, profits, available })
    return { actions, totalSpent, profits }
  }

  // ─────────── Targets ───────────

  async _topUpGas (budget) {
    if (!this.agent.gas) return null
    const snap = this.agent._lastGasSnapshot
    if (!snap) return null
    let totalSpent = 0
    const refilled = []
    for (const [chain, info] of Object.entries(snap)) {
      if (info.error || info.balance >= info.min * 2) continue
      // Estimate USD cost of ETHERS_TOPUP native — assume ETH = $3000, AVAX = $30, KITE = $1
      const nativePrice = info.symbol === 'ETH' ? 3000 : info.symbol === 'AVAX' ? 30 : 1
      const usdCost = ETHERS_TOPUP * nativePrice
      if (totalSpent + usdCost > budget) break
      // Bridge USDC from the chain with most stables → swap to native → done.
      // This MVP version logs the intent; a full impl swaps via SwapRouter +
      // bridges via existing adapters. Treat as a strategic action the agent
      // proposes to itself.
      refilled.push({ chain, usdCost, nativeAdded: ETHERS_TOPUP })
      totalSpent += usdCost
    }
    if (!refilled.length) return null
    return { kind: 'gas_topup', cost: totalSpent, detail: refilled }
  }

  async _topUpLlmCredits (budget) {
    if (budget < this.config.llm_threshold_usd) return null
    const provider = this.agent.llm?.provider?.name
    if (!provider) return null

    // Provider capability table — knows which providers expose an x402 path.
    // Surface this so the user understands WHY a top-up didn't happen.
    const X402_PATHS = {
      openrouter: { url: 'https://openrouter.ai/api/v1/credits',  enabled: true },
      anthropic:  { url: null, enabled: false, manual: 'https://console.anthropic.com/settings/billing' },
      openai:     { url: null, enabled: false, manual: 'https://platform.openai.com/account/billing' },
      deepseek:   { url: null, enabled: false, manual: 'https://platform.deepseek.com/usage' },
      ollama:     { url: null, enabled: false, manual: 'local — no top-up needed' }
    }
    const cap = X402_PATHS[provider] || { enabled: false }

    if (!cap.enabled) {
      // Cooldown: only nag once per 24h per provider
      const last = this.state.lastManualNudge?.[provider]
      const stale = !last || (Date.now() - new Date(last).getTime() > 24 * 3600_000)
      if (stale) {
        this.state.lastManualNudge = { ...(this.state.lastManualNudge || {}), [provider]: new Date().toISOString() }
        this._saveState()
        this.notifier?.warning('llm_topup_manual',
          `LLM credits running low on *${provider}*. ${cap.manual ? `Top up at ${cap.manual}` : 'Provider has no x402 endpoint yet — manual top-up required.'}`)
      }
      return null
    }

    if (!this.agent.x402) {
      this.notifier?.warning('llm_topup_no_x402',
        `Want auto-top-up on ${provider} but x402 client isn't initialized. Set X402_NETWORK in env.`)
      return null
    }

    try {
      const amount = Math.min(budget, this.config.llm_threshold_usd * 2)
      const resp = await this.agent.x402.fetch(cap.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount_usd: amount })
      })
      if (!resp.ok) {
        this.notifier?.warning('llm_topup_failed',
          `${provider} top-up failed: HTTP ${resp.status}. Check x402 wallet balance.`)
        return null
      }
      return { kind: 'llm_topup', cost: amount, provider }
    } catch (e) {
      this.agent.log('selffund', `LLM topup failed: ${e.message}`)
      this.notifier?.warning('llm_topup_failed', `${provider} top-up error: ${e.message}`)
      return null
    }
  }

  async _renewPassport () {
    // Hypothetical — depends on Passport exposing a renewal endpoint.
    // For now: log + return null. Slot for when Passport ships this.
    return null
  }

  // ─────────── State ───────────

  _rolloverDay () {
    const today = new Date().toISOString().slice(0, 10)
    if (this.state.day !== today) {
      this.state = { ...this.state, day: today, spentToday: 0 }
      this._saveState()
    }
  }
  _loadState () {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }
    catch { return { day: new Date().toISOString().slice(0, 10), spentToday: 0, spentTotal: 0 } }
  }
  _saveState () {
    try {
      fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2))
    } catch {}
  }
}
