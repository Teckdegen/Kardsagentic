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
        '*Kard chat commands*',
        '`/status` — current portfolio + active strategy',
        '`/goal <text>` — add an autonomous goal',
        '`/compile <text>` — preview a strategy (no execution)',
        '`/execute <text>` — run a strategy (gated)',
        '`/skill list` — list installed skills',
        '`/start` — begin autonomous loop',
        '`/stop` — pause the agent',
        '_Just type a strategy without a slash to compile it._'
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
      if (!skills) return '⚠ skills not enabled'
      const [sub, ...rest] = intent.args
      if (sub === 'list' || !sub) {
        return '*Skills:*\n' + skills.list().map(s => `• ${s.name} — ${s.description}`).join('\n')
      }
      if (sub === 'run') {
        const [name, tool, ...kvs] = rest
        const params = Object.fromEntries(kvs.map(kv => kv.split('=')))
        const out = await skills.invoke(name, tool, params)
        return '```\n' + JSON.stringify(out, null, 2).slice(0, 1500) + '\n```'
      }
      return 'usage: /skill list  |  /skill run <name> <tool> [k=v…]'
    }

    case 'compile': {
      const decision = await llm.reason(agent.getSnapshot(), { userInstruction: intent.text })
      const acts = (decision.actions || []).map(a => `• ${a.type} ${a.symbol || a.token || ''} ${a.amount || a.size || ''} — ${a.reason}`).join('\n')
      return `🧠 ${decision.reasoning}\n\n*Proposed:*\n${acts || '(no actions)'}\n\n_Run with /execute to submit._`
    }

    case 'execute': {
      if (!allowExecute || !from?.isAllowed) return '🔒 execute disabled (allow-list or --allow-execute)'
      const decision = await llm.reason(agent.getSnapshot(), { userInstruction: intent.text })
      const results = []
      for (const action of decision.actions || []) {
        const r = await agent.execute(action)
        results.push(`${action.type}: ${r.tx || r.error || 'ok'}`)
      }
      return '✅ Executed:\n' + results.map(r => '• ' + r).join('\n')
    }
  }
}
