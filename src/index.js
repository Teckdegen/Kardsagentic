// @kard/agent — public SDK surface
//
// Programmatic API for embedding the Kard agentic-trading runtime in
// your own code (web app, server, scheduler, custom MCP host, …).
//
// Three primary entry points:
//   1. compileStrategy(text, opts)  — text-to-strategy via any LLM provider
//   2. createAgent(opts)             — full TreasuryAgent with adapters wired
//   3. quickRun(text, opts)          — one-shot: compile, evaluate, propose
//
// Adapters, skills, wallet, chat, x402 streams — all exported individually
// so you can compose your own runtime.

import 'dotenv/config'

// ─── Core agent + strategy presets ───
export { TreasuryAgent } from './agent/treasury.js'
export { STRATEGIES } from './agent/strategies.js'
export { LlmReasoning, createLlmFromProvider } from './agent/llm.js'

// ─── Execution adapters ───
export { AaveLending } from './evm/aave.js'
export { UniswapSwap } from './evm/swap.js'
export { Usdt0Bridge, LucidKiteBridge } from './evm/bridge.js'
export { HyperliquidPerps, createHyperliquidFromEnv } from './perps/hyperliquid.js'

// ─── Wallet + chain plumbing ───
export { EvmWallet, createWalletFromEnv } from './evm/wallet.js'
export { CHAINS, resolveChainConfig, getChainById } from './evm/chains.js'
export { ChainContext, getSignerForChain } from './chain-context.js'
export { GasManager } from './gas-manager.js'
export { WalletManager, defaultWalletManager } from './wallet/manager.js'
export { KitePassport, createPassportFromEnv } from './wallet/passport.js'

// ─── Kite settlement / attestation ───
export { KiteAttestor } from './kite/attestation.js'

// ─── Yield discovery ───
export { YieldAggregator } from './agent/yield-aggregator.js'

// ─── Risk / reconciliation / sim / events / learning ───
export { RiskEngine, pullKillSwitch, releaseKillSwitch } from './risk/engine.js'
export { Reconciler } from './agent/reconciler.js'
export { TxSimulator } from './agent/simulator.js'
export { EventBus, HyperliquidWsSource, OnChainSource, PassportPollSource } from './agent/event-bus.js'
export { Learner } from './agent/learner.js'

// ─── Routing + MEV ───
export { SwapRouter } from './agent/swap-router.js'
export { MevSubmitter } from './agent/mev.js'

// ─── Strategy library + marketplace ───
export { StrategyRegistry, strategyRegistry } from './strategies/library.js'
export { SkillMarketplace } from './skills/marketplace.js'

// ─── Backtest ───
export { Backtester } from './agent/backtest.js'

// ─── Fleet + coordination ───
export { Fleet, loadFleetConfig } from './agent/fleet.js'
export { CoordinationChannel, localBus } from './coordination/index.js'

// ─── New venues ───
export { GmxV2Perps } from './perps/gmx.js'
export { AerodromeSwap } from './dex/aerodrome.js'
export { PendleAdapter } from './dex/pendle.js'
export { LrtRouter } from './dex/lido.js'

// ─── REPL ───
export { startRepl } from './repl.js'

// ─── Bookkeeper + Reporter ───
export { Bookkeeper } from './agent/bookkeeper.js'
export { Reporter } from './agent/reporter.js'

// ─── Production-safety pack ───
export { Notifier, defaultNotifier } from './notifier.js'
export { Defender } from './agent/defender.js'
export { Treasurer } from './agent/treasurer.js'
export { SelfFunder } from './agent/self-funder.js'
export { TaxExporter } from './agent/taxes.js'
export { KardConfig, defaultConfig } from './config.js'

// ─── Skills (.md capabilities) ───
export { SkillRegistry, globalRegistry as defaultSkills } from './skills/loader.js'

// ─── Goals (self-evolving meta-strategy) ───
export { GoalEngine } from './goals/engine.js'

// ─── x402 payment streams ───
export { PaymentStream, StreamManager } from './x402/stream.js'

// ─── Chat adapters ───
export { TelegramAdapter, DiscordAdapter, SlackAdapter, createAdapter as createChatAdapter, bridge as bridgeChat } from './chat/index.js'

