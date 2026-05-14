// Kard — Treasury Agent Core
// Autonomous multi-chain treasury management for Kite

import { createWalletFromEnv } from '../evm/wallet.js'
import { AaveLending } from '../evm/aave.js'
import { UniswapSwap } from '../evm/swap.js'
import { Usdt0Bridge, LucidKiteBridge } from '../evm/bridge.js'
import { calculatePortfolioValue, getPrices } from '../evm/pricing.js'
import { STRATEGIES } from './strategies.js'
import { LlmReasoning } from './llm.js'
import { createX402Client, getX402ClientInfo } from '../x402/client.js'
import { createHyperliquidFromEnv } from '../perps/hyperliquid.js'
import { ChainContext } from '../chain-context.js'
import { GasManager } from '../gas-manager.js'
import { KiteAttestor } from '../kite/attestation.js'
import { YieldAggregator } from './yield-aggregator.js'
import { RiskEngine } from '../risk/engine.js'
import { Reconciler } from './reconciler.js'
import { TxSimulator } from './simulator.js'
import { Learner } from './learner.js'
import { Bookkeeper } from './bookkeeper.js'
import { defaultConfig } from '../config.js'
import { defaultNotifier } from '../notifier.js'
import { Defender } from './defender.js'
import { Treasurer } from './treasurer.js'
import { SelfFunder } from './self-funder.js'
import { StopWatcher } from './stop-watcher.js'

/**
 * TreasuryAgent — full autonomous loop:
 *   refresh → evaluate → propose → execute → log → sleep → repeat
 */
export class TreasuryAgent {
  constructor () {
    this.wallet = null
    this.aave = null
    this.swap = null
    this.bridge = null
    // (erc4337 was Tsentry-era WDK; removed in kard. Use ChainContext for multi-chain signing.)
    this.x402 = null
    this.llm = null
    this.strategy = null
    this.active = false
    this.paused = false
    this.llmEnabled = true // LLM reasoning on by default

    // State
    this.balances = {}
    this.supplied = {}
    this.aaveAccount = null
    this.portfolio = null
    this.prices = {}
    this.aaveAPYs = {} // { USDT: { supplyAPY, borrowAPY }, ... }
    this.swapPairs = []
    this.bridgeChains = []
    this.bridgeRoutes = []

    // Lucid Kite (yield-bearing canonical USDC on KiteAI)
    this.lucid = null
    this.lucidYieldStates = {}   // { USDC: { totalLocked, bufferBalance, ... } }
    this.lucidBalances = {}      // { kiteai: { USDC: 12.34 }, avalanche: { ... } }

    // Perps (Hyperliquid)
    this.perps = null
    this.perpsSnapshot = null    // { mids, fundingExtremes, account, positions }

    // Skills registry (.md capabilities). Attach with setSkills() or pass via createAgent().
    this.skills = null

    // Cross-protocol yield aggregator — fed snapshot data each cycle
    this.yieldAggregator = null
    this.lastOpportunities = null

    // Kite Passport — the user-facing wallet. Set when WalletManager.resolve()
    // returns a Passport-managed account.
    this.passport = null

    // Custom conditional rules (user-defined via NL)
    this.rules = []
    this._ruleSnapshots = {} // initial state snapshots per rule

    // Logging
    this.actionLog = []
    this.errors = []

    // Reasoning trail — transparent step-by-step decision log per cycle
    this.reasoningTrail = [] // current cycle's trail
    this.lastReasoningTrail = [] // previous completed cycle's trail (for dashboard)

    // Adaptive interval tracking
    this.nextCheckAt = null // Date.toISOString() of next scheduled check
    this.nextCheckReason = null // why this interval was chosen

    // Loop config
    this.pollIntervalMs = 60_000 // 1 min
    this._timer = null
    this._cycleCount = 0
  }

