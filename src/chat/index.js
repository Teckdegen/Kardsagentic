// @kard/agent — Chat Adapter Registry + Default Bridge
//
// Hooks any chat adapter (telegram | discord | slack | custom) to a Kard
// agent. Inbound messages → parsed intents → agent action; agent responses
// → adapter.send().

import { TelegramAdapter } from './telegram.js'
import { DiscordAdapter } from './discord.js'
import { SlackAdapter } from './slack.js'

export { TelegramAdapter, DiscordAdapter, SlackAdapter }

const ADAPTERS = {
  telegram: TelegramAdapter,
  discord: DiscordAdapter,
  slack: SlackAdapter
}

export function createAdapter (name, opts = {}) {
  const Cls = ADAPTERS[name]
  if (!Cls) throw new Error(`Unknown chat adapter: ${name}. Have: ${Object.keys(ADAPTERS).join(', ')}`)
  return new Cls(opts)
}

/**
 * Wire an adapter to an agent. Returns { adapter, stop }.
 *
 * @param {object} cfg
 * @param {ChatAdapter}     cfg.adapter
 * @param {TreasuryAgent}   cfg.agent
 * @param {LlmReasoning}    cfg.llm
 * @param {GoalEngine}      [cfg.goals]
 * @param {SkillRegistry}   [cfg.skills]
 * @param {boolean}         [cfg.allowExecute=false] — globally allow /execute
 */
export function bridge (cfg) {
  // allowExecute defaults to truthy KARD_ALLOW_EXECUTE so users can opt in via env
  // without remembering the CLI flag. Per-user enforcement still gates via from.isAllowed.
  const allowExecute = cfg.allowExecute ?? /^(1|true|yes)$/i.test(process.env.KARD_ALLOW_EXECUTE || '')
  const { adapter, agent, llm, goals, skills } = cfg

  adapter.on('message', async ({ from, channelId, text }) => {
    const intent = adapter.parseIntent(text)
    try {
      const reply = await handle(intent, { agent, llm, goals, skills, allowExecute, from })
      if (reply) await adapter.send(channelId, reply)
    } catch (e) {
      await adapter.send(channelId, `❌ ${e.message}`).catch(() => {})
    }
  })

  adapter.start()
  return { adapter, stop: () => adapter.stop() }
}

