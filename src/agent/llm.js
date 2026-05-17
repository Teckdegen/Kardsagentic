// @kard/agent — LLM Reasoning Engine (BYOM: Bring Your Own Model)
//
// Provider-agnostic. Pick one with LLM_PROVIDER env or createLlmFromProvider().
// Supported out of the box:
//   - anthropic   — Claude family (default)
//   - openai      — GPT family
//   - openrouter  — any model on openrouter.ai
//   - ollama      — local models (LLAMA_BASE defaults to http://127.0.0.1:11434)
//
// All providers share the same Provider interface: chat({ system, messages, maxTokens })
// returning { text, usage }. Plug your own in by passing { provider: { chat } }.

import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `You are Kard, an autonomous multi-chain treasury management agent.
Your job is to analyze the current treasury state and propose optimal actions.

You manage a USDT-focused portfolio across:
- Wallet holdings (ETH, USDT, DAI, USDC, WETH)
- Aave V3 lending positions (supply for yield)
- Velora DEX aggregator / Uniswap V3 swaps (rebalancing between tokens)
- USDT0 cross-chain bridge (LayerZero V2, 26+ chains)
- Lucid Kite — yield-bearing canonical USDC (L-USDC) on KiteAI chain.
    Lucid puts ~90% of locked collateral into Aave v3 on Arbitrum and mints
    L-USDC on KiteAI 1:1 with yield accruing in-token. Use lucid_mint to move
    idle USDC on Arbitrum into L-USDC on KiteAI when implied Lucid APY beats
    direct Aave by the configured edge. Use lucid_burn to redeem (JIT
    liquidity from Aave settles within standard bridge timelines).
- Hyperliquid perps (testnet by default) — text-to-onchain perp execution.
    Use perps_open / perps_close. ALWAYS respect strategy.perps.maxLeverage.
    Check funding rates: avoid longs against extreme positive funding; favor
    entries where funding pays you. Risk per trade is capped by
    strategy.perps.riskPerTrade (default 2% of equity).
- ERC-4337 Smart Account (gasless transactions via Safe)
- x402 payments (machine-to-machine USDT0 micropayments)

Tether ecosystem tokens (for awareness, not yet on-chain tradeable):
- USAt: Tether T-Bills — USD-denominated US Treasury yield token
- XAUt: Tether Gold — each token backed by 1 troy ounce of physical gold

Key principles:
1. USDT is the base currency — maximize USDT-denominated yield
2. Preserve capital first, optimize yield second
3. Keep enough ETH for gas (>0.002 ETH minimum)
4. Monitor health factor if any borrows exist (>1.5 safe, <1.2 critical)
5. Only propose actions with clear reasoning
6. Consider gas costs vs. benefit — don't rebalance $5 if gas costs $2

Strategy-specific behavior:
- "USDT Yield" strategy: aggressively consolidate DAI/USDC → USDT via swap, then supply USDT to Aave.
  Keep minimum $500 USDT in wallet as reserve. Supply order: USDT first, then USDC, DAI, WETH.
  Target 70% in Aave lending. This is the default Tether-centric strategy.
- "Conservative/Balanced/Aggressive": standard equal-weight stablecoin diversification.
- "Tether Diversified": spread across Tether ecosystem (USDT stablecoin + USAt T-Bills yield + XAUt gold hedge).
  60% lending, 15% real-world assets, 10% liquidity, 15% reserve.

You MUST respond with valid JSON matching this schema:
{
  "reasoning": "1-3 sentence analysis of current state",
  "answer": "Direct answer to user question (only if user instruction is a question, otherwise omit)",
  "market_assessment": "bullish | bearish | neutral | uncertain",
  "risk_level": "low | medium | high | critical",
  "actions": [
    {
      "type": "lending_supply | lending_withdraw | swap | bridge | lucid_mint | lucid_burn | perps_open | perps_close | skill | alert | hold",
      "name": "<skill-name> (for type=skill)",
      "tool": "<tool-id> (for type=skill)",
      "params": { /* skill tool params */ },
      "token": "TOKEN_SYMBOL",
      "tokenOut": "TOKEN_SYMBOL (for swaps)",
      "amount": 123.45,
      "asset": "USDC (for lucid_mint/burn)",
      "sourceChain": "arbitrum (for lucid_mint)",
      "targetChain": "kiteai (for lucid_mint) | arbitrum (for lucid_burn)",
      "symbol": "ETH (for perps_open/close — perp market symbol)",
      "side": "long | short (perps_open)",
      "size": 0.5,
      "leverage": 3,
      "limitPx": 3450.5,
      "reduceOnly": false,
      "isolated": false,
      "stopPct": 0.04,
      "tpPct": 0.08,
      "stopPx": 3300,
      "takeProfitPx": 3700,
      "reason": "why this action",
      "priority": "critical | high | medium | low",
      "confidence": 0.85
    }
  ],
  "next_check_suggestion": "30s | 1m | 5m | 15m | 1h"
}

IMPORTANT response rules:
- If the user asks a question (price, analysis, explanation), put the DIRECT ANSWER in the "answer" field and keep actions empty.
  Do NOT create alert actions to answer user questions — use the "answer" field instead.
- If no action is needed, return empty actions array with reasoning explaining why.
- Only propose executable actions (lending_supply, lending_withdraw, swap, bridge) when you genuinely recommend them.
- Never propose actions you're not confident about (confidence < 0.5).`