  /** Initialize the agent — wallet from PRIVATE_KEY (or KARD_MNEMONIC / WDK_SEED for legacy) */
  async init () {
    this.wallet = createWalletFromEnv()
    this.walletSource = 'ethers'

    // Auto-resolve Aave pool from the chain registry if not in env. Falls
    // back to a no-op shim if the connected chain has no Aave deployment
    // (e.g. KiteAI) — agent still works, just no Aave actions on that chain.
    let aavePool = process.env.AAVE_POOL
    if (!aavePool) {
      try {
        const { getChainById } = await import('../evm/chains.js')
        const net = await this.wallet.provider.getNetwork()
        const chain = getChainById(Number(net.chainId))
        aavePool = chain?.aave?.pool || null
      } catch { /* skip */ }
    }
    if (aavePool) {
      this.aave = new AaveLending({
        signer: this.wallet.signer,
        poolAddress: aavePool,
        tokens: this.wallet.tokens,
        dataProviderAddress: process.env.AAVE_DATA_PROVIDER || undefined,
        aTokens: process.env.ATOKEN_USDT ? {
          USDT: process.env.ATOKEN_USDT,
          USDC: process.env.ATOKEN_USDC,
          WETH: process.env.ATOKEN_WETH,
          ...(process.env.ATOKEN_DAI ? { DAI: process.env.ATOKEN_DAI } : {})
        } : undefined
      })
    } else {
      // No Aave on this chain — provide a graceful stub so the rest of the agent boots
      this.aave = {
        getAllSupplied: async () => ({}),
        getAccountData: async () => ({ totalCollateralUSD: 0, totalDebtUSD: 0, availableBorrowUSD: 0, healthFactor: Infinity }),
        getAllReserveAPYs: async () => ({}),
        supply: async () => { throw new Error('No Aave on current chain') },
        withdraw: async () => { throw new Error('No Aave on current chain') },
        repay: async () => { throw new Error('No Aave on current chain') },
        poolAddress: null
      }
      this.log('aave', 'No Aave on current chain — Aave actions disabled (other rails still work)')
    }

    // Swap: Uniswap V3 baseline. Cross-protocol routing (1inch / CowSwap /
    // Aerodrome / Pendle / Lucid) is handled by SwapRouter higher up.
    this.swapProvider = 'uniswap'
    this.swap = new UniswapSwap({
      signer: this.wallet.signer,
      tokens: this.wallet.tokens,
      uniswap: this._uniswapAddrs()
    })

    // Discover available swap pairs
    try {
      this.swapPairs = await this.swap.getAvailablePairs()
    } catch { this.swapPairs = [] }

    // USDT0 bridge (mainnet — quote-only from testnet)
    this.bridge = new Usdt0Bridge({ signer: this.wallet.signer })
    this.bridgeChains = this.bridge.getSupportedChains()
    this.bridgeRoutes = this.bridge.getRoutes('ethereum')

    // Multi-chain context — lets the agent execute on whichever chain an
    // action targets (Arbitrum for Lucid mint, KiteAI for burn/attest, etc.)
    // without disturbing the primary signer.
    try {
      this.chainContext = new ChainContext({
        privateKey: process.env.PRIVATE_KEY,
        mnemonic: process.env.WDK_SEED,
        rpcOverrides: {
          ...(process.env.KITE_RPC_URL ? { kiteai: process.env.KITE_RPC_URL } : {}),
          ...(process.env.ARB_RPC_URL ? { arbitrum: process.env.ARB_RPC_URL } : {})
        }
      })
      this.gas = new GasManager(this.chainContext)
      this.log('chains', `Multi-chain context ready (${this.chainContext.list().length} chains)`)

      // Kite attestor — every successful execute writes a verifiable record on KiteAI
      this.attestor = new KiteAttestor({ chainContext: this.chainContext })
      this.log('kite', `Attestation layer ready (mode: ${this.attestor.contractAddress ? 'contract' : 'self'})`)

      // User policy — chain/venue/action allow-deny lists. Loaded BEFORE the
      // aggregator so opportunities get filtered the first time.
      this.policy = defaultConfig()

      // Yield aggregator — surfaces ranked opportunities every cycle.
      this.yieldAggregator = new YieldAggregator({
        aaveByChain: new Map([['arbitrum', this.aave]].filter(([, v]) => !!v)),
        lucid: this.lucid,
        perps: this.perps,
        skills: this.skills,
        policy: this.policy
      })

      // Risk engine — hard veto between LLM and execute()
      this.risk = new RiskEngine()

      // Position reconciler — diff agent.state vs on-chain every cycle
      this.reconciler = new Reconciler({ agent: this, autoResubmit: false })

      // Pre-flight tx simulator
      this.simulator = new TxSimulator(this.chainContext)

      // Self-improving prompt learner — distils experience from cycles
      try { this.learner = new Learner({ llm: this.llm }) } catch { this.learner = null }

      // Bookkeeper — tracks every action's PnL; queryable any time
      this.bookkeeper = new Bookkeeper()

      // Notifier — proactive alerts (Telegram/Discord/Slack/email/Twilio)
      this.notifier = defaultNotifier()

      // Liquidation defender — event-driven, fires the moment HF crosses threshold
      this.defender = new Defender({ agent: this, notifier: this.notifier })

      // Cross-chain treasurer — keeps USDC distributed per ~/.kard/treasury.yml
      this.treasurer = new Treasurer({ agent: this, notifier: this.notifier })

      // Self-funder (opt-in via config) — earnings auto-top-up gas/LLM/Passport
      this.selfFunder = new SelfFunder({ agent: this, notifier: this.notifier })

      // Stop watcher — fallback when venue trigger orders fail to register
      this.stopWatcher = new StopWatcher({ agent: this, notifier: this.notifier })

      // Apply policy to LLM prompt + RiskEngine limit overrides (policy already loaded above)
      const policyBlock = this.policy.describeForPrompt()
      if (policyBlock && this.llm) {
        this.llm.extraSystem = (this.llm.extraSystem || '') + '\n' + policyBlock
      }
      if (this.risk && Object.keys(this.policy.data.limits || {}).length) {
        Object.assign(this.risk.limits, this.policy.data.limits)
      }
      // Mark start with initial equity once portfolio is loaded (handled in refresh)
    } catch (e) {
      this.log('chains', `Chain context init skipped: ${e.message}`)
      this.chainContext = null
      this.gas = null
      this.attestor = null
    }

    // Lucid Kite — yield-bearing canonical stablecoin layer on KiteAI.
    // Controllers are mainnet-only at the moment. On testnet we auto-disable
    // so calls don't silently revert. Override with KARD_FORCE_LUCID=1 if
    // Lucid testnet contracts go live and you want to try them.
    const isTestnet = process.env.HYPERLIQUID_NETWORK === 'testnet' || process.env.KARD_TESTNET === '1'
    const forceLucid = process.env.KARD_FORCE_LUCID === '1'
    if (isTestnet && !forceLucid) {
      this.lucid = null
      this.log('lucid', 'Testnet detected — Lucid disabled (mainnet controllers only). Set KARD_FORCE_LUCID=1 to override.')
    } else if (!process.env.KITEAI_LZ_EID && !forceLucid) {
      // Lucid relies on a real LayerZero V2 EID for KiteAI; the registry default
      // is a placeholder. Require explicit confirmation before letting it run.
      this.lucid = null
      this.log('lucid', 'KITEAI_LZ_EID not set — Lucid disabled. Set the real LayerZero V2 EID in env (or KARD_FORCE_LUCID=1) to enable.')
    } else {
      try {
        this.lucid = new LucidKiteBridge({ signer: this.wallet.signer })
        this.log('lucid', 'Lucid Kite bridge initialized', { assets: this.lucid.getAssets().map(a => a.symbol) })
      } catch (e) {
        this.log('lucid', `Lucid init failed: ${e.message} — continuing without Lucid`)
        this.lucid = null
      }
    }

    // Hyperliquid perps — text-to-onchain perp execution
    try {
      this.perps = createHyperliquidFromEnv()
      this.log('perps', `Hyperliquid adapter initialized (${this.perps.network}, ${this.perps.cfg.base})`, {
        network: this.perps.network,
        hasSigner: !!this.perps.apiWallet,
        userAddress: this.perps.userAddress
      })
    } catch (e) {
      this.log('perps', `Perps init failed: ${e.message} — continuing without perps`)
      this.perps = null
    }

    // LLM reasoning engine
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        this.llm = new LlmReasoning()
        const ok = await this.llm.healthCheck()
        if (ok) {
          this.log('llm', 'LLM reasoning engine connected', { model: this.llm.model })
        } else {
          this.log('llm', 'LLM health check failed — falling back to rules')
          this.llm = null
        }
      } catch (e) {
        this.log('llm', `LLM init failed: ${e.message} — falling back to rules`)
        this.llm = null
      }
    } else {
      this.log('llm', 'No ANTHROPIC_API_KEY — using rule-based evaluation only')
    }

    // x402 payment client (agent-to-agent payments)
    // Activated when X402_NETWORK is set (e.g., "eip155:42161" for Arbitrum)
    if (process.env.X402_NETWORK && this.wallet.signer) {
      try {
        const network = await this.wallet.provider.getNetwork()
        this.x402 = createX402Client({
          wallet: this.wallet.signer,
          chainId: Number(network.chainId),
          network: process.env.X402_NETWORK
        })
        this.log('x402', `Payment client initialized (${process.env.X402_NETWORK})`, getX402ClientInfo(this.x402))
      } catch (e) {
        this.log('x402', `x402 client init failed: ${e.message} — continuing without payments`)
        this.x402 = null
      }
    }

    // Strict mode — require Lucid controller ABI to match deployed bytecode
    if (process.env.KARD_STRICT === '1' && this.lucid) {
      const report = await this.lucid.verifyController('USDC').catch(e => ({ allOk: false, error: e.message }))
      if (!report.allOk) {
        throw new Error(`Strict mode: Lucid ABI mismatch — ${JSON.stringify(report).slice(0, 300)}`)
      }
      this.log('strict', 'Lucid controller verified ✓')
    }

    await this.refresh()
    this.log('init', `Agent initialized — wallet ${this.wallet.address} (${this.walletSource}), swap: ${this.swapProvider}`, {
      walletSource: this.walletSource,
      swapProvider: this.swapProvider,
      balances: this.balances,
      supplied: this.supplied,
      swapPairs: this.swapPairs.map(p => `${p.tokenA}/${p.tokenB}`),
      bridgeChains: this.bridgeChains.map(c => c.name)
    })

    return this
  }

  /** Refresh all on-chain data */
  async refresh () {
    try {
      // Wallet balances
      this.balances = await this.wallet.getAllBalances()

      // Aave positions
      this.supplied = await this.aave.getAllSupplied()
      this.aaveAccount = await this.aave.getAccountData()

      // Live prices + Aave APYs
      this.prices = await getPrices(['ETH', 'BTC', 'USDT', 'DAI', 'USDC'])
      try {
        this.aaveAPYs = await this.aave.getAllReserveAPYs()
      } catch { this.aaveAPYs = {} }

      // Portfolio value (wallet + supplied)
      const combined = { ...this.balances }
      for (const [sym, amt] of Object.entries(this.supplied)) {
        combined[`a${sym}`] = amt // aUSDT, aDAI, etc.
      }
      this.portfolio = await calculatePortfolioValue(combined)

      // First valid refresh → mark bookkeeper baseline
      if (this.bookkeeper && !this.bookkeeper.startedAt && this.portfolio?.totalUSD != null) {
        this.bookkeeper.markStart(this.portfolio.totalUSD)
      }

      // Lucid Kite yield-layer state (best-effort, off-path)
      if (this.lucid) {
        try {
          const targets = this.strategy?.lucid?.asset
            ? [this.strategy.lucid.asset]
            : ['USDC']
          for (const sym of targets) {
            this.lucidYieldStates[sym] = await this.lucid.getYieldState(sym)
          }
          // L-USDC balance on KiteAI (and source-chain native if address known)
          if (this.wallet.address) {
            try {
              this.lucidBalances.kiteai = {
                USDC: await this.lucid.getBalance('USDC', 'kiteai', this.wallet.address)
              }
            } catch { /* node not reachable, fine */ }
          }
        } catch (e) {
          // Don't break the refresh loop on Lucid RPC hiccups
          this.log('lucid_refresh', `Lucid yield-state fetch skipped: ${e.message}`)
        }
      }

      // Yield-opportunity discovery (5-min cache inside aggregator)
      if (this.yieldAggregator) {
        try {
          const prevTop = this.lastOpportunities?.opportunities?.[0]?.apy || 0
          this.lastOpportunities = await this.yieldAggregator.discover({
            assets: ['USDC', 'USDT', 'ETH', 'WETH'],
            limit: 12
          })
          // Notify if a NEW high-APR opportunity surfaced this cycle
          const newTop = this.lastOpportunities?.opportunities?.[0]
          if (newTop && (newTop.apy || 0) - prevTop > 0.05) {  // jumped > 5%
            this.notifier?.newOpportunity(newTop)
          }
        } catch (e) {
          this.log('yield', `Aggregator skipped: ${e.message}`)
        }
      }

      // Treasurer — refresh real cross-chain stable balances, then propose rebalance
      if (this.treasurer?.enabled()) {
        try {
          await this.treasurer.refreshBalances()
          const action = this.treasurer.proposeRebalance()
          if (action) this._pendingTreasurerAction = action
        } catch (e) { this.log('treasurer', `skipped: ${e.message}`) }
      }

      // Self-funder — opt-in; tops up gas/LLM/Passport from realized profits
      if (this.selfFunder?.enabled()) {
        try { await this.selfFunder.tick() }
        catch (e) { this.log('selffund', `skipped: ${e.message}`) }
      }

      // Position reconciliation — diff agent state vs ground truth
      if (this.reconciler) {
        try { this._lastReconcile = await this.reconciler.reconcile() }
        catch (e) { this.log('reconcile', `skipped: ${e.message}`) }
      }

      // Native-balance / gas snapshot across every supported chain
      if (this.gas) {
        try {
          this._lastGasSnapshot = await this.gas.snapshotAll()
        } catch { /* RPCs flaky — no-op */ }
      }

      // Perps snapshot (mids + funding + account if userAddress set)
      if (this.perps) {
        try {
          this.perpsSnapshot = await this.perps.snapshot()
        } catch (e) {
          this.log('perps_refresh', `Perps snapshot skipped: ${e.message}`)
        }
      }
    } catch (e) {
      this.logError('refresh', e)
    }
  }

  /** Attach a SkillRegistry — exposes .md capabilities to the LLM */
  setSkills (registry) {
    this.skills = registry
    if (this.llm && registry) {
      // Append the skills block to the LLM's system prompt (one-shot, on attach)
      this.llm.extraSystem = registry.describeForPrompt()
    }
    return this
  }

  /** Set strategy by name or config */
  setStrategy (nameOrConfig) {
    if (typeof nameOrConfig === 'string') {
      const strat = STRATEGIES[nameOrConfig.toUpperCase()]
      if (!strat) throw new Error(`Unknown strategy: ${nameOrConfig}`)
      this.strategy = { ...strat }
    } else {
      this.strategy = { ...nameOrConfig }
    }
    this.log('strategy', `Strategy set: ${this.strategy.name}`, this.strategy)
  }

  /**
   * Evaluate current state — LLM-powered with rule-based fallback
   * @returns {Array<object>} actions
   */
  async evaluate () {
    if (!this.strategy) return []

    // Always run rule-based evaluation as safety baseline
    const ruleActions = this._evaluateRules()

    // Evaluate user-defined conditional rules
    const customRuleActions = this._evaluateCustomRules()
    if (customRuleActions.length > 0) {
      ruleActions.push(...customRuleActions)
    }

    // Treasurer-proposed rebalance — folded in as a normal rule action
    if (this._pendingTreasurerAction) {
      ruleActions.push(this._pendingTreasurerAction)
      this._pendingTreasurerAction = null
    }

    // If LLM is available and enabled, use it for intelligent reasoning
    if (this.llm && this.llmEnabled) {
      try {
        // Inject self-distilled experience memo into the system prompt
        if (this.learner) {
          const memo = this.learner.readMemo()
          if (memo) {
            this.llm.extraSystem = (this.llm.extraSystem || '') + '\n\n## Lessons from past cycles\n' + memo
          }
        }
        const snapshot = this.getSnapshot()
        const decision = await this.llm.reason(snapshot, {
          ruleBasedActions: ruleActions
        })

        // Log this cycle for the learner
        if (this.learner) {
          this.learner.recordCycle({
            cycle: this._cycleCount,
            portfolioUSD: this.portfolio?.totalUSD,
            strategy: this.strategy?.name,
            reasoning: decision.reasoning,
            actions: decision.actions
          })
        }

        // Store latest reasoning for dashboard
        this._lastLlmDecision = decision

        this.log('llm_reason', decision.reasoning, {
          market: decision.market_assessment,
          risk: decision.risk_level,
          actions: decision.actions.length,
          model: decision._meta?.model,
          latencyMs: decision._meta?.latencyMs,
          tokens: decision._meta?.inputTokens + decision._meta?.outputTokens
        })

        // Merge: LLM actions + any critical rule-based alerts the LLM may have missed
        const llmActionTypes = new Set(decision.actions.map(a => `${a.type}:${a.token || ''}`))
        const criticalRuleAlerts = ruleActions.filter(a =>
          a.priority === 'critical' && !llmActionTypes.has(`${a.type}:${a.token || ''}`)
        )

        const merged = [...decision.actions, ...criticalRuleAlerts]

        // Adjust next check interval if suggested
        if (decision.next_check_suggestion && this.active) {
          const ms = this._parseInterval(decision.next_check_suggestion)
          if (ms && ms !== this.pollIntervalMs) {
            const prev = this.pollIntervalMs
            this.pollIntervalMs = ms
            this.nextCheckReason = `AI: "${decision.next_check_suggestion}" (was ${prev / 1000}s)`
            this._reason('interval', `Adaptive: next check in ${decision.next_check_suggestion} (${decision.risk_level} risk)`, {
              previous: prev / 1000 + 's',
              next: decision.next_check_suggestion,
              risk: decision.risk_level
            })
            this.log('llm_interval', `LLM suggests next check in ${decision.next_check_suggestion}`)
          }
        }

        return merged
      } catch (e) {
        this.logError('llm_reason', e)
        this.log('llm_fallback', `LLM reasoning failed — using rule-based: ${e.message}`)
        // Fall through to rule-based
      }
    }

    return ruleActions
  }

  /**
   * Rule-based evaluation — deterministic safety net
   * @returns {Array<object>} actions
   */
  _evaluateRules () {
    const actions = []

    const ethPrice = this.prices?.ETH?.usd || 2600
    const walletUSD = (this.balances.USDT || 0) + (this.balances.DAI || 0) +
      (this.balances.USDC || 0) + (this.balances.WETH || 0) * ethPrice +
      (this.balances.ETH || 0) * ethPrice
    const suppliedUSD = (this.supplied.USDT || 0) + (this.supplied.DAI || 0) +
      (this.supplied.USDC || 0) + (this.supplied.WETH || 0) * ethPrice
    const totalUSD = walletUSD + suppliedUSD

    if (totalUSD < 1) return []

    const currentLendingPct = (suppliedUSD / totalUSD) * 100
    const targetLendingPct = this.strategy.allocations.lending
    const drift = targetLendingPct - currentLendingPct

    // Rebalance lending if drift exceeds threshold
    if (Math.abs(drift) > this.strategy.rebalanceThreshold) {
      const targetDeltaUSD = (drift / 100) * totalUSD

      if (drift > 0) {
        const capped = this._supplyCapped || new Set()
        const lendingOrder = this.strategy.lendingPriority || ['WETH', 'USDT', 'DAI', 'USDC']
        const minUsdtReserve = this.strategy.minUsdtReserve || 10

        const supplyDefs = {
          WETH: { bal: this.balances.WETH || 0, valuePerUnit: ethPrice, minKeep: 0.001 },
          USDT: { bal: this.balances.USDT || 0, valuePerUnit: 1, minKeep: Math.max(10, minUsdtReserve) },
          DAI: { bal: this.balances.DAI || 0, valuePerUnit: 1, minKeep: 10 },
          USDC: { bal: this.balances.USDC || 0, valuePerUnit: 1, minKeep: 10 }
        }

        const supplyable = lendingOrder
          .filter(t => supplyDefs[t])
          .map(t => ({ token: t, ...supplyDefs[t] }))
          .filter(s => s.bal > s.minKeep && !capped.has(s.token))

        let remainingUSD = Math.abs(targetDeltaUSD)
        for (const s of supplyable) {
          if (remainingUSD <= 0) break
          const availableUSD = (s.bal - s.minKeep) * s.valuePerUnit * 0.95
          const useUSD = Math.min(availableUSD, remainingUSD)
          const useUnits = useUSD / s.valuePerUnit
          if (useUnits < (s.token === 'WETH' ? 0.0001 : 1)) continue

          const amount = s.token === 'WETH'
            ? Math.floor(useUnits * 1e6) / 1e6
            : Math.floor(useUnits * 100) / 100

          actions.push({
            type: 'lending_supply',
            token: s.token,
            amount,
            reason: `Lending at ${currentLendingPct.toFixed(1)}%, target ${targetLendingPct}% — supply ${amount} ${s.token} (~$${useUSD.toFixed(0)})`,
            priority: 'medium'
          })
          remainingUSD -= useUSD
        }
      } else {
        const withdrawable = Object.entries(this.supplied)
          .filter(([, v]) => v > 0.0001)
          .map(([token, bal]) => ({
            token, bal,
            valuePerUnit: token === 'WETH' ? ethPrice : 1
          }))
          .sort((a, b) => (b.bal * b.valuePerUnit) - (a.bal * a.valuePerUnit))

        let remainingUSD = Math.abs(targetDeltaUSD)
        for (const s of withdrawable) {
          if (remainingUSD <= 0) break
          const useUSD = Math.min(s.bal * s.valuePerUnit, remainingUSD)
          const useUnits = useUSD / s.valuePerUnit
          const amount = s.token === 'WETH'
            ? Math.floor(useUnits * 1e6) / 1e6
            : Math.floor(useUnits * 100) / 100

          actions.push({
            type: 'lending_withdraw',
            token: s.token,
            amount,
            reason: `Lending at ${currentLendingPct.toFixed(1)}%, target ${targetLendingPct}% — withdraw ${amount} ${s.token}`,
            priority: 'medium'
          })
          remainingUSD -= useUSD
        }
      }
    }

    // Health factor monitoring
    if (this.aaveAccount && this.aaveAccount.totalDebtUSD > 0) {
      if (this.aaveAccount.healthFactor < 1.5) {
        actions.push({
          type: 'alert',
          level: 'critical',
          reason: `Health factor LOW: ${this.aaveAccount.healthFactor.toFixed(2)} — repay debt or add collateral`,
          priority: 'critical'
        })
      }
    }

    // Stablecoin rebalance — USDT-centric or equal-weight
    const stableBals = { USDT: this.balances.USDT || 0, DAI: this.balances.DAI || 0, USDC: this.balances.USDC || 0 }
    const totalStable = stableBals.USDT + stableBals.DAI + stableBals.USDC

    if (totalStable > 100 && this.strategy.consolidateToBase && this.strategy.baseCurrency === 'USDT') {
      // USDT-centric: consolidate DAI/USDC → USDT when non-USDT share exceeds threshold
      const nonUsdt = stableBals.DAI + stableBals.USDC
      const threshold = this.strategy.consolidateThreshold || 0.30
      if (nonUsdt > totalStable * threshold) {
        for (const sym of ['DAI', 'USDC']) {
          const bal = stableBals[sym]
          if (bal > 100 && this._hasPair(sym, 'USDT')) {
            // Keep $50 of each non-USDT stable for diversity, swap the rest
            const swapAmt = Math.floor((bal - 50) * 100) / 100
            if (swapAmt > 50) {
              actions.push({
                type: 'swap',
                tokenIn: sym,
                tokenOut: 'USDT',
                amount: swapAmt,
                reason: `USDT-centric: consolidate ${swapAmt} ${sym} → USDT (non-USDT at ${((nonUsdt / totalStable) * 100).toFixed(0)}%, threshold ${(threshold * 100).toFixed(0)}%)`,
                priority: 'medium'
              })
            }
          }
        }
      }
    } else if (totalStable > 100) {
      // Equal-weight: rebalance across stables
      const idealPer = totalStable / 3
      for (const [sym, bal] of Object.entries(stableBals)) {
        const excess = bal - idealPer
        if (excess > totalStable * 0.25) {
          const lowestSym = Object.entries(stableBals)
            .filter(([s]) => s !== sym)
            .sort((a, b) => a[1] - b[1])[0]?.[0]
          if (lowestSym && this._hasPair(sym, lowestSym)) {
            const swapAmt = Math.floor(excess * 0.4 * 100) / 100
            if (swapAmt > 10) {
              actions.push({
                type: 'swap',
                tokenIn: sym,
                tokenOut: lowestSym,
                amount: swapAmt,
                reason: `${sym} overweight (${((bal / totalStable) * 100).toFixed(0)}%) — rebalance to ${lowestSym}`,
                priority: 'low'
              })
            }
          }
        }
      }
    }

    // ─── Lucid Kite yield opportunity ───
    // If the strategy enables Lucid AND idle USDC > minMintAmount AND
    // Lucid net APY beats Aave by >= minYieldEdgeBps, propose a mint.
    const lcfg = this.strategy.lucid
    if (lcfg?.enabled && this.lucid && this.lucidYieldStates[lcfg.asset]) {
      const yieldOp = this._scoreLucidOpportunity(lcfg)
      if (yieldOp) actions.push(yieldOp)
    }

    // Gas check
    if (this.balances.ETH < 0.002) {
      actions.push({
        type: 'alert',
        level: 'warning',
        reason: `Low ETH for gas: ${this.balances.ETH.toFixed(6)} ETH`,
        priority: 'high'
      })
    }

    return actions
  }

  // ─── Custom Conditional Rules Engine ───

  /**
   * Add a conditional rule (parsed from NL by LLM)
   * @param {object} rule — { id, description, conditions, actions, oneShot }
   */
  addRule (rule) {
    rule.id = rule.id || `rule_${Date.now()}`
    rule.active = true
    rule.createdAt = new Date().toISOString()
    rule.triggeredCount = 0

    // Snapshot current state at rule creation (for relative conditions like "drops by X%")
    this._ruleSnapshots[rule.id] = {
      prices: { ...this.prices },
      supplied: { ...this.supplied },
      balances: { ...this.balances },
      aaveAccount: this.aaveAccount ? { ...this.aaveAccount } : null,
      aaveAPYs: { ...this.aaveAPYs }
    }

    this.rules.push(rule)
    this.log('rule_add', `Rule added: "${rule.description}"`, { id: rule.id, conditions: rule.conditions, actions: rule.actions })
    return rule
  }

  /** Remove a rule by id */
  removeRule (ruleId) {
    const idx = this.rules.findIndex(r => r.id === ruleId)
    if (idx === -1) return false
    const removed = this.rules.splice(idx, 1)[0]
    delete this._ruleSnapshots[ruleId]
    this.log('rule_remove', `Rule removed: "${removed.description}"`, { id: ruleId })
    return true
  }

  /** Get all rules */
  getRules () {
    return this.rules.map(r => ({ ...r }))
  }

  /**
   * Evaluate all active custom rules against current state.
   * Returns actions to execute if conditions are met.
   */
  _evaluateCustomRules () {
    const triggered = []

    for (const rule of this.rules) {
      if (!rule.active) continue

      const snapshot = this._ruleSnapshots[rule.id] || {}
      const allMet = rule.conditions.every(c => this._checkCondition(c, snapshot))

      if (allMet) {
        rule.triggeredCount++
        this.log('rule_trigger', `Rule triggered: "${rule.description}" (${rule.triggeredCount}x)`, { id: rule.id })

        for (const action of rule.actions) {
          triggered.push({
            ...action,
            reason: `[Rule] ${rule.description} — ${action.reason || action.type}`,
            priority: action.priority || 'high',
            _ruleId: rule.id
          })
        }

        // One-shot rules deactivate after first trigger
        if (rule.oneShot) {
          rule.active = false
          this.log('rule_deactivate', `One-shot rule deactivated: "${rule.description}"`)
        }
      }
    }

    return triggered
  }

  /**
   * Check a single condition against current state
   * @param {object} cond — { type, token, operator, value, reference }
   * @param {object} snapshot — initial state at rule creation
   */
  _checkCondition (cond, snapshot) {
    let current

    switch (cond.type) {
      case 'apr_below':
      case 'apy_below': {
        // Real Aave supply APY from on-chain ProtocolDataProvider
        const token = cond.token || 'USDT'
        current = this.aaveAPYs?.[token]?.supplyAPY || 0
        return current < cond.value
      }

      case 'apr_drop_pct': {
        // APY dropped by X% relative to initial snapshot
        const token = cond.token || 'USDT'
        const initialAPY = snapshot.aaveAPYs?.[token]?.supplyAPY || 0
        const currentAPY = this.aaveAPYs?.[token]?.supplyAPY || 0
        if (initialAPY <= 0) return false
        const dropPct = ((initialAPY - currentAPY) / initialAPY) * 100
        return dropPct >= cond.value
      }

      case 'balance_below': {
        const bal = (this.balances[cond.token] || 0) + (this.supplied[cond.token] || 0)
        return bal < cond.value
      }

      case 'balance_above': {
        const bal = (this.balances[cond.token] || 0) + (this.supplied[cond.token] || 0)
        return bal > cond.value
      }

      case 'price_below': {
        const price = this.prices?.[cond.token]?.usd || 0
        return price < cond.value
      }

      case 'price_above': {
        const price = this.prices?.[cond.token]?.usd || 0
        return price > cond.value
      }

      case 'price_drop_pct': {
        const initPrice = snapshot.prices?.[cond.token]?.usd || 0
        const curPrice = this.prices?.[cond.token]?.usd || 0
        if (initPrice <= 0) return false
        const dropPct = ((initPrice - curPrice) / initPrice) * 100
        return dropPct >= cond.value
      }

      case 'health_factor_below': {
        const hf = this.aaveAccount?.healthFactor || Infinity
        return hf < cond.value
      }

      case 'lending_pct_above': {
        const pct = parseFloat(this._currentLendingPct())
        return pct > cond.value
      }

      case 'lending_pct_below': {
        const pct = parseFloat(this._currentLendingPct())
        return pct < cond.value
      }

      default:
        return false
    }
  }

  _compare (a, op, b) {
    switch (op) {
      case '>': return a > b
      case '<': return a < b
      case '>=': return a >= b
      case '<=': return a <= b
      case '==': return a === b
      default: return false
    }
  }

  /** Parse interval string to ms */
  _parseInterval (str) {
    const match = str.match(/^(\d+)(s|m|h)$/)
    if (!match) return null
    const val = parseInt(match[1])
    const unit = match[2]
    return val * ({ s: 1000, m: 60_000, h: 3_600_000 }[unit])
  }

  /** Resolve Uniswap contract addresses from env vars (undefined → swap.js defaults) */
  _uniswapAddrs () {
    if (process.env.UNISWAP_ROUTER) {
      return {
        SWAP_ROUTER: process.env.UNISWAP_ROUTER,
        QUOTER_V2: process.env.UNISWAP_QUOTER,
        FACTORY: process.env.UNISWAP_FACTORY
      }
    }
    return undefined
  }

  /** Check if a swap pair exists */
  _hasPair (tokenA, tokenB) {
    return this.swapPairs.some(p =>
      (p.tokenA === tokenA && p.tokenB === tokenB) ||
      (p.tokenA === tokenB && p.tokenB === tokenA)
    )
  }

  /** Pick stablecoin with highest wallet balance */
  _pickBestStable () {
    let best = null
    let max = 0
    for (const sym of ['USDT', 'DAI', 'USDC']) {
      if ((this.balances[sym] || 0) > max) {
        max = this.balances[sym]
        best = sym
      }
    }
    return best
  }

  /**
   * Score "idle USDC on source chain → mint L-USDC on KiteAI" as a yield opportunity.
   *
   * Inputs:
   *  - Aave native supply APY for `asset` (this.aaveAPYs[asset].supplyAPY) — what we'd earn parked in Aave today
   *  - Lucid yield state — totalLocked, aaveDeposited, bufferRatio, utilization
   *
   * Heuristic for implied Lucid APY:
   *  Lucid puts ~90% of its collateral into Aave v3 (per docs). A first-order
   *  estimate of holder yield is therefore (aaveDeposited / totalLocked) * AaveAPY,
   *  with a small fee haircut. We only propose a mint when the edge clears the
   *  configured threshold AND the buffer ratio is healthy (else mint may be paused
   *  or settlement will be slow on burn).
   *
   * Returns an action object or null.
   */
  _scoreLucidOpportunity (lcfg) {
    const asset = lcfg.asset || 'USDC'
    const state = this.lucidYieldStates[asset]
    if (!state) return null

    // Idle balance available for minting on the source chain
    // (Note: in this single-chain-signer model, "balance" = wallet[asset] on whatever
    //  chain the signer is connected to. The agent caller is responsible for switching
    //  chain context to lcfg.sourceChain before executing.)
    const idle = this.balances[asset] || 0
    const keep = lcfg.keepBuffer ?? 100
    const mintable = Math.max(0, idle - keep)
    if (mintable < (lcfg.minMintAmount ?? 50)) return null

    // Aave native supply APY for the same asset (decimal, e.g. 0.045 = 4.5%)
    const aaveAPY = this.aaveAPYs?.[asset]?.supplyAPY || 0

    // Implied Lucid net APY: (deposited / locked) * Aave APY * (1 - haircut)
    const HAIRCUT = 0.05  // 5% haircut for protocol fees / unallocated buffer
    const aaveShare = state.totalLocked > 0
      ? state.aaveDeposited / state.totalLocked
      : 0.9  // assume documented 90% if zero division
    const impliedLucidAPY = aaveAPY * aaveShare * (1 - HAIRCUT)

    // Edge in basis points
    const edgeBps = (impliedLucidAPY - aaveAPY) * 10000
    const minEdgeBps = lcfg.minYieldEdgeBps ?? 50

    // Health check: don't mint into a stressed pool
    const bufferOk = state.bufferRatio == null || state.bufferRatio >= 8 // ≥ 8% buffer
    const utilizationOk = state.utilizationBps == null || state.utilizationBps < 9000

    if (!bufferOk || !utilizationOk) {
      return {
        type: 'alert',
        level: 'info',
        reason: `Lucid ${asset} skip: buffer=${state.bufferRatio?.toFixed(1)}% util=${(state.utilizationBps / 100).toFixed(1)}%`,
        priority: 'low'
      }
    }

    // Lucid loses by this metric — but might still be worth it if Aave APY is ~0
    // and the user explicitly wants KiteAI exposure. Defer to LLM in that case.
    if (edgeBps < minEdgeBps) return null

    return {
      type: 'lucid_mint',
      asset,
      amount: Math.floor(mintable * 100) / 100,
      sourceChain: lcfg.sourceChain || 'arbitrum',
      targetChain: lcfg.targetChain || 'kiteai',
      reason: `Lucid edge: implied ${(impliedLucidAPY * 100).toFixed(2)}% vs Aave ${(aaveAPY * 100).toFixed(2)}% (+${edgeBps.toFixed(0)}bps); mint ${mintable.toFixed(2)} ${asset} → L-${asset} on KiteAI`,
      priority: 'medium',
      confidence: Math.min(0.95, 0.6 + edgeBps / 1000),
      _yieldEdgeBps: edgeBps
    }
  }

  /** Pick supplied token with highest balance */
  _pickBestSupplied () {
    let best = null
    let max = 0
    for (const [sym, amt] of Object.entries(this.supplied)) {
      if (amt > max) { max = amt; best = sym }
    }
    return best
  }

  /**
   * Execute an action on-chain with confirmation + retry
   * @param {object} action
   * @param {number} [attempt=1] - Current retry attempt
   * @returns {object} result
   */
  async execute (action, attempt = 1) {
    const MAX_RETRIES = 2

    // ─── User-policy veto (hard) — chains/venues/actions/assets allow-deny ───
    if (this.policy && action.type !== 'alert') {
      const verdict = this.policy.evaluate(action)
      if (!verdict.ok) {
        this.log('policy_veto', `Policy rejected: ${verdict.reason}`, { action })
        return { error: verdict.reason, vetoed: true, vetoedBy: 'policy' }
      }
    }

    // ─── Risk-engine veto (hard) ───
    if (this.risk && action.type !== 'alert' && action.type !== 'skill') {
      const portfolioState = {
        equityUSD: this.portfolio?.totalUSD || 0,
        positions: Object.fromEntries(
          (this.perpsSnapshot?.positions || []).map(p => [p.symbol, Math.abs(p.positionValue || 0)])
        ),
        priceFor: (sym) => this.prices?.[sym]?.usd || 0,
        gasEstimateUSD: 0
      }
      const verdict = this.risk.evaluate(action, portfolioState)
      if (!verdict.ok) {
        this.log('risk_veto', `RiskEngine vetoed: ${verdict.reason}`, { action })
        // Notify the user about safety-critical vetoes (drawdown / kill switch)
        if (verdict.reason.includes('drawdown')) {
          this.notifier?.drawdownBreaker(
            this.risk._dailyDrawdown(portfolioState.equityUSD) || 0,
            portfolioState.equityUSD
          )
        } else if (verdict.reason.includes('kill switch')) {
          this.notifier?.killSwitch(true)
        }
        return { error: verdict.reason, vetoed: true }
      }
      if (verdict.clamped) {
        this.log('risk_clamp', `RiskEngine clamped`, { from: action, to: verdict.clamped })
        Object.assign(action, verdict.clamped)
      }
      this.risk.recordEquity(portfolioState.equityUSD)
    }

    this.log('execute', `Executing ${action.type}: ${action.reason}${attempt > 1 ? ` (retry ${attempt}/${MAX_RETRIES})` : ''}`, action)

    try {
      let result
      switch (action.type) {
        case 'lending_supply':
          // If supplying WETH but balance is low, wrap ETH first
          if (action.token === 'WETH') {
            const wethBal = this.balances.WETH || 0
            if (wethBal < action.amount) {
              const toWrap = action.amount - wethBal + 0.0001
              const ethAvail = this.balances.ETH - 0.002
              if (ethAvail >= toWrap) {
                this.log('wrap', `Wrapping ${toWrap.toFixed(6)} ETH → WETH`)
                await this.wallet.wrapEth(toWrap)
              }
            }
          }
          try {
            result = await this.aave.supply(action.token, action.amount)
          } catch (supplyErr) {
            // Aave error "51" = SUPPLY_CAP_EXCEEDED — add to blocked list
            if (supplyErr.message?.includes('"51"')) {
              this._supplyCapped = this._supplyCapped || new Set()
              this._supplyCapped.add(action.token)
              this.log('cap', `Supply cap exceeded for ${action.token} — skipping future supplies`)
              result = { skipped: true, reason: `Supply cap exceeded for ${action.token}` }
            } else {
              throw supplyErr
            }
          }
          break

        case 'lending_withdraw':
          result = await this.aave.withdraw(action.token, action.amount)
          break

        case 'swap':
          result = await this.swap.sell(
            action.tokenIn || action.token, action.tokenOut, action.amount, 2
          )
          break

        case 'bridge':
          result = await this.bridge.bridge(action.targetChain, action.amount, action.recipient)
          break

        case 'lucid_mint': {
          if (!this.lucid) throw new Error('Lucid bridge not initialized')
          if (!this.chainContext) throw new Error('Multi-chain context required for lucid_mint — set PRIVATE_KEY')
          // Mints originate on the Lucid lock chain (Arbitrum for USDC/WETH).
          // Switch to a signer wired to that chain rather than assuming the
          // primary signer is already there.
          const sourceChain = action.sourceChain || 'arbitrum'
          const signer = this.chainContext.getSigner(sourceChain)
          const lucidOnSource = new LucidKiteBridge({ signer })
          result = await lucidOnSource.mint(
            action.asset || 'USDC',
            action.targetChain || 'kiteai',
            action.amount,
            action.recipient,
            { gasManager: this.gas }
          )
          break
        }

        case 'lucid_burn': {
          if (!this.lucid) throw new Error('Lucid bridge not initialized')
          if (!this.chainContext) throw new Error('Multi-chain context required for lucid_burn — set PRIVATE_KEY')
          // Burns originate on KiteAI (or wherever the L-token lives).
          const sourceChain = action.sourceChain || 'kiteai'
          const signer = this.chainContext.getSigner(sourceChain)
          const lucidOnSource = new LucidKiteBridge({ signer })
          result = await lucidOnSource.burn(
            action.asset || 'USDC',
            action.targetChain || 'arbitrum',
            action.amount,
            action.recipient,
            { gasManager: this.gas }
          )
          break
        }

        case 'perps_open': {
          if (!this.perps) throw new Error('Perps adapter not initialized')
          // Risk-engine guard: cap leverage at strategy.perps.maxLeverage
          const cap = this.strategy?.perps?.maxLeverage ?? 5
          const lev = Math.min(action.leverage ?? 1, cap)
          if (action.leverage && action.leverage > cap) {
            this.log('risk_clamp', `Clamping leverage ${action.leverage}x → ${cap}x for ${action.symbol}`)
          }
          {
            const stopPct = action.stopPct ?? this.strategy?.perps?.defaultStopPct
            const tpPct = action.tpPct ?? this.strategy?.perps?.defaultTakeProfitPct
            result = await this.perps.openPosition({
              symbol: action.symbol,
              side: action.side,
              size: action.size,
              leverage: lev,
              limitPx: action.limitPx,
              reduceOnly: action.reduceOnly,
              isolated: action.isolated,
              stopPx: action.stopPx,
              stopPct,
              takeProfitPx: action.takeProfitPx,
              tpPct
            })
            // If venue-side trigger orders failed to register, fall back to a
            // Kard-side stop watcher so the position is still protected.
            if (result?.triggerVerification?.ok === false && this.stopWatcher) {
              const mid = (await this.perps.getMids().catch(() => ({})))[action.symbol]
              const entry = action.limitPx || mid
              const stopPx = action.stopPx ?? (stopPct && entry
                ? (action.side === 'long' ? entry * (1 - stopPct) : entry * (1 + stopPct))
                : null)
              const tpPx = action.takeProfitPx ?? (tpPct && entry
                ? (action.side === 'long' ? entry * (1 + tpPct) : entry * (1 - tpPct))
                : null)
              this.stopWatcher.watch({
                symbol: action.symbol, side: action.side, size: action.size,
                entryPx: entry, stopPx, tpPx
              })
              this.log('stop_watch', `Venue stops failed to register for ${action.symbol} — Kard-side watcher armed`,
                { stopPx, tpPx })
              this.notifier?.warning('stop_fallback',
                `⚠ Venue trigger orders for ${action.symbol} didn't register. Kard is watching the price as fallback.`)
            }
          }
          break
        }

        case 'perps_close':
          if (!this.perps) throw new Error('Perps adapter not initialized')
          result = await this.perps.closePosition(action.symbol, action.size || null)
          break

        case 'skill': {
          // LLM-invoked skill — { name, tool, params }
          if (!this.skills) throw new Error('Skill registry not attached — pass { skills } to TreasuryAgent or use createAgent()')
          result = await this.skills.invoke(action.name, action.tool, action.params || {}, {
            allowWrites: action.allowWrites === true
          })
          break
        }

        case 'transfer':
          result = await this.wallet.transfer(action.token, action.to, action.amount)
          break

        case 'alert':
          result = { acknowledged: true }
          break

        default:
          result = { skipped: true, reason: `Unhandled action type: ${action.type}` }
      }

      // Verify tx receipt if present
      if (result.tx && !result.skipped) {
        if (result.receipt?.status === 0) {
          throw new Error(`Transaction reverted: ${result.tx}`)
        }
        this.log('execute_done', `Confirmed ${action.type} (tx: ${result.tx})`, {
          tx: result.tx,
          gasUsed: result.gasUsed,
          status: 'confirmed'
        })
      } else {
        this.log('execute_done', `Completed ${action.type}`, {
          tx: result.tx,
          gasUsed: result.gasUsed
        })
      }

      // Track tx with reconciler so we self-heal on drops/replacements
      if (this.reconciler && result.tx && !result.skipped) {
        this.reconciler.track(result.tx, action)
      }

      // Bookkeeper: record this action's economic effect
      if (this.bookkeeper && !result.skipped && action.type !== 'alert') {
        try {
          this.bookkeeper.record(action, result, {
            priceFor: (s) => this.prices?.[s]?.usd || 0
          })
        } catch (e) { this.log('bookkeep', `record failed: ${e.message}`) }
      }

      // Kite attestation — fire-and-forget; never block the cycle on it.
      // Skips on alerts/skipped results (no on-chain effect to attest).
      if (this.attestor && !result.skipped && action.type !== 'alert') {
        this.attestor.attest(action, result, {
          cycle: this._cycleCount,
          address: this.wallet?.address,
          strategy: this.strategy?.name
        }).then(att => {
          if (att?.txHash) {
            this.log('kite_attest', `Attested on KiteAI: ${att.txHash}`, {
              hash: att.hash, mode: att.mode, explorer: att.explorerUrl
            })
          } else if (att?.error) {
            this.log('kite_attest', `Attestation failed: ${att.error}`)
          }
        }).catch(e => this.log('kite_attest', `Attest error: ${e.message}`))
      }

      return result
    } catch (e) {
      // Retry on transient network errors
      const transient = /nonce|timeout|NETWORK_ERROR|replacement fee|ETIMEDOUT|ECONNRESET/i
      if (transient.test(e.message) && attempt <= MAX_RETRIES) {
        const delayMs = 2000 * attempt
        this.log('retry', `Transient error: ${e.message} — retrying in ${delayMs}ms (attempt ${attempt}/${MAX_RETRIES})`)
        await new Promise(r => setTimeout(r, delayMs))
        return this.execute(action, attempt + 1)
      }

      this.logError('execute', e, action)
      return { error: e.message }
    }
  }

  /** Add a step to the current cycle's reasoning trail */
  _reason (phase, message, detail = null) {
    const step = { ts: new Date().toISOString(), phase, message }
    if (detail) step.detail = detail
    this.reasoningTrail.push(step)
  }

  /**
   * Run a single agent cycle: refresh → evaluate → execute
   * Each phase is logged to the reasoning trail for transparency
   */
  async cycle () {
    this._cycleCount++
    const cycleId = this._cycleCount

    // Reset reasoning trail for this cycle
    this.reasoningTrail = [{ ts: new Date().toISOString(), phase: 'start', message: `Cycle #${cycleId} started` }]

    try {
      // Phase 1: Refresh on-chain state
      this._reason('refresh', 'Fetching on-chain state: balances, Aave positions, prices, APYs')
      await this.refresh()
      const lPct = this._currentLendingPct()
      this._reason('refresh', `State loaded: $${this.portfolio?.totalUSD?.toFixed(2) || '?'} total, ${lPct}% in lending`, {
        balances: Object.fromEntries(Object.entries(this.balances).filter(([, v]) => v > 0)),
        supplied: Object.fromEntries(Object.entries(this.supplied).filter(([, v]) => v > 0)),
        lendingPct: lPct,
        healthFactor: this.aaveAccount?.healthFactor
      })

      // Phase 2: Evaluate — propose actions
      this._reason('evaluate', 'Running rule engine + LLM analysis')
      const actions = await this.evaluate()

      if (actions.length > 0) {
        // Build a multi-step plan description
        const plan = actions.map((a, i) => `${i + 1}. ${a.type}${a.token ? ' ' + a.token : ''}${a.tokenOut ? ' → ' + a.tokenOut : ''} ${a.amount || ''} — ${a.reason || ''}`).join('\n')
        this._reason('plan', `${actions.length} action(s) proposed`, { steps: plan })
        this.log('cycle', `Cycle #${cycleId}: ${actions.length} action(s) proposed`, {
          actions: actions.map(a => ({ type: a.type, reason: a.reason }))
        })

        // Phase 3: Execute each action
        for (const action of actions) {
          if (action.type === 'alert') {
            this._reason('alert', action.reason, { level: action.level })
            this.log('alert', action.reason, { level: action.level })
            continue
          }
          if (!this.paused) {
            this._reason('execute', `Executing: ${action.type} ${action.token || ''} ${action.amount || ''}`)
            const result = await this.execute(action)
            if (result?.error) {
              this._reason('error', `Failed: ${result.error}`, { action: action.type })
            } else if (result?.skipped) {
              this._reason('skip', result.reason || 'Skipped')
            } else {
              this._reason('done', `Confirmed: ${action.type}${result?.tx ? ' tx:' + result.tx.slice(0, 10) + '...' : ''}`)
            }
          } else {
            this._reason('paused', `Skipping ${action.type} (agent paused)`)
            this.log('skip', `Paused — skipping ${action.type}`, action)
          }
        }
      } else {
        this._reason('plan', 'No actions needed — holding position', {
          lendingPct: lPct,
          targetLending: this.strategy?.allocations?.lending
        })
        this.log('cycle', `Cycle #${cycleId}: no actions needed`, {
          balances: this.balances,
          supplied: this.supplied,
          lendingPct: lPct
        })
      }

      this._reason('complete', `Cycle #${cycleId} complete`)
    } catch (e) {
      this._reason('error', `Cycle failed: ${e.message}`)
      this.logError('cycle', e)
    }

    // Save trail for dashboard access
    this.lastReasoningTrail = [...this.reasoningTrail]
  }

  _currentLendingPct () {
    const ethPrice = this.prices?.ETH?.usd || 2600
    const suppliedUSD = (this.supplied.USDT || 0) + (this.supplied.DAI || 0) +
      (this.supplied.USDC || 0) + (this.supplied.WETH || 0) * ethPrice
    const walletUSD = (this.balances.USDT || 0) + (this.balances.DAI || 0) +
      (this.balances.USDC || 0) + (this.balances.WETH || 0) * ethPrice +
      (this.balances.ETH || 0) * ethPrice
    const total = walletUSD + suppliedUSD
    return total > 0 ? ((suppliedUSD / total) * 100).toFixed(1) : '0.0'
  }

  /** Start the autonomous loop */
  start (intervalMs) {
    if (intervalMs) this.pollIntervalMs = intervalMs
    this.active = true
    this.paused = false
    this.log('start', `Agent loop started (interval: ${this.pollIntervalMs / 1000}s)`)
    if (this.defender) this.defender.start()
    this._scheduleNext()
  }

  /** Stop the autonomous loop */
  stop () {
    this.active = false
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
    if (this.defender) this.defender.stop()
    if (this.notifier) this.notifier.stop()
    this.log('stop', 'Agent loop stopped')
  }

  /** Pause execution (still evaluates but doesn't execute) */
  pause () {
    this.paused = true
    this.log('pause', 'Agent paused — will evaluate but not execute')
  }

  /** Resume execution */
  resume () {
    this.paused = false
    this.log('resume', 'Agent resumed')
  }

  _scheduleNext () {
    if (!this.active) return
    this.nextCheckAt = new Date(Date.now() + this.pollIntervalMs).toISOString()
    this._timer = setTimeout(async () => {
      try {
        this.nextCheckAt = null
        await this.cycle()
      } catch (e) {
        this.logError('schedule', e)
      }
      this._scheduleNext()
    }, this.pollIntervalMs)
  }

  /** Get full snapshot for API/dashboard */
  getSnapshot () {
    return {
      address: this.wallet?.address,
      walletSource: this.walletSource || 'unknown',
      wdkInfo: this.wallet?.getInfo?.() || null,
      active: this.active,
      paused: this.paused,
      cycle: this._cycleCount,
      strategy: this.strategy,
      balances: this.balances,
      supplied: this.supplied,
      aaveAccount: this.aaveAccount,
      aaveAPYs: this.aaveAPYs,
      portfolio: this.portfolio,
      prices: this.prices,
      lendingPct: this._currentLendingPct(),
      swapPairs: this.swapPairs,
      swapProvider: this.swapProvider || 'uniswap',
      bridgeChains: this.bridgeChains,
      bridgeRoutes: this.bridgeRoutes,
      lucid: this.lucid ? {
        enabled: true,
        assets: this.lucid.getAssets(),
        yieldStates: this.lucidYieldStates,
        balances: this.lucidBalances
      } : { enabled: false },
      perps: this.perps ? {
        enabled: true,
        network: this.perps.network,
        hasSigner: !!this.perps.apiWallet,
        userAddress: this.perps.userAddress,
        snapshot: this.perpsSnapshot
      } : { enabled: false },
      chains: this.chainContext ? this.chainContext.list() : [],
      gasSnapshot: this._lastGasSnapshot || null,
      attestations: this.attestor ? {
        enabled: this.attestor.enabled,
        mode: this.attestor.contractAddress ? 'contract' : 'self',
        contract: this.attestor.contractAddress,
        recent: this.attestor.list({ limit: 10 })
      } : { enabled: false },
      opportunities: this.lastOpportunities,
      passport: this.passport ? {
        enabled: true,
        address: this.passport.address || null,
        email: this.passport.email || null
      } : { enabled: false },
      risk: this.risk ? this.risk.state(this.portfolio?.totalUSD || 0) : null,
      reconcile: this._lastReconcile || null,
      earnings: this.bookkeeper ? this.bookkeeper.earnings(this.portfolio?.totalUSD) : null,
      x402: getX402ClientInfo(this.x402),
      llm: {
        enabled: this.llmEnabled,
        connected: !!this.llm,
        model: this.llm?.model || null,
        lastDecision: this._lastLlmDecision || null
      },
      reasoningTrail: this.lastReasoningTrail,
      nextCheck: {
        at: this.nextCheckAt,
        intervalMs: this.pollIntervalMs,
        reason: this.nextCheckReason
      },
      rules: this.rules.map(r => ({ id: r.id, description: r.description, active: r.active, triggeredCount: r.triggeredCount, oneShot: r.oneShot, conditions: r.conditions, actions: r.actions, createdAt: r.createdAt })),
      recentActions: this.actionLog.slice(-50),
      recentErrors: this.errors.slice(-10)
    }
  }

  /** Log an event */
  log (type, message, data = {}) {
    const entry = { ts: new Date().toISOString(), type, message, data }
    this.actionLog.push(entry)
    if (this.actionLog.length > 2000) {
      this.actionLog = this.actionLog.slice(-1000)
    }
    console.log(`[kard] [${type}] ${message}`)
  }

  logError (context, error, extra = {}) {
    const entry = {
      ts: new Date().toISOString(),
      context,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      extra
    }
    this.errors.push(entry)
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(-50)
    }
    console.error(`[kard] [ERROR:${context}] ${error.message}`)
  }
}
