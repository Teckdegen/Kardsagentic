// @kard/agent — Interactive REPL
//
// `kard` with no args drops you here. A line buffer where:
//   - bare text     → compile via the default LLM provider, preview actions
//   - /commands     → /status, /goal, /skill, /strategy, /help, /quit
//   - !shell        → run a shell command via the shell-exec skill
//   - <Tab>         → completes commands and known strategy/skill names
//   - <Up/Down>     → command history (persisted at ~/.kard/repl-history)

import readline from 'node:readline'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const HISTORY_FILE = path.join(os.homedir(), '.kard', 'repl-history')

export async function startRepl () {
  const { createAgent, compileStrategy } = await import('./index.js')
  const { strategyRegistry } = await import('./strategies/library.js')
  const { globalRegistry } = await import('./skills/loader.js')
  const skills = globalRegistry()
  skills.watch?.()
  const strategies = strategyRegistry()
  const provider = process.env.LLM_PROVIDER || 'anthropic'

  let agent = null
  const ensureAgent = async () => {
    if (agent) return agent
    console.error('[repl] booting agent…')
    agent = await createAgent({ provider, withGoals: false })
    return agent
  }

  // Build completion universe
  const commands = ['/help', '/status', '/quit', '/exit',
    '/goal', '/skill', '/strategy', '/opportunities', '/passport', '/run']
  const completer = (line) => {
    const all = [
      ...commands,
      ...strategies.list().map(s => '/strategy ' + s.name.toLowerCase()),
      ...skills.list().map(s => '/skill run ' + s.name)
    ]
    const hits = all.filter(c => c.startsWith(line))
    return [hits.length ? hits : all, line]
  }

  // Load history
  let history = []
  try { history = fs.readFileSync(HISTORY_FILE, 'utf8').trim().split('\n').filter(Boolean) } catch {}

  const rl = readline.createInterface({
    input: process.stdin, output: process.stdout,
    completer, history, terminal: true,
    prompt: 'kard › '
  })

  console.log('Kard interactive — type /help, or just describe a strategy. Tab completes. /quit to exit.')
  rl.prompt()

  rl.on('line', async (raw) => {
    const line = raw.trim()
    if (!line) { rl.prompt(); return }
    appendHistory(line)
    try {
      if (line === '/quit' || line === '/exit') { rl.close(); return }
      if (line === '/help') { printHelp(); rl.prompt(); return }
      if (line === '/status') {
        const a = await ensureAgent()
        const s = a.getSnapshot()
        console.log(JSON.stringify({
          strategy: s.strategy?.name, equity: s.portfolio?.totalUSD,
          passport: s.passport?.address, cycle: s.cycle,
          topOpp: s.opportunities?.opportunities?.[0]
        }, null, 2))
        rl.prompt(); return
      }
      if (line === '/opportunities') {
        const a = await ensureAgent()
        await a.refresh()
        const ops = a.lastOpportunities?.opportunities?.slice(0, 8) || []
        for (const o of ops) console.log(`  ${(o.apy * 100).toFixed(2).padStart(6)}%  ${o.source.padEnd(11)} ${o.chain.padEnd(10)} ${o.asset || ''}`)
        rl.prompt(); return
      }
      if (line.startsWith('/strategy ')) {
        const name = line.split(/\s+/)[1]
        const a = await ensureAgent()
        const s = strategies.get(name)
        if (!s) console.error('unknown strategy:', name)
        else { a.setStrategy(s); console.log(`✓ strategy → ${s.name}`) }
        rl.prompt(); return
      }
      if (line.startsWith('/goal ')) {
        const a = await ensureAgent()
        const { GoalEngine } = await import('./goals/engine.js')
        const ge = new GoalEngine({ agent: a, llm: a.llm, skills: a.skills })
        const g = await ge.setGoal(line.replace(/^\/goal\s+/, ''))
        ge.start(); a.start()
        console.log(`🎯 goal set, baseline $${g.baseline.portfolioUSD.toFixed(2)}, target ${JSON.stringify(g.target)}`)
        rl.prompt(); return
      }
      if (line.startsWith('/skill ')) {
        const [, sub, name, tool, ...rest] = line.split(/\s+/)
        if (sub === 'list' || !sub) { for (const s of skills.list()) console.log(`• ${s.name} — ${s.description || ''}`); rl.prompt(); return }
        if (sub === 'run') {
          const params = Object.fromEntries(rest.map(kv => kv.split('=')))
          console.log(JSON.stringify(await skills.invoke(name, tool, params), null, 2))
        }
        rl.prompt(); return
      }
      if (line.startsWith('!')) {
        const cmd = line.slice(1).trim()
        const r = await skills.invoke('shell-exec', 'run', { cmd }, { allowWrites: true })
        if (r.rejected) console.error('rejected:', r.reason)
        else console.log(r.stdout || ''), r.stderr && console.error(r.stderr)
        rl.prompt(); return
      }
      // Default: compile
      const decision = await compileStrategy(line, { provider })
      console.log(`\n${decision.reasoning || decision.answer || ''}`)
      for (const a of decision.actions || []) {
        console.log(`  • ${a.type} ${a.symbol || a.token || ''} ${a.amount || a.size || ''} — ${a.reason}`)
      }
    } catch (e) {
      console.error('error:', e.message)
    }
    rl.prompt()
  })

  rl.on('close', () => { console.log('\nbye'); process.exit(0) })
}

function appendHistory (line) {
  try {
    const dir = path.dirname(HISTORY_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(HISTORY_FILE, line + '\n')
  } catch {}
}

function printHelp () {
  console.log([
    '',
    '  Bare text                describe a strategy → compile + preview',
    '  /status                  current portfolio + active strategy',
    '  /opportunities           top live yield opportunities',
    '  /strategy <name>         switch active strategy preset',
    '  /goal <text>             set autonomous goal',
    '  /skill list              list installed skills',
    '  /skill run <name> <tool> [k=v…]',
    '  !<command>               run shell via shell-exec skill (gated)',
    '  /quit                    exit',
    ''
  ].join('\n'))
}
