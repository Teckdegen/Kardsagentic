// Kard — USDT0 Bridge Module (LayerZero V2 OFT)
// Cross-chain USDT0 bridging via LayerZero Omnichain Fungible Token

import { ethers } from 'ethers'

// OFT ABI (from WDK protocol)
const OFT_ABI = [
  'function token() view returns (address)',
  'function send(tuple(uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd) _sendParam, tuple(uint256 nativeFee, uint256 lzTokenFee) _fee, address _refundAddress) payable returns (tuple(bytes32 guid, uint64 nonce, tuple(uint256 nativeFee, uint256 lzTokenFee) fee) msgReceipt, tuple(uint256 amountSentLD, uint256 amountReceivedLD) oftReceipt)',
  'function quoteSend(tuple(uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd) _sendParam, bool _payInLzToken) view returns (tuple(uint256 nativeFee, uint256 lzTokenFee) msgFee)'
]

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)'
]

// USDT0 chain configurations (mainnet — LayerZero V2)
const CHAINS = {
  ethereum: {
    name: 'Ethereum',
    chainId: 1,
    eid: 30101,
    oftContract: '0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee',
    rpc: 'https://eth.drpc.org',
    explorer: 'https://etherscan.io',
    nativeSymbol: 'ETH'
  },
  arbitrum: {
    name: 'Arbitrum',
    chainId: 42161,
    eid: 30110,
    oftContract: '0x14E4A1B13bf7F943c8ff7C51fb60FA964A298D92',
    rpc: 'https://arbitrum.drpc.org',
    explorer: 'https://arbiscan.io',
    nativeSymbol: 'ETH'
  },
  berachain: {
    name: 'Berachain',
    chainId: 80094,
    eid: 30362,
    oftContract: '0x779Ded0c9e1022225f8E0630b35a9b54bE713736',
    rpc: 'https://rpc.berachain.com',
    explorer: 'https://berascan.com',
    nativeSymbol: 'BERA'
  },
  ink: {
    name: 'Ink',
    chainId: 57073,
    eid: 30339,
    oftContract: '0x0200C29006150606B650577BBE7B6248F58470c1',
    rpc: 'https://rpc-gel.inkonchain.com',
    explorer: 'https://explorer.inkonchain.com',
    nativeSymbol: 'ETH'
  }
}

// Fee tolerance: 0.1% slippage on LayerZero
const FEE_TOLERANCE = 999n

export class Usdt0Bridge {
  /**
   * @param {object} config
   * @param {import('ethers').Wallet} [config.signer] - For executing bridges (optional for quote-only)
   */
  constructor (config = {}) {
    this.signer = config.signer || null
    this.sourceChain = null
    this._providers = {}
    this._tokenAddresses = {} // cache: chain → USDT0 address
  }

  /** Detect source chain from signer's provider */
  async detectSourceChain () {
    if (!this.signer) return null
    const network = await this.signer.provider.getNetwork()
    const chainId = Number(network.chainId)
    for (const [key, chain] of Object.entries(CHAINS)) {
      if (chain.chainId === chainId) {
        this.sourceChain = key
        return key
      }
    }
    return null
  }

  /** Get read-only provider for a chain */
  _getProvider (chain) {
    if (!this._providers[chain]) {
      const cfg = CHAINS[chain]
      if (!cfg) throw new Error(`Unknown chain: ${chain}`)
      this._providers[chain] = new ethers.JsonRpcProvider(cfg.rpc)
    }
    return this._providers[chain]
  }

  /** Get OFT contract (read-only) */
  _getOft (chain) {
    const cfg = CHAINS[chain]
    if (!cfg?.oftContract) throw new Error(`No USDT0 OFT on ${chain}`)
    return new ethers.Contract(cfg.oftContract, OFT_ABI, this._getProvider(chain))
  }

  /** Build OFT send parameters */
  _buildSendParam (targetChain, recipient, amountLD) {
    const target = CHAINS[targetChain]
    if (!target) throw new Error(`Unsupported target: ${targetChain}`)

    return {
      dstEid: target.eid,
      to: ethers.zeroPadValue(recipient, 32),
      amountLD,
      minAmountLD: amountLD * FEE_TOLERANCE / 1000n,
      extraOptions: '0x0003', // Empty LayerZero options
      composeMsg: '0x',
      oftCmd: '0x'
    }
  }

