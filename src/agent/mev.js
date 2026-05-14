// @kard/agent — MEV protection
//
// Submit txs through Flashbots (Ethereum) / MEV-Share / private mempools
// where supported, transparently falling back to public mempool elsewhere.
//
// Per-chain policy:
//   ethereum  → Flashbots Protect RPC (https://rpc.flashbots.net)
//   arbitrum  → Conduit MEV-protected RPC if MEV_PROTECT_ARB set
//   base      → Public (Base sequencer is the bottleneck, MEV is low)
//   kiteai    → Public (small chain, low MEV currently)
//   *         → Public unless explicit override

import { ethers } from 'ethers'

const PROTECTED_RPC = {
  ethereum: 'https://rpc.flashbots.net',
  arbitrum: process.env.MEV_PROTECT_ARB || null,
  base:     process.env.MEV_PROTECT_BASE || null,
  avalanche: null,
  kiteai:   null
}

export class MevSubmitter {
  /**
   * @param {object} cfg
   * @param {import('../chain-context.js').ChainContext} cfg.chainContext
   */
  constructor (cfg = {}) {
    this.ctx = cfg.chainContext
    this._cache = {}
  }

  /** Get a signer connected to the protected RPC for `chain`, or fall through. */
  getProtectedSigner (chain) {
    if (this._cache[chain]) return this._cache[chain]
    const url = PROTECTED_RPC[chain]
    if (!url) return this.ctx.getSigner(chain)
    const provider = new ethers.JsonRpcProvider(url)
    const baseSigner = this.ctx.getSigner(chain)
    const wallet = new ethers.Wallet(baseSigner.privateKey, provider)
    this._cache[chain] = wallet
    return wallet
  }

  /**
   * Send a tx through the chain's protected route (when available).
   * Returns the receipt.
   */
  async send (chain, tx) {
    const signer = this.getProtectedSigner(chain)
    const sent = await signer.sendTransaction(tx)
    return sent.wait()
  }

  /** Surface what's protected, for UX/logging */
  status () {
    return Object.fromEntries(
      Object.entries(PROTECTED_RPC).map(([c, url]) => [c, { protected: !!url, rpc: url }])
    )
  }
}
