// @kard/agent — Beefy Finance Auto-Compounding Vaults
// Deposit into Beefy vaults — they auto-compound LP fees and rewards every few hours.
// Higher effective APY than manually collecting fees.
// Mainnet: Arbitrum / Base / Avalanche / Polygon / Optimism / Ethereum
// Testnet: Not available (Beefy is mainnet-only)

import { ethers } from 'ethers'

// Beefy public APIs
const BEEFY_API = 'https://api.beefy.finance'

// Beefy chain slug mapping (their naming convention)
const CHAIN_SLUG = {
  arbitrum: 'arbitrum',
  base:     'base',
  ethereum: 'ethereum',
  avalanche: 'avax',
  polygon:  'polygon',
  optimism: 'optimism',
  celo:     'celo'
}

// Standard Beefy vault ABI (all vaults share this interface)
const VAULT_ABI = [
  'function deposit(uint256 _amount)',
  'function depositAll()',
  'function withdraw(uint256 _shares)',
  'function withdrawAll()',
  'function getPricePerFullShare() view returns (uint256)',
  'function balance() view returns (uint256)',
  'function want() view returns (address)',
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function name() view returns (string)',
  'function decimals() view returns (uint8)'
]

const ERC20_ABI = [
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
]

export class BeefyVaults {
  /**
   * @param {object} cfg
   * @param {ethers.Wallet} cfg.signer
   * @param {'arbitrum'|'base'|'ethereum'|'avalanche'|'polygon'} cfg.chain
   */
  constructor (cfg) {
    this.signer = cfg.signer
    this.chain = cfg.chain
    this.slug = CHAIN_SLUG[cfg.chain]

    if (process.env.KARD_ENV === 'testnet') {
      console.warn('[beefy] Beefy vaults are mainnet-only')
      this._disabled = true
    }
  }

  // ─── Discovery ─────────────────────────────────────────────────────────────

  /**
   * Fetch all vaults from Beefy API, filtered by chain and optional criteria.
   * @param {object} opts
   * @param {string} [opts.asset] — filter by underlying asset (e.g. 'USDC')
   * @param {number} [opts.minApy=5] — minimum APY threshold
   * @param {number} [opts.minTvl=100000] — minimum TVL in USD
   * @param {number} [opts.limit=10]
   */
  async getVaults ({ asset, minApy = 5, minTvl = 100_000, limit = 10 } = {}) {
    if (this._disabled) return []

    try {
      // Fetch vaults + APY data in parallel
      const [vaultsRes, apyRes, tvlRes] = await Promise.all([
        fetch(`${BEEFY_API}/vaults`, { signal: AbortSignal.timeout(8000) }),
        fetch(`${BEEFY_API}/apy`, { signal: AbortSignal.timeout(8000) }),
        fetch(`${BEEFY_API}/tvl`, { signal: AbortSignal.timeout(8000) })
      ])

      if (!vaultsRes.ok) throw new Error(`beefy vaults ${vaultsRes.status}`)
      const [vaults, apyData, tvlData] = await Promise.all([
        vaultsRes.json(),
        apyRes.ok ? apyRes.json() : {},
        tvlRes.ok ? tvlRes.json() : {}
      ])

      return vaults
        .filter(v => {
          if (v.chain !== this.slug) return false
          if (v.status !== 'active') return false
          const apy = (apyData[v.id] || 0) * 100
          const tvl = tvlData[v.id] || 0
          if (apy < minApy) return false
          if (tvl < minTvl) return false
          if (asset) {
            const tokens = [v.token, ...(v.assets || [])].map(s => s?.toUpperCase())
            if (!tokens.some(t => t?.includes(asset.toUpperCase()))) return false
          }
          return true
        })
        .map(v => ({
          id: v.id,
          name: v.name,
          address: v.earnContractAddress,
          wantToken: v.tokenAddress,
          wantSymbol: v.token,
          assets: v.assets || [v.token],
          apy: Math.round((apyData[v.id] || 0) * 10000) / 100,  // % with 2 decimal places
          tvlUsd: Math.round(tvlData[v.id] || 0),
          platform: v.platformId,
          chain: this.chain,
          source: 'beefy'
        }))
        .sort((a, b) => b.apy - a.apy)
        .slice(0, limit)
    } catch (e) {
      console.error(`[beefy] getVaults failed: ${e.message}`)
      return []
    }
  }

