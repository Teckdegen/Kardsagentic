// @kard/agent — Gas / fee manager
//
// Every chain we touch has a different gas economy. Before any execution,
// we check that the signer has enough native token to cover gas + (for
// LayerZero / Lucid) the cross-chain messaging fee. If not, we surface
// a clear, actionable error rather than letting the tx revert later.
//
// Per-chain native asset:
//   ethereum  → ETH      arbitrum  → ETH
//   base      → ETH      avalanche → AVAX
//   celo      → CELO     kiteai    → KITE
//
// Minimum-balance heuristics (override via env: MIN_GAS_<CHAIN>=0.01):
//   most L2s:   0.001  native (cheap)
//   ethereum:   0.01   native (expensive)
//   avalanche:  0.05   AVAX
//   kiteai:     0.001  KITE   (tentative — chain is new)

import { ethers } from 'ethers'
import { CHAINS } from './evm/chains.js'

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
]

const NATIVE = {
  ethereum:  'ETH',
  arbitrum:  'ETH',
  base:      'ETH',
  sepolia:   'ETH',
  baseSepolia: 'ETH',
  avalanche: 'AVAX',
  celo:      'CELO',
  kiteai:    'KITE'
}

const DEFAULT_MIN = {
  ethereum:    0.01,
  arbitrum:    0.001,
  base:        0.001,
  sepolia:     0.01,
  baseSepolia: 0.005,
  avalanche:   0.05,
  celo:        0.1,
  kiteai:      0.001
}

export class GasManager {
  /** @param {ChainContext} chainContext */
  constructor (chainContext) {
    this.ctx = chainContext
  }

  nativeSymbol (chainKey) {
    return NATIVE[chainKey] || 'native'
  }

  minNativeFor (chainKey) {
    const envKey = `MIN_GAS_${chainKey.toUpperCase()}`
    if (process.env[envKey]) return parseFloat(process.env[envKey])
    return DEFAULT_MIN[chainKey] ?? 0.001
  }

  /**
   * ERC-20 balance on a chain (in human units). Cached briefly for speed
   * across the same cycle's reads.
   */
  async tokenBalance (chainKey, tokenAddress, decimals) {
    const provider = this.ctx.getProvider(chainKey)
    const addr = this.ctx.getSigner(chainKey).address
    const c = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
    const dec = decimals ?? await c.decimals().catch(() => 6)
    const raw = await c.balanceOf(addr)
    return parseFloat(ethers.formatUnits(raw, dec))
  }

  /**
   * Stablecoin balances across every chain that lists the symbol.
   * Returns { chainKey: { USDC: 12.34, USDT: 5.67, … } } — async-parallel.
   */
  async stableBalances (symbols = ['USDC', 'USDT']) {
    const out = {}
    const tasks = []
    for (const [chainKey, cfg] of Object.entries(CHAINS)) {
      out[chainKey] = {}
      for (const sym of symbols) {
        const tok = cfg.tokens?.[sym]
        if (!tok?.address || !tok.decimals) continue
        tasks.push(
          this.tokenBalance(chainKey, tok.address, tok.decimals)
            .then(v => { out[chainKey][sym] = v })
            .catch(() => { /* RPC flake — leave undefined */ })
        )
      }
    }
    await Promise.all(tasks)
    return out
  }

  /** Native balance on a chain (in human units) */
  async nativeBalance (chainKey) {
    const provider = this.ctx.getProvider(chainKey)
    const addr = this.ctx.getSigner(chainKey).address
    const wei = await provider.getBalance(addr)
    return parseFloat(ethers.formatEther(wei))
  }

  /** Current gas price (wei) on a chain */
  async gasPrice (chainKey) {
    const provider = this.ctx.getProvider(chainKey)
    const fee = await provider.getFeeData()
    return fee.maxFeePerGas || fee.gasPrice || 0n
  }

  /**
   * Estimate the cost of a contract call in native units.
   * @param {string} chainKey
   * @param {object} txRequest — { to, data, value, from? }
   * @returns {Promise<{ gasLimit:bigint, gasPriceWei:bigint, totalCostNative:number }>}
   */
  async estimate (chainKey, txRequest) {
    const provider = this.ctx.getProvider(chainKey)
    const from = txRequest.from || this.ctx.getSigner(chainKey).address
    const [gasLimit, gasPriceWei] = await Promise.all([
      provider.estimateGas({ ...txRequest, from }),
      this.gasPrice(chainKey)
    ])
    const totalWei = gasLimit * gasPriceWei
    return {
      gasLimit,
      gasPriceWei,
      totalCostNative: parseFloat(ethers.formatEther(totalWei))
    }
  }

  /**
   * Pre-flight check: does the signer have enough native on `chainKey` to
   * pay `extraNativeFee` (e.g. LayerZero msg.value) plus a buffer for gas?
   *
   * Throws a clear error if not — the caller never has to guess why a tx
   * failed.
   */
  async ensureCanPay (chainKey, extraNativeFee = 0) {
    const have = await this.nativeBalance(chainKey)
    const min = this.minNativeFor(chainKey)
    const need = extraNativeFee + min
    if (have < need) {
      const sym = this.nativeSymbol(chainKey)
      throw new Error(
        `Gas: insufficient ${sym} on ${chainKey}: have ${have.toFixed(6)} ${sym}, ` +
        `need ${need.toFixed(6)} (${extraNativeFee.toFixed(6)} fee + ${min.toFixed(6)} buffer). ` +
        `Top up the ${sym} balance on ${chainKey} or override MIN_GAS_${chainKey.toUpperCase()}.`
      )
    }
    return { have, need, ok: true, symbol: this.nativeSymbol(chainKey) }
  }

  /**
   * Snapshot of native balances across every supported chain.
   * Surfaces in the dashboard so the user sees which chains need topping up.
   */
  async snapshotAll () {
    const out = {}
    await Promise.all(Object.keys(CHAINS).map(async key => {
      try {
        const bal = await this.nativeBalance(key)
        out[key] = {
          chain: CHAINS[key].name,
          symbol: this.nativeSymbol(key),
          balance: bal,
          min: this.minNativeFor(key),
          ok: bal >= this.minNativeFor(key)
        }
      } catch (e) {
        out[key] = { chain: CHAINS[key].name, error: e.message }
      }
    }))
    return out
  }
}