  /** Get all supported chains */
  getSupportedChains () {
    return Object.entries(CHAINS).map(([key, cfg]) => ({
      key,
      name: cfg.name,
      chainId: cfg.chainId,
      eid: cfg.eid,
      nativeSymbol: cfg.nativeSymbol,
      explorer: cfg.explorer
    }))
  }

  /** Get available routes from a source chain */
  getRoutes (sourceChain) {
    return Object.entries(CHAINS)
      .filter(([key]) => key !== sourceChain)
      .map(([key, cfg]) => ({ key, name: cfg.name, eid: cfg.eid }))
  }

  /**
   * Quote bridge fee (read-only — queries mainnet from any machine)
   * @param {string} sourceChain - e.g. 'ethereum'
   * @param {string} targetChain - e.g. 'arbitrum'
   * @param {number} amount - Human-readable (e.g. 100 for 100 USDT0)
   * @param {string} [recipient] - Destination address (defaults to signer)
   * @returns {object}
   */
  async quote (sourceChain, targetChain, amount, recipient) {
    if (sourceChain === targetChain) throw new Error('Source and target must differ')
    if (!CHAINS[sourceChain]) throw new Error(`Unknown source: ${sourceChain}`)
    if (!CHAINS[targetChain]) throw new Error(`Unknown target: ${targetChain}`)

    const addr = recipient || this.signer?.address || ethers.ZeroAddress
    const amountLD = ethers.parseUnits(amount.toString(), 6)
    const sendParam = this._buildSendParam(targetChain, addr, amountLD)
    const oft = this._getOft(sourceChain)

    const { nativeFee, lzTokenFee } = await oft.quoteSend(sendParam, false)
    const src = CHAINS[sourceChain]

    return {
      sourceChain: src.name,
      targetChain: CHAINS[targetChain].name,
      amount,
      nativeFee: parseFloat(ethers.formatEther(nativeFee)),
      nativeFeeRaw: nativeFee.toString(),
      nativeSymbol: src.nativeSymbol,
      minReceived: parseFloat(ethers.formatUnits(amountLD * FEE_TOLERANCE / 1000n, 6)),
      recipient: addr
    }
  }

  /**
   * Quote all routes from a source chain (fan-out)
   * @param {string} sourceChain
   * @param {number} amount
   * @returns {Array<object>}
   */
  async quoteAllRoutes (sourceChain, amount) {
    const routes = this.getRoutes(sourceChain)
    const addr = this.signer?.address || ethers.ZeroAddress
    const results = []

    // Sequential to avoid RPC rate limits
    for (const r of routes) {
      try {
        const q = await this.quote(sourceChain, r.key, amount, addr)
        results.push(q)
      } catch { /* skip failed routes */ }
    }

    return results
  }

  /**
   * Execute bridge (must be connected to source chain)
   * @param {string} targetChain
   * @param {number} amount
   * @param {string} [recipient] - defaults to signer address
   * @returns {object}
   */
  async bridge (targetChain, amount, recipient) {
    if (!this.signer) throw new Error('Signer required for bridge execution')

    if (!this.sourceChain) await this.detectSourceChain()
    if (!this.sourceChain) throw new Error('Signer not on a supported USDT0 chain')
    if (this.sourceChain === targetChain) throw new Error('Cannot bridge to same chain')

    const src = CHAINS[this.sourceChain]
    const recipientAddr = recipient || this.signer.address
    const amountLD = ethers.parseUnits(amount.toString(), 6)
    const sendParam = this._buildSendParam(targetChain, recipientAddr, amountLD)

    // OFT contract with signer
    const oft = new ethers.Contract(src.oftContract, OFT_ABI, this.signer)

    // Get underlying USDT0 token address
    if (!this._tokenAddresses[this.sourceChain]) {
      this._tokenAddresses[this.sourceChain] = await oft.token()
    }
    const tokenAddr = this._tokenAddresses[this.sourceChain]

    // Approve OFT to spend USDT0
    const erc20 = new ethers.Contract(tokenAddr, ERC20_ABI, this.signer)
    const allowance = await erc20.allowance(this.signer.address, src.oftContract)
    if (allowance < amountLD) {
      const appTx = await erc20.approve(src.oftContract, ethers.MaxUint256)
      await appTx.wait()
    }

    // Quote bridge fee
    const { nativeFee } = await oft.quoteSend(sendParam, false)
    const fee = { nativeFee, lzTokenFee: 0n }

    // Execute (payable — nativeFee sent as msg.value)
    const tx = await oft.send(sendParam, fee, this.signer.address, { value: nativeFee })
    const receipt = await tx.wait()

    return {
      tx: tx.hash,
      sourceChain: src.name,
      targetChain: CHAINS[targetChain].name,
      amount,
      nativeFee: parseFloat(ethers.formatEther(nativeFee)),
      nativeSymbol: src.nativeSymbol,
      gasUsed: receipt.gasUsed.toString(),
      recipient: recipientAddr,
      explorerUrl: `${src.explorer}/tx/${tx.hash}`
    }
  }

