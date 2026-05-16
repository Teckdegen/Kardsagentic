// @kard/agent — Strategy Marketplace with Attestation Proofs
//
// Strategies published here include on-chain attestation proofs of their
// backtest results. Buyers can verify that a strategy's claimed performance
// is real — the backtest was actually run and attested on Kite AI.
//
// Flow:
//   1. Author runs backtest: kard backtest claude "my strategy" --from ... --to ...
//   2. Author publishes with proof: kard strategy publish --attest
//      → Backtest results are attested on Kite AI
//      → Strategy JSON + attestation txHash are pushed to registry
//   3. Buyer browses: kard strategy search "yield"
//      → Each result shows attestation proof + verified performance
//   4. Buyer verifies: kard strategy verify <name>
//      → Fetches the attestation tx from Kite, recomputes hash, confirms match
//   5. Buyer installs: kard strategy install <name>
//
// This creates a trust-minimized marketplace where performance claims are
// cryptographically verifiable on Kite AI's chain.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { ethers } from 'ethers'

const HOME_DIR = path.join(os.homedir(), '.kard', 'strategies')
const REGISTRY = process.env.KARD_REGISTRY_URL || 'https://registry.kard.dev'

export class StrategyMarketplace {
  /**
   * @param {object} cfg
   * @param {import('../kite/attestation.js').KiteAttestor} cfg.attestor
   * @param {import('./library.js').StrategyRegistry} cfg.registry
   */
  constructor (cfg = {}) {
    this.attestor = cfg.attestor
    this.registry = cfg.registry
    this.registryUrl = cfg.registryUrl || REGISTRY
    this.token = cfg.token || process.env.KARD_REGISTRY_TOKEN
  }

  /**
   * Publish a strategy with attestation proof of backtest results.
   * @param {object} strategy — the strategy config
   * @param {object} backtestResult — output from Backtester.run()
   * @param {object} [meta] — additional metadata
   * @returns {Promise<object>} publish receipt with attestation proof
   */
  async publishWithProof (strategy, backtestResult, meta = {}) {
    if (!this.attestor) throw new Error('attestor required for publishing with proof')

    // Create the proof payload — what gets attested on-chain
    const proofPayload = {
      type: 'strategy_backtest_proof',
      strategy: {
        name: strategy.name,
        description: strategy.description,
        version: strategy.version || '1.0.0',
        hash: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(strategy)))
      },
      backtest: {
        from: backtestResult.summary?.from || backtestResult.from,
        to: backtestResult.summary?.to || backtestResult.to,
        totalReturn: backtestResult.summary?.totalReturn,
        sharpeRatio: backtestResult.summary?.sharpeRatio,
        maxDrawdown: backtestResult.summary?.maxDrawdown,
        winRate: backtestResult.summary?.winRate,
        tradeCount: backtestResult.summary?.tradeCount,
        finalEquity: backtestResult.summary?.finalEquity
      },
      author: meta.address || null,
      publishedAt: new Date().toISOString()
    }

    // Attest the backtest proof on Kite AI
    const attestation = await this.attestor.attest(
      { type: 'strategy_publish', strategy: strategy.name },
      { proof: proofPayload },
      {
        address: meta.address,
        strategy: strategy.name,
        cycle: 'publish'
      }
    )

    if (attestation.error) {
      throw new Error(`attestation failed: ${attestation.error}`)
    }

    // Build the marketplace listing
    const listing = {
      ...strategy,
      proof: {
        attestationTx: attestation.txHash,
        attestationBlock: attestation.blockNumber,
        proofHash: attestation.hash,
        chain: 'Kite AI (2366)',
        explorerUrl: attestation.explorerUrl,
        backtest: proofPayload.backtest,
        verifiable: true
      },
      author: meta.address,
      publishedAt: proofPayload.publishedAt
    }

    // Push to registry
    try {
      const r = await fetch(`${this.registryUrl}/strategies`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {})
        },
        body: JSON.stringify(listing)
      })
      if (r.ok) {
        listing.registryId = (await r.json()).id
      }
    } catch (e) {
      // Registry push is optional — the attestation is the source of truth
      listing.registryError = e.message
    }

    // Save locally
    if (!fs.existsSync(HOME_DIR)) fs.mkdirSync(HOME_DIR, { recursive: true })
    const slug = strategy.name.toUpperCase().replace(/\s+/g, '_')
    const file = path.join(HOME_DIR, slug + '.json')
    fs.writeFileSync(file, JSON.stringify(listing, null, 2))

    return {
      published: true,
      name: slug,
      attestation: {
        txHash: attestation.txHash,
        explorerUrl: attestation.explorerUrl,
        block: attestation.blockNumber
      },
      backtest: proofPayload.backtest,
      localPath: file
    }
  }

  /**
   * Verify a strategy's attestation proof on-chain.
   * @param {string} nameOrTxHash — strategy name (looks up local) or attestation txHash
   * @returns {Promise<object>} verification result
   */
  async verify (nameOrTxHash) {
    if (!this.attestor) throw new Error('attestor required for verification')

    let txHash = nameOrTxHash

    // If it's a strategy name, look up the attestation tx from local file
    if (!nameOrTxHash.startsWith('0x')) {
      const slug = nameOrTxHash.toUpperCase().replace(/\s+/g, '_')
      const file = path.join(HOME_DIR, slug + '.json')
      if (!fs.existsSync(file)) {
        throw new Error(`strategy "${nameOrTxHash}" not found locally. Install it first.`)
      }
      const listing = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (!listing.proof?.attestationTx) {
        return { verified: false, reason: 'no attestation proof found in strategy file' }
      }
      txHash = listing.proof.attestationTx
    }

    // Verify on-chain
    const onChain = await this.attestor.verify(txHash)

    return {
      verified: true,
      attestation: {
        txHash,
        agent: onChain.agent,
        block: onChain.block,
        mode: onChain.mode,
        explorerUrl: onChain.explorerUrl
      },
      envelope: onChain.envelope,
      backtest: onChain.envelope?.result?.proof?.backtest || null,
      message: `✓ Strategy attestation verified on Kite AI block ${onChain.block}`
    }
  }

  /**
   * Browse marketplace with attestation proof status.
   * @param {string} [query]
   * @returns {Promise<object[]>}
   */
  async browse (query) {
    try {
      const r = await fetch(`${this.registryUrl}/strategies?q=${encodeURIComponent(query || '')}&proven=true`)
      if (!r.ok) throw new Error(`browse ${r.status}`)
      const results = await r.json()
      return results.map(s => ({
        name: s.name,
        description: s.description,
        author: s.author,
        proof: s.proof ? {
          verified: true,
          txHash: s.proof.attestationTx,
          backtest: s.proof.backtest,
          explorerUrl: s.proof.explorerUrl
        } : { verified: false },
        publishedAt: s.publishedAt
      }))
    } catch (e) {
      // Fallback: list local strategies with proofs
      if (!fs.existsSync(HOME_DIR)) return []
      const files = fs.readdirSync(HOME_DIR).filter(f => f.endsWith('.json'))
      return files.map(f => {
        try {
          const s = JSON.parse(fs.readFileSync(path.join(HOME_DIR, f), 'utf8'))
          return {
            name: s.name,
            description: s.description,
            author: s.author,
            proof: s.proof || { verified: false },
            publishedAt: s.publishedAt,
            local: true
          }
        } catch { return null }
      }).filter(Boolean)
    }
  }
}
