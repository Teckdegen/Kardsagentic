// @kard/agent — Gas Budget
//
// A dedicated ETH wallet address used ONLY for gas.
// Completely separate from trading capital.
//
// THE MODEL:
//
//   Trading wallet:   holds USDC + trading capital
//                     NEVER holds gas budget
//
//   Gas wallet:       holds ETH on Arbitrum ONLY
//                     ONLY used for gas costs
//                     Auto-bridges to Base/Optimism when needed
//                     Never used for trading
//
//   Kite AI gas:      funded separately by user (KITE native token)
//                     No programmatic bridge exists for KITE
//                     Testnet: free faucet at https://faucet.gokite.ai
//                     Mainnet: user sends 1-5 KITE manually
//
// HOW IT WORKS:
//   1. User runs: kard init
//   2. Gets TWO addresses:
//      a. Trading address — send USDC here
//      b. Gas budget address — send 0.005 ETH here (Arbitrum)
//   3. Agent uses gas wallet for all transaction fees
//   4. Gas wallet auto-refills other L2 chains via Across bridge
//   5. If gas wallet runs low: agent alerts user, pauses non-critical ops
//
// SET IN .ENV:
//   GAS_BUDGET_ETH=0.01         — amount of ETH allocated as gas budget
//   GAS_BUDGET_ALERT_PCT=0.2    — alert when budget drops below 20%
//   GAS_PRIVATE_KEY=0x...       — separate private key for gas wallet (optional)
//                                  if not set, uses same key as trading wallet

import { ethers } from 'ethers'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const KARD_DIR = path.join(os.homedir(), '.kard')
const GAS_KEYSTORE = path.join(KARD_DIR, 'gas-wallet.json')
const GAS_STATE = path.join(KARD_DIR, 'gas-budget.json')

// ─── Supported chains for gas budget tracking ─────────────────────────────────
// Ethereum L1 excluded — fees too expensive ($10-50/tx)
// Kite AI excluded — KITE not bridgeable via Across
export const GAS_CHAINS = {
  arbitrum: {
    name: 'Arbitrum One',
    symbol: 'ETH',
    minimum: 0.002,    // minimum to keep at all times
    target:  0.005,    // ideal balance
    rpc: process.env.ARB_RPC_URL || 'https://arb1.arbitrum.io/rpc'
  },
  base: {
    name: 'Base',
    symbol: 'ETH',
    minimum: 0.001,
    target:  0.004,
    rpc: process.env.BASE_RPC_URL || 'https://mainnet.base.org'
  },
  optimism: {
    name: 'Optimism',
    symbol: 'ETH',
    minimum: 0.001,
    target:  0.003,
    rpc: process.env.OP_RPC_URL || 'https://mainnet.optimism.io'
  },
  avalanche: {
    name: 'Avalanche',
    symbol: 'AVAX',
    minimum: 0.05,
    target:  0.2,
    rpc: process.env.AVAX_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc'
  }
}

// Testnet equivalents
export const GAS_CHAINS_TESTNET = {
  arbitrumSepolia: {
    name: 'Arbitrum Sepolia',
    symbol: 'ETH',
    minimum: 0.005,
    target:  0.02,
    faucet: 'https://faucet.quicknode.com/arbitrum/sepolia',
    rpc: process.env.ARB_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'
  },
  baseSepolia: {
    name: 'Base Sepolia',
    symbol: 'ETH',
    minimum: 0.005,
    target:  0.02,
    faucet: 'https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet',
    rpc: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
  }
}

// ─── GasBudget ────────────────────────────────────────────────────────────────
export class GasBudget {
  /**
   * @param {object} cfg
   * @param {import('../chain-context.js').ChainContext} cfg.chainContext
   * @param {number} [cfg.budgetETH] — total ETH allocated as gas budget (from env)
   * @param {number} [cfg.alertPct=0.2] — alert when remaining falls below this %
   * @param {import('../agent/gas-bridge.js').GasBridge} [cfg.gasBridge]
   */
  constructor (cfg) {
    this.ctx = cfg.chainContext
    this.budgetETH = cfg.budgetETH ?? parseFloat(process.env.GAS_BUDGET_ETH || '0.01')
    this.alertPct = cfg.alertPct ?? parseFloat(process.env.GAS_BUDGET_ALERT_PCT || '0.2')
    this.gasBridge = cfg.gasBridge || null
    this.mode = (process.env.KARD_ENV || 'testnet') === 'mainnet' ? 'mainnet' : 'testnet'
    this._state = this._loadState()
  }