  // ─── Portfolio ─────────────────────────────────────────────────────────────

  /**
   * Get current Beefy positions (mooToken balances across known vaults).
   * For efficiency, caller passes in vault addresses to check.
   */
  async getPositions (vaultAddresses = []) {
    if (this._disabled) return []
    const positions = []

    for (const addr of vaultAddresses) {
      try {
        const vault = new ethers.Contract(addr, VAULT_ABI, this.signer)
        const [mooBalance, ppfs, name] = await Promise.all([
          vault.balanceOf(this.signer.address),
          vault.getPricePerFullShare(),
          vault.name().catch(() => 'Beefy Vault')
        ])

        if (mooBalance === 0n) continue

        // mooToken → underlying = mooBalance * pricePerFullShare / 1e18
        const underlyingWei = mooBalance * ppfs / 10n ** 18n

        positions.push({
          vaultAddress: addr,
          name,
          mooBalance: mooBalance.toString(),
          underlyingBalance: underlyingWei.toString(),
          chain: this.chain,
          source: 'beefy'
        })
      } catch (e) {
        console.error(`[beefy] position read failed for ${addr}: ${e.message}`)
      }
    }

    return positions
  }

  // ─── Execution ─────────────────────────────────────────────────────────────

  /**
   * Deposit into a Beefy vault
   * @param {object} p
   * @param {string} p.vaultAddress — the mooToken contract address
   * @param {string} p.wantToken — underlying LP/token address
   * @param {number} p.amount — amount of want token to deposit
   */
  async deposit ({ vaultAddress, wantToken, amount }) {
    if (this._disabled) throw new Error('Beefy is mainnet-only')

    const vault = new ethers.Contract(vaultAddress, VAULT_ABI, this.signer)
    const token = new ethers.Contract(wantToken, ERC20_ABI, this.signer)
    const decimals = await token.decimals()
    const amountWei = ethers.parseUnits(amount.toString(), decimals)

    // Approve vault to spend want token
    const allowance = await token.allowance(this.signer.address, vaultAddress)
    if (allowance < amountWei) {
      const approveTx = await token.approve(vaultAddress, ethers.MaxUint256)
      await approveTx.wait()
    }

    const tx = await vault.deposit(amountWei)
    const receipt = await tx.wait()

    console.log(`[beefy] deposited ${amount} into vault ${vaultAddress} on ${this.chain}`)
    return {
      tx: tx.hash,
      gasUsed: receipt.gasUsed.toString(),
      vaultAddress, amount, chain: this.chain,
      type: 'beefy_deposit', venue: 'beefy'
    }
  }

  /**
   * Withdraw from a Beefy vault
   * @param {object} p
   * @param {string} p.vaultAddress
   * @param {number|'all'} p.shares — mooToken amount, or 'all' to withdraw everything
   */
  async withdraw ({ vaultAddress, shares = 'all' }) {
    if (this._disabled) throw new Error('Beefy is mainnet-only')

    const vault = new ethers.Contract(vaultAddress, VAULT_ABI, this.signer)

    let tx
    if (shares === 'all') {
      tx = await vault.withdrawAll()
    } else {
      tx = await vault.withdraw(BigInt(shares))
    }

    const receipt = await tx.wait()

    console.log(`[beefy] withdrew from vault ${vaultAddress} on ${this.chain}`)
    return {
      tx: tx.hash,
      gasUsed: receipt.gasUsed.toString(),
      vaultAddress, chain: this.chain,
      type: 'beefy_withdraw', venue: 'beefy'
    }
  }

  /** Surface top Beefy opportunities for the yield aggregator */
  async opportunities ({ asset = 'USDC', minApy = 6 } = {}) {
    const vaults = await this.getVaults({ asset, minApy })
    return vaults.slice(0, 5).map(v => ({
      source: 'beefy',
      chain: v.chain,
      asset: v.wantSymbol,
      apy: v.apy,
      tvlUsd: v.tvlUsd,
      riskTier: 2,  // auto-compounding LP = slightly more risk than lending
      vaultAddress: v.address,
      wantToken: v.wantToken,
      action: { type: 'beefy_deposit', vaultAddress: v.address, wantToken: v.wantToken, chain: v.chain },
      note: `Beefy ${v.name} — ${v.apy}% APY (auto-compounded)`
    }))
  }
}