// ─────────── Retry helper ───────────

const DEFAULT_RETRIES = 3
const RETRY_BASE_MS = 1000

/**
 * Retry with exponential backoff + jitter.
 * Retries on 429, 500, 502, 503, 504, and network errors.
 */
async function withRetry (fn, { retries = DEFAULT_RETRIES, signal } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (signal?.aborted) throw new Error('Request aborted (timeout)')
      return await fn(signal)
    } catch (err) {
      lastErr = err
      const status = err.status || err.statusCode
      const retryable = !status || status === 429 || status >= 500
      if (!retryable || attempt === retries) throw err
      const delay = RETRY_BASE_MS * Math.pow(2, attempt) + Math.random() * 500
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastErr
}

/** Create an AbortSignal that fires after `ms` milliseconds */
function timeoutSignal (ms) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  // Allow GC if caller finishes early
  ctrl.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
  return ctrl
}

// ─────────── Provider implementations ───────────

/** Anthropic — Claude */
function anthropicProvider (opts = {}) {
  const apiKey = opts.apiKey || process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('anthropic: ANTHROPIC_API_KEY required')
  const client = new Anthropic({ apiKey })
  const model = opts.model || process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001'
  const timeout = opts.timeout || 60000
  return {
    name: 'anthropic',
    model,
    async chat ({ system, messages, maxTokens = 1024 }) {
      return withRetry(async () => {
        const res = await client.messages.create(
          { model, system, messages, max_tokens: maxTokens },
          { timeout }
        )
        return {
          text: res.content[0]?.text || '',
          usage: { input: res.usage?.input_tokens, output: res.usage?.output_tokens }
        }
      })
    }
  }
}

/** OpenAI — chat completions */
function openaiProvider (opts = {}) {
  const apiKey = opts.apiKey || process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('openai: OPENAI_API_KEY required')
  const model = opts.model || process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const base = opts.baseUrl || 'https://api.openai.com/v1'
  return {
    name: 'openai',
    model,
    async chat ({ system, messages, maxTokens = 1024 }) {
      const all = system ? [{ role: 'system', content: system }, ...messages] : messages
      const r = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: all, max_tokens: maxTokens, response_format: { type: 'json_object' } })
      })
      if (!r.ok) throw new Error(`openai ${r.status}: ${await r.text()}`)
      const data = await r.json()
      return {
        text: data.choices?.[0]?.message?.content || '',
        usage: { input: data.usage?.prompt_tokens, output: data.usage?.completion_tokens }
      }
    }
  }
}

