// @kard/agent — Kite Attestation Writer
//
// Every executed action emits a verifiable on-chain record on KiteAI.
// This is the hackathon's "verification layer" requirement made concrete.
//
// Two emission modes:
//
//   1. CONTRACT MODE (when KARD_ATTESTOR_ADDR is set):
//        Calls `attest(bytes32 hash, string memory uri)` on the configured
//        contract. The contract is expected to emit an event keyed by hash;
//        the off-chain JSON envelope (with action details) is stored at `uri`
//        (typically an IPFS CID, an Arweave tx, or a content-addressed URL).
//        If you don't have an attestor contract deployed, set the address to
//        any contract that accepts arbitrary calldata — even a no-op proxy —
//        and we'll emit logs against it.
//
//   2. SELF-ATTESTATION MODE (default):
//        Sends a 0-value tx FROM the agent TO itself on KiteAI with calldata
//        equal to:
//
//            0x4b41524400 || keccak256(JSON_canonicalized) || abbreviated JSON
//            (magic 5 bytes "KARD\0") || (32-byte hash)    || (rest of payload)
//
//        The transaction itself is the attestation: tx hash on KiteAI is a
//        permanent verifiable record. Anyone can fetch the tx, verify the
//        signer (= agent address), and decode the calldata to recover the
//        full action JSON. Cheap, no contract deploy required, works today.
//
// Both modes return the same shape:
//   { txHash, blockNumber, hash, uri?, mode, gasUsed }

import { ethers } from 'ethers'

const MAGIC = '0x4b41524400'      // "KARD\0" — easy to grep on-chain
const KITE_CHAIN_KEY = 'kiteai'

// Matches contracts/KardAttestor.sol — indexed by (agent, hash, strategyId)
// so subgraphs can aggregate attestations cheaply.
const ATTESTOR_ABI = [
  'function attest(bytes32 hash, bytes32 strategyId, bytes32 goalId, string uri)',
  'function attestBatch(bytes32[] hashes, bytes32[] strategyIds, bytes32[] goalIds, string[] uris)',
  'function lastByAgentStrategy(address,bytes32) view returns (bytes32)',
  'function countByAgent(address) view returns (uint256)',
  'event Attested(address indexed agent, bytes32 indexed hash, bytes32 indexed strategyId, bytes32 goalId, string uri, uint256 ts)'
]

export class KiteAttestor {
  /**
   * @param {object} cfg
   * @param {import('../chain-context.js').ChainContext} cfg.chainContext
   * @param {string} [cfg.contractAddress] — KARD_ATTESTOR_ADDR (optional)
   * @param {(payload:object)=>Promise<string>} [cfg.uploader]  — returns a uri (e.g. IPFS CID)
   * @param {boolean} [cfg.enabled=true]
   * @param {number} [cfg.maxCalldataBytes=8192] — truncate huge payloads
   */
  constructor (cfg = {}) {
    this.ctx = cfg.chainContext
    this.contractAddress = cfg.contractAddress || process.env.KARD_ATTESTOR_ADDR || null
    this.uploader = cfg.uploader || null
    this.enabled = cfg.enabled !== false && process.env.KARD_ATTEST !== '0'
    this.maxCalldataBytes = cfg.maxCalldataBytes ?? 8192
    this.localLog = []   // last N attestations, in-memory mirror
  }

  /** Hash an action payload deterministically (sorted keys, no whitespace). */
  hashPayload (payload) {
    const canonical = JSON.stringify(sortKeys(payload))
    return ethers.keccak256(ethers.toUtf8Bytes(canonical))
  }