  /**
   * Get USDT0 balance on a specific chain
   * @param {string} chain
   * @param {string} address
   * @returns {number}
   */
  async getBalance (chain, address) {
    const oft = this._getOft(chain)
    if (!this._tokenAddresses[chain]) {
      this._tokenAddresses[chain] = await oft.token()
    }
    const provider = this._getProvider(chain)
    const erc20 = new ethers.Contract(this._tokenAddresses[chain], ERC20_ABI, provider)
    const bal = await erc20.balanceOf(address)
    return parseFloat(ethers.formatUnits(bal, 6))
  }

  /**
   * Get USDT0 balances across all supported chains
   * @param {string} address
   * @returns {object} { chain: balance }
   */
  async getAllBalances (address) {
    const result = {}
    const chains = Object.keys(CHAINS)

    await Promise.allSettled(
      chains.map(async chain => {
        try {
          result[chain] = await this.getBalance(chain, address)
        } catch {
          result[chain] = null
        }
      })
    )

    return result
  }
}

// ─────────────────────────────────────────────────────────────
// Lucid Kite Bridge — canonical yield-bearing stablecoins on KiteAI
//
// Architecture (per Lucid docs):
//   user USDC on supported chain
//     → multi-hop routing → lock chain (Arbitrum) → Lucid lock contract
//     → 90% deposited into Aave v3 (yield), 10% on-chain liquidity buffer
//     → controller mints L-USDC on destination chain (KiteAI) via LayerZero
//   burn L-USDC on KiteAI → JIT liquidity pulled from Aave if needed
//     → native USDC routed back to user on chosen chain.
//
// This class wraps the controller's mint/burn surface so the agent can
// route idle USDC into yield-bearing L-USDC on KiteAI without leaving
// the Kard execution model used by Usdt0Bridge above.
// ─────────────────────────────────────────────────────────────

// Minimal Lucid controller ABI — mint/burn + quote.
// We expose the cross-chain entry points; the controller handles the
// LayerZero adapter, lock-contract custody, and Aave deposit internally.
const LUCID_CONTROLLER_ABI = [
  // Cross-chain mint: lock collateral on lockChain, mint L-* on dstEid
  'function mint(uint32 dstEid, address to, uint256 amount, bytes extraOptions) payable returns (bytes32 guid)',
  // Burn L-* on current chain, route native asset back to recipient on dstEid
  'function burn(uint32 dstEid, address to, uint256 amount, bytes extraOptions) payable returns (bytes32 guid)',
  // Quote LayerZero messaging fee for either direction
  'function quoteMint(uint32 dstEid, address to, uint256 amount, bytes extraOptions) view returns (uint256 nativeFee, uint256 lzTokenFee)',
  'function quoteBurn(uint32 dstEid, address to, uint256 amount, bytes extraOptions) view returns (uint256 nativeFee, uint256 lzTokenFee)',
  // Yield-state introspection
  'function totalLocked() view returns (uint256)',
  'function bufferBalance() view returns (uint256)',
  'function aaveDeposited() view returns (uint256)',
  'function utilization() view returns (uint256)' // basis points
]

// LayerZero EIDs for chains touched by Lucid Kite.
// KiteAI's EID is honored from env first (KITEAI_LZ_EID) so deployers can
// pin the verified value once they confirm it from the LayerZero endpoint
// or the controller's getPeer() / endpoint() reads.
const LUCID_EIDS = {
  kiteai: parseInt(process.env.KITEAI_LZ_EID || '30357', 10), // best-known LZ V2 EID for KiteAI; override via env
  arbitrum: 30110,
  avalanche: 30106,
  celo: 30125,
  ethereum: 30101,
  base: 30184
}