/** OpenRouter — any model on openrouter.ai (OpenAI-compatible) */
function openrouterProvider (opts = {}) {
  const apiKey = opts.apiKey || process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('openrouter: OPENROUTER_API_KEY required')
  const model = opts.model || process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet'
  const base = 'https://openrouter.ai/api/v1'
  return {
    name: 'openrouter',
    model,
    async chat ({ system, messages, maxTokens = 1024 }) {
      const all = system ? [{ role: 'system', content: system }, ...messages] : messages
      const r = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://github.com/kard/agent',
          'X-Title': '@kard/agent'
        },
        body: JSON.stringify({ model, messages: all, max_tokens: maxTokens })
      })
      if (!r.ok) throw new Error(`openrouter ${r.status}: ${await r.text()}`)
      const data = await r.json()
      return {
        text: data.choices?.[0]?.message?.content || '',
        usage: { input: data.usage?.prompt_tokens, output: data.usage?.completion_tokens }
      }
    }
  }
}

/** DeepSeek — OpenAI-compatible API */
function deepseekProvider (opts = {}) {
  const apiKey = opts.apiKey || process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('deepseek: DEEPSEEK_API_KEY required')
  const model = opts.model || process.env.DEEPSEEK_MODEL || 'deepseek-chat'
  const base = opts.baseUrl || 'https://api.deepseek.com/v1'
  return {
    name: 'deepseek',
    model,
    async chat ({ system, messages, maxTokens = 1024 }) {
      const all = system ? [{ role: 'system', content: system }, ...messages] : messages
      const r = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: all, max_tokens: maxTokens, response_format: { type: 'json_object' } })
      })
      if (!r.ok) throw new Error(`deepseek ${r.status}: ${await r.text()}`)
      const data = await r.json()
      return {
        text: data.choices?.[0]?.message?.content || '',
        usage: { input: data.usage?.prompt_tokens, output: data.usage?.completion_tokens }
      }
    }
  }
}

/** Ollama — local models */
function ollamaProvider (opts = {}) {
  const base = opts.baseUrl || process.env.OLLAMA_BASE || 'http://127.0.0.1:11434'
  const model = opts.model || process.env.OLLAMA_MODEL || 'llama3.1'
  return {
    name: 'ollama',
    model,
    async chat ({ system, messages, maxTokens = 1024 }) {
      const all = system ? [{ role: 'system', content: system }, ...messages] : messages
      const r = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model, messages: all, stream: false,
          format: 'json',
          options: { num_predict: maxTokens }
        })
      })
      if (!r.ok) throw new Error(`ollama ${r.status}: ${await r.text()}`)
      const data = await r.json()
      return { text: data.message?.content || '', usage: {} }
    }
  }
}

/** Google Gemini — via OpenAI-compatible endpoint */
function geminiProvider (opts = {}) {
  const apiKey = opts.apiKey || process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('gemini: GEMINI_API_KEY required')
  const model = opts.model || process.env.GEMINI_MODEL || 'gemini-1.5-flash'
  const base = 'https://generativelanguage.googleapis.com/v1beta/openai'
  return {
    name: 'gemini',
    model,
    async chat ({ system, messages, maxTokens = 1024 }) {
      const all = system ? [{ role: 'system', content: system }, ...messages] : messages
      const r = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: all,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' }
        })
      })
      if (!r.ok) throw new Error(`gemini ${r.status}: ${await r.text()}`)
      const data = await r.json()
      return {
        text: data.choices?.[0]?.message?.content || '',
        usage: { input: data.usage?.prompt_tokens, output: data.usage?.completion_tokens }
      }
    }
  }
}

