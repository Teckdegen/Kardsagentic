// @kard/agent — Notifier
//
// Proactive outbound alerts. The agent pages YOU when something happens —
// health factor dropping, drawdown breaker tripped, big PnL move, skill
// auto-authored, kill switch flipped, juicy opp surfaced.
//
// Sinks (any combo):
//   - telegram   : reuse the running TelegramAdapter (best for instant ping)
//   - discord    : same
//   - slack      : same
//   - email      : SMTP via NOTIFY_SMTP_* env (info / warning levels only)
//   - twilio     : NOTIFY_TWILIO_* env → SMS or voice for critical alerts
//   - webhook    : NOTIFY_WEBHOOK_URL — POST JSON for custom integrations
//
// Levels: 'info' | 'warning' | 'critical'
// Routing: critical → every configured sink. warning → primary sink.
//          info → batched into digest, sent every 6h (configurable).

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const DIGEST_FILE = path.join(os.homedir(), '.kard', 'digest.ndjson')
const TWILIO_STATE_FILE = path.join(os.homedir(), '.kard', 'twilio-state.json')

export class Notifier {
  /**
   * @param {object} cfg
   * @param {object} [cfg.chats]   — { telegram: { adapter, channelId }, discord: {...}, slack: {...} }
   * @param {object} [cfg.email]   — { host, port, user, pass, from, to }
   * @param {object} [cfg.twilio]  — { sid, token, from, to, voice: false }
   * @param {string} [cfg.webhook] — generic webhook URL
   * @param {string} [cfg.digestInterval='6h']
   */
  constructor (cfg = {}) {
    this.chats = cfg.chats || {}
    this.email = cfg.email || (process.env.NOTIFY_SMTP_HOST ? smtpFromEnv() : null)
    this.twilio = cfg.twilio || (process.env.NOTIFY_TWILIO_SID ? twilioFromEnv() : null)
    this.webhook = cfg.webhook || process.env.NOTIFY_WEBHOOK_URL || null

    // Digest interval. 'live' or 0 → stream info events immediately (no digest).
    const di = cfg.digestInterval ?? process.env.NOTIFY_DIGEST_INTERVAL ?? '6h'
    this.streamingInfo = di === 'live' || di === '0' || di === 0
    this.digestIntervalMs = this.streamingInfo ? 0 : parseDuration(di)

    // Per-level streaming overrides — let users push warnings instantly to
    // every sink, or downgrade critical to a single sink, etc.
    //   NOTIFY_STREAM_LEVELS=info,warning  → both go everywhere immediately
    this.streamLevels = new Set(
      (cfg.streamLevels || process.env.NOTIFY_STREAM_LEVELS || '')
        .split(',').map(s => s.trim()).filter(Boolean)
    )

    // Twilio cost guard — daily $ cap on calls/SMS combined.
    // Defaults: $1/day. SMS ≈ $0.01, voice ≈ $0.02–$0.04/min.
    this.twilioBudgetUsd = cfg.twilioBudgetUsd ?? parseFloat(process.env.NOTIFY_TWILIO_BUDGET_USD || '1')
    this.twilioSmsCost   = parseFloat(process.env.NOTIFY_TWILIO_SMS_COST   || '0.01')
    this.twilioVoiceCost = parseFloat(process.env.NOTIFY_TWILIO_VOICE_COST || '0.04')

    // Voice ONLY for these events (default: just liquidation + drawdown).
    // Comma-separated list; '*' = every critical. Set NOTIFY_TWILIO_VOICE_EVENTS=
    // to disable voice entirely (still send SMS).
    this.twilioVoiceEvents = new Set(
      (cfg.voiceEvents || process.env.NOTIFY_TWILIO_VOICE_EVENTS ||
        'health_factor_low,drawdown_breaker,liq_defense'
      ).split(',').map(s => s.trim()).filter(Boolean)
    )

    this._digestTimer = null
    this._infoBuffer = []
    this._twilioState = this._loadTwilioState()
    if (this.digestIntervalMs) this._startDigest()
  }

  /** Register a chat-bridge sink at runtime (called after the chat adapter starts) */
  attachChat (name, adapter, channelId) {
    this.chats[name] = { adapter, channelId }
  }

  // ─────────── Public API ───────────

  async info    (event, msg, data)  { return this._send('info',     event, msg, data) }
  async warning (event, msg, data)  { return this._send('warning',  event, msg, data) }
  async critical (event, msg, data) { return this._send('critical', event, msg, data) }

  // ─────────── Convenience event helpers ───────────

  healthFactorLow (hf, threshold = 1.5) {
    const level = hf < 1.2 ? 'critical' : 'warning'
    return this._send(level, 'health_factor_low',
      `Aave health factor *${hf.toFixed(2)}* (threshold ${threshold}). ${level === 'critical' ? '⚠ LIQUIDATION RISK' : 'Add collateral or repay debt.'}`,
      { hf, threshold })
  }

