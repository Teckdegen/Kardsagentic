// @kard/agent — Extended MCP tools
//
// Imported by src/mcp-server.js. Adds the kard.* tool surface so any MCP
// host (Claude Code, Cursor, Claude Desktop) can drive the whole stack:
//   kard.compile         — text → action plan (no execution)
//   kard.opportunities   — live ranked yield list
//   kard.attest_verify   — decode an on-chain attestation tx
//   kard.passport.*      — ensure_session, pay, balance, address
//   kard.skill.*         — list, run, search, install
//   kard.goal.*          — set, list, remove
//   kard.fleet_state     — multi-agent state snapshot

import { z } from 'zod'

export function registerKardTools (server) {
  if (!server?.tool) {
    // Older MCP SDK shape — accept .registerTool too
    if (!server?.registerTool) {
      console.error('[kard.mcp] server has no tool() registrar — skipping kard.* tools')
      return
    }
  }
  const reg = (name, schema, handler, description) => {
    if (server.tool) return server.tool(name, schema, handler, { description })
    if (server.registerTool) return server.registerTool({ name, description, inputSchema: schema, handler })
  }

  reg('kard.compile',
    { text: z.string(), provider: z.string().optional() },
    async ({ text, provider }) => {
      const { compileStrategy } = await import('./index.js')
      const decision = await compileStrategy(text, { provider })
      return { content: [{ type: 'text', text: JSON.stringify(decision, null, 2) }] }
    },
    'Compile a natural-language strategy → structured action plan (dry-run).'
  )

  reg('kard.opportunities',
    { assets: z.array(z.string()).optional(), chains: z.array(z.string()).optional(), limit: z.number().optional() },
    async (args) => {
      const { createAgent } = await import('./index.js')
      const a = await createAgent({ useWalletManager: false })
      await a.refresh()
      const ops = a.lastOpportunities
      return { content: [{ type: 'text', text: JSON.stringify(ops, null, 2) }] }
    },
    'Live ranked yield opportunities across Aave / Lucid / DeFiLlama / Hyperliquid funding.'
  )

  reg('kard.attest_verify',
    { txHash: z.string() },
    async ({ txHash }) => {
      const { ChainContext } = await import('./chain-context.js')
      const { KiteAttestor } = await import('./kite/attestation.js')
      const ctx = new ChainContext()
      const att = new KiteAttestor({ chainContext: ctx })
      const out = await att.verify(txHash)
      return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] }
    },
    'Decode and verify an on-chain Kard attestation tx on KiteAI.'
  )

  reg('kard.passport.address',
    {},
    async () => {
      const { KitePassport } = await import('./wallet/passport.js')
      const p = new KitePassport()
      if (!p.isInstalled()) return { content: [{ type: 'text', text: p.installHint() }], isError: true }
      const me = await p.me()
      return { content: [{ type: 'text', text: JSON.stringify(me, null, 2) }] }
    },
    'Get the user\'s Kite Passport address + sign-in state.'
  )

  reg('kard.passport.pay',
    { recipient: z.string(), amount: z.number(), memo: z.string().optional(), duration: z.string().optional() },
    async ({ recipient, amount, memo, duration }) => {
      const { KitePassport } = await import('./wallet/passport.js')
      const p = new KitePassport()
      const session = await p.ensureSession({ budget: amount, duration: duration || '1h', scope: 'pay', description: memo })
      const r = await p.pay({ sessionId: session.id, recipient, amount, memo })
      return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] }
    },
    'Pay a recipient or x402 service via an approved Kite Passport session.'
  )

  reg('kard.skill.list',
    {},
    async () => {
      const { globalRegistry } = await import('./skills/loader.js')
      const list = globalRegistry().list().map(s => ({ name: s.name, description: s.description, triggers: s.triggers }))
      return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] }
    },
    'List installed Kard skills (.md capabilities).'
  )

  reg('kard.skill.run',
    { name: z.string(), tool: z.string(), params: z.record(z.any()).optional(), allowWrites: z.boolean().optional() },
    async ({ name, tool, params, allowWrites }) => {
      const { globalRegistry } = await import('./skills/loader.js')
      const out = await globalRegistry().invoke(name, tool, params || {}, { allowWrites })
      return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] }
    },
    'Invoke a skill tool. Use kard.skill.list first to see what\'s installed.'
  )

  reg('kard.skill.search',
    { query: z.string() },
    async ({ query }) => {
      const { SkillMarketplace } = await import('./skills/marketplace.js')
      const out = await new SkillMarketplace().search(query)
      return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] }
    },
    'Search the Kard skill marketplace for community-published skills.'
  )

  reg('kard.skill.install',
    { ref: z.string() },
    async ({ ref }) => {
      const { SkillMarketplace } = await import('./skills/marketplace.js')
      const out = await new SkillMarketplace().install(ref)
      return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] }
    },
    'Install a skill by reference (e.g. "kard/coingecko-historical").'
  )

  reg('kard.goal.set',
    { text: z.string(), strategy: z.string().optional() },
    async ({ text, strategy }) => {
      const { createAgent } = await import('./index.js')
      const { GoalEngine } = await import('./goals/engine.js')
      const a = await createAgent({ strategy: strategy || 'KITE_YIELD', useWalletManager: false })
      const ge = new GoalEngine({ agent: a, llm: a.llm, skills: a.skills })
      const g = await ge.setGoal(text)
      return { content: [{ type: 'text', text: JSON.stringify(g, null, 2) }] }
    },
    'Set an autonomous goal (e.g. "raise portfolio 5% in 2 weeks"). Persists to disk.'
  )

  reg('kard.earnings',
    {},
    async () => {
      const { Bookkeeper } = await import('./agent/bookkeeper.js')
      const bk = new Bookkeeper()
      return { content: [{ type: 'text', text: JSON.stringify(bk.earnings(), null, 2) }] }
    },
    'Total agent earnings: realized PnL, by source, by symbol, 24h/7d/30d windows.'
  )

  reg('kard.report',
    { mode: z.enum(['fast', 'normal', 'full']).optional() },
    async ({ mode }) => {
      const { createAgent } = await import('./index.js')
      const { Reporter } = await import('./agent/reporter.js')
      const a = await createAgent({ useWalletManager: false })
      await a.refresh()
      const r = await new Reporter({ agent: a, interval: '1m', mode: mode || 'normal', sinks: { console: false } }).report()
      return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] }
    },
    'One-shot agent report — strategy, equity, PnL windows, top opportunities, open positions.'
  )

  reg('kard.fleet_state',
    {},
    async () => {
      const { Fleet } = await import('./agent/fleet.js')
      // Fleet state is process-local — return whatever's running
      const f = globalThis.__kardFleet
      if (!f) return { content: [{ type: 'text', text: '(no fleet running in this process)' }] }
      return { content: [{ type: 'text', text: JSON.stringify(f.state(), null, 2) }] }
    },
    'Snapshot of the running multi-agent fleet (if any).'
  )

  console.error('[kard.mcp] registered kard.* tools')
}
