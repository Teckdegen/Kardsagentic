// @kard/agent — Fleet manager
//
// Run up to 100 Kard agents on one device. They share:
//   - the LLM provider + a token-budget pool   (agentic economy on one credit)
//   - the skill registry (any agent can author a new SKILL.md; all see it next cycle)
//   - the strategy library
//   - a fleet-wide RiskEngine (global exposure caps across ALL agents)
//   - the coordination channel (intents broadcast, conflicts resolved)
//   - the Kite attestor (each agent attests under its own address; the
//     contract indexes by agent so subgraphs can split or aggregate)
//
// Each agent has its own:
//   - Passport account (or shared, opt-in) and operator key (keystore index)
//   - goal + strategy + reasoning trail
//   - identity (ethers wallet address)
//
// Config: a YAML file. Example:
//
//   provider: anthropic
//   token_budget_per_min: 200_000
//   global_risk:
//     max_total_leverage: 5
//     max_bucket_pct: 0.6
//     max_daily_drawdown_pct: 0.10
//   agents:
//     - id: alpha
//       goal: "raise portfolio 5% in 2 weeks"
//       strategy: KITE_YIELD
//       account: 0
//     - id: omega
//       goal: "trade BTC funding rates"
//       strategy: PERPS_TRADER
//       account: 1
//       restrict_universe: [BTC, ETH]
//     # … up to 100 entries
//
// Run:  kard fleet run config.yml

import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { CoordinationChannel } from '../coordination/index.js'
import { RiskEngine } from '../risk/engine.js'
import { Learner } from './learner.js'
import { strategyRegistry } from '../strategies/library.js'
import { globalRegistry as skillRegistry } from '../skills/loader.js'
import { ChainContext } from '../chain-context.js'
import { WalletManager } from '../wallet/manager.js'
import { TreasuryAgent } from './treasury.js'
import { GoalEngine } from '../goals/engine.js'
import { createLlmFromProvider } from './llm.js'

const FLEET_DIR = path.join(os.homedir(), '.kard', 'fleet')
const FLEET_LOG = path.join(FLEET_DIR, 'fleet.ndjson')

export class Fleet extends EventEmitter {
  /**
   * @param {object} cfg
   * @param {string} cfg.provider — default LLM provider
   * @param {object} cfg.global_risk — RiskEngine limits applied across the fleet
   * @param {number} [cfg.token_budget_per_min] — across all agents
   * @param {Array<object>} cfg.agents
   */
  constructor (cfg = {}) {
    super()
    this.cfg = cfg
    this.agents = new Map()             // id → { agent, goals, channel, learner }
    // Per-provider token budgets (each provider has its own credit pool).
    // cfg.token_budget_per_min may be a number (applies to all) OR an object
    // { anthropic: 200_000, deepseek: 1_000_000, openai: 100_000, … }
    this.tokenBudgets = this._normaliseBudgets(cfg.token_budget_per_min)
    this.providerSpend = new Map()       // provider → { window: ts, spent: n }
    this.globalRisk = new RiskEngine({ limits: cfg.global_risk })
    this.skills = skillRegistry()
    this.strategies = strategyRegistry()
    this.strategies.watch(() => this.emit('strategy:reload'))
    if (!fs.existsSync(FLEET_DIR)) fs.mkdirSync(FLEET_DIR, { recursive: true })
  }

  async spawnAll () {
    const list = this.cfg.agents || []
    if (list.length > 100) throw new Error('Fleet: max 100 agents per device')
    for (const a of list) await this.spawn(a)
    this.emit('ready', { count: this.agents.size })
  }

