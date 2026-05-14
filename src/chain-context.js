// @kard/agent — Multi-chain signer factory
//
// Solves the "signer is connected to chain X but the action targets chain Y"
// problem. Build a fresh signer wired to any chain in the registry without
// disturbing the existing one.
//
// Usage:
//   const ctx = new ChainContext({ privateKey: process.env.PRIVATE_KEY })
//   const arbSigner = ctx.getSigner('arbitrum')
//   const kiteSigner = ctx.getSigner('kiteai')
//   await new LucidKiteBridge({ signer: arbSigner }).mint('USDC', 'kiteai', 100)

import { ethers } from 'ethers'
import { CHAINS, resolveChainConfig } from './evm/chains.js'

export class ChainContext {
  /**
   * @param {object} cfg
   * @param {string}  [cfg.privateKey]    — hex private key (no 0x or with)
   * @param {string}  [cfg.mnemonic]      — BIP-39 seed (alternative to privateKey)
   * @param {string}  [cfg.derivationPath='m/44\'/60\'/0\'/0/0']
   * @param {object}  [cfg.rpcOverrides]  — { kiteai: 'https://my-rpc' }
   */
  constructor (cfg = {}) {
    this.privateKey = cfg.privateKey || process.env.PRIVATE_KEY || null
    this.mnemonic = cfg.mnemonic || process.env.KARD_MNEMONIC || process.env.WDK_SEED || null
    this.derivationPath = cfg.derivationPath || "m/44'/60'/0'/0/0"
    this.rpcOverrides = cfg.rpcOverrides || {}
    this._providers = new Map() // chainKey → JsonRpcProvider
    this._signers = new Map()   // chainKey → Wallet
  }

  /** Resolve effective RPC URL for a chain, honoring overrides + env vars */
  rpcFor (chainKey) {
    if (this.rpcOverrides[chainKey]) return this.rpcOverrides[chainKey]
    const envKey = `RPC_${chainKey.toUpperCase()}`
    if (process.env[envKey]) return process.env[envKey]
    const cfg = CHAINS[chainKey]
    if (!cfg) throw new Error(`ChainContext: unknown chain ${chainKey}`)
    return cfg.rpcUrl
  }

  /** Cached read-only provider for a chain */
  getProvider (chainKey) {
    if (!this._providers.has(chainKey)) {
      this._providers.set(chainKey, new ethers.JsonRpcProvider(this.rpcFor(chainKey)))
    }
    return this._providers.get(chainKey)
  }

  /** Cached signer for a chain (wraps your key against that chain's RPC) */
  getSigner (chainKey) {
    if (this._signers.has(chainKey)) return this._signers.get(chainKey)
    const provider = this.getProvider(chainKey)
    let wallet
    if (this.privateKey) {
      const pk = this.privateKey.startsWith('0x') ? this.privateKey : `0x${this.privateKey}`
      wallet = new ethers.Wallet(pk, provider)
    } else if (this.mnemonic) {
      const hd = ethers.HDNodeWallet.fromPhrase(this.mnemonic, undefined, this.derivationPath)
      wallet = new ethers.Wallet(hd.privateKey, provider)
    } else {
      throw new Error('ChainContext: no privateKey or mnemonic configured')
    }
    this._signers.set(chainKey, wallet)
    return wallet
  }

  /** Resolve chain key from chainId (e.g. 42161 → 'arbitrum') */
  keyForChainId (chainId) {
    for (const [k, cfg] of Object.entries(CHAINS)) {
      if (cfg.chainId === Number(chainId)) return k
    }
    return null
  }

  /** Get the canonical address for the configured key (same on every EVM chain) */
  get address () {
    const sample = this.getSigner(Object.keys(CHAINS)[0])
    return sample.address
  }

  /** List chains the context can sign on */
  list () {
    return Object.entries(CHAINS).map(([key, cfg]) => ({
      key,
      name: cfg.name,
      chainId: cfg.chainId,
      type: cfg.type,
      rpc: this.rpcFor(key)
    }))
  }
}

/** Convenience: build a one-off signer for a chain from env vars */
export function getSignerForChain (chainKey, opts = {}) {
  return new ChainContext(opts).getSigner(chainKey)
}

/** Resolve which chain a given config targets — kept here so adapters
 *  don't have to re-import resolveChainConfig. */
export function resolveTargetChain (chainKey) {
  return resolveChainConfig(chainKey)
}