// Lucid asset registry — keyed by symbol, mirrors chains.js `lucid` block.
// Source of truth at runtime is chains.js; this is the bridge's local
// view so it can operate without re-importing the full chain registry.
const LUCID_ASSETS = {
  USDC: {
    controller: '0x92E2391d0836e10b9e5EAB5d56BfC286Fadec25b',
    lockChain: 'arbitrum',
    decimals: 6,
    tokens: {
      kiteai: '0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e',
      avalanche: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e'
    }
  },
  WETH: {
    controller: '0x638d1c70c7b047b192eB88657B411F84fAc74681',
    lockChain: 'arbitrum',
    decimals: 18,
    tokens: {
      kiteai: '0x3D66d6c3201190952e8EA973F59c4428b32D5F9b',
      avalanche: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB'
    }
  },
  USDT: {
    controller: '0x80bA7204f060Fd321BFE8d4F3aB2E2bF4e6fCe49',
    lockChain: 'arbitrum',
    decimals: 6,
    tokens: {
      kiteai: '0x3Fdd283C4c43A60398bf93CA01a8a8BD773a755b'
      // celo token address pending — controller-managed, resolve via getToken()
    }
  }
}

const LUCID_RPC = {
  kiteai: 'https://rpc.gokite.ai',
  arbitrum: 'https://arbitrum.drpc.org',
  avalanche: 'https://api.avax.network/ext/bc/C/rpc',
  celo: 'https://forno.celo.org'
}

export class LucidKiteBridge {
  /**
   * @param {object} config
   * @param {import('ethers').Wallet} [config.signer]
   */
  constructor (config = {}) {
    this.signer = config.signer || null
    this._providers = {}
  }

  _getProvider (chain) {
    if (!this._providers[chain]) {
      const rpc = LUCID_RPC[chain]
      if (!rpc) throw new Error(`Lucid: no RPC for chain ${chain}`)
      this._providers[chain] = new ethers.JsonRpcProvider(rpc)
    }
    return this._providers[chain]
  }

  _getController (asset, chain, withSigner = false) {
    const a = LUCID_ASSETS[asset]
    if (!a) throw new Error(`Lucid: unknown asset ${asset}`)
    const runner = withSigner
      ? this.signer
      : this._getProvider(chain || a.lockChain)
    return new ethers.Contract(a.controller, LUCID_CONTROLLER_ABI, runner)
  }

  _eid (chain) {
    const eid = LUCID_EIDS[chain]
    if (!eid) throw new Error(`Lucid: no LayerZero EID known for ${chain}`)
    return eid
  }

  /** Enumerate Lucid-supported assets and their deployed chains */
  getAssets () {
    return Object.entries(LUCID_ASSETS).map(([symbol, a]) => ({
      symbol,
      controller: a.controller,
      lockChain: a.lockChain,
      deployedChains: Object.keys(a.tokens),
      decimals: a.decimals
    }))
  }

  /**
   * Read live yield-layer state for an asset (totalLocked, buffer, Aave deposit, utilization).
   * Useful for the agent's risk engine: thin buffer + high utilization → defer mint.
   */
  async getYieldState (asset) {
    const a = LUCID_ASSETS[asset]
    if (!a) throw new Error(`Lucid: unknown asset ${asset}`)
    const ctrl = this._getController(asset, a.lockChain)
    const [totalLocked, buffer, aaveDeposited, utilization] = await Promise.all([
      ctrl.totalLocked().catch(() => 0n),
      ctrl.bufferBalance().catch(() => 0n),
      ctrl.aaveDeposited().catch(() => 0n),
      ctrl.utilization().catch(() => 0n)
    ])
    const fmt = v => parseFloat(ethers.formatUnits(v, a.decimals))
    return {
      asset,
      lockChain: a.lockChain,
      totalLocked: fmt(totalLocked),
      bufferBalance: fmt(buffer),
      aaveDeposited: fmt(aaveDeposited),
      bufferRatio: totalLocked > 0n ? Number(buffer * 10000n / totalLocked) / 100 : null,
      utilizationBps: Number(utilization)
    }
  }

