#!/usr/bin/env node
// @kard/agent — CLI entry
//
// Forms:
//   npx @kard/agent <provider> "<strategy>"     compile (dry-run by default)
//   npx @kard/agent run [--strategy ...]        autonomous loop
//   npx @kard/agent goal "<text>"               self-evolving goal mode
//   npx @kard/agent chat <telegram|discord|slack>   chat-bot front-end
//   npx @kard/agent skill <list|add|remove|run> ...
//   npx @kard/agent pay-stream <recipient> --pct 0.10 --basis revenue --interval 1s
//   npx @kard/agent init                        first-run wallet setup
//   npx @kard/agent wallet <list|add|import|address>
//   npx @kard/agent gas | verify-lucid | serve | mcp | help

import 'dotenv/config'

// Load saved config from ~/.kard/env.json (created by kard init)
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
const _envPath = path.join(os.homedir(), '.kard', 'env.json')
if (fs.existsSync(_envPath)) {
  try {
    const saved = JSON.parse(fs.readFileSync(_envPath, 'utf8'))
    for (const [k, v] of Object.entries(saved)) {
      if (!process.env[k]) process.env[k] = v  // env vars take priority over saved config
    }
  } catch { /* ignore parse errors */ }
}

const args = process.argv.slice(2)

function parseFlags (rest) {
  const flags = {}
  const positional = []
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = rest[i + 1]
      if (!next || next.startsWith('--')) flags[key] = true
      else { flags[key] = next; i++ }
    } else positional.push(a)
  }
  return { flags, positional }
}

function help () {
  console.log(`
@kard/agent — text-to-onchain trading infrastructure for Kite

GETTING STARTED (Passport flow — recommended)
  curl -fsSL https://agentpassport.ai/install.sh | bash    # install Kite Passport
  npx @kard/agent passport signup <email>                  # create Passport account
  npx @kard/agent passport verify <8-char-code>            # complete with passkey
  npx @kard/agent passport address                         # get your Kite USDC address
  npx @kard/agent claude "long ETH 3x if RSI < 30"

INTERACT
  npx @kard/agent                           interactive REPL (default)
  npx @kard/agent <provider> "<strategy>"   compile + (dry-run) execute
  npx @kard/agent run [--strategy NAME]     autonomous loop  (--strict for ABI verify)
  npx @kard/agent goal "<text>"             self-evolving goal mode
  npx @kard/agent backtest <prov> "<text>"  replay against history
  npx @kard/agent simulate '{tx}' --chain X eth_call pre-flight a tx
  npx @kard/agent kill <on|off>             global circuit breaker
  npx @kard/agent fleet run config.yml      multi-agent (up to 100)
  npx @kard/agent strategy <list|install|publish|search|save>
  npx @kard/agent repl                      interactive REPL (explicit)
  npx @kard/agent daemon                    long-running: agent + chat + reporter (servers)

POLICY (chains / venues / actions / assets — hard allow/deny)
  kard config show
  kard config deny actions perps_open perps_close    don't trade perps
  kard config deny chains avalanche celo             skip these chains entirely
  kard config allow chains kiteai arbitrum           ONLY these chains
  kard config deny venues hyperliquid                broader: kill that venue
  kard config undeny chains avalanche                remove from deny list
  kard config reset                                  back to defaults
  kard config venues                                 list available venue names
  kard config actions                                list available action names

CHAT FRONT-ENDS
  npx @kard/agent chat telegram             needs TELEGRAM_BOT_TOKEN
  npx @kard/agent chat discord              needs DISCORD_BOT_TOKEN
  npx @kard/agent chat slack                needs SLACK_BOT_TOKEN + SLACK_APP_TOKEN

SKILLS (.md capabilities)
  npx @kard/agent skill list
  npx @kard/agent skill add ./my-skill.md
  npx @kard/agent skill remove <name>
  npx @kard/agent skill run <name> <tool> [k=v ...]

WALLET
  npx @kard/agent init                      first-run setup (keystore + password)
  npx @kard/agent wallet list
  npx @kard/agent wallet address
  npx @kard/agent wallet import <pk> [--label=foo]
  npx @kard/agent wallet add [--label=foo]

x402 PAYMENT STREAMS
  npx @kard/agent pay-stream <recipient> --fixed 0.001 --interval 1s
  npx @kard/agent pay-stream <recipient> --pct 0.10 --basis revenue --interval 1s --cap-day 1000

PASSPORT (Kite Agent Passport)
  npx @kard/agent passport status            who am I, balance, sessions
  npx @kard/agent passport signup <email>
  npx @kard/agent passport verify <code>
  npx @kard/agent passport address
  npx @kard/agent passport sessions
  npx @kard/agent passport pay <recipient> <amount> [--session ID]

TAXES / TREASURY / SELF-FUNDING
  kard taxes summary --year 2025
  kard taxes export --year 2025 --format 8949 --out taxes.csv
  kard taxes export --format koinly --method fifo --out koinly.csv
  kard treasury show                   show ~/.kard/treasury.yml policy
  kard treasury check                  one-shot drift check
  kard self-fund show
  kard self-fund on                    enable agent self-funding from profits
  kard self-fund off

EARNINGS / REPORTS
  npx @kard/agent earnings                  total PnL, by source, by symbol
  npx @kard/agent pnl --since 24h           shorthand for earnings
  npx @kard/agent report                    one-shot snapshot
  npx @kard/agent report --loop 5m          looped report (5m intervals)
  npx @kard/agent report --loop 3s --mode fast    HUD-style 3s tick
  npx @kard/agent report --loop 1m --webhook https://... POST each report

KITE ATTESTATION
  npx @kard/agent attest list                last 20 attestations
  npx @kard/agent attest verify <txHash>     decode an on-chain attestation

REPUTATION (on-chain trust score from attestation history)
  npx @kard/agent reputation                 your agent's reputation score
  npx @kard/agent reputation show <addr>     check any agent's score
  npx @kard/agent reputation leaderboard <addr1> <addr2> ...

STRATEGY MARKETPLACE (with attestation proofs)
  npx @kard/agent strategy list              all installed strategies
  npx @kard/agent strategy publish <name> --attest   publish with on-chain proof
  npx @kard/agent strategy verify <name>     verify attestation proof on Kite
  npx @kard/agent strategy browse [query]    browse proven strategies
  npx @kard/agent strategy install <ref>     install from marketplace
  npx @kard/agent strategy search <query>    search registry

DEMO (end-to-end showcase for judges)
  npx @kard/agent demo                       full demo in ~30 seconds
  npx @kard/agent demo --execute             demo with real testnet execution
  npx @kard/agent demo --provider deepseek   use a specific LLM

YIELD
  npx @kard/agent opportunities              live ranked yield (Aave / Lucid / DeFiLlama / funding)

INFRA
  npx @kard/agent mcp                       stdio MCP server (Claude / Cursor)
  npx @kard/agent gas                       native balances across chains
  npx @kard/agent verify-lucid USDC         ABI sanity check

PROVIDERS
  claude | anthropic   ANTHROPIC_API_KEY
  gpt    | openai      OPENAI_API_KEY
  openrouter           OPENROUTER_API_KEY
  ollama | local       OLLAMA_BASE (default 127.0.0.1:11434)

ENV (key ones)
  PRIVATE_KEY  WDK_SEED  KARD_PASSWORD  KARD_ACCOUNT
  KITE_RPC_URL  ARB_RPC_URL  KITEAI_LZ_EID
  HYPERLIQUID_API_WALLET  HYPERLIQUID_USER_ADDRESS  HYPERLIQUID_NETWORK
  TELEGRAM_BOT_TOKEN  DISCORD_BOT_TOKEN  SLACK_BOT_TOKEN  SLACK_APP_TOKEN
  KARD_SKILLS_DIR
`)
}