/** xAI Grok — OpenAI-compatible API */
function grokProvider (opts = {}) {
  const apiKey = opts.apiKey || process.env.GROK_API_KEY
  if (!apiKey) throw new Error('grok: GROK_API_KEY required')
  const model = opts.model || process.env.GROK_MODEL || 'grok-beta'
  const base = 'https://api.x.ai/v1'
  return {
    name: 'grok',
    model,
    async chat ({ system, messages, maxTokens = 1024 }) {
      const all = system ? [{ role: 'system', content: system }, ...messages] : messages
      const r = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({ model, messages: all, max_tokens: maxTokens })
      })
      if (!r.ok) throw new Error(`grok ${r.status}: ${await r.text()}`)
      const data = await r.json()
      return {
        text: data.choices?.[0]?.message?.content || '',
        usage: { input: data.usage?.prompt_tokens, output: data.usage?.completion_tokens }
      }
    }
  }
}

const PROVIDERS = {
  anthropic: anthropicProvider,
  claude: anthropicProvider,
  openai: openaiProvider,
  gpt: openaiProvider,
  openrouter: openrouterProvider,
  deepseek: deepseekProvider,
  gemini: geminiProvider,
  google: geminiProvider,
  grok: grokProvider,
  xai: grokProvider,
  ollama: ollamaProvider,
  local: ollamaProvider
}

/** Build an LlmReasoning bound to the named provider */
export function createLlmFromProvider (name, opts = {}) {
  const factory = PROVIDERS[name?.toLowerCase()]
  if (!factory) throw new Error(`Unknown LLM provider: ${name}. Supported: ${Object.keys(PROVIDERS).join(', ')}`)
  return new LlmReasoning({ ...opts, provider: factory(opts) })
}

export class LlmReasoning {
  constructor (opts = {}) {
    // Either pass a custom provider OR rely on env-based defaults (Anthropic legacy)
    if (opts.provider && typeof opts.provider.chat === 'function') {
      this.provider = opts.provider
    } else {
      const name = opts.providerName || process.env.LLM_PROVIDER || 'anthropic'
      const factory = PROVIDERS[name.toLowerCase()]
      if (!factory) throw new Error(`Unknown LLM provider: ${name}`)
      this.provider = factory(opts)
    }

    this.model = opts.model || this.provider.model
    this.maxTokens = opts.maxTokens || 1024
    this.history = []
    this.maxHistory = 10

    // Backward-compat: keep `client` for code that accessed it directly
    this.client = this.provider
  }