// ─── Pricing + portfolio ───
export { getPrices, calculatePortfolioValue } from './evm/pricing.js'

/**
 * Compile a natural-language strategy into a structured plan.
 *
 * @param {string} text — e.g. "long ETH 3x if RSI < 30, risk 2%"
 * @param {object} opts
 * @param {'anthropic'|'openai'|'openrouter'|'ollama'} [opts.provider='anthropic']
 * @param {string} [opts.model] — provider-specific model id
 * @param {string} [opts.apiKey] — overrides env var
 */
export async function compileStrategy (text, opts = {}) {
  const { createLlmFromProvider } = await import('./agent/llm.js')
  const { globalRegistry } = await import('./skills/loader.js')
  const llm = createLlmFromProvider(opts.provider || 'anthropic', opts)
  // Make skills visible to the compile call
  llm.extraSystem = globalRegistry().describeForPrompt()
  return llm.reason(
    { cycle: 0, balances: {}, supplied: {}, prices: {}, strategy: null },
    { userInstruction: text }
  )
}

/**
 * Spin up a fully-wired TreasuryAgent with adapters, skills, and (optionally)
 * a wallet manager + goal engine.
 *
 * @param {object} opts
 * @param {string|object} [opts.strategy='KITE_YIELD']
 * @param {'anthropic'|'openai'|'openrouter'|'ollama'} [opts.provider]
 * @param {boolean} [opts.useWalletManager=true] — if no PRIVATE_KEY, prompt to create one
 * @param {boolean} [opts.withGoals=false]       — attach GoalEngine
 */
export async function createAgent (opts = {}) {
  const { TreasuryAgent } = await import('./agent/treasury.js')
  const { STRATEGIES } = await import('./agent/strategies.js')
  const { globalRegistry } = await import('./skills/loader.js')
  if (opts.provider) process.env.LLM_PROVIDER = opts.provider

  // Smooth wallet UX — auto-resolve from Passport → env → keystore.
  // For agent-internal signing (gas, perps), we still need a private key.
  // When Passport is the user wallet, the agent uses a small "operator" key
  // (env or keystore) for its own gas while routing user funds via Passport.
  let passportInstance = null
  if (opts.useWalletManager !== false) {
    const { defaultWalletManager } = await import('./wallet/manager.js')
    const wm = defaultWalletManager()
    if (!process.env.PRIVATE_KEY && !process.env.KARD_MNEMONIC && !process.env.WDK_SEED) {
      const acct = await wm.resolve({ interactive: process.stdout.isTTY })
      if (acct.passport) {
        passportInstance = { handle: acct.passport, address: acct.address, email: acct.email }
        // Passport doesn't expose the user's private key — fine for paying
        // services (Passport signs sessions). For agent-internal signing
        // we generate / load a separate operator key from keystore.
        if (!wm.exists()) await wm.create({ interactive: true, label: 'operator' })
        const op = await wm.unlock(undefined, { interactive: process.stdout.isTTY })
        process.env.PRIVATE_KEY = op.privateKey
      } else if (acct.privateKey) {
        process.env.PRIVATE_KEY = acct.privateKey
      }
    }
  }

  const agent = new TreasuryAgent()
  await agent.init()
  if (passportInstance) agent.passport = passportInstance

  // Attach skills so the agent can invoke them via the `skill` action
  const skills = globalRegistry()
  agent.setSkills(skills)

  const strat = opts.strategy || 'KITE_YIELD'
  agent.setStrategy(typeof strat === 'string' ? STRATEGIES[strat.toUpperCase()] || strat : strat)

  if (opts.withGoals) {
    const { GoalEngine } = await import('./goals/engine.js')
    agent.goals = new GoalEngine({ agent, llm: agent.llm, skills })
  }

  return agent
}

/**
 * One-shot: text → preview proposed actions, no execution.
 */
export async function quickRun (text, opts = {}) {
  const agent = await createAgent({ ...opts, useWalletManager: false })
  agent.pause()
  const decision = await compileStrategy(text, opts)
  for (const rule of decision.rules || []) {
    try { agent.addRule(rule) } catch {}
  }
  await agent.cycle()
  return {
    decision,
    snapshot: agent.getSnapshot(),
    proposedActions: agent.lastReasoningTrail
  }
}