// ─────────── compile (provider form) ───────────

async function cmdCompile (provider, prompt, flags) {
  const { compileStrategy, createAgent } = await import('../index.js')
  if (!prompt) { console.error('Missing prompt.'); process.exit(2) }
  console.error(`[kard] compiling via ${provider}…`)
  const decision = await compileStrategy(prompt, { provider })

  if (flags.json) {
    console.log(JSON.stringify(decision, null, 2))
  } else {
    console.log(`\n→ Reasoning: ${decision.reasoning}`)
    if (decision.market_assessment) console.log(`→ Market: ${decision.market_assessment}`)
    if (decision.risk_level) console.log(`→ Risk:   ${decision.risk_level}`)
    console.log(`→ Actions (${decision.actions?.length || 0}):`)
    for (const a of decision.actions || []) {
      const meta = [a.symbol || a.token, a.side, a.amount || a.size, a.leverage && `${a.leverage}x`].filter(Boolean).join(' ')
      console.log(`   • [${a.type}] ${meta} — ${a.reason} (conf ${a.confidence ?? '?'})`)
    }
  }

  if (!flags.execute) { console.error('\n[kard] dry-run — pass --execute to submit'); return }
  console.error('\n[kard] EXECUTE — wiring agent…')
  const agent = await createAgent({ provider, strategy: flags.strategy || 'KITE_YIELD' })
  for (const action of decision.actions || []) {
    console.error(`\n[kard] executing ${action.type}…`)
    console.log(JSON.stringify(await agent.execute(action), null, 2))
  }
}

// ─────────── run / goal ───────────

async function cmdRun (flags) {
  const { createAgent } = await import('../index.js')
  if (flags.strict) process.env.KARD_STRICT = '1'
  const provider = flags.provider || process.env.LLM_PROVIDER || 'anthropic'
  const agent = await createAgent({ provider, strategy: flags.strategy || 'KITE_YIELD' })
  const intervalMs = parseInterval(flags.interval || '60s') ?? 60_000
  console.error(`[kard] starting agent loop — strategy=${agent.strategy?.name} interval=${intervalMs / 1000}s`)
  agent.start(intervalMs)
  process.on('SIGINT', () => { agent.stop(); process.exit(0) })
}

async function cmdGoal (text, flags) {
  if (!text) { console.error('Missing goal text. Example: kard goal "raise portfolio 5% in 2 weeks"'); process.exit(2) }
  const { createAgent } = await import('../index.js')
  const { GoalEngine } = await import('../goals/engine.js')
  const provider = flags.provider || process.env.LLM_PROVIDER || 'anthropic'
  const agent = await createAgent({ provider, strategy: flags.strategy || 'KITE_YIELD' })
  const goals = new GoalEngine({ agent, llm: agent.llm, skills: agent.skills })
  const g = await goals.setGoal(text)
  console.error(`[kard] goal "${g.text}" set. baseline $${g.baseline.portfolioUSD.toFixed(2)}, target ${JSON.stringify(g.target)}`)
  goals.start()
  agent.start(parseInterval(flags.interval || '60s') ?? 60_000)
  process.on('SIGINT', () => { goals.stop(); agent.stop(); process.exit(0) })
}

// ─────────── chat ───────────

async function cmdChat (platform, flags) {
  if (!platform) { console.error('Missing platform: telegram|discord|slack'); process.exit(2) }
  const { createAgent } = await import('../index.js')
  const { createAdapter, bridge } = await import('../chat/index.js')
  const { GoalEngine } = await import('../goals/engine.js')
  const provider = flags.provider || process.env.LLM_PROVIDER || 'anthropic'
  const agent = await createAgent({ provider, strategy: flags.strategy || 'KITE_YIELD' })
  const goals = new GoalEngine({ agent, llm: agent.llm, skills: agent.skills })
  goals.start()
  const adapter = createAdapter(platform)
  bridge({ adapter, agent, llm: agent.llm, goals, skills: agent.skills, allowExecute: !!flags['allow-execute'] })
  console.error(`[kard] chat:${platform} bridged to agent. /help in your channel.`)
  process.on('SIGINT', () => { adapter.stop(); agent.stop(); process.exit(0) })
}

// ─────────── skills ───────────

async function cmdSkill (sub, rest, flags) {
  const { globalRegistry } = await import('../skills/loader.js')
  const reg = globalRegistry()
  switch (sub) {
    case 'list': case undefined: {
      const list = reg.list()
      if (!list.length) { console.log('(no skills installed)'); return }
      for (const s of list) console.log(`• ${s.name.padEnd(28)} ${s.description || ''}`)
      return
    }
    case 'add': {
      const path = rest[0]
      if (!path) { console.error('usage: kard skill add <path-to-SKILL.md>'); process.exit(2) }
      const s = reg.addFromPath(path)
      console.log(`✓ added: ${s.name}`)
      return
    }
    case 'remove': {
      const name = rest[0]
      if (!name) { console.error('usage: kard skill remove <name>'); process.exit(2) }
      reg.remove(name); console.log(`✓ removed: ${name}`); return
    }
    case 'run': {
      const [name, tool, ...kvs] = rest
      const params = Object.fromEntries(kvs.map(kv => kv.split('=')))
      const out = await reg.invoke(name, tool, params, { allowWrites: !!flags.write })
      console.log(JSON.stringify(out, null, 2))
      return
    }
    default:
      console.error('usage: kard skill <list|add|remove|run> ...'); process.exit(2)
  }
}

// ─────────── wallet ───────────

