// @kard/agent — Cross-agent coordination
//
// Up to 100 Kard agents on one device — different goals, different strategies,
// shared API credits, shared skill registry, shared wallet pool — coordinating
// so they don't fight each other in the order book and so what one learns
// becomes available to all of them.
//
// Channel: a local in-process EventEmitter for same-host fleets, plus an
// optional x402-paid relay (KARD_COORD_URL) for cross-host coordination.
// Every message is signed by the agent's operator key so receivers can
// verify origin.
//
// Message types:
//   intent       agent broadcasts an intended trade BEFORE submitting; peers
//                with overlapping interests can yield, hedge, or co-execute
//   fill         agent broadcasts a fill so peers update their world model
//   skill_share  agent publishes a new SKILL.md it authored to the shared registry
//   strategy_share strategy preset that worked for someone — others can adopt
//   experience   distilled lesson from the learner — gets folded into prompts
//   bid / ask    matched offers ("I'll pay 0.1 USDC if you stop competing on ETH")

import { EventEmitter } from 'node:events'
import { ethers } from 'ethers'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const SHARED_DIR = path.join(os.homedir(), '.kard', 'fleet')
const SHARED_LOG = path.join(SHARED_DIR, 'coord.ndjson')

// Max message payload size (64KB) to prevent memory abuse
const MAX_MESSAGE_SIZE = 64 * 1024

/** In-process bus shared across agents in the same Node runtime */
class LocalBus extends EventEmitter {}
const localBus = new LocalBus()
localBus.setMaxListeners(200) // up to 100 agents x ~2 listeners each

export class CoordinationChannel extends EventEmitter {
  /**
   * @param {object} cfg
   * @param {ethers.Wallet} cfg.signer — agent's operator key (for sign/verify)
   * @param {string} cfg.agentId
   * @param {string} [cfg.relayUrl=KARD_COORD_URL] — optional remote relay
   * @param {(msg)=>Promise<boolean>} [cfg.policy] — receiver-side accept/reject
   */
  constructor (cfg) {
    super()
    this.signer = cfg.signer
    this.agentId = cfg.agentId
    this.relayUrl = cfg.relayUrl || process.env.KARD_COORD_URL || null
    this.policy = cfg.policy || (() => true)
    this.peers = new Set()
    this._seenIds = new Set() // deduplication
    this._seenMaxSize = 10000
    this._reconnectAttempts = 0
    this._maxReconnectDelay = 60000 // 60s max backoff
    this._ws = null
    this._stopped = false

    // Ensure shared log directory exists
    this._ensureLogDir()

    this._localHandler = (msg) => this._receive(msg)
    localBus.on('msg', this._localHandler)
    if (this.relayUrl) this._connectRelay()
  }

  _ensureLogDir () {
    try {
      fs.mkdirSync(SHARED_DIR, { recursive: true })
    } catch (err) {
      // If we can't create the dir, log writes will fail gracefully
      this.emit('error', new Error(`Cannot create coord log dir: ${err.message}`))
    }
  }

  stop () {
    this._stopped = true
    localBus.off('msg', this._localHandler)
    if (this._ws) {
      try { this._ws.close() } catch {}
      this._ws = null
    }
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
  }