  /**
   * Spawn one agent.
   * @param {object} spec — { id, goal?, strategy, account, restrict_universe?, allowAuthorSkills? }
   */
  async spawn (spec) {
    if (this.agents.has(spec.id)) throw new Error(`Fleet: agent ${spec.id} already exists`)

    // Per-agent operator key from keystore index
    const wm = new WalletManager()
    const acct = await wm.unlock(undefined, { interactive: false, accountIndex: spec.account ?? 0 })
    process.env.KARD_ACCOUNT = String(spec.account ?? 0)
    process.env.PRIVATE_KEY = acct.privateKey

    const agent = new TreasuryAgent()
    await agent.init()
    agent.setSkills(this.skills)
    if (spec.strategy) {
      const s = this.strategies.get(spec.strategy) || this.cfg.strategies?.[spec.strategy]
      if (s) agent.setStrategy(s)
    }

    // ── Per-agent LLM provider override ──
    // Spec can specify { provider, model, apiKey } so a fleet can mix
    // Claude / DeepSeek / OpenAI / OpenRouter / Ollama all on one device.
    // If no spec provider, fall back to the fleet-level default.
    const agentProvider = spec.provider || this.cfg.provider || process.env.LLM_PROVIDER || 'anthropic'
    if (agent.llm && (spec.provider || spec.model || spec.apiKey)) {
      try {
        agent.llm = createLlmFromProvider(agentProvider, {
          model: spec.model,
          apiKey: spec.apiKey,
          baseUrl: spec.baseUrl
        })
        agent.log('llm', `Fleet override → provider=${agentProvider} model=${agent.llm.model}`)
      } catch (e) {
        agent.log('llm', `Fleet provider override failed: ${e.message} — keeping default`)
      }
    }
    // Wrap LLM provider with PER-PROVIDER token budget enforcement.
    if (agent.llm) {
      const providerName = agent.llm.provider.name || agentProvider
      const inner = agent.llm.provider.chat.bind(agent.llm.provider)
      agent.llm.provider.chat = async (req) => {
        const need = req.maxTokens || 1024
        if (!this._spendTokens(providerName, need)) {
          throw new Error(`Fleet: ${providerName} token budget exhausted this minute (${this.tokenBudgets[providerName] || 'default'}/min)`)
        }
        return inner(req)
      }
    }

    // Coordination channel signed by this agent's operator key
    const channel = new CoordinationChannel({
      signer: agent.wallet.signer,
      agentId: spec.id,
      policy: (msg) => this._coordPolicy(spec, msg)
    })

    // Conflict resolution: if a peer just intented the same market, defer
    channel.on('message:intent', (msg) => {
      const peerSym = msg.data?.symbol || msg.data?.token
      if (!peerSym) return
      agent._peerIntents = agent._peerIntents || new Map()
      agent._peerIntents.set(peerSym, { peer: msg.from, ts: msg.ts })
    })

    // Skill sharing: any peer's published skill flows into the shared registry
    channel.on('message:skill_share', async (msg) => {
      try {
        const md = msg.data?.md
        if (!md || typeof md !== 'string') return
        const tmp = path.join(FLEET_DIR, `inbound-${Date.now()}-${msg.from}.md`)
        fs.writeFileSync(tmp, md)
        this.skills.addFromPath(tmp)
        fs.unlinkSync(tmp)
        this.emit('skill:received', { from: msg.from })
      } catch (e) { /* swallow malformed skills */ }
    })

    // Strategy sharing
    channel.on('message:strategy_share', (msg) => {
      const cfg = msg.data
      if (!cfg?.name) return
      this.strategies.saveAs(cfg.name, cfg)
      this.emit('strategy:received', { from: msg.from, name: cfg.name })
    })

    // Goals — optional per-agent
    let goals = null
    if (spec.goal) {
      goals = new GoalEngine({ agent, llm: agent.llm, skills: this.skills })
      await goals.setGoal(spec.goal)
      goals.start()
    }

    // Learner — collects experience and can author NEW skill .md files
    const learner = new FleetLearner({
      agent, llm: agent.llm, channel, skills: this.skills, fleet: this
    })

    // Wrap execute() with global risk veto
    const innerExecute = agent.execute.bind(agent)
    agent.execute = async (action, attempt = 1) => {
      const portfolioState = this._fleetPortfolioState()
      const verdict = this.globalRisk.evaluate(action, portfolioState)
      if (!verdict.ok) {
        agent.log('fleet_risk_veto', `Vetoed by global risk: ${verdict.reason}`, { action })
        return { error: verdict.reason, vetoed: true }
      }
      if (verdict.clamped) {
        Object.assign(action, verdict.clamped)
      }
      // Broadcast intent first (gives peers ~250ms to claim/yield)
      channel.intent(action)
      await new Promise(r => setTimeout(r, 250))
      const result = await innerExecute(action, attempt)
      if (result?.tx) channel.fill(action, { tx: result.tx, gasUsed: result.gasUsed })
      learner.observe(action, result)
      return result
    }

    this.agents.set(spec.id, { spec, agent, goals, channel, learner })
    this._appendLog({ type: 'spawn', id: spec.id, address: agent.wallet.address })
    this.emit('agent:spawned', { id: spec.id, address: agent.wallet.address })
    return agent
  }

