// @kard/agent — Self-improving prompt learner
//
// After every cycle: log (state, decision, outcome). Periodically distil
// what worked / didn't into an "experience" addendum bolted onto the
// system prompt for future cycles. Genuinely self-evolving rather than
// just discovery-driven.
//
// Two modes:
//
// 1. Distillation (default, no fine-tune):
//    Every N cycles or on demand, send the LLM a summary of the last K
//    decisions + their outcomes (PnL, drawdown, time-to-close) and ask:
//    "Write a 200-word memo of patterns to remember." Save the memo as
//    `~/.kard/experience.md`. Inject it into the system prompt on the next cycle.
//
// 2. Fine-tune dataset export:
//    `kard learn export --since=30d > training.jsonl` — produces an
//    OpenAI/Anthropic-compatible JSONL of (system, user, assistant) tuples
//    where the assistant message was a *successful* decision (PnL > 0 or
//    risk-adjusted-PnL > threshold). Plug into your fine-tune pipeline.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const DIR = path.join(os.homedir(), '.kard')
const LOG_FILE = path.join(DIR, 'cycle-log.ndjson')
const MEMO_FILE = path.join(DIR, 'experience.md')

export class Learner {
  /**
   * @param {object} cfg
   * @param {import('./llm.js').LlmReasoning} cfg.llm
   * @param {number} [cfg.distilEveryNCycles=20]
   */
  constructor (cfg = {}) {
    this.llm = cfg.llm
    this.distilEveryNCycles = cfg.distilEveryNCycles ?? 20
    this._cyclesSinceDistil = 0
    this._ensureDir()
  }

  _ensureDir () {
    if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true })
  }

  /** Append a cycle entry to the rolling log */
  recordCycle (entry) {
    const row = {
      ts: entry.ts || new Date().toISOString(),
      cycle: entry.cycle,
      portfolioUSD: entry.portfolioUSD,
      strategy: entry.strategy,
      reasoning: entry.reasoning,
      actions: (entry.actions || []).map(a => ({
        type: a.type, symbol: a.symbol, token: a.token,
        amount: a.amount, size: a.size, side: a.side, leverage: a.leverage,
        confidence: a.confidence, reason: a.reason
      })),
      outcomes: entry.outcomes || []
    }
    fs.appendFileSync(LOG_FILE, JSON.stringify(row) + '\n')
    this._cyclesSinceDistil++
    if (this._cyclesSinceDistil >= this.distilEveryNCycles) {
      this.distil().catch(() => {})
      this._cyclesSinceDistil = 0
    }
  }

  /**
   * Score outcomes for the most recent cycles by diffing portfolio value.
   * Called once a cycle completes and a follow-up snapshot is taken.
   */
  scoreOutcome (cycle, beforeUSD, afterUSD, ms) {
    const pnl = afterUSD - beforeUSD
    const pnlPct = beforeUSD > 0 ? pnl / beforeUSD : 0
    return { cycle, beforeUSD, afterUSD, pnl, pnlPct, ms }
  }

  /** Read last N cycles from the log */
  readRecent (n = 50) {
    if (!fs.existsSync(LOG_FILE)) return []
    const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').slice(-n)
    return lines.map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  }

  /** Ask the LLM to write a memo of what worked + what didn't */
  async distil () {
    if (!this.llm) return null
    const recent = this.readRecent(50)
    if (recent.length < 5) return null
    const summary = recent.map(r => {
      const acts = r.actions.map(a => `${a.type}:${a.symbol || a.token || ''}`).join(',')
      const out = r.outcomes?.[0]?.pnlPct
      return `c${r.cycle} [${r.strategy}] ${acts} → pnl ${out != null ? (out * 100).toFixed(2) + '%' : '?'}`
    }).join('\n')

    const res = await this.llm.provider.chat({
      system: 'You are a trading-strategy historian for the Kard agent. Write tight, actionable lessons.',
      messages: [{
        role: 'user',
        content: [
          'Below are recent trading cycles for the Kard agent (last 50). Write a ≤200-word memo that:',
          '1) names 1–3 specific patterns that produced the best PnL,',
          '2) names 1–3 patterns that lost money,',
          '3) gives concrete adjustments for next cycle (asset, leverage, timing).',
          'Output plain markdown. No preamble.',
          '',
          summary
        ].join('\n')
      }],
      maxTokens: 600
    })
    const memo = (res.text || '').trim()
    if (memo) {
      fs.writeFileSync(MEMO_FILE, memo)
    }
    return memo
  }

  /** Read the experience memo for injection into system prompt */
  readMemo () {
    try { return fs.readFileSync(MEMO_FILE, 'utf8') } catch { return '' }
  }

  /** Export a fine-tune-ready JSONL of profitable decisions */
  exportTraining ({ minPnlPct = 0.005, since } = {}) {
    const since_ms = since ? Date.now() - parseDuration(since) : 0
    const rows = []
    for (const r of this.readRecent(10_000)) {
      if (since_ms && new Date(r.ts).getTime() < since_ms) continue
      const o = r.outcomes?.[0]
      if (!o || (o.pnlPct ?? 0) < minPnlPct) continue
      rows.push({
        messages: [
          { role: 'system', content: 'You are a kard trading agent.' },
          { role: 'user', content: r.reasoning || `Cycle ${r.cycle} state.` },
          { role: 'assistant', content: JSON.stringify({ actions: r.actions, reasoning: r.reasoning }) }
        ]
      })
    }
    return rows.map(r => JSON.stringify(r)).join('\n')
  }
}

function parseDuration (s) {
  const m = String(s).match(/^(\d+)(d|h|m)$/)
  if (!m) return 0
  return parseInt(m[1]) * { d: 86400, h: 3600, m: 60 }[m[2]] * 1000
}