async function cmdInit () {
  const { WalletManager } = await import('../wallet/manager.js')
  const readline = await import('node:readline')
  const fs = await import('node:fs')
  const path = await import('node:path')
  const os = await import('node:os')

  const wm = new WalletManager()
  if (wm.exists()) {
    console.error('[kard] wallet keystore already exists. Use `kard wallet list` to view.')
    return
  }

  // Interactive setup wizard
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ask = (q) => new Promise(resolve => rl.question(q, resolve))

  console.log('')
  console.log('  ┌─────────────────────────────────────┐')
  console.log('  │        KARD — First Time Setup       │')
  console.log('  └─────────────────────────────────────┘')
  console.log('')

  // 1. Network selection
  console.log('  Which network do you want to use?')
  console.log('    1) Testnet (recommended for first time)')
  console.log('    2) Mainnet (real funds)')
  console.log('')
  const netChoice = await ask('  Select [1/2]: ')
  const isMainnet = netChoice.trim() === '2'
  process.env.KARD_ENV = isMainnet ? 'mainnet' : 'testnet'

  // Save network preference
  const kardDir = path.join(os.homedir(), '.kard')
  if (!fs.existsSync(kardDir)) fs.mkdirSync(kardDir, { recursive: true })
  const configPath = path.join(kardDir, 'env.json')
  const envConfig = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {}
  envConfig.KARD_ENV = isMainnet ? 'mainnet' : 'testnet'

  console.log(`\n  ✓ Network: ${isMainnet ? 'Mainnet' : 'Testnet'}`)

  // 2. Password
  console.log('')
  console.log('  Set a password to encrypt your wallet.')
  console.log('  (You will need this every time you start the agent)')
  console.log('')
  const password = await ask('  Password: ')
  if (!password || password.trim().length < 4) {
    console.error('  ✗ Password must be at least 4 characters.')
    rl.close()
    process.exit(1)
  }

  // 3. LLM provider (optional)
  console.log('')
  console.log('  Which AI provider do you want to use?')
  console.log('    1) Groq (free, fast — recommended)')
  console.log('    2) Anthropic (Claude)')
  console.log('    3) DeepSeek (cheap)')
  console.log('    4) Gemini (Google)')
  console.log('    5) OpenAI (GPT)')
  console.log('    6) Ollama (local, free)')
  console.log('    7) Skip for now')
  console.log('')
  const llmChoice = await ask('  Select [1-7]: ')
  const llmMap = { '1': 'groq', '2': 'anthropic', '3': 'deepseek', '4': 'gemini', '5': 'openai', '6': 'ollama' }
  const provider = llmMap[llmChoice.trim()]

  if (provider && provider !== 'ollama') {
    const keyNames = { groq: 'GROQ_API_KEY', anthropic: 'ANTHROPIC_API_KEY', deepseek: 'DEEPSEEK_API_KEY', gemini: 'GEMINI_API_KEY', openai: 'OPENAI_API_KEY' }
    const keyName = keyNames[provider]
    console.log(`\n  Enter your ${keyName}:`)
    const apiKey = await ask('  API Key: ')
    if (apiKey.trim()) {
      envConfig.LLM_PROVIDER = provider
      envConfig[keyName] = apiKey.trim()
      console.log(`  ✓ ${provider} configured`)
    }
  } else if (provider === 'ollama') {
    envConfig.LLM_PROVIDER = 'ollama'
    console.log('  ✓ Ollama configured (make sure it is running locally)')
  }

  // Save env config
  fs.writeFileSync(configPath, JSON.stringify(envConfig, null, 2))
  console.log(`\n  ✓ Config saved to ~/.kard/env.json`)

  // 4. Create wallet
  rl.close()
  console.log('\n  Creating wallet...')
  wm.password = password.trim()
  await wm.create({ interactive: false, password: password.trim() })

  // Summary
  console.log('')
  console.log('  ┌─────────────────────────────────────┐')
  console.log('  │          Setup Complete              │')
  console.log('  └─────────────────────────────────────┘')
  console.log('')
  console.log(`  Network:  ${isMainnet ? 'Mainnet' : 'Testnet'}`)
  console.log(`  Provider: ${provider || 'not set'}`)
  console.log(`  Config:   ~/.kard/env.json`)
  console.log(`  Wallet:   ~/.kard/wallet.json`)
  console.log('')
  if (!isMainnet) {
    console.log('  Next steps:')
    console.log('    1. Get KITE gas: faucet.gokite.ai')
    console.log('    2. Get ETH: faucet.quicknode.com/arbitrum/sepolia')
    console.log('    3. Run: kard gas (to verify)')
    console.log('    4. Run: kard groq "park USDC at highest yield"')
  }
  console.log('')
}

async function cmdWallet (sub, rest, flags) {
  const { WalletManager } = await import('../wallet/manager.js')
  const wm = new WalletManager()
  switch (sub) {
    case 'list': case undefined:
      for (const a of wm.list()) {
        console.log(`${a.active ? '*' : ' '} [${a.index}] ${a.label.padEnd(16)} ${a.address}  (created ${a.created})`)
      }
      return
    case 'address': {
      const acct = await wm.resolve({ interactive: true })
      console.log(acct.address)
      return
    }
    case 'add':
      await wm.unlock()
      console.log(JSON.stringify(await wm.addAccount({ label: flags.label }), null, 2))
      return
    case 'import': {
      const pk = rest[0]
      if (!pk) { console.error('usage: kard wallet import <private-key>'); process.exit(2) }
      await wm.unlock()
      console.log(JSON.stringify(await wm.import(pk, { label: flags.label }), null, 2))
      return
    }
    default: console.error('usage: kard wallet <list|add|import|address>'); process.exit(2)
  }
}

// ─────────── pay-stream ───────────

async function cmdPayStream (recipient, flags) {
  if (!recipient) { console.error('usage: kard pay-stream <recipient> [--fixed N | --pct N --basis revenue|pnl|portfolio] --interval Ns [--cap-day N] [--cap-total N]'); process.exit(2) }
  const { createAgent } = await import('../index.js')
  const { PaymentStream } = await import('../x402/stream.js')
  const agent = await createAgent({ strategy: flags.strategy || 'KITE_YIELD' })
  if (!agent.x402) { console.error('x402 client not initialized — set X402_NETWORK'); process.exit(2) }

  const formula = flags.fixed
    ? { kind: 'fixed', amount: parseFloat(flags.fixed) }
    : { kind: 'percent', basis: flags.basis || 'revenue', pct: parseFloat(flags.pct) }
  const caps = {}
  if (flags['cap-tick'])  caps.perTick = parseFloat(flags['cap-tick'])
  if (flags['cap-day'])   caps.perDay  = parseFloat(flags['cap-day'])
  if (flags['cap-total']) caps.total   = parseFloat(flags['cap-total'])

  const stream = new PaymentStream({
    recipient,
    token: flags.token || 'USDT0',
    formula, caps,
    intervalMs: parseInterval(flags.interval || '1s') ?? 1000,
    client: agent.x402,
    context: {
      getRevenue:    async () => agent._x402Revenue || 0,
      getPnl:        async () => (agent.portfolio?.totalUSD || 0) - (agent._baselineUSD || 0),
      getPortfolioUSD: async () => agent.portfolio?.totalUSD || 0
    }
  })
  stream.on('tick', t => console.log(`[stream] +${t.amount?.toFixed(6)} ${flags.token || 'USDT0'} (total ${stream.totalPaid.toFixed(6)})`))
  stream.on('error', e => console.error(`[stream] ${e.message}`))
  stream.start()
  console.error(`[kard] pay-stream → ${recipient}: ${JSON.stringify(formula)} every ${flags.interval}`)
  process.on('SIGINT', () => { stream.stop(); process.exit(0) })
}