  /** Stop one agent */
  stopAgent (id) {
    const a = this.agents.get(id)
    if (!a) return
    a.agent.stop()
    a.goals?.stop()
    a.channel.stop()
    a.learner.stop()
    this.agents.delete(id)
    this._appendLog({ type: 'stop', id })
  }

  stopAll () {
    for (const id of [...this.agents.keys()]) this.stopAgent(id)
    this.strategies.unwatch()
  }

  /** Start every agent's autonomous loop */
  startAll (intervalMs = 60_000) {
    for (const { agent } of this.agents.values()) agent.start(intervalMs)
    this.emit('started', { count: this.agents.size })
  }

  /** Aggregate state across all agents */
  state () {
    const agents = []
    let totalEquity = 0
    for (const [id, { agent, spec }] of this.agents) {
      const s = agent.getSnapshot()
      const eq = s.portfolio?.totalUSD || 0
      totalEquity += eq
      agents.push({
        id, address: s.address, strategy: s.strategy?.name,
        cycle: s.cycle, equity: eq,
        provider: agent.llm?.provider?.name || null,
        model: agent.llm?.model || null,
        restrictUniverse: spec.restrict_universe || null
      })
    }
    const tokenSpend = {}
    for (const [provider, pool] of this.providerSpend) {
      tokenSpend[provider] = {
        spentThisMin: pool.spent,
        cap: this.tokenBudgets[provider] ?? this.tokenBudgets.__default,
        windowAge: Date.now() - pool.window
      }
    }
    return {
      count: this.agents.size,
      totalEquity,
      tokenBudgets: this.tokenBudgets,
      tokenSpend,
      globalRisk: this.globalRisk.state(totalEquity),
      agents
    }
  }

  // ─── internals ───

  _normaliseBudgets (raw) {
    const DEFAULT = 200_000
    if (raw == null) return { __default: DEFAULT }
    if (typeof raw === 'number') return { __default: raw }
    return { __default: raw.default ?? DEFAULT, ...raw }
  }

  _spendTokens (providerName, n) {
    const cap = this.tokenBudgets[providerName] ?? this.tokenBudgets.__default
    let pool = this.providerSpend.get(providerName)
    const now = Date.now()
    if (!pool || now - pool.window > 60_000) {
      pool = { window: now, spent: 0 }
      this.providerSpend.set(providerName, pool)
    }
    if (pool.spent + n > cap) return false
    pool.spent += n
    return true
  }

  _fleetPortfolioState () {
    let equity = 0
    const positions = {}
    for (const { agent } of this.agents.values()) {
      equity += agent.portfolio?.totalUSD || 0
      const perpPositions = agent.perpsSnapshot?.positions || []
      for (const p of perpPositions) {
        positions[p.symbol] = (positions[p.symbol] || 0) + Math.abs(p.positionValue || 0)
      }
    }
    this.globalRisk.recordEquity(equity)
    return { equityUSD: equity, positions, priceFor: () => 0 }
  }

  _coordPolicy (spec, msg) {
    // Reject messages targeting markets outside this agent's universe
    if (spec.restrict_universe && msg.data?.symbol &&
        !spec.restrict_universe.includes(msg.data.symbol)) {
      return false
    }
    return true
  }

  _appendLog (row) {
    try {
      fs.appendFileSync(FLEET_LOG, JSON.stringify({ ts: new Date().toISOString(), ...row }) + '\n')
    } catch {}
  }
}

/**
 * Fleet-aware Learner — same as the per-agent Learner plus the ability to
 * author NEW SKILL.md files when it spots a recurring profitable pattern.
 *
 * Trigger: every 50 cycles, or on demand. The learner asks the LLM:
 *   "Of the last 200 cycles, what's a reusable capability the agent
 *    repeatedly invoked? Author a SKILL.md (frontmatter + body)."
 * Result is dropped into ~/.kard/skills/ so all fleet agents see it.
 */
class FleetLearner extends Learner {
  constructor (cfg) {
    super(cfg)
    this.channel = cfg.channel
    this.fleet = cfg.fleet
    this.cyclesSinceAuthor = 0
    this.authorEveryNCycles = 50
  }

  observe (action, result) {
    this.recordCycle({
      cycle: Date.now(),
      strategy: action.strategy,
      reasoning: action.reason,
      actions: [action],
      outcomes: [{ ok: !result?.error, pnl: 0 }]
    })
    this.cyclesSinceAuthor++
    if (this.cyclesSinceAuthor >= this.authorEveryNCycles) {
      this.cyclesSinceAuthor = 0
      this.authorSkill().catch(() => {})
    }
  }

