// @kard/agent — Kite Agent Passport client
//
// Kite Passport is the user-facing identity + spending-control layer for
// Kite. It owns the *user's* USDC on KiteAI and authorizes the agent to
// spend within passkey-approved sessions (budget + duration + scope).
//
// Kard's wallet flow:
//   1. Detect `kpass` CLI in PATH.
//      → not present: instruct user to install (curl …/install.sh | bash).
//      → present:     call `kpass user me` to check signed-in state.
//   2. Not signed in: drive `kpass user signup --email <email>`.
//      User clicks the verification email, completes passkey setup in browser,
//      pastes the 8-character code back. Then `kpass user verify <code>`.
//   3. Get the Passport wallet address: `kpass user me`.
//   4. For any spend: `kpass session create --budget X --duration Yh --scope ...`,
//      user approves with passkey, then `kpass pay --session <id> --to <addr> --amount X`.
//
// We intentionally never see the user's private key — Passport holds it.
// Our own keystore (WalletManager) is for *agent-internal* operations
// (signing trade orders, gas) when running in self-hosted mode without
// Passport. With Passport on, the agent is purely a payee/spender.

import { spawn, spawnSync } from 'node:child_process'
import { EventEmitter } from 'node:events'

const INSTALL_URL = 'https://agentpassport.ai/install.sh'

export class KitePassport extends EventEmitter {
  constructor (cfg = {}) {
    super()
    this.bin = cfg.bin || process.env.KPASS_BIN || 'kpass'
    this.timeoutMs = cfg.timeoutMs || 60_000
    this._me = null
  }

  /** Is `kpass` available on PATH? */
  isInstalled () {
    try {
      const r = spawnSync(this.bin, ['--version'], { stdio: 'ignore' })
      return r.status === 0
    } catch { return false }
  }