  /**
   * Build a state summary for the LLM
   * @param {object} snapshot — agent.getSnapshot()
   * @param {object} opts — extra context
   * @returns {string} formatted state
   */
  buildStatePrompt (snapshot, opts = {}) {
    const lines = []

    lines.push('=== TREASURY STATE ===')
    lines.push(`Timestamp: ${new Date().toISOString()}`)
    lines.push(`Cycle: #${snapshot.cycle}`)
    lines.push(`Strategy: ${snapshot.strategy?.name || 'none'} (target lending: ${snapshot.strategy?.allocations?.lending || 0}%)`)
    lines.push(`Agent: ${snapshot.active ? 'ACTIVE' : 'STOPPED'} ${snapshot.paused ? '(PAUSED)' : ''}`)
    lines.push('')

    // Wallet balances
    lines.push('--- Wallet Balances ---')
    for (const [sym, bal] of Object.entries(snapshot.balances || {})) {
      if (bal > 0) {
        const usdVal = sym === 'ETH' || sym === 'WETH'
          ? `(~$${(bal * (snapshot.prices?.ETH?.usd || 2600)).toFixed(2)})`
          : `(~$${bal.toFixed(2)})`
        lines.push(`  ${sym}: ${bal} ${usdVal}`)
      }
    }

    // Supplied (Aave)
    lines.push('')
    lines.push('--- Aave Supplied ---')
    const hasSupplied = Object.values(snapshot.supplied || {}).some(v => v > 0)
    if (hasSupplied) {
      for (const [sym, amt] of Object.entries(snapshot.supplied)) {
        if (amt > 0) lines.push(`  ${sym}: ${amt}`)
      }
    } else {
      lines.push('  (none)')
    }

    // Aave account
    if (snapshot.aaveAccount) {
      const a = snapshot.aaveAccount
      lines.push('')
      lines.push('--- Aave Account ---')
      lines.push(`  Total Collateral: $${a.totalCollateralUSD?.toFixed(2) || '0'}`)
      lines.push(`  Total Debt: $${a.totalDebtUSD?.toFixed(2) || '0'}`)
      lines.push(`  Available Borrow: $${a.availableBorrowUSD?.toFixed(2) || '0'}`)
      if (a.healthFactor) lines.push(`  Health Factor: ${a.healthFactor}`)
    }

    // Portfolio
    lines.push('')
    lines.push('--- Portfolio ---')
    lines.push(`  Lending Allocation: ${snapshot.lendingPct}%`)
    if (snapshot.portfolio) {
      lines.push(`  Total Value: $${snapshot.portfolio.totalUSD?.toFixed(2) || '?'}`)
    }

    // Prices
    lines.push('')
    lines.push('--- Market Prices ---')
    for (const [sym, data] of Object.entries(snapshot.prices || {})) {
      if (data?.usd) {
        const change = data.usd_24h_change
        const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→'
        lines.push(`  ${sym}: $${data.usd} ${arrow}${Math.abs(change || 0).toFixed(1)}% (24h)`)
      }
    }

    // Available swap pairs
    if (snapshot.swapPairs?.length > 0) {
      lines.push('')
      lines.push('--- Available Swaps ---')
      lines.push(`  ${snapshot.swapPairs.map(p => `${p.tokenA}/${p.tokenB}`).join(', ')}`)
    }

    // Bridge routes
    if (snapshot.bridgeChains?.length > 0) {
      lines.push('')
      lines.push('--- Bridge Routes (USDT0) ---')
      lines.push(`  Chains: ${snapshot.bridgeChains.map(c => c.name).join(', ')}`)
    }

    // Recent actions for context
    const recentActions = (snapshot.recentActions || []).slice(-5)
    if (recentActions.length > 0) {
      lines.push('')
      lines.push('--- Recent Actions (last 5) ---')
      for (const a of recentActions) {
        lines.push(`  [${a.type}] ${a.message} (${a.ts})`)
      }
    }

    // Recent errors
    if (snapshot.recentErrors?.length > 0) {
      lines.push('')
      lines.push('--- Recent Errors ---')
      for (const e of snapshot.recentErrors.slice(-3)) {
        lines.push(`  [${e.context}] ${e.message} (${e.ts})`)
      }
    }

    // Strategy constraints
    if (snapshot.strategy) {
      lines.push('')
      lines.push('--- Strategy Constraints ---')
      lines.push(`  Target Yield: ${snapshot.strategy.targetYield}%`)
      lines.push(`  Max Risk: ${snapshot.strategy.maxRisk}`)
      lines.push(`  Allocations: lending=${snapshot.strategy.allocations.lending}%, liquidity=${snapshot.strategy.allocations.liquidity}%, reserve=${snapshot.strategy.allocations.reserve}%`)
      lines.push(`  Rebalance Threshold: ${snapshot.strategy.rebalanceThreshold}%`)
    }

    // Extra context (e.g. user instructions)
    if (opts.userInstruction) {
      lines.push('')
      lines.push(`--- User Instruction ---`)
      lines.push(`  ${opts.userInstruction}`)
    }

    return lines.join('\n')
  }

