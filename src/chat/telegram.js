// @kard/agent — Telegram Adapter (long-polling, no extra deps)
//
// Set TELEGRAM_BOT_TOKEN. Optionally TELEGRAM_ALLOW_USERS (comma-separated
// numeric user IDs) to restrict execute commands to known users.
//
// All commands work in DMs and groups (mention the bot for groups, or use
// the slash commands).

import { ChatAdapter } from './base.js'

export class TelegramAdapter extends ChatAdapter {
  constructor (cfg = {}) {
    super({ name: 'telegram', ...cfg })
    this.token = cfg.token || process.env.TELEGRAM_BOT_TOKEN
    if (!this.token) throw new Error('telegram: TELEGRAM_BOT_TOKEN required')
    this.allowList = cfg.allowList || (process.env.TELEGRAM_ALLOW_USERS
      ? process.env.TELEGRAM_ALLOW_USERS.split(',').map(s => Number(s.trim()))
      : null)
    this.base = `https://api.telegram.org/bot${this.token}`
    this.offset = 0
    this._poll = null
  }

  async start () {
    if (this._started) return
    this._started = true
    // Verify token
    const me = await this._call('getMe')
    this._self = me.result
    console.error(`[chat:telegram] connected as @${this._self.username}`)
    this._loop()
  }

  async stop () {
    this._started = false
    if (this._poll) clearTimeout(this._poll)
  }

  async send (chatId, text) {
    const msg = text.length > 4000 ? text.slice(0, 4000) + '\n…' : text
    try {
      return await this._call('sendMessage', {
        chat_id: chatId,
        text: msg,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      })
    } catch (e) {
      // Fallback to plain text if Markdown parsing fails
      return await this._call('sendMessage', {
        chat_id: chatId,
        text: msg,
        disable_web_page_preview: true
      })
    }
  }

  async _loop () {
    while (this._started) {
      try {
        const data = await this._call('getUpdates', {
          offset: this.offset,
          timeout: 25,
          allowed_updates: ['message']
        })
        for (const u of data.result || []) {
          this.offset = u.update_id + 1
          const m = u.message
          if (!m?.text) continue
          const allowed = !this.allowList || this.allowList.includes(m.from.id)
          this.emit('message', {
            from: { id: m.from.id, username: m.from.username, isAllowed: allowed },
            channelId: m.chat.id,
            text: m.text,
            raw: m
          })
        }
      } catch (e) {
        console.error('[chat:telegram] poll error:', e.message)
        await new Promise(r => setTimeout(r, 3000))
      }
    }
  }

  async _call (method, params = {}) {
    const url = `${this.base}/${method}`
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params)
    })
    const data = await r.json()
    if (!data.ok) throw new Error(`telegram ${method}: ${data.description}`)
    return data
  }
}