  /** Run a kpass command, capture stdout (parsed as JSON if --json was passed). */
  async run (args, { input, parseJson = false } = {}) {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.bin, args, { stdio: input ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'] })
      let out = '', err = ''
      proc.stdout.on('data', d => { out += d })
      proc.stderr.on('data', d => { err += d })
      proc.on('error', reject)
      proc.on('close', code => {
        if (code !== 0) return reject(new Error(`kpass ${args.join(' ')} exit ${code}: ${err.trim() || out.trim()}`))
        if (parseJson) {
          try { return resolve(JSON.parse(out)) }
          catch { return resolve(out.trim()) }
        }
        resolve(out.trim())
      })
      const t = setTimeout(() => { proc.kill('SIGTERM'); reject(new Error(`kpass timeout: ${args.join(' ')}`)) }, this.timeoutMs)
      proc.on('close', () => clearTimeout(t))
      if (input) { proc.stdin.write(input); proc.stdin.end() }
    })
  }

  /** Print the install instructions (the user runs this manually — bash needed). */
  installHint () {
    return [
      '',
      '┌────────────────── Kite Agent Passport not detected ──────────────────┐',
      '│  Kard uses Passport so YOU stay in control of agent spending.        │',
      '│                                                                      │',
      `│  Install:  curl -fsSL ${INSTALL_URL} | bash                          │`,
      '│                                                                      │',
      '│  After install:                                                      │',
      '│    1. kard passport signup <your-email>                              │',
      '│    2. Click verification link, set up passkey                        │',
      '│    3. kard passport verify <8-char-code>                             │',
      '│    4. Fund: kard passport address  (send USDC on Kite)               │',
      '│                                                                      │',
      '│  Skip Passport (advanced — self-host the wallet):  kard init         │',
      '└──────────────────────────────────────────────────────────────────────┘',
      ''
    ].join('\n')
  }

  /** Whoami — returns { email, address, ... } or null if not signed in */
  async me () {
    if (this._me) return this._me
    try {
      const data = await this.run(['user', 'me', '--json'], { parseJson: true })
      this._me = typeof data === 'object' ? data : JSON.parse(data)
      return this._me
    } catch { return null }
  }

  /** Start signup flow */
  async signup (email) {
    return this.run(['user', 'signup', '--email', email])
  }

  /** Complete signup with the 8-character verification code */
  async verify (code) {
    const out = await this.run(['user', 'verify', code])
    this._me = null
    return out
  }

  /** Get the Passport wallet address (USDC lives here on KiteAI) */
  async address () {
    const me = await this.me()
    return me?.address || me?.wallet || null
  }

  /** Current balance (USDC on Kite) */
  async balance () {
    try {
      const data = await this.run(['user', 'balance', '--json'], { parseJson: true })
      return typeof data === 'object' ? data : { raw: data }
    } catch (e) {
      return { error: e.message }
    }
  }

  // ─────────── Sessions (spending controls) ───────────

  /**
   * Create a spending session. Returns { id, ... } once user approves the
   * session in their browser/dashboard with the passkey.
   *
   * @param {object} cfg
   * @param {number} cfg.budget        — max total spend (USDC)
   * @param {number} [cfg.maxPerTx]    — max per single transaction (USDC)
   * @param {string} cfg.duration      — '1h' | '24h' | '7d' | …
   * @param {string} cfg.scope         — what the agent may do, e.g. 'trade.perps,defi.yield'
   * @param {string} [cfg.description] — human-readable reason shown to user
   */
  async createSession (cfg) {
    const args = [
      'session', 'create',
      '--budget', String(cfg.budget),
      '--duration', cfg.duration
    ]
    if (cfg.maxPerTx)    args.push('--max-per-tx', String(cfg.maxPerTx))
    if (cfg.scope)       args.push('--scope', cfg.scope)
    if (cfg.description) args.push('--description', cfg.description)
    args.push('--json')
    const data = await this.run(args, { parseJson: true })
    this.emit('session:created', data)
    return data
  }

  async listSessions ({ status = 'active' } = {}) {
    const data = await this.run(['user', 'sessions', '--status', status, '--json'], { parseJson: true })
    return Array.isArray(data) ? data : (data?.sessions || [])
  }

  async revokeSession (id) {
    return this.run(['session', 'revoke', id])
  }

  // ─────────── Payments ───────────

  /**
   * Pay an x402 service URL or a Kite address from an approved session.
   * @param {object} cfg
   * @param {string} cfg.sessionId
   * @param {string} cfg.recipient — URL or 0x address
   * @param {number} cfg.amount    — USDC
   * @param {string} [cfg.memo]
   */
  async pay (cfg) {
    const args = ['pay', '--session', cfg.sessionId, '--to', cfg.recipient, '--amount', String(cfg.amount)]
    if (cfg.memo) args.push('--memo', cfg.memo)
    args.push('--json')
    const data = await this.run(args, { parseJson: true })
    this.emit('payment', { ...cfg, result: data })
    return data
  }

  /** Discover services in the Passport catalog */
  async discoverServices (query) {
    const args = ['services', 'search', '--json']
    if (query) args.push('--query', query)
    return this.run(args, { parseJson: true })
  }

  /**
   * Convenience: ensure there's a usable session for a budget.
   * If an active session has remaining ≥ minRemaining, reuse it.
   * Otherwise create a fresh one.
   */
  async ensureSession ({ budget, minRemaining = budget, duration = '1h', scope, description }) {
    const sessions = await this.listSessions({ status: 'active' })
    for (const s of sessions) {
      const remaining = (s.budget || 0) - (s.spent || 0)
      if (remaining >= minRemaining && (!scope || s.scope === scope)) return s
    }
    return this.createSession({ budget, duration, scope, description })
  }
}

export function createPassportFromEnv () {
  return new KitePassport({
    bin: process.env.KPASS_BIN,
    timeoutMs: process.env.KPASS_TIMEOUT_MS ? parseInt(process.env.KPASS_TIMEOUT_MS, 10) : undefined
  })
}
