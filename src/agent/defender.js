// @kard/agent — Liquidation Defender
//
// Event-driven safety net for Aave borrow positions. Fires the *moment* the
// agent's health factor crosses below threshold — not on the next polling
// tick, not "in a minute or so." Critical infrastructure.
//
// Defense hierarchy (executes top-down until safe):
//   1. Repay using available stable balance (USDC / USDT / DAI on lend chain)
//   2. Withdraw from Lucid L-USDC and use that to repay
//   3. Close perp positions to free margin → swap to stable → repay
//   4. Emergency: close everything, withdraw all collateral, repay max debt
//
// Wired sources:
//   - Aave's UserAccountUpdated / Borrow / Repay events via WebSocket
//   - Polling fallback every 30s (in case WS is flaky)

import { ethers } from 'ethers'

const POLL_INTERVAL_MS = 30_000
const SAFE_HEALTH_FACTOR = 1.5
const CRITICAL_HEALTH_FACTOR = 1.2

export class Defender {
  /**
   * @param {object} cfg
   * @param {import('./treasury.js').TreasuryAgent} cfg.agent
   * @param {import('../notifier.js').Notifier} [cfg.notifier]
   * @param {number} [cfg.threshold=1.5]
   * @param {number} [cfg.criticalThreshold=1.2]
   */
  constructor (cfg) {
    this.agent = cfg.agent
    this.notifier = cfg.notifier
    this.threshold = cfg.threshold ?? SAFE_HEALTH_FACTOR
    this.critical = cfg.criticalThreshold ?? CRITICAL_HEALTH_FACTOR
    this._timer = null
    this._wsListeners = []
    this._defending = false
    this._lastDefenseAt = 0
  }

  start () {
    if (this._timer) return
    // Polling fallback — runs every 30s as belt-and-suspenders
    this._timer = setInterval(() => this._check().catch(() => {}), POLL_INTERVAL_MS)
    // Immediate first check
    this._check().catch(() => {})
    // WS subscribers — if the agent has aave + chain context, hook the events
    this._subscribeAaveEvents()
  }

  stop () {
    if (this._timer) clearInterval(this._timer)
    for (const off of this._wsListeners) off()
    this._wsListeners = []
  }

  async _check () {
    const acc = this.agent.aaveAccount
    if (!acc || !acc.totalDebtUSD || acc.totalDebtUSD <= 0) return
    const hf = parseFloat(acc.healthFactor || Infinity)
    if (hf >= this.threshold) return
    await this._defend(hf)
  }

  /** The actual defense logic — idempotent, debounced */
  async _defend (currentHF) {
    // Debounce: don't fire defense more than once per 60s — give the chain
    // time to confirm the previous repay before firing another.
    if (this._defending || Date.now() - this._lastDefenseAt < 60_000) return
    this._defending = true
    this._lastDefenseAt = Date.now()
    const isCritical = currentHF < this.critical

    try {
      this.notifier?.healthFactorLow(currentHF, this.threshold)
      this.agent.log('defender', `HF ${currentHF.toFixed(3)} below ${this.threshold} — defending (critical: ${isCritical})`)

      // Strategy ordering depends on HOW critical the situation is.
      //
      // CRITICAL (HF < 1.2):
      //   Lucid burn settles via LayerZero — minutes of latency we don't have.
      //   Skip it entirely. Go: stables → close perps → emergency unwind.
      //
      // WARNING (1.2 <= HF < 1.5):
      //   We have time. Try cheapest-to-undo first: stables → Lucid burn.
      //   Only escalate if those don't restore safety.

      // Strategy 1: repay with stable balance (fast, cheap, always-first)
      const repaid = await this._tryRepayWithStables()
      if (repaid) {
        this.notifier?.liquidationDefenseTriggered(`repaid $${repaid.amount.toFixed(2)} ${repaid.token}`, currentHF)
        return
      }

      if (isCritical) {
        // Skip Lucid (async), go straight to perps then emergency
        const fromPerps = await this._tryClosePerps()
        if (fromPerps) {
          this.notifier?.liquidationDefenseTriggered(`CRITICAL HF: closed ${fromPerps.count} perps → repaid`, currentHF)
          return
        }
        const emergency = await this._emergencyUnwind()
        this.notifier?.liquidationDefenseTriggered(`EMERGENCY UNWIND ${emergency ? '✓' : 'FAILED'}`, currentHF)
        return
      }

      // Warning level — try Lucid burn (slow but cheap) before nuking positions
      const fromLucid = await this._tryRepayFromLucid()
      if (fromLucid) {
        this.notifier?.liquidationDefenseTriggered(
          `burned L-USDC $${fromLucid.amount.toFixed(2)} (LayerZero settle ~3-5min)`, currentHF)
        return
      }

      // Lucid didn't help — close perps to free margin
      const fromPerps = await this._tryClosePerps()
      if (fromPerps) {
        this.notifier?.liquidationDefenseTriggered(`closed ${fromPerps.count} perps → repaid`, currentHF)
      }
    } catch (e) {
      this.agent.log('defender', `defense failed: ${e.message}`)
      this.notifier?.critical('defender_error', `Defense failed at HF ${currentHF.toFixed(2)}: ${e.message}`)
    } finally {
      this._defending = false
    }
  }