  drawdownBreaker (drawdownPct, equityUSD) {
    return this.critical('drawdown_breaker',
      `🛑 Daily drawdown ${(drawdownPct * 100).toFixed(2)}% — agents halted. Equity now $${equityUSD.toFixed(2)}.`,
      { drawdownPct, equityUSD })
  }

  killSwitch (on) {
    return this.critical('kill_switch',
      on ? '🔴 KILL switch ON — agents stopped accepting actions.'
         : '🟢 KILL switch OFF — agents resumed.',
      { on })
  }

  pnlSummary ({ pnl24h, pnl7d, equity, trades }) {
    const arrow = pnl24h >= 0 ? '↑' : '↓'
    const level = Math.abs(pnl24h) > equity * 0.05 ? 'warning' : 'info'
    return this._send(level, 'pnl_summary',
      `${arrow} 24h $${pnl24h.toFixed(2)} · 7d $${pnl7d.toFixed(2)} · equity $${equity.toFixed(2)} · ${trades} trades closed`,
      { pnl24h, pnl7d, equity, trades })
  }

  newOpportunity (op) {
    if ((op.apy || 0) < 0.10) return null   // don't ping for sub-10%
    return this.warning('new_opportunity',
      `🎯 ${(op.apy * 100).toFixed(1)}% APY just opened on *${op.source}* (${op.chain}/${op.asset}). ${op.note || ''}`,
      op)
  }

  skillAuthored ({ name, by }) {
    return this.info('skill_authored',
      `🧬 Agent *${by}* just authored a new skill: *${name}*. Drop it in to use, or check ~/.kard/skills/${name}/SKILL.md`,
      { name, by })
  }

  positionStopped ({ symbol, side, entryPx, stopPx, pnl }) {
    return this.warning('position_stopped',
      `🛑 ${side.toUpperCase()} ${symbol} stopped out at $${stopPx.toFixed(2)} (entry $${entryPx.toFixed(2)}). PnL $${pnl.toFixed(2)}.`,
      { symbol, side, entryPx, stopPx, pnl })
  }

  positionTakeProfit ({ symbol, side, entryPx, tpPx, pnl }) {
    return this.info('position_tp',
      `🎯 ${side.toUpperCase()} ${symbol} TP hit at $${tpPx.toFixed(2)} (entry $${entryPx.toFixed(2)}). PnL +$${pnl.toFixed(2)}.`,
      { symbol, side, entryPx, tpPx, pnl })
  }

  liquidationDefenseTriggered (action, hf) {
    return this.critical('liq_defense',
      `⚡ Liquidation defense fired: ${action} (HF was ${hf.toFixed(2)}).`,
      { action, hf })
  }

  // ─────────── internals ───────────

  async _send (level, event, msg, data = {}) {
    const payload = {
      ts: new Date().toISOString(),
      level, event, msg, data
    }
    // Streaming override — user opted to push this level immediately
    if (this.streamLevels.has(level) || this.streamingInfo && level === 'info') {
      await this._toPrimary(payload)
      return
    }
    // info → batch into digest unless streaming
    if (level === 'info') {
      this._infoBuffer.push(payload)
      this._appendDigest(payload)
      return
    }
    // warning → primary sink (first available chat)
    if (level === 'warning') {
      await this._toPrimary(payload)
      return
    }
    // critical → everywhere
    await this._toAll(payload)
  }

  async _toPrimary (p) {
    const sink = this.chats.telegram || this.chats.discord || this.chats.slack
    if (sink) await safeSend(sink.adapter, sink.channelId, fmt(p))
    else if (this.webhook) await this._toWebhook(p)
    else console.error(`[notify:${p.level}] ${p.msg}`)
  }

  async _toAll (p) {
    const tasks = []
    for (const [, sink] of Object.entries(this.chats)) {
      tasks.push(safeSend(sink.adapter, sink.channelId, fmt(p)))
    }
    if (this.webhook) tasks.push(this._toWebhook(p))
    if (this.email) tasks.push(this._toEmail(p))
    if (this.twilio) tasks.push(this._toTwilio(p))
    await Promise.allSettled(tasks)
    // Always log critical to stderr
    console.error(`[notify:CRITICAL] ${p.event}: ${p.msg}`)
  }

