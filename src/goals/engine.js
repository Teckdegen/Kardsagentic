// @kard/agent — Goal Engine
//
// The Goal Engine sits ABOVE the strategy layer. Where a Strategy is
// "this is what to do every cycle", a Goal is "this is what success looks
// like — figure out how."
//
// Examples:
//   - "raise my portfolio by 5% in 2 weeks"
//   - "trade"  (open-ended — agent discovers strategies itself)
//   - "stay above $100k portfolio value"
//   - "earn $X per day in yield"
//
// The engine runs an outer loop:
//   1. measure   → snapshot portfolio + reference baseline
//   2. assess    → are we on track for the goal?
//   3. discover  → ask the LLM (with skills) to propose candidate strategies
//   4. choose    → pick top candidate (highest expected value, risk-adjusted)
//   5. enact     → set the agent's strategy + custom rules to match
//   6. measure   → next outer tick: did the strategy move us toward the goal?
//   7. evolve    → reinforce winners, prune losers, mutate parameters
//
// State is persisted at ~/.kard/goals.json so a goal survives restarts.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { STRATEGIES } from '../agent/strategies.js'
import { extractJson } from '../agent/llm.js'

const GOAL_FILE = path.join(os.homedir(), '.kard', 'goals.json')

export class GoalEngine {
  /**
   * @param {object} cfg
   * @param {import('../agent/treasury.js').TreasuryAgent} cfg.agent
   * @param {import('../agent/llm.js').LlmReasoning} cfg.llm
   * @param {import('../skills/loader.js').SkillRegistry} [cfg.skills]
   */
  constructor (cfg) {
    this.agent = cfg.agent
    this.llm = cfg.llm
    this.skills = cfg.skills || null
    this.goals = []        // active goals
    this.history = []      // outer-loop ticks
    this.outerIntervalMs = parseInt(process.env.KARD_GOAL_INTERVAL_MS || '900000', 10) // 15 min
    this._timer = null
    this._load()
  }

  /** Add a goal — text + optional structured target */
  async setGoal (text, opts = {}) {
    const goal = {
      id: opts.id || `goal_${Date.now()}`,
      text,
      target: opts.target || null,    // e.g. { metric:'portfolioUSD', op:'>=', value: baseline*1.05 }
      deadline: opts.deadline || null,
      createdAt: new Date().toISOString(),
      baseline: null,
      tries: [],
      active: true
    }
    // Take baseline immediately
    await this.agent.refresh()
    goal.baseline = {
      portfolioUSD: this.agent.portfolio?.totalUSD || 0,
      ts: new Date().toISOString()
    }
    // Materialise target from text if not provided
    if (!goal.target) goal.target = await this._parseTarget(text, goal.baseline)
    this.goals.push(goal)
    this._save()
    // Run a discovery tick right away so the agent picks a strategy and starts moving
    await this._tick(goal)
    return goal
  }

  removeGoal (id) {
    this.goals = this.goals.filter(g => g.id !== id)
    this._save()
  }

  list () { return this.goals.map(g => ({ ...g })) }

  /** Start the outer loop — runs every outerIntervalMs */
  start () {
    if (this._timer) return
    this._timer = setInterval(() => this._runAllGoals().catch(e => console.error(e)), this.outerIntervalMs)
    // Immediate tick for responsiveness
    this._runAllGoals().catch(() => {})
  }

  stop () {
    if (this._timer) clearInterval(this._timer)
    this._timer = null
  }

  // ─────────── outer loop ───────────

  async _runAllGoals () {
    for (const goal of this.goals) {
      if (!goal.active) continue
      try { await this._tick(goal) } catch (e) {
        this.history.push({ ts: new Date().toISOString(), goalId: goal.id, error: e.message })
      }
    }
  }

  async _tick (goal) {
    await this.agent.refresh()
    const now = this.agent.portfolio?.totalUSD || 0
    const progress = this._progress(goal, now)

    // Goal met?
    if (progress.metric >= 1) {
      goal.active = false
      goal.completedAt = new Date().toISOString()
      this._save()
      return { goal, progress, action: 'completed' }
    }

    // Deadline missed?
    if (goal.deadline && Date.now() > new Date(goal.deadline).getTime()) {
      goal.active = false
      goal.expiredAt = new Date().toISOString()
      this._save()
      return { goal, progress, action: 'expired' }
    }

    // Discover + choose a strategy
    const candidates = await this._discoverCandidates(goal, progress)
    const winner = this._choose(candidates, goal)
    if (!winner) {
      this.history.push({ ts: new Date().toISOString(), goalId: goal.id, note: 'no candidate selected' })
      return { goal, progress, action: 'hold' }
    }

    // Enact: set strategy + add any custom rules
    if (winner.strategy && STRATEGIES[winner.strategy.toUpperCase()]) {
      this.agent.setStrategy(winner.strategy.toUpperCase())
    } else if (winner.strategyConfig) {
      this.agent.setStrategy(winner.strategyConfig)
    }
    for (const rule of winner.rules || []) {
      try { this.agent.addRule(rule) } catch { /* skip malformed */ }
    }

    goal.tries.push({
      ts: new Date().toISOString(),
      portfolioUSD: now,
      progress: progress.metric,
      winner
    })
    // Evolve — keep last 50 attempts only, but track outcomes
    if (goal.tries.length > 50) goal.tries = goal.tries.slice(-50)
    this._save()
    return { goal, progress, winner, action: 'enacted' }
  }