  /**
   * Quote a Lucid mint: lock native USDC on `sourceChain`,
   * receive L-USDC on `targetChain`. Fees are paid in source-chain native gas.
   */
  async quoteMint (asset, sourceChain, targetChain, amount, recipient) {
    const a = LUCID_ASSETS[asset]
    if (!a) throw new Error(`Lucid: unknown asset ${asset}`)
    const addr = recipient || this.signer?.address || ethers.ZeroAddress
    const amountLD = ethers.parseUnits(amount.toString(), a.decimals)
    const ctrl = this._getController(asset, sourceChain)
    const dstEid = this._eid(targetChain)
    const { nativeFee, lzTokenFee } = await ctrl.quoteMint(dstEid, addr, amountLD, '0x0003')
    return {
      direction: 'mint',
      asset,
      sourceChain,
      targetChain,
      amount,
      recipient: addr,
      nativeFee: parseFloat(ethers.formatEther(nativeFee)),
      lzTokenFee: lzTokenFee.toString(),
      lUsdcOut: amount, // 1:1 mint, yield accrues post-mint
      lockChain: a.lockChain
    }
  }

  /**
   * Quote a Lucid burn: redeem L-USDC on `sourceChain` (typically KiteAI),
   * receive native USDC on `targetChain`. JIT liquidity pulled from Aave if buffer < amount.
   */
  async quoteBurn (asset, sourceChain, targetChain, amount, recipient) {
    const a = LUCID_ASSETS[asset]
    if (!a) throw new Error(`Lucid: unknown asset ${asset}`)
    const addr = recipient || this.signer?.address || ethers.ZeroAddress
    const amountLD = ethers.parseUnits(amount.toString(), a.decimals)
    const ctrl = this._getController(asset, sourceChain)
    const dstEid = this._eid(targetChain)
    const { nativeFee, lzTokenFee } = await ctrl.quoteBurn(dstEid, addr, amountLD, '0x0003')

    // Surface JIT-liquidity risk: if requested amount exceeds buffer, settlement
    // waits for an Aave withdrawal — agent should expect bridge-timeline delay.
    let jitRequired = false
    try {
      const state = await this.getYieldState(asset)
      jitRequired = state.bufferBalance !== null && amount > state.bufferBalance
    } catch { /* yield-state read is best-effort */ }

    return {
      direction: 'burn',
      asset,
      sourceChain,
      targetChain,
      amount,
      recipient: addr,
      nativeFee: parseFloat(ethers.formatEther(nativeFee)),
      lzTokenFee: lzTokenFee.toString(),
      jitRequired,
      lockChain: a.lockChain
    }
  }

  /**
   * Execute a Lucid mint — agent must be connected to `sourceChain`.
   * Approves the controller for the native asset, then submits the mint.
   */
  async mint (asset, targetChain, amount, recipient, opts = {}) {
    if (!this.signer) throw new Error('Signer required for Lucid mint')
    const a = LUCID_ASSETS[asset]
    if (!a) throw new Error(`Lucid: unknown asset ${asset}`)

    const network = await this.signer.provider.getNetwork()
    const sourceChain = Object.entries(LUCID_RPC).find(([k]) => {
      // resolve current chain by id
      const ids = { kiteai: 2366, arbitrum: 42161, avalanche: 43114, celo: 42220 }
      return ids[k] === Number(network.chainId)
    })?.[0]
    if (!sourceChain) throw new Error('Lucid: signer not on a Lucid-supported chain')

    const recipientAddr = recipient || this.signer.address
    const amountLD = ethers.parseUnits(amount.toString(), a.decimals)
    const ctrl = this._getController(asset, sourceChain, true)

    // Approve native asset to controller (USDC / WETH on source chain)
    const tokenAddr = a.tokens[sourceChain]
    if (tokenAddr) {
      const erc20 = new ethers.Contract(tokenAddr, ERC20_ABI, this.signer)
      const allowance = await erc20.allowance(this.signer.address, a.controller)
      if (allowance < amountLD) {
        const appTx = await erc20.approve(a.controller, ethers.MaxUint256)
        await appTx.wait()
      }
    }

    const dstEid = this._eid(targetChain)
    const { nativeFee } = await ctrl.quoteMint(dstEid, recipientAddr, amountLD, '0x0003')

    // Pre-flight gas check (fee + buffer) — caller can pass a GasManager
    if (opts.gasManager) {
      await opts.gasManager.ensureCanPay(sourceChain, parseFloat(ethers.formatEther(nativeFee)))
    }

    const tx = await ctrl.mint(dstEid, recipientAddr, amountLD, '0x0003', { value: nativeFee })
    const receipt = await tx.wait()

    return {
      tx: tx.hash,
      direction: 'mint',
      asset,
      sourceChain,
      targetChain,
      amount,
      lUsdcOut: amount,
      nativeFee: parseFloat(ethers.formatEther(nativeFee)),
      gasUsed: receipt.gasUsed.toString(),
      recipient: recipientAddr
    }
  }