  async _toWebhook (p) {
    try {
      await fetch(this.webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(p)
      })
    } catch (e) { /* swallow — never let notification failure break the agent */ }
  }

  async _toEmail (p) {
    if (!this.email) return
    // Minimal SMTP — uses nodemailer if installed, else fetches via webhook fallback
    try {
      const nm = await import('nodemailer').catch(() => null)
      if (!nm) return
      const t = nm.createTransport({
        host: this.email.host, port: this.email.port,
        secure: this.email.port === 465,
        auth: { user: this.email.user, pass: this.email.pass }
      })
      await t.sendMail({
        from: this.email.from, to: this.email.to,
        subject: `[Kard ${p.level}] ${p.event}`,
        text: `${p.msg}\n\n${JSON.stringify(p.data, null, 2)}`
      })
    } catch {}
  }

  async _toTwilio (p) {
    if (!this.twilio) return

    // Budget guard — refuse to send if today's spend exceeds cap
    this._rolloverTwilioDay()
    if (this._twilioState.spentToday >= this.twilioBudgetUsd) {
      return // silently skip; budget exhausted, but other sinks still fire
    }

    // Voice only for whitelisted events; everything else is SMS.
    // '*' wildcard means voice for every critical event.
    const wantVoice = this.twilio.voice && (
      this.twilioVoiceEvents.has('*') || this.twilioVoiceEvents.has(p.event)
    )
    const cost = wantVoice ? this.twilioVoiceCost : this.twilioSmsCost
    if (this._twilioState.spentToday + cost > this.twilioBudgetUsd) {
      // Would exceed cap — fall back to SMS if voice was requested
      if (wantVoice && this._twilioState.spentToday + this.twilioSmsCost <= this.twilioBudgetUsd) {
        return this._twilioSend(p, false, this.twilioSmsCost)
      }
      return
    }
    return this._twilioSend(p, wantVoice, cost)
  }

  async _twilioSend (p, voice, cost) {
    const auth = Buffer.from(`${this.twilio.sid}:${this.twilio.token}`).toString('base64')
    const base = `https://api.twilio.com/2010-04-01/Accounts/${this.twilio.sid}`
    const body = `[Kard] ${p.msg}`.slice(0, 1000)
    try {
      if (voice) {
        const twiml = `<Response><Say>${escapeXml(body)}</Say></Response>`
        await fetch(`${base}/Calls.json`, {
          method: 'POST',
          headers: { authorization: `Basic ${auth}`, 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ To: this.twilio.to, From: this.twilio.from, Twiml: twiml })
        })
      } else {
        await fetch(`${base}/Messages.json`, {
          method: 'POST',
          headers: { authorization: `Basic ${auth}`, 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ To: this.twilio.to, From: this.twilio.from, Body: body })
        })
      }
      this._twilioState.spentToday += cost
      this._saveTwilioState()
    } catch {}
  }

  _rolloverTwilioDay () {
    const today = new Date().toISOString().slice(0, 10)
    if (this._twilioState.day !== today) {
      this._twilioState = { day: today, spentToday: 0 }
      this._saveTwilioState()
    }
  }
  _loadTwilioState () {
    try { return JSON.parse(fs.readFileSync(TWILIO_STATE_FILE, 'utf8')) }
    catch { return { day: new Date().toISOString().slice(0, 10), spentToday: 0 } }
  }
  _saveTwilioState () {
    try {
      fs.mkdirSync(path.dirname(TWILIO_STATE_FILE), { recursive: true })
      fs.writeFileSync(TWILIO_STATE_FILE, JSON.stringify(this._twilioState))
    } catch {}
  }

  _appendDigest (p) {
    try {
      fs.mkdirSync(path.dirname(DIGEST_FILE), { recursive: true })
      fs.appendFileSync(DIGEST_FILE, JSON.stringify(p) + '\n')
    } catch {}
  }

  _startDigest () {
    this._digestTimer = setInterval(() => this._flushDigest().catch(() => {}), this.digestIntervalMs)
  }

  async _flushDigest () {
    if (!this._infoBuffer.length) return
    const buf = this._infoBuffer.splice(0)
    const lines = buf.map(p => `• [${p.event}] ${p.msg}`)
    await this._toPrimary({
      ts: new Date().toISOString(),
      level: 'info', event: 'digest',
      msg: `📋 Last ${this.digestIntervalMs / 3600_000}h:\n${lines.join('\n')}`,
      data: { count: buf.length }
    })
  }

  stop () { if (this._digestTimer) clearInterval(this._digestTimer) }
}

function smtpFromEnv () {
  return {
    host: process.env.NOTIFY_SMTP_HOST,
    port: parseInt(process.env.NOTIFY_SMTP_PORT || '587'),
    user: process.env.NOTIFY_SMTP_USER,
    pass: process.env.NOTIFY_SMTP_PASS,
    from: process.env.NOTIFY_SMTP_FROM,
    to:   process.env.NOTIFY_SMTP_TO
  }
}
function twilioFromEnv () {
  return {
    sid: process.env.NOTIFY_TWILIO_SID,
    token: process.env.NOTIFY_TWILIO_TOKEN,
    from: process.env.NOTIFY_TWILIO_FROM,
    to: process.env.NOTIFY_TWILIO_TO,
    voice: process.env.NOTIFY_TWILIO_VOICE === '1'
  }
}

function fmt (p) {
  const flag = p.level === 'critical' ? '🚨' : p.level === 'warning' ? '⚠' : 'ℹ'
  return `${flag} *${p.event}* — ${p.msg}`
}
async function safeSend (adapter, channelId, text) {
  try { await adapter.send(channelId, text) } catch {}
}
function escapeXml (s) { return s.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])) }
function parseDuration (s) {
  const m = String(s).match(/^(\d+)(ms|s|m|h)$/)
  if (!m) return null
  return parseInt(m[1]) * { ms: 1, s: 1000, m: 60_000, h: 3_600_000 }[m[2]]
}

let _global = null
export function defaultNotifier () {
  if (!_global) _global = new Notifier()
  return _global
}