  /**
   * Run LLM reasoning on current state
   * @param {object} snapshot — from agent.getSnapshot()
   * @param {object} opts — { userInstruction?, ruleBasedActions? }
   * @returns {object} parsed LLM decision
   */
  async reason (snapshot, opts = {}) {
    const statePrompt = this.buildStatePrompt(snapshot, opts)

    // Include rule-based actions as advisory
    let userMessage = statePrompt
    if (opts.ruleBasedActions?.length > 0) {
      userMessage += '\n\n--- Rule-Based Suggestions (for reference) ---'
      for (const a of opts.ruleBasedActions) {
        userMessage += `\n  [${a.type}] ${a.reason} (priority: ${a.priority})`
      }
      userMessage += '\n\nConsider these rule-based suggestions but use your own judgment. You may agree, modify, or override them.'
    }

    if (opts.userInstruction) {
      userMessage += `\n\nThe user is asking: "${opts.userInstruction}". Answer their question directly in the "answer" field. Return empty actions array — do NOT create alert actions to answer questions.`
    } else {
      userMessage += '\n\nAnalyze the treasury state and propose actions.'
    }
    userMessage += ' Respond with JSON only.'

    // Build messages with history for continuity
    const messages = [
      ...this.history,
      { role: 'user', content: userMessage }
    ]

    const startTime = Date.now()

    const fullSystem = this.extraSystem
      ? `${SYSTEM_PROMPT}\n\n${this.extraSystem}`
      : SYSTEM_PROMPT
    const response = await this.provider.chat({
      system: fullSystem,
      messages,
      maxTokens: this.maxTokens
    })

    const elapsed = Date.now() - startTime
    const text = response.text || ''

    // Robust JSON extraction — works whether the model returns pure JSON,
    // fenced code blocks, or prose-wrapped JSON.
    const decision = extractJson(text)
    if (!decision) {
      throw new Error(`LLM returned no parseable JSON: ${text.slice(0, 300)}`)
    }

    // Validate structure
    if (!decision.reasoning || !Array.isArray(decision.actions)) {
      throw new Error(`LLM response missing required fields: ${JSON.stringify(decision).slice(0, 200)}`)
    }

    // Filter low-confidence actions
    decision.actions = decision.actions.filter(a => (a.confidence || 0) >= 0.5)

    // Post-process for user questions: extract answer, strip alert-as-answer actions
    if (opts.userInstruction) {
      // If LLM didn't provide answer field, synthesize from reasoning
      if (!decision.answer) {
        decision.answer = decision.reasoning
      }
      // Remove alert/hold actions that are just answering the question (not real alerts)
      decision.actions = decision.actions.filter(a =>
        a.type !== 'alert' && a.type !== 'hold'
      )
    }

    // Add metadata
    decision._meta = {
      provider: this.provider.name,
      model: this.model,
      latencyMs: elapsed,
      inputTokens: response.usage?.input,
      outputTokens: response.usage?.output,
      timestamp: new Date().toISOString()
    }

    // Update conversation history
    this.history.push(
      { role: 'user', content: `[Cycle #${snapshot.cycle}] ${statePrompt.slice(0, 500)}...` },
      { role: 'assistant', content: text }
    )
    // Trim history
    if (this.history.length > this.maxHistory * 2) {
      this.history = this.history.slice(-this.maxHistory * 2)
    }

    return decision
  }

  /**
   * Quick health check — is the LLM reachable?
   */
  async healthCheck () {
    try {
      const response = await this.provider.chat({
        messages: [{ role: 'user', content: 'Reply with just: {"status":"ok"}' }],
        maxTokens: 32
      })
      return (response.text || '').includes('ok')
    } catch (e) {
      return false
    }
  }