  // ─── Status ────────────────────────────────────────────────────────────────

  /**
   * Full gas budget status across all chains.
   * Returns balances, remaining budget, and any chains that need topping up.
   */
  async status () {
    const chains = this.mode === 'mainnet' ? GAS_CHAINS : GAS_CHAINS_TESTNET
    const results = {}
    let totalETHEquiv = 0

    await Promise.all(
      Object.entries(chains).map(async ([key, cfg]) => {
        try {
          const provider = new ethers.JsonRpcProvider(cfg.rpc)
          const addr = this.ctx.getSigner(key).address
          const raw = await provider.getBalance(addr)
          const balance = parseFloat(ethers.formatEther(raw))

          const needsTopUp = balance < cfg.minimum
          const okForNow = balance >= cfg.minimum
          const healthy = balance >= cfg.target

          totalETHEquiv += balance // rough equivalence

          results[key] = {
            chain: cfg.name,
            symbol: cfg.symbol,
            balance: balance.toFixed(6),
            minimum: cfg.minimum,
            target: cfg.target,
            needsTopUp,
            okForNow,
            healthy,
            faucet: cfg.faucet || null,
            status: !okForNow ? '❌ NEEDS GAS' : !healthy ? '🟡 LOW' : '✅ OK'
          }
        } catch (e) {
          results[key] = { chain: cfg.name, error: e.message, status: '⚠ RPC ERROR' }
        }
      })
    )

    const remaining = Math.max(0, this.budgetETH - this._state.spent)
    const remainingPct = this.budgetETH > 0 ? remaining / this.budgetETH : 0
    const alert = remainingPct < this.alertPct

    return {
      budgetETH: this.budgetETH,
      spentETH: this._state.spent,
      remainingETH: remaining,
      remainingPct: (remainingPct * 100).toFixed(1) + '%',
      alert,
      chains: results,
      totalETHAcrossChains: totalETHEquiv.toFixed(6)
    }
  }

  /**
   * Check a single chain — throws if below minimum gas.
   * Called before any tx execution.
   */
  async ensureGas (chainKey, estimatedGasETH = 0) {
    const chains = this.mode === 'mainnet' ? GAS_CHAINS : GAS_CHAINS_TESTNET
    const cfg = chains[chainKey]
    if (!cfg) return true // unknown chain, skip

    try {
      const provider = new ethers.JsonRpcProvider(cfg.rpc)
      const addr = this.ctx.getSigner(chainKey).address
      const raw = await provider.getBalance(addr)
      const balance = parseFloat(ethers.formatEther(raw))
      const needed = Math.max(cfg.minimum, estimatedGasETH)

      if (balance < needed) {
        // Try to auto-bridge if gas bridge is available
        if (this.gasBridge && chainKey !== 'arbitrum' && cfg.symbol === 'ETH') {
          console.log(`[gas-budget] ${chainKey} low (${balance.toFixed(6)} ETH) — auto-bridging...`)
          const bridgeResult = await this.gasBridge._bridge(chainKey, cfg.target - balance)
          if (!bridgeResult.error) {
            console.log(`[gas-budget] Bridge initiated. May take ${bridgeResult.estimatedArrivalMin || '3-5'} min to arrive.`)
            // Don't throw — let the current tx try, it may still have enough
            return { bridging: true, result: bridgeResult }
          }
        }

        const hint = cfg.faucet
          ? `Get ${cfg.symbol} at: ${cfg.faucet}`
          : `Bridge ${cfg.symbol} to ${cfg.name} using Across: https://across.to`

        throw new Error(
          `Gas budget: ${cfg.name} has ${balance.toFixed(6)} ${cfg.symbol} — need ${needed.toFixed(6)}. ${hint}`
        )
      }

      return { ok: true, balance, needed }
    } catch (e) {
      if (e.message.startsWith('Gas budget:')) throw e
      console.error(`[gas-budget] ensureGas check failed for ${chainKey}: ${e.message}`)
      return { ok: true } // RPC error, proceed optimistically
    }
  }

