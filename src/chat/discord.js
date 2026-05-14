// @kard/agent — Discord Adapter
//
// Uses Discord's gateway via raw WebSocket — no extra runtime dependencies
// beyond Node's built-in `ws` (Node 22+ ships native WebSocket).
//
// Set DISCORD_BOT_TOKEN. Optionally DISCORD_ALLOW_USERS (comma-separated).
//
// This adapter handles two intents:
//   - direct messages (DMs) → channelId is the DM channel
//   - mentions in guild channels → respond when bot is @mentioned
//
// For richer features (slash commands, buttons), wrap `discord.js` and
// emit { from, channelId, text } the same way.

import { ChatAdapter } from './base.js'

const GATEWAY_URL = 'wss://gateway.discord.gg/?v=10&encoding=json'
const API = 'https://discord.com/api/v10'

export class DiscordAdapter extends ChatAdapter {
  constructor (cfg = {}) {
    super({ name: 'discord', ...cfg })
    this.token = cfg.token || process.env.DISCORD_BOT_TOKEN
    if (!this.token) throw new Error('discord: DISCORD_BOT_TOKEN required')
    this.allowList = cfg.allowList || (process.env.DISCORD_ALLOW_USERS
      ? process.env.DISCORD_ALLOW_USERS.split(',').map(s => s.trim())
      : null)
    this.intents = cfg.intents ?? (1 << 9 | 1 << 12 | 1 << 15) // GUILD_MESSAGES | DIRECT_MESSAGES | MESSAGE_CONTENT
    this._ws = null
    this._heart = null
    this._seq = null
    this._self = null
  }

  async start () {
    if (this._started) return
    this._started = true
    this._connect()
  }

  async stop () {
    this._started = false
    if (this._heart) clearInterval(this._heart)
    if (this._ws) this._ws.close()
  }

  async send (channelId, text) {
    const r = await fetch(`${API}/channels/${channelId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bot ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ content: text.length > 1900 ? text.slice(0, 1900) + '\n…' : text })
    })
    if (!r.ok) throw new Error(`discord send ${r.status}: ${await r.text()}`)
    return r.json()
  }

  _connect () {
    const ws = new WebSocket(GATEWAY_URL)
    this._ws = ws
    ws.onmessage = (ev) => this._onMessage(JSON.parse(ev.data))
    ws.onclose = () => { if (this._started) setTimeout(() => this._connect(), 3000) }
    ws.onerror = (e) => console.error('[chat:discord] ws error:', e.message)
  }

  _onMessage (payload) {
    const { op, d, s, t } = payload
    if (s != null) this._seq = s

    if (op === 10) {
      // Hello — start heartbeat + identify
      const interval = d.heartbeat_interval
      this._heart = setInterval(() => this._ws.send(JSON.stringify({ op: 1, d: this._seq })), interval)
      this._ws.send(JSON.stringify({
        op: 2,
        d: {
          token: this.token,
          intents: this.intents,
          properties: { os: 'linux', browser: 'kard', device: 'kard' }
        }
      }))
    } else if (op === 0 && t === 'READY') {
      this._self = d.user
      console.error(`[chat:discord] connected as ${this._self.username}#${this._self.discriminator}`)
    } else if (op === 0 && t === 'MESSAGE_CREATE') {
      this._onChat(d)
    }
  }

  _onChat (m) {
    if (m.author?.bot) return
    // In guilds, only respond when mentioned
    const isDM = !m.guild_id
    const isMention = (m.mentions || []).some(u => u.id === this._self?.id)
    if (!isDM && !isMention) return
    let text = m.content
    if (isMention) text = text.replace(new RegExp(`<@!?${this._self.id}>`, 'g'), '').trim()
    const allowed = !this.allowList || this.allowList.includes(m.author.id)
    this.emit('message', {
      from: { id: m.author.id, username: m.author.username, isAllowed: allowed },
      channelId: m.channel_id,
      text,
      raw: m
    })
  }
}