  /**
   * Self-evolution: scan recent successful patterns, ask LLM to write a
   * SKILL.md that captures the capability for reuse, drop it into the
   * shared registry, and broadcast to peers.
   */
  async authorSkill () {
    const recent = this.readRecent(200)
    if (recent.length < 30) return null
    const profitable = recent.filter(r => (r.outcomes?.[0]?.pnlPct ?? 0) > 0)
    if (profitable.length < 10) return null
    const sample = profitable.slice(-15).map(r => ({
      actions: r.actions, pnl: r.outcomes?.[0]?.pnlPct
    }))
    const res = await this.llm.provider.chat({
      system: 'You author new Kard skill .md files. Output ONLY a complete skill markdown with YAML frontmatter — no preamble, no fences.',
      messages: [{
        role: 'user',
        content: [
          'Below are 15 recent profitable cycles for a Kard trading agent.',
          'Look for a recurring decision pattern. If you find one, author a',
          'SKILL.md that captures it as a reusable capability. The skill should',
          'have triggers (when to use), tools (HTTP endpoints or `kind: js` scripts),',
          'and a body explaining the heuristic. If no clear reusable pattern',
          'emerges, output exactly: NO_SKILL.',
          '',
          JSON.stringify(sample, null, 2)
        ].join('\n')
      }],
      maxTokens: 1500
    })
    const md = (res.text || '').trim()
    if (!md || md === 'NO_SKILL' || !md.startsWith('---')) return null

    // Save + share
    const tmp = path.join(FLEET_DIR, `authored-${Date.now()}.md`)
    fs.writeFileSync(tmp, md)
    try {
      const skill = this.skills.addFromPath(tmp)
      this.channel?.shareSkill(md)
      this.fleet?.emit('skill:authored', { name: skill.name, by: this.channel?.agentId })
      fs.unlinkSync(tmp)
      return skill
    } catch {
      // malformed — keep the file for inspection
      return null
    }
  }

  stop () { /* nothing to clean up — log is append-only */ }
}

/** Tiny YAML loader for fleet config files (no external dep needed for the subset we use) */
export function loadFleetConfig (filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  // Try real yaml package if installed
  try {
    const yaml = (typeof require === 'undefined') ? null : require('yaml')
    if (yaml?.parse) return yaml.parse(raw)
  } catch {}
  // Fallback: very small subset (agents list + flat top-level keys + nested global_risk)
  return parseTinyYaml(raw)
}

function parseTinyYaml (src) {
  const out = { agents: [] }
  const lines = src.split(/\r?\n/).filter(l => !l.startsWith('#') && l.trim())
  let mode = 'top', cur = null, sub = null
  for (const line of lines) {
    const indent = line.match(/^\s*/)[0].length
    const t = line.trim()
    if (t === 'agents:') { mode = 'agents'; continue }
    if (t === 'global_risk:') { mode = 'globalRisk'; out.global_risk = {}; continue }
    if (mode === 'agents' && t.startsWith('- ')) {
      cur = {}; out.agents.push(cur)
      const kv = t.slice(2).match(/^([^:]+):\s*(.*)$/)
      if (kv) cur[kv[1].trim()] = coerce(kv[2])
      continue
    }
    if (mode === 'agents' && cur && indent >= 2) {
      const kv = t.match(/^([^:]+):\s*(.*)$/)
      if (kv) cur[kv[1].trim()] = coerceList(kv[2])
      continue
    }
    if (mode === 'globalRisk') {
      const kv = t.match(/^([^:]+):\s*(.*)$/)
      if (kv) out.global_risk[kv[1].trim()] = coerce(kv[2])
      continue
    }
    const kv = t.match(/^([^:]+):\s*(.*)$/)
    if (kv) out[kv[1].trim()] = coerce(kv[2])
  }
  return out
}
function coerce (v) {
  const s = (v || '').trim()
  if (s === 'true') return true; if (s === 'false') return false
  if (/^-?\d+$/.test(s)) return parseInt(s)
  if (/^-?\d*\.\d+$/.test(s)) return parseFloat(s)
  return s.replace(/^['"]|['"]$/g, '')
}
function coerceList (v) {
  const s = v.trim()
  if (s.startsWith('[')) return s.slice(1, -1).split(',').map(x => coerce(x.trim()))
  return coerce(s)
}