  /** Broadcast a typed message to local + remote peers */
  async broadcast (type, data) {
    const msg = {
      v: 1,
      id: `${this.agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      data,
      from: this.agentId,
      address: this.signer.address,
      ts: Date.now()
    }

    // Size check before signing
    const payload = JSON.stringify(msg)
    if (payload.length > MAX_MESSAGE_SIZE) {
      throw new Error(`Message too large: ${payload.length} bytes (max ${MAX_MESSAGE_SIZE})`)
    }

    msg.signature = await this.signer.signMessage(canonical(msg))

    // Async file write — don't block the event loop
    const line = JSON.stringify(msg) + '\n'
    fs.appendFile(SHARED_LOG, line, { flag: 'a' }, (err) => {
      if (err) this.emit('error', new Error(`Coord log write failed: ${err.message}`))
    })

    localBus.emit('msg', msg)

    if (this._ws && this._ws.readyState === 1) {
      try { this._ws.send(JSON.stringify(msg)) } catch (err) {
        this.emit('error', new Error(`WebSocket send failed: ${err.message}`))
      }
    }

    return msg
  }

  // Convenience emitters
  intent (action) { return this.broadcast('intent', action) }
  fill (action, result) { return this.broadcast('fill', { action, result }) }
  shareSkill (skillMd) { return this.broadcast('skill_share', { md: skillMd }) }
  shareStrategy (cfg) { return this.broadcast('strategy_share', cfg) }
  shareExperience (memo) { return this.broadcast('experience', { memo }) }
  bid (target, terms) { return this.broadcast('bid', { target, terms }) }
  ask (terms) { return this.broadcast('ask', terms) }

  async _receive (msg) {
    if (msg.from === this.agentId) return // skip own messages

    // Deduplication — skip messages we've already processed
    if (msg.id) {
      if (this._seenIds.has(msg.id)) return
      this._seenIds.add(msg.id)
      // Prevent unbounded growth of seen set
      if (this._seenIds.size > this._seenMaxSize) {
        const arr = [...this._seenIds]
        this._seenIds = new Set(arr.slice(arr.length - (this._seenMaxSize / 2)))
      }
    }

    // Verify signature
    try {
      const msgWithoutSig = { ...msg, signature: undefined }
      const recovered = ethers.verifyMessage(canonical(msgWithoutSig), msg.signature)
      if (recovered.toLowerCase() !== msg.address.toLowerCase()) {
        this.emit('error', new Error(`Signature mismatch from ${msg.from}`))
        return
      }
    } catch (err) {
      this.emit('error', new Error(`Signature verification failed: ${err.message}`))
      return
    }

    // Policy gate
    try {
      if (!(await this.policy(msg))) return
    } catch (err) {
      this.emit('error', new Error(`Policy check failed: ${err.message}`))
      return
    }

    this.peers.add(msg.from)
    this.emit('message', msg)
    this.emit(`message:${msg.type}`, msg)
  }

  _connectRelay () {
    if (this._stopped) return

    try {
      const ws = new WebSocket(this.relayUrl)
      this._ws = ws

      ws.onopen = () => {
        this._reconnectAttempts = 0 // reset backoff on successful connect
        ws.send(JSON.stringify({ subscribe: this.agentId }))
        this.emit('relay:connected')
      }

      ws.onmessage = (ev) => {
        try {
          const data = typeof ev.data === 'string' ? ev.data : ev.data.toString()
          if (data.length > MAX_MESSAGE_SIZE) return // drop oversized messages
          this._receive(JSON.parse(data))
        } catch {}
      }

      ws.onclose = () => {
        this._ws = null
        this.emit('relay:disconnected')
        this._scheduleReconnect()
      }

      ws.onerror = (err) => {
        this.emit('error', new Error(`WebSocket error: ${err.message || 'unknown'}`))
      }
    } catch (err) {
      this.emit('error', new Error(`WebSocket connect failed: ${err.message}`))
      this._scheduleReconnect()
    }
  }

  /** Exponential backoff with jitter for relay reconnection */
  _scheduleReconnect () {
    if (this._stopped) return
    this._reconnectAttempts++
    const baseDelay = Math.min(1000 * Math.pow(2, this._reconnectAttempts), this._maxReconnectDelay)
    const jitter = Math.random() * baseDelay * 0.3
    const delay = baseDelay + jitter

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null
      this._connectRelay()
    }, delay)
  }
}

/** Sort keys so signatures are stable across machines */
function canonical (obj) {
  const sorted = (o) => {
    if (Array.isArray(o)) return o.map(sorted)
    if (o && typeof o === 'object') {
      return Object.keys(o).sort().reduce((a, k) => { a[k] = sorted(o[k]); return a }, {})
    }
    return o
  }
  return JSON.stringify(sorted(obj))
}

export { localBus }