async function handle (intent, { agent, llm, goals, skills, allowExecute, from }) {
  switch (intent.kind) {
    case 'help':
      return [
        'Kard commands:',
        '/status — portfolio + strategy',
        '/start — begin autonomous loop',
        '/stop — pause the agent',
        '/goal <text> — set an autonomous goal',
        '/compile <text> — preview a strategy',
        '/execute <text> — run a strategy (gated)',
        '/skill list — list installed skills',
        '/earnings — PnL summary',
        '/gas — check balances on all chains',
        '/opportunities — live yield scan',
        '/reputation — on-chain reputation score',
        '/risk — show risk limits',
        '/config — show current policy',
        '/kill — emergency stop all agents',
        '/resume — resume after kill',
        '/address — show wallet address',
        '/attest — list recent attestations',
        '',
        'Or just type anything to chat with the AI agent.'
      ].join('\n')

    case 'status': {
      const s = agent.getSnapshot()
      const top = s.opportunities?.opportunities?.[0]
      return [
        `*Strategy:* ${s.strategy?.name || 'none'}  (${s.active ? 'active' : 'stopped'})`,
        `*Portfolio:* $${s.portfolio?.totalUSD?.toFixed(2) || '?'}`,
        s.passport?.enabled ? `*Passport:* ${s.passport.address}  ${s.passport.email ? '('+s.passport.email+')' : ''}` : '',
        `*Lending %:* ${s.lendingPct}`,
        s.perps?.snapshot?.account ? `*Perp equity:* $${s.perps.snapshot.account.accountValue.toFixed(2)}` : '',
        s.lucid?.yieldStates?.USDC ? `*Lucid USDC pool:* buffer ${s.lucid.yieldStates.USDC.bufferRatio?.toFixed(1)}%` : '',
        top ? `*Best opp:* ${top.source} ${top.asset} ${(top.apy*100).toFixed(2)}% on ${top.chain}` : '',
        s.attestations?.enabled ? `*Attest:* ${s.attestations.recent.length} on KiteAI` : '',
        `*Cycle:* #${s.cycle}`
      ].filter(Boolean).join('\n')
    }

    case 'start': agent.start(); return '▶ agent loop started'
    case 'stop':  agent.stop();  return '⏹ agent stopped'

    case 'kill': {
      const { pullKillSwitch } = await import('../risk/engine.js')
      pullKillSwitch()
      agent.stop()
      return 'KILL switch ON. All agents halted.'
    }

    case 'resume': {
      const { releaseKillSwitch } = await import('../risk/engine.js')
      releaseKillSwitch()
      return 'KILL switch OFF. You can /start again.'
    }

    case 'address': {
      const addr = agent.wallet?.address || 'unknown'
      return `Agent wallet: ${addr}`
    }

    case 'gas': {
      const { GasManager } = await import('../gas-manager.js')
      const gas = new GasManager(agent.chainContext || agent._chainContext)
      if (!gas.ctx) return 'Chain context not available'
      const snap = await gas.snapshotAll()
      const lines = ['Gas balances:']
      for (const [key, info] of Object.entries(snap)) {
        if (info.error) lines.push(`  ${key}: ERROR`)
        else lines.push(`  ${info.ok ? '✓' : '✗'} ${key}: ${info.balance.toFixed(6)} ${info.symbol}`)
      }
      return lines.join('\n')
    }

    case 'opportunities': {
      await agent.refresh()
      const ops = agent.lastOpportunities
      if (!ops || !ops.opportunities?.length) return 'No opportunities found'
      const lines = ['Live opportunities:']
      for (const o of ops.opportunities.slice(0, 8)) {
        const apy = o.apy ? `${(o.apy * 100).toFixed(1)}%` : '?'
        lines.push(`  ${apy} ${o.source || o.protocol || ''} ${o.asset || ''} ${o.chain || ''}`)
      }
      return lines.join('\n')
    }

    case 'reputation': {
      try {
        const { KiteReputation } = await import('../kite/reputation.js')
        const rep = new KiteReputation({ chainContext: agent.chainContext || agent._chainContext })
        const addr = agent.wallet?.address
        const score = await rep.getScore(addr)
        return `Reputation: ${score.score} (${score.tier})\nAttestations: ${score.stats.totalAttestations}\nSuccess rate: ${score.stats.successRate}`
      } catch (e) {
        return `Reputation: score 0 (newcomer) — ${e.message}`
      }
    }

    case 'risk': {
      const { getEffectiveLimits } = await import('../risk/engine.js')
      const limits = getEffectiveLimits()
      return [
        'Risk limits:',
        `  Max drawdown: ${(limits.max_daily_drawdown_pct * 100).toFixed(1)}%`,
        `  Max leverage: ${limits.max_total_leverage}x`,
        `  Hard max leverage: ${limits.hard_max_leverage}x`,
        `  Max per-market: ${(limits.max_per_market_pct * 100).toFixed(1)}%`,
        `  Max position: $${limits.hard_max_position_usd.toLocaleString()}`,
        `  Min trade: $${limits.min_trade_usd}`
      ].join('\n')
    }

    case 'config': {
      const { defaultConfig } = await import('../config.js')
      const cfg = defaultConfig()
      return cfg.describe()
    }

    case 'attest': {
      const list = agent.attestor?.list({ limit: 5 }) || []
      if (!list.length) return 'No attestations yet. Run the agent to generate them.'
      const lines = ['Recent attestations:']
      for (const a of list) {
        lines.push(`  ${a.ts?.slice(0, 16) || '?'} ${a.txHash?.slice(0, 14) || a.error || '?'}...`)
      }
      return lines.join('\n')
    }

    case 'earnings': {
      const e = agent.bookkeeper?.earnings(agent.portfolio?.totalUSD)
      if (!e) return '(no bookkeeper)'
      return [
        `*Earnings* since ${e.since?.slice(0, 16) || 'never'}`,
        `Net: $${(e.net || 0).toFixed(2)} · Realized: $${(e.realizedPnl || 0).toFixed(2)} · Expenses: $${(e.expenses || 0).toFixed(2)}`,
        `24h: $${(e.pnl24h || 0).toFixed(2)} · 7d: $${(e.pnl7d || 0).toFixed(2)} · 30d: $${(e.pnl30d || 0).toFixed(2)}`,
        `Trades closed: ${e.tradeCount}` + (e.annualisedReturn != null ? ` · APR ${(e.annualisedReturn * 100).toFixed(1)}%` : ''),
        `By source: ${Object.entries(e.pnlBySource).map(([k, v]) => `${k} $${v.toFixed(2)}`).join(' · ')}`
      ].join('\n')
    }

    case 'report': {
      const { Reporter } = await import('../agent/reporter.js')
      const r = await new Reporter({ agent, interval: '1m', mode: intent.mode || 'normal', sinks: { console: false } }).report()
      // Reuse the formatter
      const fmt = new Reporter({ agent })._format(r)
      return fmt
    }

    case 'goal': {
      if (!goals) return '⚠ goal engine not enabled'
      const g = await goals.setGoal(intent.text)
      return `🎯 goal added: _${g.text}_\nbaseline: $${g.baseline.portfolioUSD.toFixed(2)}\ntarget: ${JSON.stringify(g.target)}`
    }

    case 'skill': {
      if (!skills) return 'skills not enabled'
      const [sub, ...rest] = intent.args
      if (sub === 'list' || !sub) {
        const list = skills.list()
        if (!list.length) return '(no skills installed)'
        return 'Skills:\n' + list.map(s => `- ${s.name}: ${s.description || ''}`).join('\n')
      }
      if (sub === 'run') {
        const [name, tool, ...kvs] = rest
        const params = Object.fromEntries(kvs.map(kv => kv.split('=')))
        const out = await skills.invoke(name, tool, params)
        const txt = JSON.stringify(out, null, 2)
        return txt.length > 1500 ? txt.slice(0, 1500) + '\n...' : txt
      }
      return 'usage: /skill list  |  /skill run <name> <tool> [k=v]'
    }

    case 'compile': {
      try {
        const decision = await llm.reason(agent.getSnapshot(), { userInstruction: intent.text })
        if (!decision) return 'I could not process that. Check your API key and LLM_PROVIDER are set.'
        if (decision.answer) return decision.answer
        const acts = (decision.actions || []).map(a => `• ${a.type} ${a.symbol || a.token || ''} ${a.amount || a.size || ''} — ${a.reason || ''}`).join('\n')
        return `${decision.reasoning || 'No reasoning'}\n\nProposed:\n${acts || '(no actions)'}\n\nRun with /execute to submit.`
      } catch (e) {
        return `Could not get AI response: ${e.message?.slice(0, 200) || 'unknown error'}`
      }
    }

    case 'execute': {
      if (!allowExecute || !from?.isAllowed) return 'execute disabled (allow-list or --allow-execute)'
      try {
        const decision = await llm.reason(agent.getSnapshot(), { userInstruction: intent.text })
        if (!decision) return 'LLM returned no response.'
        const results = []
        for (const action of decision.actions || []) {
          const r = await agent.execute(action)
          results.push(`${action.type}: ${r.tx || r.error || 'ok'}`)
        }
        return 'Executed:\n' + results.map(r => '• ' + r).join('\n')
      } catch (e) {
        return `Execution failed: ${e.message?.slice(0, 200) || 'unknown error'}`
      }
    }
  }
}
