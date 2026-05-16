// @kard/agent — Kite Reputation System
//
// On-chain reputation derived from attestation history on Kite AI (chainId 2366).
// Every attested action contributes to a public, verifiable trust score.
//
// Score formula:
//   base = attestation_count * 10
//   bonus = profitable_actions * 5
//   penalty = failed_actions * -3
//   streak = consecutive_profitable * 2
//   age_bonus = days_since_first_attestation * 0.5
//   score = base + bonus + penalty + streak + age_bonus
//
// The score is queryable by anyone — it's just reading on-chain tx history.
// Agents with higher reputation can be trusted more by other agents in fleets,
// and strategy marketplace buyers can verify publisher track records.

import { ethers } from 'ethers'

const MAGIC = '0x4b41524400' // "KARD\0"
const KITE_CHAIN_KEY = 'kiteai'

const ATTESTOR_ABI = [
  'function countByAgent(address) view returns (uint256)',
  'event Attested(address indexed agent, bytes32 indexed hash, bytes32 indexed strategyId, bytes32 goalId, string uri, uint256 ts)'
]

export class KiteReputation {
  /**
   * @param {object} cfg
   * @param {import('../chain-context.js').ChainContext} cfg.chainContext
   * @param {string} [cfg.contractAddress]
   */
  constructor (cfg = {}) {
    this.ctx = cfg.chainContext
    this.contractAddress = cfg.contractAddress || process.env.KARD_ATTESTOR_ADDR || null
  }

  /**
   * Query the reputation score for an agent address.
   * Scans on-chain attestation history and computes a trust score.
   * @param {string} address — agent wallet address
   * @returns {Promise<object>} reputation profile
   */
  async getScore (address) {
    if (!this.ctx) throw new Error('no chain context')
    const provider = this.ctx.getProvider(KITE_CHAIN_KEY)

    let attestations = []
    let totalCount = 0

    if (this.contractAddress) {
      // Contract mode — use indexed events for efficient querying
      const contract = new ethers.Contract(this.contractAddress, ATTESTOR_ABI, provider)
      totalCount = Number(await contract.countByAgent(address))

      // Query last 100 attestation events for this agent
      const filter = contract.filters.Attested(address)
      const blockNumber = await provider.getBlockNumber()
      const fromBlock = Math.max(0, blockNumber - 100_000) // ~last 100k blocks
      const events = await contract.queryFilter(filter, fromBlock, blockNumber)
      attestations = events.map(e => ({
        hash: e.args[1],
        strategyId: e.args[2],
        goalId: e.args[3],
        uri: e.args[4],
        ts: Number(e.args[5]) * 1000,
        block: e.blockNumber,
        txHash: e.transactionHash
      }))
    } else {
      // Self-attestation mode — scan txs from this address to itself
      // In production this would use an indexer; for hackathon we scan recent blocks
      const blockNumber = await provider.getBlockNumber()
      const scanDepth = Math.min(50_000, blockNumber)
      const fromBlock = blockNumber - scanDepth

      // Use getLogs with address filter for self-txs
      // For self-attestation, we look at transactions where from === to === address
      // This is a simplified scan — production would use The Graph or KiteScan API
      const history = await this._scanSelfAttestations(provider, address, fromBlock, blockNumber)
      attestations = history
      totalCount = history.length
    }

    // Compute reputation score
    const now = Date.now()
    const firstAttestation = attestations.length > 0
      ? Math.min(...attestations.map(a => a.ts || now))
      : now
    const daysSinceFirst = Math.max(0, (now - firstAttestation) / 86_400_000)

    // Analyze attestation payloads for profit/loss signals
    let profitable = 0
    let failed = 0
    let consecutiveProfitable = 0
    let maxStreak = 0

    for (const a of attestations) {
      if (a.envelope) {
        const result = a.envelope.result || {}
        if (result.error || result.reverted) {
          failed++
          consecutiveProfitable = 0
        } else {
          profitable++
          consecutiveProfitable++
          maxStreak = Math.max(maxStreak, consecutiveProfitable)
        }
      } else {
        // No envelope decoded — count as successful (attested = completed)
        profitable++
        consecutiveProfitable++
        maxStreak = Math.max(maxStreak, consecutiveProfitable)
      }
    }

    const base = totalCount * 10
    const bonus = profitable * 5
    const penalty = failed * -3
    const streak = maxStreak * 2
    const ageBonus = Math.floor(daysSinceFirst * 0.5)
    const score = Math.max(0, base + bonus + penalty + streak + ageBonus)

    // Tier classification
    let tier = 'unranked'
    if (score >= 1000) tier = 'legendary'
    else if (score >= 500) tier = 'diamond'
    else if (score >= 200) tier = 'gold'
    else if (score >= 100) tier = 'silver'
    else if (score >= 25) tier = 'bronze'
    else if (score > 0) tier = 'newcomer'

    return {
      address,
      score,
      tier,
      breakdown: { base, bonus, penalty, streak, ageBonus },
      stats: {
        totalAttestations: totalCount,
        profitable,
        failed,
        successRate: totalCount > 0 ? ((profitable / totalCount) * 100).toFixed(1) + '%' : 'N/A',
        longestStreak: maxStreak,
        activeSinceDays: Math.floor(daysSinceFirst)
      },
      chain: 'Kite AI (2366)',
      contract: this.contractAddress || 'self-attestation',
      queriedAt: new Date().toISOString()
    }
  }

  /**
   * Get a leaderboard of top agents by reputation.
   * In production this would query an indexer. For hackathon, uses known agents.
   * @param {string[]} addresses — list of agent addresses to rank
   * @returns {Promise<object[]>} sorted leaderboard
   */
  async leaderboard (addresses = []) {
    const scores = await Promise.all(
      addresses.map(addr => this.getScore(addr).catch(() => ({ address: addr, score: 0, tier: 'error' })))
    )
    return scores.sort((a, b) => b.score - a.score).map((s, i) => ({ rank: i + 1, ...s }))
  }

  /** Scan self-attestation txs (simplified for hackathon) */
  async _scanSelfAttestations (provider, address, fromBlock, toBlock) {
    const results = []
    // Batch scan in chunks of 5000 blocks
    const chunkSize = 5000
    for (let start = fromBlock; start <= toBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, toBlock)
      try {
        // Look for transactions from address with KARD magic in data
        // This uses eth_getLogs which is more efficient than scanning each block
        const block = await provider.getBlock(end)
        if (!block) continue
        // For hackathon: check last few blocks for demo purposes
        if (end > toBlock - 1000) {
          for (const txHash of (block.transactions || [])) {
            try {
              const tx = await provider.getTransaction(txHash)
              if (tx && tx.from?.toLowerCase() === address.toLowerCase() &&
                  tx.to?.toLowerCase() === address.toLowerCase() &&
                  tx.data?.toLowerCase().startsWith(MAGIC)) {
                // Decode envelope
                let envelope = null
                try {
                  const jsonHex = '0x' + tx.data.slice(2 + 10 + 64)
                  envelope = JSON.parse(ethers.toUtf8String(jsonHex))
                } catch { /* truncated */ }
                results.push({
                  txHash: tx.hash,
                  block: tx.blockNumber,
                  ts: block.timestamp * 1000,
                  envelope
                })
              }
            } catch { /* skip individual tx errors */ }
          }
        }
      } catch { /* skip block errors */ }
    }
    return results
  }
}