// ─────────── infra ───────────

async function cmdMcp () { await import('../mcp-server.js') }

// ─────────── passport ───────────

async function cmdPassport (sub, rest, flags) {
  const { KitePassport } = await import('../wallet/passport.js')
  const p = new KitePassport()
  if (!p.isInstalled()) { console.error(p.installHint()); process.exit(1) }
  switch (sub) {
    case 'status': case undefined: {
      const me = await p.me()
      if (!me) { console.error('not signed in. run: kard passport signup <email>'); return }
      console.log(JSON.stringify(me, null, 2))
      try {
        const bal = await p.balance()
        console.log('balance:', JSON.stringify(bal, null, 2))
      } catch {}
      return
    }
    case 'signup': {
      const email = rest[0]
      if (!email) { console.error('usage: kard passport signup <email>'); process.exit(2) }
      console.error(await p.signup(email))
      console.error('\n→ Check your email for the verification link + 8-char code.')
      console.error('→ Click the link, set up your passkey on the dashboard.')
      console.error('→ Then run:  kard passport verify <code>')
      return
    }
    case 'verify':
      console.log(await p.verify(rest[0])); return
    case 'address':
      console.log(await p.address()); return
    case 'sessions':
      console.log(JSON.stringify(await p.listSessions({ status: flags.status || 'active' }), null, 2)); return
    case 'pay': {
      const [recipient, amount] = rest
      if (!recipient || !amount) { console.error('usage: kard passport pay <recipient> <amount> [--session ID] [--memo TEXT]'); process.exit(2) }
      let sessionId = flags.session
      if (!sessionId) {
        const session = await p.ensureSession({
          budget: parseFloat(amount),
          duration: flags.duration || '1h',
          scope: flags.scope || 'pay',
          description: flags.memo || `kard pay ${recipient}`
        })
        sessionId = session.id
        console.error(`[kard] using session ${sessionId} (approve with passkey if first time)`)
      }
      console.log(JSON.stringify(await p.pay({ sessionId, recipient, amount: parseFloat(amount), memo: flags.memo }), null, 2))
      return
    }
    default:
      console.error('usage: kard passport <status|signup|verify|address|sessions|pay>'); process.exit(2)
  }
}

// ─────────── attest ───────────

async function cmdAttest (sub, rest) {
  const { ChainContext } = await import('../chain-context.js')
  const { KiteAttestor } = await import('../kite/attestation.js')
  const { defaultWalletManager } = await import('../wallet/manager.js')
  const wm = defaultWalletManager()
  const acct = await wm.resolve({ interactive: true })
  if (acct.privateKey) process.env.PRIVATE_KEY = acct.privateKey
  const ctx = new ChainContext()
  const attestor = new KiteAttestor({ chainContext: ctx })
  switch (sub) {
    case 'verify': {
      const txHash = rest[0]
      if (!txHash) { console.error('usage: kard attest verify <txHash>'); process.exit(2) }
      console.log(JSON.stringify(await attestor.verify(txHash), null, 2)); return
    }
    case 'list': case undefined:
      console.log('(local in-memory log — start an agent run to populate)')
      console.log(JSON.stringify(attestor.list({ limit: 20 }), null, 2)); return
    default:
      console.error('usage: kard attest <list|verify>'); process.exit(2)
  }
}

// ─────────── opportunities ───────────

async function cmdOpportunities (flags) {
  const { createAgent } = await import('../index.js')
  const agent = await createAgent({
    strategy: flags.strategy || 'KITE_YIELD',
    useWalletManager: !flags['no-wallet']
  })
  await agent.refresh()
  const ops = agent.lastOpportunities
  if (!ops) { console.error('No opportunities — aggregator not initialized'); return }
  console.log(`# ${ops.opportunities.length} ranked opportunities (sources: ${JSON.stringify(ops.sources)})\n`)
  for (const o of ops.opportunities) {
    const apy = o.apy ? `${(o.apy * 100).toFixed(2)}%` : '?'
    const tvl = o.tvl ? `$${(o.tvl / 1e6).toFixed(1)}M` : '?'
    console.log(`• ${apy.padEnd(7)} ${o.source.padEnd(11)} ${(o.protocol || o.chain).padEnd(14)} ${(o.asset || '').padEnd(8)} tvl ${tvl.padEnd(8)}  ${o.note || ''}`)
  }
}

async function cmdGas () {
  const { ChainContext } = await import('../chain-context.js')
  const { GasManager } = await import('../gas-manager.js')
  const { defaultWalletManager } = await import('../wallet/manager.js')
  const wm = defaultWalletManager()
  const acct = await wm.resolve({ interactive: true })
  process.env.PRIVATE_KEY = acct.privateKey
  const ctx = new ChainContext()
  const gas = new GasManager(ctx)
  const snap = await gas.snapshotAll()
  console.log('Native balances across supported chains:\n')
  for (const [key, info] of Object.entries(snap)) {
    if (info.error) console.log(`  ${key.padEnd(14)} ERROR: ${info.error}`)
    else {
      const flag = info.ok ? '✓' : '✗'
      console.log(`  ${flag} ${key.padEnd(14)} ${info.balance.toFixed(6)} ${info.symbol}  (min ${info.min})`)
    }
  }
}

async function cmdVerifyLucid (asset) {
  const { LucidKiteBridge } = await import('../evm/bridge.js')
  const { ChainContext } = await import('../chain-context.js')
  const { defaultWalletManager } = await import('../wallet/manager.js')
  const wm = defaultWalletManager()
  const acct = await wm.resolve({ interactive: true })
  process.env.PRIVATE_KEY = acct.privateKey
  const ctx = new ChainContext()
  const lucid = new LucidKiteBridge({ signer: ctx.getSigner('arbitrum') })
  const report = await lucid.verifyController((asset || 'USDC').toUpperCase())
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.allOk ? 0 : 1)
}

function parseInterval (s) {
  if (!s) return null
  const m = String(s).match(/^(\d+)(ms|s|m|h)$/)
  if (!m) return null
  const mult = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 }[m[2]]
  return parseInt(m[1]) * mult
}

