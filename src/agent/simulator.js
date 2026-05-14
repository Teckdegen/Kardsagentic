// @kard/agent — Tx Simulator
//
// Pre-flight every tx before signing. Two modes:
//
//  1. eth_call simulation (default, free, fast)
//     Calls the contract via provider.call({...}) at the latest block.
//     Catches reverts, decodes revert reasons. ~50ms.
//
//  2. Anvil/Tenderly fork (KARD_SIM_RPC=...) — full state-changing simulation
//     Forks mainnet at head, runs the tx, returns trace + final balances.
//     Catches gas blowups, slippage surprises, revert reasons that need state.
//
// Use:
//   const sim = new TxSimulator(chainContext)
//   const r = await sim.simulate({ chain: 'arbitrum', tx: { to, data, value } })
//   if (!r.ok) throw new Error(r.reason)

import { ethers } from 'ethers'

export class TxSimulator {
  constructor (chainContext, cfg = {}) {
    this.ctx = chainContext
    this.simRpc = cfg.simRpc || process.env.KARD_SIM_RPC || null
    this.gasBufferPct = cfg.gasBufferPct ?? 0.20
  }

  /**
   * @param {object} arg
   * @param {string} arg.chain — chain key
   * @param {object} arg.tx   — { to, data, value, from? }
   * @returns {Promise<{ ok, gasEstimate?, reason?, returnData?, trace? }>}
   */
  async simulate ({ chain, tx }) {
    const provider = this.simRpc
      ? new ethers.JsonRpcProvider(this.simRpc)
      : this.ctx.getProvider(chain)

    const from = tx.from || this.ctx.getSigner(chain).address
    const call = { from, to: tx.to, data: tx.data || '0x', value: tx.value || 0n }

    // 1) eth_call to catch reverts
    try {
      const ret = await provider.call(call)
      // 2) gas estimate
      let gas = null
      try { gas = await provider.estimateGas(call) } catch { /* may revert in estimate but pass call */ }
      return {
        ok: true,
        returnData: ret,
        gasEstimate: gas?.toString(),
        gasWithBuffer: gas ? (gas * BigInt(Math.ceil((1 + this.gasBufferPct) * 100)) / 100n).toString() : null
      }
    } catch (err) {
      const reason = decodeRevert(err)
      return { ok: false, reason, raw: err.shortMessage || err.message }
    }
  }

  /**
   * Simulate a sequence of txs on a fork (requires KARD_SIM_RPC pointing at
   * an Anvil/Hardhat node with --fork-url for the target chain).
   *
   * Returns per-step results + final balances.
   */
  async simulateSequence (chain, txs, watchAddresses = []) {
    if (!this.simRpc) {
      // Without a fork, fall back to per-tx independent simulation
      const out = []
      for (const tx of txs) out.push(await this.simulate({ chain, tx }))
      return { mode: 'isolated', steps: out }
    }
    const provider = new ethers.JsonRpcProvider(this.simRpc)
    const signer = await provider.getSigner(this.ctx.getSigner(chain).address).catch(() => null)
    const steps = []
    for (const tx of txs) {
      try {
        const sent = signer
          ? await signer.sendTransaction(tx)
          : null
        const receipt = sent ? await sent.wait() : null
        steps.push({
          ok: receipt?.status === 1,
          gasUsed: receipt?.gasUsed?.toString(),
          hash: sent?.hash,
          logs: receipt?.logs?.length
        })
      } catch (e) {
        steps.push({ ok: false, reason: decodeRevert(e) })
      }
    }
    const balances = {}
    for (const addr of watchAddresses) balances[addr] = (await provider.getBalance(addr)).toString()
    return { mode: 'fork', steps, balances }
  }
}

function decodeRevert (err) {
  if (err?.reason) return err.reason
  const data = err?.data || err?.error?.data
  if (!data) return err?.shortMessage || err?.message || 'unknown revert'
  // Standard Error(string)
  try {
    const iface = new ethers.Interface(['function Error(string) view returns (string)'])
    const decoded = iface.parseError(data)
    if (decoded) return decoded.args[0]
  } catch {}
  // Custom error selectors — return raw 4-byte
  return `revert ${typeof data === 'string' ? data.slice(0, 10) : ''}`
}