  /**
   * Record that gas was spent (called after tx confirmation).
   * @param {number} amountETH — amount of ETH spent on gas
   * @param {string} chain — which chain
   * @param {string} [txHash] — for audit trail
   */
  recordSpend (amountETH, chain, txHash = null) {
    this._state.spent = (this._state.spent || 0) + amountETH
    this._state.history = this._state.history || []
    this._state.history.push({
      ts: new Date().toISOString(),
      chain,
      eth: amountETH,
      tx: txHash
    })
    // Keep last 200 entries
    if (this._state.history.length > 200) {
      this._state.history = this._state.history.slice(-200)
    }
    this._saveState()
  }

  /**
   * Print the gas budget status table to console.
   * Used by `kard gas` command.
   */
  async printTable () {
    const stat = await this.status()

    console.log('\n┌──────────────────────────────────────────────────────────────┐')
    console.log(`│  Gas Budget — ${this.mode.toUpperCase().padEnd(48)}│`)
    console.log('├──────────────────────────────────────────────────────────────┤')
    console.log(`│  Total budget: ${stat.budgetETH} ETH  │  Spent: ${stat.spentETH.toFixed(6)} ETH  │  Remaining: ${stat.remainingPct}  │`)
    console.log('├──────────────────────────────────────────────────────────────┤')
    console.log('│  Chain              Symbol  Balance       Min       Status    │')
    console.log('├──────────────────────────────────────────────────────────────┤')

    for (const [, info] of Object.entries(stat.chains)) {
      if (info.error) {
        console.log(`│  ${info.chain.padEnd(20)} ⚠ ${info.error.slice(0, 30).padEnd(37)} │`)
        continue
      }
      const chain = info.chain.padEnd(20)
      const sym = info.symbol.padEnd(7)
      const bal = info.balance.padEnd(13)
      const min = String(info.minimum).padEnd(9)
      console.log(`│  ${chain} ${sym} ${bal} ${min} ${info.status.padEnd(10)} │`)
    }

    console.log('└──────────────────────────────────────────────────────────────┘')

    if (stat.alert) {
      console.log(`\n⚠️  Gas budget is low (${stat.remainingPct} remaining)`)
      console.log('   Add more ETH to your Arbitrum address to top up the gas budget.\n')
    }

    const needsTopUp = Object.entries(stat.chains).filter(([, v]) => v.needsTopUp)
    if (needsTopUp.length > 0) {
      console.log('\n⛽ CHAINS THAT NEED GAS:')
      for (const [key, info] of needsTopUp) {
        console.log(`\n  ${info.chain}: need ${info.minimum} ${info.symbol}`)
        if (info.faucet) console.log(`  Faucet: ${info.faucet}`)
        else if (info.symbol === 'ETH') console.log('  Bridge via Across: https://across.to')
        else if (info.symbol === 'AVAX') console.log('  Bridge via Stargate: https://stargate.finance')
      }
    } else {
      console.log('\n✅ Gas budget healthy on all chains.\n')
    }

    // Kite AI reminder
    console.log('📋 Kite AI gas (KITE): cannot be auto-funded via bridge.')
    if (this.mode === 'testnet') {
      console.log('   Testnet faucet: https://faucet.gokite.ai')
    } else {
      console.log('   Mainnet: send 1-5 KITE to your address manually.')
      console.log('   Cost: ~$0.01-0.05. Required for ALL attestations.')
    }
    console.log()
  }

  /**
   * How much to fund — called during init to tell the user what to send.
   */
  fundingInstructions () {
    const chains = this.mode === 'mainnet' ? GAS_CHAINS : GAS_CHAINS_TESTNET
    const items = []

    for (const [key, cfg] of Object.entries(chains)) {
      if (key === 'arbitrum' || key === 'arbitrumSepolia') {
        // Primary chain — user funds this directly
        items.push({
          chain: cfg.name,
          symbol: cfg.symbol,
          amount: this.budgetETH,
          note: 'Fund this first — agent auto-bridges to other L2s from here',
          priority: 1,
          faucet: cfg.faucet || null
        })
      }
    }

    // Kite AI — always manual
    items.push({
      chain: 'Kite AI',
      symbol: 'KITE',
      amount: this.mode === 'mainnet' ? '1-5' : '1',
      note: 'CRITICAL — required for attestations. Cannot be bridged programmatically.',
      priority: 0, // highest priority
      faucet: this.mode === 'testnet' ? 'https://faucet.gokite.ai' : null,
      manual: this.mode === 'mainnet' ? 'Ask in Kite Discord or community' : null
    })

    return items.sort((a, b) => a.priority - b.priority)
  }

