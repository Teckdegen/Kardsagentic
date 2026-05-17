// @kard/agent — Chat Adapter Base
//
// Shared shape for every chat platform Kard plugs into. A chat adapter
// converts inbound messages into agent intents (compile, query, set-goal,
// open-position, etc.) and pipes the agent's responses back to the channel.
//
// Implement:
//   start()                — connect to platform, begin listening
//   stop()                 — graceful shutdown
//   send(channelId, text)  — push a message back
//   on('message', handler) — emit { from, channelId, text, raw }

import { EventEmitter } from 'node:events'

export class ChatAdapter extends EventEmitter {
  constructor (cfg = {}) {
    super()
    this.name = cfg.name || 'unknown'
    this.allowList = cfg.allowList || null    // optional: only these user IDs may issue execute commands
    this._started = false
  }

  async start () { throw new Error('start() not implemented') }
  async stop () { this._started = false }
  async send (channelId, text) { throw new Error('send() not implemented') }

  /** Default text-to-intent parser — adapters can override */
  parseIntent (text) {
    const t = text.trim()
    if (/^\/(help|h)\b/i.test(t))   return { kind: 'help' }
    if (/^\/(status|s)\b/i.test(t)) return { kind: 'status' }
    if (/^\/(stop|halt)\b/i.test(t)) return { kind: 'stop' }
    if (/^\/(start|run|go)\b/i.test(t))    return { kind: 'start' }
    if (/^\/(kill)\b/i.test(t))            return { kind: 'kill' }
    if (/^\/(resume)\b/i.test(t))          return { kind: 'resume' }
    if (/^\/(address|wallet)\b/i.test(t))  return { kind: 'address' }
    if (/^\/(gas|balance|balances)\b/i.test(t)) return { kind: 'gas' }
    if (/^\/(opportunities|opp|yields)\b/i.test(t)) return { kind: 'opportunities' }
    if (/^\/(reputation|rep|score)\b/i.test(t)) return { kind: 'reputation' }
    if (/^\/(risk)\b/i.test(t))            return { kind: 'risk' }
    if (/^\/(config|policy)\b/i.test(t))   return { kind: 'config' }
    if (/^\/(attest|attestations)\b/i.test(t)) return { kind: 'attest' }
    if (/^\/(earnings|pnl)\b/i.test(t))    return { kind: 'earnings' }
    if (/^\/(report)\b/i.test(t))          return { kind: 'report', mode: t.includes('full') ? 'full' : 'normal' }
    if (/^\/(goal)\b/i.test(t))    return { kind: 'goal', text: t.replace(/^\/goal\s*/i, '') }
    if (/^\/(skill)\b/i.test(t))   return { kind: 'skill', args: t.replace(/^\/skill\s*/i, '').split(/\s+/) }
    if (/^\/(compile|ask)\b/i.test(t)) return { kind: 'compile', text: t.replace(/^\/(compile|ask)\s*/i, '') }
    if (/^\/(execute|exec|do)\b/i.test(t)) return { kind: 'execute', text: t.replace(/^\/(execute|exec|do)\s*/i, '') }
    // No prefix → treat as natural-language chat (compile)
    return { kind: 'compile', text: t }
  }
}
