// @kard/agent — Slack Adapter (Web API + Socket Mode)
//
// Set SLACK_BOT_TOKEN (xoxb-…) and SLACK_APP_TOKEN (xapp-…) for Socket Mode.
// Optionally SLACK_ALLOW_USERS (comma-separated user IDs).
//
// Socket Mode lets you run without a public webhook — perfect for self-hosted
// agents. Get an App Token from your Slack app settings under "Socket Mode".

import { ChatAdapter } from './base.js'

export class SlackAdapter extends ChatAdapter {
  constructor (cfg = {}) {
    super({ name: 'slack', ...cfg })
    this.botToken = cfg.botToken || process.env.SLACK_BOT_TOKEN
    this.appToken = cfg.appToken || process.env.SLACK_APP_TOKEN
    if (!this.botToken || !this.appToken) {
      throw new Error('slack: SLACK_BOT_TOKEN and SLACK_APP_TOKEN required (Socket Mode)')
    }
    this.allowList = cfg.allowList || (process.env.SLACK_ALLOW_USERS
      ? process.env.SLACK_ALLOW_USERS.split(',').map(s => s.trim()) : null)
    this._ws = null
    this._self = null
  }

  async start () {
    if (this._started) return
    this._started = true
    this._self = (await this._call('auth.test', null, this.botToken))
    console.error(`[chat:slack] connected as ${this._self.user}`)
    const wsUrl = (await this._call('apps.connections.open', null, this.appToken)).url
    this._connect(wsUrl)
  }

  async stop () {
    this._started = false
    if (this._ws) this._ws.close()
  }

  async send (channelId, text) {
    return this._call('chat.postMessage', { channel: channelId, text }, this.botToken)
  }

  _connect (wsUrl) {
    const ws = new WebSocket(wsUrl)
    this._ws = ws
    ws.onmessage = (ev) => this._onWs(JSON.parse(ev.data))
    ws.onclose = () => { if (this._started) setTimeout(() => this.start(), 3000) }
    ws.onerror = (e) => console.error('[chat:slack] ws error:', e.message)
  }

  _onWs (payload) {
    const { type, payload: p, envelope_id } = payload
    if (type === 'hello') return
    if (type === 'disconnect') return
    if (envelope_id) {
      // ack
      this._ws.send(JSON.stringify({ envelope_id }))
    }
    if (type === 'events_api') {
      const ev = p.event
      if (ev.type === 'message' && !ev.bot_id && !ev.subtype) {
        const allowed = !this.allowList || this.allowList.includes(ev.user)
        let text = ev.text || ''
        text = text.replace(/<@\w+>\s*/g, '').trim() // strip mentions
        this.emit('message', {
          from: { id: ev.user, username: ev.user, isAllowed: allowed },
          channelId: ev.channel,
          text,
          raw: ev
        })
      } else if (ev.type === 'app_mention') {
        const allowed = !this.allowList || this.allowList.includes(ev.user)
        const text = (ev.text || '').replace(/<@\w+>\s*/g, '').trim()
        this.emit('message', {
          from: { id: ev.user, username: ev.user, isAllowed: allowed },
          channelId: ev.channel, text, raw: ev
        })
      }
    }
  }

  async _call (method, body, token) {
    const r = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json; charset=utf-8'
      },
      body: body ? JSON.stringify(body) : undefined
    })
    const data = await r.json()
    if (!data.ok) throw new Error(`slack ${method}: ${data.error}`)
    return data
  }
}