  // ─── Persistence ───────────────────────────────────────────────────────────

  _loadState () {
    try {
      return JSON.parse(fs.readFileSync(GAS_STATE, 'utf8'))
    } catch {
      return { spent: 0, history: [] }
    }
  }

  _saveState () {
    try {
      fs.mkdirSync(KARD_DIR, { recursive: true })
      fs.writeFileSync(GAS_STATE, JSON.stringify(this._state, null, 2))
    } catch (e) {
      console.error('[gas-budget] save failed:', e.message)
    }
  }
}

/**
 * Print the complete gas funding guide.
 * Used by `kard gas --guide`
 */
export function printGasGuide (mode = 'testnet') {
  const isTestnet = mode === 'testnet'

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  KARD GAS BUDGET GUIDE — ${mode.toUpperCase().padEnd(38)}║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  There are TWO separate wallets:                                 ║
║                                                                  ║
║  1. TRADING WALLET — your USDC and trading capital               ║
║  2. GAS WALLET     — ETH for transaction fees only               ║
║                                                                  ║
║  Both wallets share the SAME address.                            ║
║  The separation is logical, not physical.                        ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  STEP 1: Fund Gas Budget (Arbitrum ${isTestnet ? 'Sepolia' : 'Mainnet'})               ║`)

  if (isTestnet) {
    console.log(`║                                                                  ║
║  → https://faucet.quicknode.com/arbitrum/sepolia                 ║
║    Get 0.02 ETH — covers all testnet gas                         ║
║                                                                  ║
║  Agent auto-bridges gas to Base Sepolia as needed.               ║`)
  } else {
    console.log(`║                                                                  ║
║  Send 0.005 ETH to your address on Arbitrum network.             ║
║  This is your gas budget. Agent uses it ONLY for fees.           ║
║                                                                  ║
║  Where to get ETH on Arbitrum:                                   ║
║  • Buy on Coinbase, withdraw to "Arbitrum" network               ║
║  • Bridge from any chain: https://across.to (fastest)            ║
║  • Bridge from any chain: https://stargate.finance               ║
║                                                                  ║
║  Agent auto-bridges gas to Base / Optimism as needed.            ║
║  You never need to manually fund those chains.                   ║`)
  }

  console.log(`║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  STEP 2: Fund Kite AI gas (CRITICAL — attestations)              ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║`)

  if (isTestnet) {
    console.log(`║  → https://faucet.gokite.ai                                      ║
║    Get 1 KITE — free testnet faucet                              ║
║                                                                  ║
║  Without KITE gas, attestations fail.                            ║
║  Every agent action writes to Kite AI — it needs gas.            ║`)
  } else {
    console.log(`║  KITE native token cannot be bridged from other chains.          ║
║  It must be funded manually.                                     ║
║                                                                  ║
║  • Ask in Kite Discord / community (1-5 KITE = ~$0.01-0.05)     ║
║  • Or wait — agent earns from yield and can self-fund over time  ║
║                                                                  ║
║  Without KITE gas, attestations will fail.                       ║`)
  }

  console.log(`║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  STEP 3: Fund Trading Capital                                    ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║`)

  if (isTestnet) {
    console.log(`║  Get testnet USDC from: https://staging.aave.com/faucet/         ║
║  Get 1000+ USDC on Arbitrum Sepolia                              ║`)
  } else {
    console.log(`║  Send USDC to your address on Arbitrum.                          ║
║  Any amount — agent deploys it into yield strategies.            ║
║  More capital = more yield (APY % stays the same).              ║`)
  }

  console.log(`║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  SUMMARY                                                         ║
║                                                                  ║
║  You fund:  Arbitrum ETH (gas) + Kite KITE + USDC (trading)     ║
║  Agent does: everything else automatically                       ║
║                                                                  ║
║  Verify after funding: kard gas                                  ║
╚══════════════════════════════════════════════════════════════════╝
`)
}