  /**
   * Compute progress toward a goal as a [0,1] metric.
   * For "raise portfolio by X%" → (now - baseline) / (target - baseline).
   */
  _progress (goal, now) {
    const t = goal.target
    if (!t) return { metric: 0, note: 'no target' }
    if (t.metric === 'portfolioUSD') {
      const span = t.value - (goal.baseline?.portfolioUSD || 0)
      const made = now - (goal.baseline?.portfolioUSD || 0)
      return { metric: span > 0 ? Math.max(0, made / span) : 0, now, target: t.value }
    }
    return { metric: 0 }
  }

  /**
   * Ask the LLM (with the full skill registry exposed) to propose candidate
   * strategies for this goal given current state. Replies should be a JSON
   * array of { strategy?, strategyConfig?, rules?, expectedAPY?, risk, rationale }.
   */
  async _discoverCandidates (goal, progress) {
    const snapshot = this.agent.getSnapshot()
    const skillsBlock = this.skills?.describeForPrompt() || ''
    const recentTries = (goal.tries || []).slice(-5)

    const prompt = [
      '# Goal-Engine Discovery',
      `Goal: "${goal.text}"`,
      `Target: ${JSON.stringify(goal.target)}`,
      `Baseline portfolio: $${goal.baseline?.portfolioUSD?.toFixed(2)}`,
      `Now: $${snapshot.portfolio?.totalUSD?.toFixed(2)}`,
      `Progress: ${(progress.metric * 100).toFixed(1)}%`,
      `Available preset strategies: ${Object.keys(STRATEGIES).join(', ')}`,
      `Lucid yield states: ${JSON.stringify(snapshot.lucid?.yieldStates || {})}`,
      `Perp markets (top funding): ${JSON.stringify(snapshot.perps?.snapshot?.fundingExtremes || {})}`,
      `Aave APYs: ${JSON.stringify(snapshot.aaveAPYs || {})}`,
      `Recent attempts: ${JSON.stringify(recentTries.map(t => ({ progress: t.progress, strategy: t.winner?.strategy })))}`,
      skillsBlock,
      '',
      'Propose 1–3 candidate strategies that move us toward the goal.',
      'Reply with a JSON object: { "candidates": [ { "strategy": "PRESET_NAME or null", "strategyConfig": {...} or null, "rules": [...], "expectedReturnPct": <number>, "risk": "low|medium|high", "rationale": "..." }, ... ] }',
      'Prefer reusing presets when possible. Use rules for opportunistic triggers (e.g. "if BTC funding > 0.5%, short ETH").',
      'Learn from recent attempts: avoid repeating losers, double down on winners with mutation.'
    ].join('\n')

    const res = await this.llm.provider.chat({
      system: 'You are the Kard Goal Engine — propose strategies that will move portfolio toward the user\'s stated goal. Reply with strict JSON only.',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2048
    })
    const obj = extractJson(res.text)
    if (!obj) {
      console.error('[goal] discovery parse failed; raw:', (res.text || '').slice(0, 200))
      return []
    }
    return obj.candidates || []
  }

  /** Pick the candidate with the best expected-return / risk score. */
  _choose (candidates, goal) {
    if (!candidates.length) return null
    const RISK = { low: 0.5, medium: 1, high: 2 }
    const scored = candidates.map(c => ({
      ...c,
      score: (c.expectedReturnPct || 0) / (RISK[c.risk] || 1)
    })).sort((a, b) => b.score - a.score)
    return scored[0]
  }

  /**
   * Ask the LLM to interpret a goal text into a structured target.
   * Defaults to "raise portfolio by 5%" if it can't parse.
   */
  async _parseTarget (text, baseline) {
    try {
      const res = await this.llm.provider.chat({
        system: 'You convert user goals into structured targets for a trading agent. Reply with strict JSON.',
        messages: [{
          role: 'user',
          content: `Goal: "${text}". Baseline portfolio USD: ${baseline.portfolioUSD}. Reply: { "metric": "portfolioUSD", "op": ">=", "value": <number>, "deadline": "<ISO8601 or null>" }`
        }],
        maxTokens: 256
      })
      const obj = extractJson(res.text)
      if (obj) return obj
    } catch { /* fall through */ }
    return { metric: 'portfolioUSD', op: '>=', value: baseline.portfolioUSD * 1.05 }
  }

  // ─────────── persistence ───────────

  _load () {
    try {
      if (fs.existsSync(GOAL_FILE)) {
        const data = JSON.parse(fs.readFileSync(GOAL_FILE, 'utf8'))
        this.goals = data.goals || []
        this.history = data.history || []
      }
    } catch { /* fresh start */ }
  }

  _save () {
    try {
      const dir = path.dirname(GOAL_FILE)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(GOAL_FILE, JSON.stringify({
        goals: this.goals,
        history: this.history.slice(-200)
      }, null, 2))
    } catch (e) {
      console.error('[goal] save failed:', e.message)
    }
  }
}