async function cmdDaemon (flags) {
  // Long-running production process: agent loop + chat bridge + reporter,
  // all wired up, restartable by systemd / Docker / Render / etc.
  //
  // Required env: KARD_PASSWORD (auto-unlock keystore), one LLM key,
  // and at least one chat token if you want chat (TELEGRAM_BOT_TOKEN etc.)
  const { createAgent } = await import('../index.js')
  const { GoalEngine } = await import('../goals/engine.js')
  const { Reporter } = await import('../agent/reporter.js')

  const provider = flags.provider || process.env.LLM_PROVIDER || 'anthropic'
  const strategy = flags.strategy || 'KITE_YIELD'
  const interval = parseInterval(flags.interval || '60s') ?? 60_000

  console.error(`[daemon] booting agent: provider=${provider} strategy=${strategy} interval=${interval / 1000}s`)
  const agent = await createAgent({ provider, strategy })

  // Optional: set a goal from --goal flag
  let goals = null
  if (flags.goal) {
    goals = new GoalEngine({ agent, llm: agent.llm, skills: agent.skills })
    await goals.setGoal(flags.goal)
    goals.start()
    console.error(`[daemon] goal set: ${flags.goal}`)
  }

  // Auto-attach chat adapters that have credentials in env
  const chats = []
  const tryChat = async (name, envCheck) => {
    if (!envCheck) return
    try {
      const { createAdapter, bridge } = await import('../chat/index.js')
      const adapter = createAdapter(name)
      bridge({ adapter, agent, llm: agent.llm, goals, skills: agent.skills })
      // Hook this adapter as a notifier sink so proactive alerts go to your chat
      // (uses the configured channel if NOTIFY_<NAME>_CHANNEL is set, else
      // defaults to the bot's own DMs / first joined channel)
      const channelId = process.env[`NOTIFY_${name.toUpperCase()}_CHANNEL`] || null
      if (channelId && agent.notifier) {
        agent.notifier.attachChat(name, adapter, channelId)
      }
      chats.push(name)
    } catch (e) {
      console.error(`[daemon] ${name} chat skipped: ${e.message}`)
    }
  }
  await tryChat('telegram', !!process.env.TELEGRAM_BOT_TOKEN)
  await tryChat('discord',  !!process.env.DISCORD_BOT_TOKEN)
  await tryChat('slack',    !!process.env.SLACK_BOT_TOKEN && !!process.env.SLACK_APP_TOKEN)
  console.error(`[daemon] chat bridges: ${chats.join(', ') || 'none'}`)

  // Optional: periodic reporter (off by default)
  let reporter = null
  if (flags.report) {
    reporter = new Reporter({
      agent,
      interval: flags.report === true ? '5m' : flags.report,
      mode: flags['report-mode'] || 'normal',
      sinks: { console: true, file: true }
    })
    reporter.start()
    console.error(`[daemon] reporter on every ${flags.report}`)
  }

  agent.start(interval)
  console.error(`[daemon] running. address=${agent.wallet.address}`)

  const shutdown = () => {
    console.error('[daemon] shutting down…')
    reporter?.stop(); goals?.stop(); agent.stop()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

async function cmdRepl () {
  const { startRepl } = await import('../repl.js')
  await startRepl()
}

async function cmdBacktest (provider, prompt, flags) {
  const { Backtester } = await import('../agent/backtest.js')
  const bt = new Backtester({ startingEquity: parseFloat(flags['equity'] || '10000') })
  const out = await bt.run({
    strategyText: prompt, provider: provider || 'anthropic',
    from: flags.from || new Date(Date.now() - 90 * 86400_000).toISOString(),
    to: flags.to || new Date().toISOString(),
    csv: flags.csv || null
  })
  console.log(JSON.stringify(out.summary, null, 2))
  if (flags.verbose) {
    console.log('--- equity curve ---')
    for (const p of out.equityCurve.slice(-30)) {
      console.log(new Date(p.ts).toISOString(), p.equity.toFixed(2))
    }
  }
}

async function cmdFleet (sub, rest, flags) {
  const { Fleet, loadFleetConfig } = await import('../agent/fleet.js')
  switch (sub) {
    case 'run': {
      const cfgPath = rest[0]
      if (!cfgPath) { console.error('usage: kard fleet run <config.yml>'); process.exit(2) }
      const cfg = loadFleetConfig(cfgPath)
      const fleet = new Fleet(cfg)
      globalThis.__kardFleet = fleet
      fleet.on('agent:spawned', e => console.error(`[fleet] spawned ${e.id} @ ${e.address}`))
      fleet.on('skill:authored', e => console.error(`[fleet] new skill authored: ${e.name} by ${e.by}`))
      fleet.on('skill:received', e => console.error(`[fleet] skill received from peer: ${e.from}`))
      await fleet.spawnAll()
      fleet.startAll(parseInterval(flags.interval || '60s') ?? 60_000)
      process.on('SIGINT', () => { fleet.stopAll(); process.exit(0) })
      return
    }
    case 'state': {
      const fleet = globalThis.__kardFleet
      if (!fleet) { console.log('(no fleet running)'); return }
      console.log(JSON.stringify(fleet.state(), null, 2)); return
    }
    default: console.error('usage: kard fleet <run|state>'); process.exit(2)
  }
}

async function cmdSimulate (txJson, flags) {
  const { ChainContext } = await import('../chain-context.js')
  const { TxSimulator } = await import('../agent/simulator.js')
  const ctx = new ChainContext()
  const sim = new TxSimulator(ctx)
  const tx = JSON.parse(txJson)
  console.log(JSON.stringify(await sim.simulate({ chain: flags.chain || 'arbitrum', tx }), null, 2))
}

async function cmdTaxes (sub, rest, flags) {
  const { TaxExporter, FORMATS } = await import('../agent/taxes.js')
  const exporter = new TaxExporter({ method: flags.method || 'fifo' })
  const year = flags.year ? parseInt(flags.year) : null
  switch (sub) {
    case 'summary': case undefined:
      console.log(JSON.stringify(exporter.summary({ year }), null, 2))
      return
    case 'export': {
      const fmt = flags.format || '8949'
      if (!FORMATS.includes(fmt)) { console.error(`unknown format. Have: ${FORMATS.join(', ')}`); process.exit(2) }
      const out = exporter.export({ year, format: fmt })
      if (flags.out) {
        require('fs').writeFileSync(flags.out, out)
        console.error(`✓ wrote ${flags.out}`)
      } else {
        console.log(out)
      }
      return
    }
    default:
      console.error('usage: kard taxes <summary|export> [--year 2025] [--format 8949|koinly|cointracker|generic|json] [--method fifo|lifo|hifo] [--out file]')
      process.exit(2)
  }
}

async function cmdTreasury (sub) {
  const { Treasurer } = await import('../agent/treasurer.js')
  const { createAgent } = await import('../index.js')
  switch (sub) {
    case 'show': case undefined: {
      const t = new Treasurer({ agent: { _lastGasSnapshot: {}, balances: {} } })
      console.log(t.describe())
      return
    }
    case 'check': {
      const agent = await createAgent({ useWalletManager: true })
      await agent.refresh()
      const action = agent.treasurer?.proposeRebalance()
      console.log(action ? JSON.stringify(action, null, 2) : '✓ portfolio within target distribution — no rebalance needed')
      return
    }
    default:
      console.error('usage: kard treasury <show|check>')
      process.exit(2)
  }
}

async function cmdSelfFund (sub, flags) {
  const { defaultConfig } = await import('../config.js')
  const cfg = defaultConfig()
  switch (sub) {
    case 'show':
      console.log(JSON.stringify(cfg.get('self_funding') || { enabled: false }, null, 2)); return
    case 'on':
      cfg.set('self_funding.enabled', true)
      console.log('✓ self-funding ENABLED. Configure targets:')
      console.log('  kard config set self_funding.gas_topup true')
      console.log('  kard config set self_funding.gas_threshold_usd 5')
      console.log('  kard config set self_funding.llm_topup true')
      console.log('  kard config set self_funding.max_per_day_usd 25')
      return
    case 'off':
      cfg.set('self_funding.enabled', false)
      console.log('✓ self-funding disabled'); return
    default:
      console.error('usage: kard self-fund <show|on|off>')
      process.exit(2)
  }
}

async function cmdRisk (sub, rest, flags) {
  const { getEffectiveLimits, setUserLimit, resetUserLimits, saveUserLimits } = await import('../risk/engine.js')
  switch (sub) {
    case 'show': case undefined: {
      const limits = getEffectiveLimits()
      console.log('Current risk limits:\n')
      console.log(`  Max daily drawdown:     ${(limits.max_daily_drawdown_pct * 100).toFixed(1)}%`)
      console.log(`  Max leverage (gross):   ${limits.max_total_leverage}x`)
      console.log(`  Hard max leverage:      ${limits.hard_max_leverage}x`)
      console.log(`  Max per-market:         ${(limits.max_per_market_pct * 100).toFixed(1)}%`)
      console.log(`  Max bucket exposure:    ${(limits.max_bucket_pct * 100).toFixed(1)}%`)
      console.log(`  Max position (USD):     $${limits.hard_max_position_usd.toLocaleString()}`)
      console.log(`  Min trade (USD):        $${limits.min_trade_usd}`)
      console.log(`  Max gas % of trade:     ${(limits.max_gas_pct_of_trade * 100).toFixed(1)}%`)
      console.log(`\n  Config: ~/.kard/risk-limits.json`)
      return
    }
    case 'set': {
      const [key, value] = rest
      if (!key || value === undefined) {
        console.error('usage: kard risk set <limit> <value>\n')
        console.error('Available limits:')
        console.error('  max_drawdown          Max daily drawdown % (e.g. 5 = 5%)')
        console.error('  max_leverage          Max gross leverage (e.g. 3)')
        console.error('  hard_max_leverage     Absolute leverage cap (e.g. 5)')
        console.error('  max_per_market        Max % in one market (e.g. 20)')
        console.error('  max_bucket            Max % in correlated bucket (e.g. 50)')
        console.error('  max_position_usd      Max single position USD (e.g. 10000)')
        console.error('  min_trade_usd         Min trade size USD (e.g. 5)')
        process.exit(2)
      }
      const keyMap = {
        max_drawdown: 'max_daily_drawdown_pct',
        max_leverage: 'max_total_leverage',
        hard_max_leverage: 'hard_max_leverage',
        max_per_market: 'max_per_market_pct',
        max_bucket: 'max_bucket_pct',
        max_position_usd: 'hard_max_position_usd',
        min_trade_usd: 'min_trade_usd',
      }
      const pctKeys = ['max_drawdown', 'max_per_market', 'max_bucket']
      const realKey = keyMap[key] || key
      let realValue = parseFloat(value)
      if (pctKeys.includes(key)) realValue = realValue / 100
      setUserLimit(realKey, realValue)
      console.log(`✓ ${key} set to ${value}${pctKeys.includes(key) ? '%' : ''}`)
      console.log(`  Saved to ~/.kard/risk-limits.json`)
      return
    }
    case 'reset':
      resetUserLimits()
      console.log('✓ Risk limits reset to defaults')
      return
    default:
      console.error('usage: kard risk <show|set|reset>')
      console.error('  kard risk show                    View current limits')
      console.error('  kard risk set max_drawdown 5      Set max drawdown to 5%')
      console.error('  kard risk set max_leverage 2      Set max leverage to 2x')
      console.error('  kard risk set max_position_usd 5000')
      console.error('  kard risk reset                   Reset to defaults')
      process.exit(2)
  }
}

async function cmdConfig (sub, rest) {
  const { defaultConfig, ALL_VENUES, ALL_ACTIONS } = await import('../config.js')
  const cfg = defaultConfig()
  switch (sub) {
    case 'show': case undefined:
      console.log(cfg.describe())
      return
    case 'reset':
      cfg.reset(); console.log('✓ reset to defaults'); return
    case 'venues':
      console.log('Available venues:', ALL_VENUES.join(', ')); return
    case 'actions':
      console.log('Available actions:', ALL_ACTIONS.join(', ')); return
    case 'set': {
      const [key, ...values] = rest
      if (!key) { console.error('usage: kard config set <key> <values...>'); process.exit(2) }
      // Multi-value → array; single value → coerced
      const value = values.length === 0 ? null
        : values.length === 1 ? coerce(values[0])
        : values.map(v => v.trim()).filter(Boolean)
      cfg.set(key, value)
      console.log(`✓ ${key} = ${JSON.stringify(value)}`)
      console.log(cfg.describe())
      return
    }
    case 'allow': case 'deny': {
      const [scope, ...items] = rest
      if (!scope || !items.length) {
        console.error('usage: kard config <allow|deny> <chains|venues|actions|assets> <item1> [item2…]')
        process.exit(2)
      }
      const cur = cfg.get(`${scope}.${sub}`) || []
      const next = [...new Set([...cur, ...items])]
      cfg.set(`${scope}.${sub}`, next)
      console.log(`✓ ${scope}.${sub}: ${next.join(', ')}`)
      return
    }
    case 'unallow': case 'undeny': {
      const realKey = sub === 'unallow' ? 'allow' : 'deny'
      const [scope, ...items] = rest
      const cur = cfg.get(`${scope}.${realKey}`) || []
      const next = cur.filter(x => !items.includes(x))
      cfg.set(`${scope}.${realKey}`, next)
      console.log(`✓ ${scope}.${realKey}: ${next.join(', ') || '(empty)'}`)
      return
    }
    default:
      console.error('usage: kard config <show|set|allow|deny|reset|venues|actions>')
      process.exit(2)
  }
}

function coerce (v) {
  if (v === 'true') return true; if (v === 'false') return false
  if (/^\d+$/.test(v)) return parseInt(v); if (/^\d*\.\d+$/.test(v)) return parseFloat(v)
  return v
}

async function cmdEarnings (flags) {
  const { Bookkeeper } = await import('../agent/bookkeeper.js')
  const bk = new Bookkeeper()
  const earnings = bk.earnings(flags.equity ? parseFloat(flags.equity) : null)
  if (flags.json) { console.log(JSON.stringify(earnings, null, 2)); return }
  console.log(`\nKard earnings  (since ${earnings.since || 'never started'})`)
  console.log(`─────────────────────────────────────`)
  console.log(`Realized PnL:     $${(earnings.realizedPnl || 0).toFixed(2)}`)
  console.log(`Expenses paid:    $${(earnings.expenses || 0).toFixed(2)}`)
  console.log(`Net:              $${(earnings.net || 0).toFixed(2)}`)
  console.log(`24h:              $${(earnings.pnl24h || 0).toFixed(2)}`)
  console.log(`7d:               $${(earnings.pnl7d || 0).toFixed(2)}`)
  console.log(`30d:              $${(earnings.pnl30d || 0).toFixed(2)}`)
  console.log(`Trades closed:    ${earnings.tradeCount}`)
  if (earnings.annualisedReturn != null) {
    console.log(`Annualised:       ${(earnings.annualisedReturn * 100).toFixed(2)}%`)
  }
  console.log(`\nBy source:`)
  for (const [s, v] of Object.entries(earnings.pnlBySource)) {
    console.log(`  ${s.padEnd(10)} $${v.toFixed(2)}`)
  }
  console.log(`\nBy symbol:`)
  for (const [s, v] of Object.entries(earnings.pnlBySymbol)) {
    console.log(`  ${s.padEnd(10)} $${v.toFixed(2)}`)
  }
  if (earnings.openPositions.perps.length) {
    console.log(`\nOpen perps:`)
    for (const p of earnings.openPositions.perps) {
      console.log(`  ${p.symbol} ${p.side} ${p.size} @ $${p.entryPx?.toFixed(2)} (${p.leverage}x)`)
    }
  }
  if (earnings.openPositions.yields.length) {
    console.log(`\nOpen yield positions:`)
    for (const y of earnings.openPositions.yields) {
      console.log(`  ${y.asset} ${y.amount} (${y.source}) — basis $${y.basisUSD?.toFixed(2)}`)
    }
  }
}

async function cmdReport (flags) {
  const { createAgent } = await import('../index.js')
  const { Reporter } = await import('../agent/reporter.js')
  const agent = await createAgent({
    strategy: flags.strategy || 'KITE_YIELD',
    useWalletManager: !flags['no-wallet']
  })
  const sinks = { console: true }
  if (flags.file) sinks.file = flags.file === true ? true : flags.file
  if (flags.webhook) sinks.webhook = flags.webhook
  const reporter = new Reporter({
    agent,
    interval: flags.loop || '1m',
    mode: flags.mode || 'normal',
    sinks
  })
  if (!flags.loop) {
    // One-shot
    const r = await reporter.report()
    if (flags.json) console.log(JSON.stringify(r, null, 2))
    return
  }
  reporter.start()
  process.on('SIGINT', () => { reporter.stop(); process.exit(0) })
}

async function cmdKill (sub) {
  const { pullKillSwitch, releaseKillSwitch } = await import('../risk/engine.js')
  if (sub === 'on')      { pullKillSwitch();    console.log('🔴 KILL switch ON — agents halt new actions.') }
  else if (sub === 'off') { releaseKillSwitch(); console.log('🟢 KILL switch OFF') }
  else                    { console.error('usage: kard kill <on|off>'); process.exit(2) }
}

// ─────────── demo ───────────

async function cmdDemo (flags) {
  const { runDemo } = await import('./demo.js')
  await runDemo(flags)
}

// ─────────── reputation ───────────

async function cmdReputation (sub, rest, flags) {
  const { ChainContext } = await import('../chain-context.js')
  const { KiteReputation } = await import('../kite/reputation.js')
  const { defaultWalletManager } = await import('../wallet/manager.js')

  const wm = defaultWalletManager()
  const acct = await wm.resolve({ interactive: true })
  if (acct.privateKey) process.env.PRIVATE_KEY = acct.privateKey
  const ctx = new ChainContext()
  const rep = new KiteReputation({ chainContext: ctx, contractAddress: process.env.KARD_ATTESTOR_ADDR })

  switch (sub) {
    case 'leaderboard': {
      const addresses = rest.length > 0 ? rest : [acct.address]
      const board = await rep.leaderboard(addresses)
      console.log('\n🏆 Kard Agent Leaderboard (Kite AI)\n')
      for (const entry of board) {
        console.log(`  #${entry.rank}  ${entry.address.slice(0, 10)}…  score: ${entry.score}  (${entry.tier})`)
      }
      console.log('')
      return
    }
    case undefined: case 'show': {
      const address = rest[0] || acct.address
      const score = await rep.getScore(address)
      console.log('\n🃏 Kard Agent Reputation\n')
      console.log(`  Address:        ${score.address}`)
      console.log(`  Score:          ${score.score}`)
      console.log(`  Tier:           ${score.tier}`)
      console.log(`  Chain:          ${score.chain}`)
      console.log('')
      console.log('  Breakdown:')
      console.log(`    Base (attestations × 10):   ${score.breakdown.base}`)
      console.log(`    Profit bonus:               ${score.breakdown.bonus}`)
      console.log(`    Failure penalty:             ${score.breakdown.penalty}`)
      console.log(`    Streak bonus:               ${score.breakdown.streak}`)
      console.log(`    Age bonus:                  ${score.breakdown.ageBonus}`)
      console.log('')
      console.log('  Stats:')
      console.log(`    Total attestations:  ${score.stats.totalAttestations}`)
      console.log(`    Profitable:          ${score.stats.profitable}`)
      console.log(`    Failed:              ${score.stats.failed}`)
      console.log(`    Success rate:        ${score.stats.successRate}`)
      console.log(`    Longest streak:      ${score.stats.longestStreak}`)
      console.log(`    Active since:        ${score.stats.activeSinceDays} days`)
      console.log('')
      console.log(`  Verify: https://kitescan.ai/address/${score.address}`)
      console.log('')
      return
    }
    default:
      console.error('usage: kard reputation [show|leaderboard] [address...]')
      process.exit(2)
  }
}

// ─────────── strategy marketplace (with attestation proofs) ───────────

async function cmdStrategyMarketplace (sub, rest, flags) {
  const { strategyRegistry } = await import('../strategies/library.js')
  const reg = strategyRegistry()

  // For commands that need attestation
  if (sub === 'publish' && flags.attest) {
    const { ChainContext } = await import('../chain-context.js')
    const { KiteAttestor } = await import('../kite/attestation.js')
    const { StrategyMarketplace } = await import('../strategies/marketplace.js')
    const { Backtester } = await import('../agent/backtest.js')
    const { defaultWalletManager } = await import('../wallet/manager.js')

    const wm = defaultWalletManager()
    const acct = await wm.resolve({ interactive: true })
    if (acct.privateKey) process.env.PRIVATE_KEY = acct.privateKey
    const ctx = new ChainContext()
    const attestor = new KiteAttestor({ chainContext: ctx })
    const marketplace = new StrategyMarketplace({ attestor, registry: reg })

    const strategyName = rest[0]
    if (!strategyName) {
      console.error('usage: kard strategy publish <name> --attest [--from DATE --to DATE]')
      process.exit(2)
    }

    const strategy = reg.get(strategyName)
    if (!strategy) {
      console.error(`strategy "${strategyName}" not found. Run: kard strategy list`)
      process.exit(2)
    }

    // Run backtest for proof
    console.error(`[kard] running backtest for attestation proof...`)
    const bt = new Backtester({ startingEquity: parseFloat(flags.equity || '10000') })
    const backtestResult = await bt.run({
      strategyText: strategy.description || strategyName,
      provider: flags.provider || 'anthropic',
      from: flags.from || new Date(Date.now() - 90 * 86400_000).toISOString(),
      to: flags.to || new Date().toISOString()
    })

    console.error(`[kard] attesting backtest results on Kite AI...`)
    const result = await marketplace.publishWithProof(
      { name: strategyName, ...strategy },
      backtestResult,
      { address: acct.address }
    )

    console.log('\n✓ Strategy published with attestation proof\n')
    console.log(`  Name:        ${result.name}`)
    console.log(`  Attestation: ${result.attestation.txHash}`)
    console.log(`  Explorer:    ${result.attestation.explorerUrl}`)
    console.log(`  Block:       ${result.attestation.block}`)
    console.log(`  Backtest:    ${JSON.stringify(result.backtest)}`)
    console.log(`  Local:       ${result.localPath}`)
    console.log('')
    console.log('  Anyone can verify: kard strategy verify ' + result.name)
    console.log('')
    return
  }

  if (sub === 'verify') {
    const { ChainContext } = await import('../chain-context.js')
    const { KiteAttestor } = await import('../kite/attestation.js')
    const { StrategyMarketplace } = await import('../strategies/marketplace.js')
    const { defaultWalletManager } = await import('../wallet/manager.js')

    const wm = defaultWalletManager()
    const acct = await wm.resolve({ interactive: true })
    if (acct.privateKey) process.env.PRIVATE_KEY = acct.privateKey
    const ctx = new ChainContext()
    const attestor = new KiteAttestor({ chainContext: ctx })
    const marketplace = new StrategyMarketplace({ attestor, registry: reg })

    const target = rest[0]
    if (!target) {
      console.error('usage: kard strategy verify <name-or-txHash>')
      process.exit(2)
    }

    const result = await marketplace.verify(target)
    if (result.verified) {
      console.log('\n✓ Strategy attestation VERIFIED\n')
      console.log(`  Tx:      ${result.attestation.txHash}`)
      console.log(`  Agent:   ${result.attestation.agent}`)
      console.log(`  Block:   ${result.attestation.block}`)
      console.log(`  Mode:    ${result.attestation.mode}`)
      console.log(`  Explorer: ${result.attestation.explorerUrl}`)
      if (result.backtest) {
        console.log(`  Backtest: ${JSON.stringify(result.backtest)}`)
      }
    } else {
      console.log(`\n✗ Verification failed: ${result.reason}`)
    }
    console.log('')
    return
  }

  if (sub === 'browse') {
    const { StrategyMarketplace } = await import('../strategies/marketplace.js')
    const marketplace = new StrategyMarketplace({ registry: reg })
    const results = await marketplace.browse(rest[0] || '')
    console.log('\n📦 Strategy Marketplace\n')
    if (!results.length) { console.log('  (no strategies found)'); return }
    for (const s of results) {
      const proof = s.proof?.verified ? '✓ proven' : '  unproven'
      const backtest = s.proof?.backtest ? ` (${(s.proof.backtest.totalReturn * 100).toFixed(1)}% return)` : ''
      console.log(`  ${proof} ${(s.name || '').padEnd(20)} ${(s.description || '').slice(0, 40)}${backtest}`)
    }
    console.log('')
    return
  }

  // Fall through to original strategy command
  switch (sub) {
    case 'list': case undefined:
      for (const s of reg.list()) console.log(`${s.source.padEnd(8)} ${s.name.padEnd(28)} ${s.description || ''}`)
      return
    case 'install':
      console.log(JSON.stringify(await reg.install(rest[0]), null, 2)); return
    case 'publish':
      console.log(JSON.stringify(await reg.publish(rest[0]), null, 2)); return
    case 'search':
      console.log(JSON.stringify(await reg.search(rest[0] || ''), null, 2)); return
    case 'remove':
      reg.remove(rest[0]); console.log(`✓ removed ${rest[0]}`); return
    case 'save': {
      const name = rest[0]
      const config = JSON.parse(rest[1] || '{}')
      console.log(JSON.stringify(reg.saveAs(name, config), null, 2)); return
    }
    default: console.error('usage: kard strategy <list|install|publish|search|remove|save|verify|browse>'); process.exit(2)
  }
}

async function main () {
  if (args.length === 0) { return cmdRepl() }
  if (['help', '--help', '-h'].includes(args[0])) return help()
  const [cmd, ...rest] = args
  const { flags, positional } = parseFlags(rest)

  switch (cmd) {
    case 'init':           return cmdInit()
    case 'demo':           return cmdDemo(flags)
    case 'reputation':     return cmdReputation(positional[0], positional.slice(1), flags)
    case 'wallet':         return cmdWallet(positional[0], positional.slice(1), flags)
    case 'skill':          return cmdSkill(positional[0], positional.slice(1), flags)
    case 'goal':           return cmdGoal(positional.join(' '), flags)
    case 'chat':           return cmdChat(positional[0], flags)
    case 'pay-stream':     return cmdPayStream(positional[0], flags)
    case 'run':            return cmdRun(flags)
    case 'mcp':            return cmdMcp()
    case 'gas':            return cmdGas()
    case 'verify-lucid':   return cmdVerifyLucid(positional[0])
    case 'passport':       return cmdPassport(positional[0], positional.slice(1), flags)
    case 'attest':         return cmdAttest(positional[0], positional.slice(1))
    case 'opportunities':  return cmdOpportunities(flags)
    case 'repl':           return cmdRepl()
    case 'backtest':       return cmdBacktest(positional[0], positional.slice(1).join(' '), flags)
    case 'strategy':       return cmdStrategyMarketplace(positional[0], positional.slice(1), flags)
    case 'fleet':          return cmdFleet(positional[0], positional.slice(1), flags)
    case 'simulate':       return cmdSimulate(positional[0], flags)
    case 'kill':           return cmdKill(positional[0])
    case 'earnings':       return cmdEarnings(flags)
    case 'pnl':            return cmdEarnings({ ...flags, json: false })
    case 'report':         return cmdReport(flags)
    case 'config':         return cmdConfig(positional[0], positional.slice(1))
    case 'risk':           return cmdRisk(positional[0], positional.slice(1), flags)
    case 'daemon':         return cmdDaemon(flags)
    case 'taxes':          return cmdTaxes(positional[0], positional.slice(1), flags)
    case 'treasury':       return cmdTreasury(positional[0])
    case 'self-fund':      return cmdSelfFund(positional[0], flags)
    default: {
      // Provider form: `kard <provider> "<prompt>"`
      return cmdCompile(cmd, positional.join(' '), flags)
    }
  }
}

main().catch(e => { console.error(`[kard] ${e.message}`); process.exit(1) })