  /**
   * Parse a natural language rule into structured conditions + actions
   * @param {string} text — e.g. "put 60% in highest APR protocol, if APR drops 5% withdraw all and send USDT to 0x..."
   * @param {object} snapshot — current agent state for context
   * @returns {object} { description, conditions, actions, oneShot }
   */
  async parseRule (text, snapshot = {}) {
    const prompt = `You are a DeFi rule parser. Convert the user's natural language instruction into a structured conditional rule for an autonomous treasury agent.

Current agent state:
- Wallet balances: ${JSON.stringify(snapshot.balances || {})}
- Aave supplied: ${JSON.stringify(snapshot.supplied || {})}
- Strategy: ${snapshot.strategy?.name || 'none'}
- Lending %: ${snapshot.lendingPct || '0'}%

Available condition types:
- apr_below: { type: "apr_below", value: <number> } — Aave APY falls below X%
- apr_drop_pct: { type: "apr_drop_pct", value: <number> } — APR dropped by X% relative to when rule was created
- balance_below: { type: "balance_below", token: "SYMBOL", value: <number> }
- balance_above: { type: "balance_above", token: "SYMBOL", value: <number> }
- price_below: { type: "price_below", token: "SYMBOL", value: <number> }
- price_above: { type: "price_above", token: "SYMBOL", value: <number> }
- price_drop_pct: { type: "price_drop_pct", token: "SYMBOL", value: <number> }
- health_factor_below: { type: "health_factor_below", value: <number> }
- lending_pct_above: { type: "lending_pct_above", value: <number> }
- lending_pct_below: { type: "lending_pct_below", value: <number> }

Available action types:
- lending_supply: { type: "lending_supply", token: "SYMBOL", amount: <number|"max"> }
- lending_withdraw: { type: "lending_withdraw", token: "SYMBOL", amount: <number|"max"> }
- swap: { type: "swap", tokenIn: "SYMBOL", tokenOut: "SYMBOL", amount: <number|"max"> }
- bridge: { type: "bridge", targetChain: "chain_name", amount: <number> }
- transfer: { type: "transfer", token: "SYMBOL", to: "0xADDRESS", amount: <number|"max"> }
- alert: { type: "alert", level: "warning|critical", reason: "message" }

Respond with JSON only:
{
  "description": "Short human-readable summary of the rule",
  "conditions": [ ... ],
  "actions": [ ... ],
  "oneShot": true/false,
  "confidence": 0.0-1.0
}

Rules:
- If the user says "if X then Y", X becomes conditions and Y becomes actions
- "withdraw all" = amount: "max"
- "send to address" = transfer action
- For allocation instructions like "put 60% of 100 USDT in lending", calculate the amount (60)
- oneShot=true if it's a one-time action, false if it should keep monitoring
- If the instruction implies ongoing monitoring (e.g. "if APR drops"), set oneShot=false
- Tokens: ETH, WETH, USDT, USDC, DAI, USDT0`

    const response = await this.provider.chat({
      messages: [
        { role: 'user', content: `${prompt}\n\nUser instruction: "${text}"\n\nRespond with JSON only.` }
      ],
      maxTokens: 1024
    })

    const parsed = extractJson(response.text || '')
    if (!parsed) throw new Error(`Failed to parse rule: ${(response.text || '').slice(0, 200)}`)

    if (!parsed.conditions || !parsed.actions) {
      throw new Error('Rule must have conditions and actions')
    }

    return parsed
  }

  /** Reset conversation history */
  resetHistory () {
    this.history = []
  }
}

/**
 * Robust JSON extraction from an LLM response.
 *
 * Handles:
 *  - pure JSON: `{...}`
 *  - fenced code: ```json\n{...}\n```
 *  - JSON inside prose: "Here is the result: {...}"
 *  - Multiple JSON candidates (returns the largest, on the assumption it's
 *    the structured payload rather than a small inline example).
 *
 * Returns parsed object or null.
 */
export function extractJson (raw) {
  if (raw == null) return null
  const text = String(raw)

  // 1. Strip code fences and try direct parse
  const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/g, '').trim()
  try { return JSON.parse(stripped) } catch {}

  // 2. Find every balanced { ... } region and try the largest first
  const candidates = []
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue
    let depth = 0, inStr = false, esc = false
    for (let j = i; j < text.length; j++) {
      const c = text[j]
      if (esc) { esc = false; continue }
      if (c === '\\') { esc = true; continue }
      if (c === '"') { inStr = !inStr; continue }
      if (inStr) continue
      if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth === 0) {
          candidates.push(text.slice(i, j + 1))
          i = j
          break
        }
      }
    }
  }
  candidates.sort((a, b) => b.length - a.length)
  for (const c of candidates) {
    try { return JSON.parse(c) } catch {}
  }
  return null
}