  /**
   * Execute a Lucid burn — agent must be connected to `sourceChain` (usually KiteAI).
   * JIT liquidity from Aave settles within standard bridge timelines if buffer < amount.
   */
  async burn (asset, targetChain, amount, recipient, opts = {}) {
    if (!this.signer) throw new Error('Signer required for Lucid burn')
    const a = LUCID_ASSETS[asset]
    if (!a) throw new Error(`Lucid: unknown asset ${asset}`)

    const network = await this.signer.provider.getNetwork()
    const ids = { kiteai: 2366, arbitrum: 42161, avalanche: 43114, celo: 42220 }
    const sourceChain = Object.entries(ids).find(([, id]) => id === Number(network.chainId))?.[0]
    if (!sourceChain) throw new Error('Lucid: signer not on a Lucid-supported chain')

    const recipientAddr = recipient || this.signer.address
    const amountLD = ethers.parseUnits(amount.toString(), a.decimals)
    const ctrl = this._getController(asset, sourceChain, true)
    const dstEid = this._eid(targetChain)

    const { nativeFee } = await ctrl.quoteBurn(dstEid, recipientAddr, amountLD, '0x0003')

    if (opts.gasManager) {
      await opts.gasManager.ensureCanPay(sourceChain, parseFloat(ethers.formatEther(nativeFee)))
    }

    const tx = await ctrl.burn(dstEid, recipientAddr, amountLD, '0x0003', { value: nativeFee })
    const receipt = await tx.wait()

    return {
      tx: tx.hash,
      direction: 'burn',
      asset,
      sourceChain,
      targetChain,
      amount,
      nativeFee: parseFloat(ethers.formatEther(nativeFee)),
      gasUsed: receipt.gasUsed.toString(),
      recipient: recipientAddr
    }
  }

  /**
   * Sanity-check the controller before any mainnet write.
   * Probes each function we rely on with eth_call and reports which selectors
   * are reachable. Run this once after deployment confirmation; if any read
   * function returns "not a function" we know the ABI drifted from docs and
   * we shouldn't sign a write.
   *
   * @returns {Promise<{ asset, controller, results: Record<string, {ok:boolean, error?:string}> }>}
   */
  async verifyController (asset) {
    const a = LUCID_ASSETS[asset]
    if (!a) throw new Error(`Lucid: unknown asset ${asset}`)
    const ctrl = this._getController(asset, a.lockChain)
    const probes = ['totalLocked', 'bufferBalance', 'aaveDeposited', 'utilization']
    const results = {}
    for (const fn of probes) {
      try {
        const v = await ctrl[fn]()
        results[fn] = { ok: true, value: v.toString() }
      } catch (e) {
        results[fn] = { ok: false, error: e.shortMessage || e.message }
      }
    }
    // Static-call quoteMint with zero address / zero amount as a write-path probe
    try {
      const q = await ctrl.quoteMint.staticCall(
        LUCID_EIDS.kiteai, ethers.ZeroAddress, 0n, '0x0003'
      )
      results.quoteMint = { ok: true, nativeFee: q[0]?.toString() }
    } catch (e) {
      results.quoteMint = { ok: false, error: e.shortMessage || e.message }
    }
    const allOk = Object.values(results).every(r => r.ok)
    return { asset, controller: a.controller, lockChain: a.lockChain, allOk, results }
  }

  /** L-token balance on a deployed chain (e.g. L-USDC on KiteAI) */
  async getBalance (asset, chain, address) {
    const a = LUCID_ASSETS[asset]
    if (!a) throw new Error(`Lucid: unknown asset ${asset}`)
    const tokenAddr = a.tokens[chain]
    if (!tokenAddr) throw new Error(`Lucid: ${asset} not deployed on ${chain}`)
    const erc20 = new ethers.Contract(tokenAddr, ERC20_ABI, this._getProvider(chain))
    const bal = await erc20.balanceOf(address)
    return parseFloat(ethers.formatUnits(bal, a.decimals))
  }
}