  /**
   * Emit an attestation for a single executed action.
   * @param {object} action — the action that was executed
   * @param {object} result — execute() result (tx, gasUsed, etc.)
   * @param {object} [meta] — agent + cycle metadata
   * @returns {Promise<object>} attestation receipt
   */
  async attest (action, result, meta = {}) {
    if (!this.enabled) return { skipped: true, reason: 'attestation disabled' }
    if (!this.ctx) return { skipped: true, reason: 'no chain context' }

    const envelope = {
      v: 1,
      ts: new Date().toISOString(),
      cycle: meta.cycle ?? null,
      agent: meta.address ?? null,
      strategy: meta.strategy ?? null,
      action: redact(action),
      result: redact(result),
      goalId: meta.goalId ?? null
    }
    const hash = this.hashPayload(envelope)

    // Optional: upload full envelope to a content-addressed store
    let uri = null
    if (this.uploader) {
      try { uri = await this.uploader(envelope) }
      catch (e) { console.error(`[kite.attest] uploader failed: ${e.message}`) }
    }

    const signer = this.ctx.getSigner(KITE_CHAIN_KEY)

    let receipt
    try {
      if (this.contractAddress) {
        // Contract mode — emit indexed event for off-chain aggregation
        const c = new ethers.Contract(this.contractAddress, ATTESTOR_ABI, signer)
        const strategyId = meta.strategy ? ethers.id(meta.strategy) : ethers.ZeroHash
        const goalId = meta.goalId ? ethers.id(meta.goalId) : ethers.ZeroHash
        const tx = await c.attest(hash, strategyId, goalId, uri || '')
        receipt = await tx.wait()
      } else {
        // Self-attestation: 0-value tx to self with calldata = MAGIC || hash || JSON
        const jsonBytes = ethers.toUtf8Bytes(JSON.stringify(envelope))
        // Truncate to keep gas predictable (KiteAI is cheap but not free)
        const max = this.maxCalldataBytes - 5 - 32  // minus magic + hash
        const tail = jsonBytes.length > max ? jsonBytes.slice(0, max) : jsonBytes
        const data = ethers.concat([MAGIC, hash, tail])
        const tx = await signer.sendTransaction({
          to: signer.address,
          value: 0n,
          data,
          gasLimit: 200_000n + BigInt(tail.length * 16)
        })
        receipt = await tx.wait()
      }
    } catch (e) {
      const failure = { error: e.shortMessage || e.message, hash, uri, mode: this.contractAddress ? 'contract' : 'self' }
      this.localLog.push({ ...failure, ts: envelope.ts })
      this._trim()
      return failure
    }

    const out = {
      ok: true,
      mode: this.contractAddress ? 'contract' : 'self',
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString(),
      hash,
      uri,
      ts: envelope.ts,
      explorerUrl: `https://kitescan.ai/tx/${receipt.hash}`
    }
    this.localLog.push(out)
    this._trim()
    return out
  }

  /**
   * Verify an attestation by fetching the on-chain tx and recomputing the hash.
   * @param {string} txHash
   */
  async verify (txHash) {
    if (!this.ctx) throw new Error('no chain context')
    const provider = this.ctx.getProvider(KITE_CHAIN_KEY)
    const tx = await provider.getTransaction(txHash)
    if (!tx) throw new Error(`tx not found: ${txHash}`)
    const data = tx.data
    if (this.contractAddress && tx.to?.toLowerCase() === this.contractAddress.toLowerCase()) {
      // Decode contract call
      const iface = new ethers.Interface(ATTESTOR_ABI)
      const decoded = iface.parseTransaction({ data })
      return {
        mode: 'contract',
        agent: tx.from,
        hash: decoded.args[0],
        uri: decoded.args[1],
        block: tx.blockNumber,
        explorerUrl: `https://kitescan.ai/tx/${txHash}`
      }
    }
    // Self-attestation: data = MAGIC || hash || JSON
    if (!data.toLowerCase().startsWith(MAGIC)) {
      throw new Error('not a Kard attestation (magic mismatch)')
    }
    const hash = '0x' + data.slice(2 + 10, 2 + 10 + 64) // after MAGIC (10 hex chars after 0x)
    const jsonHex = '0x' + data.slice(2 + 10 + 64)
    let envelope = null
    try { envelope = JSON.parse(ethers.toUtf8String(jsonHex)) } catch { /* truncated */ }
    return {
      mode: 'self',
      agent: tx.from,
      hash,
      envelope,
      block: tx.blockNumber,
      explorerUrl: `https://kitescan.ai/tx/${txHash}`
    }
  }

  list ({ limit = 20 } = {}) {
    return this.localLog.slice(-limit).reverse()
  }

  _trim () { if (this.localLog.length > 500) this.localLog = this.localLog.slice(-500) }
}

function sortKeys (obj) {
  if (Array.isArray(obj)) return obj.map(sortKeys)
  if (obj && typeof obj === 'object') {
    return Object.keys(obj).sort().reduce((acc, k) => { acc[k] = sortKeys(obj[k]); return acc }, {})
  }
  return obj
}

/** Strip private/sensitive fields before they hit calldata */
function redact (o) {
  if (!o || typeof o !== 'object') return o
  const out = Array.isArray(o) ? [] : {}
  for (const [k, v] of Object.entries(o)) {
    if (/privatekey|secret|password|seed|mnemonic/i.test(k)) continue
    out[k] = redact(v)
  }
  return out
}