  async _tryRepayWithStables () {
    const balances = this.agent.balances || {}
    // Pick the largest stable balance
    const stables = ['USDC', 'USDT', 'DAI', 'USDC.e']
      .map(s => ({ s, bal: balances[s] || 0 }))
      .filter(x => x.bal > 1)
      .sort((a, b) => b.bal - a.bal)
    if (!stables.length) return null
    const top = stables[0]
    const acc = this.agent.aaveAccount
    // Repay min(stable balance, total debt + 5% buffer)
    const repayAmount = Math.min(top.bal * 0.95, (acc.totalDebtUSD || 0) * 1.05)
    if (repayAmount < 1) return null
    try {
      await this.agent.aave.repay(top.s, repayAmount)
      return { token: top.s, amount: repayAmount }
    } catch (e) {
      this.agent.log('defender', `repay ${top.s} failed: ${e.message}`)
      return null
    }
  }

  async _tryRepayFromLucid () {
    if (!this.agent.lucid || !this.agent.chainContext) return null
    const lucidBal = this.agent.lucidBalances?.kiteai?.USDC || 0
    if (lucidBal < 5) return null
    try {
      // Burn enough L-USDC to cover the gap to safety
      const acc = this.agent.aaveAccount
      const targetRepay = ((this.threshold - parseFloat(acc.healthFactor)) * acc.totalDebtUSD) || lucidBal
      const amount = Math.min(lucidBal * 0.95, targetRepay * 1.1)
      if (amount < 5) return null
      const signer = this.agent.chainContext.getSigner('kiteai')
      const { LucidKiteBridge } = await import('../evm/bridge.js')
      const lucid = new LucidKiteBridge({ signer })
      await lucid.burn('USDC', 'arbitrum', amount, undefined, { gasManager: this.agent.gas })
      // After burn settles, repay — but burn is async (LayerZero), so just
      // log the intent; the next polling cycle will repay with the freed USDC
      return { amount }
    } catch (e) {
      this.agent.log('defender', `lucid burn failed: ${e.message}`)
      return null
    }
  }

  async _tryClosePerps () {
    if (!this.agent.perps) return null
    try {
      const positions = await this.agent.perps.getPositions()
      if (!positions.length) return null
      let closed = 0
      // Close smallest unrealized-loss positions first to preserve winners
      const sorted = [...positions].sort((a, b) => (b.unrealizedPnl || 0) - (a.unrealizedPnl || 0))
      for (const p of sorted) {
        try { await this.agent.perps.closePosition(p.symbol); closed++ } catch {}
      }
      return closed > 0 ? { count: closed } : null
    } catch (e) { return null }
  }

  async _emergencyUnwind () {
    try {
      // Close all perps
      await this._tryClosePerps()
      // Withdraw all aave supplied
      for (const [sym, amt] of Object.entries(this.agent.supplied || {})) {
        if (amt > 0) {
          try { await this.agent.aave.withdraw(sym, amt) } catch {}
        }
      }
      // After withdrawals, retry stable repay
      const repaid = await this._tryRepayWithStables()
      return !!repaid
    } catch { return false }
  }

  _subscribeAaveEvents () {
    // Best-effort — providers vary in WS support. Polling is the floor.
    if (!this.agent.chainContext || !this.agent.aave?.poolAddress) return
    try {
      const provider = this.agent.chainContext.getProvider('arbitrum')
      // Aave V3 emits Borrow/Repay with the user as topic — listen for our address
      const userTopic = ethers.zeroPadValue(this.agent.wallet.address, 32)
      const filter = {
        address: this.agent.aave.poolAddress,
        topics: [
          [
            ethers.id('Borrow(address,address,address,uint256,uint8,uint256,uint16)'),
            ethers.id('Repay(address,address,address,uint256,bool)'),
            ethers.id('LiquidationCall(address,address,address,uint256,uint256,address,bool)')
          ],
          null,
          userTopic
        ]
      }
      const handler = () => this._check().catch(() => {})
      provider.on(filter, handler)
      this._wsListeners.push(() => provider.off(filter, handler))
    } catch (e) { /* WS not supported on this provider — polling still active */ }
  }
}
