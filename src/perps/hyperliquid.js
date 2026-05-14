// @kard/agent — Hyperliquid Perps Adapter
//
// Uses the maintained @nktkas/hyperliquid SDK so EIP-712 signing,
// msgpack action hashing, and L1 transport are handled by code that's
// been validated against real fills. Our adapter is a thin wrapper that
// matches the rest of the codebase's call shape and adds the risk-engine
// hooks the agent runtime needs.
//
// Network selection:
//   HYPERLIQUID_NETWORK=testnet (default) | mainnet
//
// Real perp execution requires:
//   HYPERLIQUID_API_WALLET   — private key of the agent wallet you've
//                              authorized in the Hyperliquid UI under
//                              "API". This is NOT your main account key.
//   HYPERLIQUID_USER_ADDRESS — your main account address (the one whose
//                              positions/equity the agent reads + trades)

import { ethers } from 'ethers'
import * as hl from '@nktkas/hyperliquid'

const NETWORKS = {
  testnet: { name: 'Hyperliquid Testnet', isTestnet: true,  base: 'https://api.hyperliquid-testnet.xyz' },
  mainnet: { name: 'Hyperliquid',         isTestnet: false, base: 'https://api.hyperliquid.xyz' }
}

export class HyperliquidPerps {
  /**
   * @param {object} cfg
   * @param {'testnet'|'mainnet'} [cfg.network]
   * @param {string} [cfg.userAddress]
   * @param {import('ethers').Wallet} [cfg.apiWallet]
   */
  constructor (cfg = {}) {
    const net = cfg.network || process.env.HYPERLIQUID_NETWORK || 'testnet'
    if (!NETWORKS[net]) throw new Error(`Hyperliquid: unknown network ${net}`)
    this.network = net
    this.cfg = NETWORKS[net]
    this.userAddress = cfg.userAddress || null
    this.apiWallet = cfg.apiWallet || null
    this._meta = null

    // Read client — works without any signer
    const transport = new hl.HttpTransport({ isTestnet: this.cfg.isTestnet })
    this.info = new hl.InfoClient({ transport })

    // Write client — only when an API wallet is configured
    this.exchange = this.apiWallet
      ? new hl.ExchangeClient({
          transport,
          wallet: this.apiWallet,            // ethers Wallet — SDK handles signing
          isTestnet: this.cfg.isTestnet,
          // Optional: route trades from a vault or as an agent for `userAddress`
          ...(this.userAddress ? { defaultVaultAddress: undefined } : {})
        })
      : null
  }

  // ─────────── Reads ───────────

  async getMarkets () {
    if (this._meta) return this._meta
    const meta = await this.info.meta()
    this._meta = meta.universe.map((m, i) => ({
      symbol: m.name,
      assetIndex: i,
      maxLeverage: m.maxLeverage,
      szDecimals: m.szDecimals,
      onlyIsolated: !!m.onlyIsolated
    }))
    return this._meta
  }

  async getMids () {
    const mids = await this.info.allMids()
    const out = {}
    for (const [k, v] of Object.entries(mids)) out[k] = parseFloat(v)
    return out
  }

  async getFunding () {
    const ctx = await this.info.metaAndAssetCtxs()
    const universe = ctx[0]?.universe || []
    const ctxs = ctx[1] || []
    const out = {}
    for (let i = 0; i < universe.length; i++) {
      const sym = universe[i].name
      const c = ctxs[i] || {}
      out[sym] = {
        funding: parseFloat(c.funding || '0'),
        openInterest: parseFloat(c.openInterest || '0'),
        premium: parseFloat(c.premium || '0'),
        oraclePx: parseFloat(c.oraclePx || '0'),
        markPx: parseFloat(c.markPx || '0')
      }
    }
    return out
  }

  async getOrderBook (symbol, nLevels = 10) {
    const book = await this.info.l2Book({ coin: symbol, nSigFigs: null })
    return {
      symbol,
      bids: (book.levels?.[0] || []).slice(0, nLevels)
        .map(l => ({ px: parseFloat(l.px), sz: parseFloat(l.sz) })),
      asks: (book.levels?.[1] || []).slice(0, nLevels)
        .map(l => ({ px: parseFloat(l.px), sz: parseFloat(l.sz) }))
    }
  }

  async getAccountState (address) {
    const user = address || this.userAddress
    if (!user) throw new Error('Hyperliquid: userAddress required for getAccountState')
    const s = await this.info.clearinghouseState({ user })
    return {
      address: user,
      accountValue: parseFloat(s.marginSummary?.accountValue || '0'),
      totalNtlPos: parseFloat(s.marginSummary?.totalNtlPos || '0'),
      totalRawUsd: parseFloat(s.marginSummary?.totalRawUsd || '0'),
      totalMarginUsed: parseFloat(s.marginSummary?.totalMarginUsed || '0'),
      withdrawable: parseFloat(s.withdrawable || '0'),
      crossMaintenanceMarginUsed: parseFloat(s.crossMaintenanceMarginUsed || '0')
    }
  }

  async getPositions (address) {
    const user = address || this.userAddress
    if (!user) throw new Error('Hyperliquid: userAddress required for getPositions')
    const s = await this.info.clearinghouseState({ user })
    return (s.assetPositions || [])
      .map(p => ({
        symbol: p.position.coin,
        size: parseFloat(p.position.szi),
        entryPx: parseFloat(p.position.entryPx || '0'),
        positionValue: parseFloat(p.position.positionValue || '0'),
        unrealizedPnl: parseFloat(p.position.unrealizedPnl || '0'),
        returnOnEquity: parseFloat(p.position.returnOnEquity || '0'),
        leverage: p.position.leverage?.value || null,
        liquidationPx: parseFloat(p.position.liquidationPx || '0'),
        marginUsed: parseFloat(p.position.marginUsed || '0')
      }))
      .filter(p => p.size !== 0)
  }

  // ─────────── Writes (real signing via @nktkas/hyperliquid) ───────────

  /**
   * Open a perp position. Real EIP-712 signing handled by the SDK.
   * @param {object} order
   * @param {string} order.symbol
   * @param {'long'|'short'} order.side
   * @param {number} order.size
   * @param {number} [order.leverage]
   * @param {number} [order.limitPx] — omit for IOC market-style fill at mid ± 1%
   * @param {boolean} [order.reduceOnly]
   * @param {boolean} [order.isolated]
   */
  async openPosition (order) {
    if (!this.exchange) {
      throw new Error('Hyperliquid: HYPERLIQUID_API_WALLET required for trade execution. ' +
        'Authorize an API wallet in the Hyperliquid UI and set its private key.')
    }
    const markets = await this.getMarkets()
    const m = markets.find(x => x.symbol === order.symbol)
    if (!m) throw new Error(`Hyperliquid: unknown market ${order.symbol}`)

    let limitPx = order.limitPx
    if (!limitPx) {
      const mids = await this.getMids()
      const mid = mids[order.symbol]
      if (!mid) throw new Error(`Hyperliquid: no mid price for ${order.symbol}`)
      limitPx = order.side === 'long' ? mid * 1.01 : mid * 0.99
    }

    if (order.leverage) {
      await this.exchange.updateLeverage({
        asset: m.assetIndex,
        isCross: !order.isolated,
        leverage: order.leverage
      })
    }

    // Build entry order
    const entry = {
      a: m.assetIndex,
      b: order.side === 'long',
      p: this._fmtPx(limitPx),
      s: this._fmtSz(order.size, m.szDecimals),
      r: !!order.reduceOnly,
      t: { limit: { tif: 'Ioc' } }
    }
    const orders = [entry]

    // VENUE-SIDE STOPS — submitted at entry time so they fire even if Kard
    // is offline. order.stopPx and order.takeProfitPx are absolute prices.
    // order.stopPct / order.tpPct are percentage offsets from limitPx.
    const stopPx = order.stopPx ??
      (order.stopPct ? (order.side === 'long' ? limitPx * (1 - order.stopPct) : limitPx * (1 + order.stopPct)) : null)
    const tpPx = order.takeProfitPx ??
      (order.tpPct ? (order.side === 'long' ? limitPx * (1 + order.tpPct) : limitPx * (1 - order.tpPct)) : null)

    if (stopPx) {
      orders.push({
        a: m.assetIndex,
        b: order.side === 'short',  // opposite — closes the position
        p: this._fmtPx(stopPx),
        s: this._fmtSz(order.size, m.szDecimals),
        r: true,                    // reduce-only so it can never flip you
        t: { trigger: { isMarket: true, triggerPx: this._fmtPx(stopPx), tpsl: 'sl' } }
      })
    }
    if (tpPx) {
      orders.push({
        a: m.assetIndex,
        b: order.side === 'short',
        p: this._fmtPx(tpPx),
        s: this._fmtSz(order.size, m.szDecimals),
        r: true,
        t: { trigger: { isMarket: true, triggerPx: this._fmtPx(tpPx), tpsl: 'tp' } }
      })
    }

    const result = await this.exchange.order({
      orders,
      grouping: stopPx || tpPx ? 'positionTpsl' : 'na'
    })

    // Post-submit verification — make sure the trigger orders actually registered.
    // If they didn't, surface a clear error so the caller can fall back (e.g.
    // schedule a Kard-side stop monitor) instead of silently being unprotected.
    if (stopPx || tpPx) {
      try {
        const open = await this.info.frontendOpenOrders({ user: this.userAddress })
        const slOk = !stopPx || open.some(o =>
          o.coin === order.symbol && o.orderType === 'Stop Market' &&
          Math.abs(parseFloat(o.triggerPx) - stopPx) / stopPx < 0.005)
        const tpOk = !tpPx || open.some(o =>
          o.coin === order.symbol && o.orderType === 'Take Profit Market' &&
          Math.abs(parseFloat(o.triggerPx) - tpPx) / tpPx < 0.005)
        if (!slOk || !tpOk) {
          result.triggerVerification = {
            ok: false,
            stopRegistered: slOk, takeProfitRegistered: tpOk,
            warning: 'Trigger order did not register on Hyperliquid. Falling back to Kard-side stop watch.'
          }
        } else {
          result.triggerVerification = { ok: true }
        }
      } catch (e) {
        result.triggerVerification = { ok: null, error: e.message }
      }
    }
    return result
  }

  async closePosition (symbol, size = null) {
    const positions = await this.getPositions()
    const pos = positions.find(p => p.symbol === symbol)
    if (!pos) throw new Error(`Hyperliquid: no open position in ${symbol}`)
    const closeSize = size != null ? size : Math.abs(pos.size)
    const closeSide = pos.size > 0 ? 'short' : 'long'
    return this.openPosition({
      symbol,
      side: closeSide,
      size: closeSize,
      reduceOnly: true
    })
  }

  /** Cancel an open order by oid */
  async cancel (symbol, oid) {
    if (!this.exchange) throw new Error('Hyperliquid: API wallet required')
    const markets = await this.getMarkets()
    const m = markets.find(x => x.symbol === symbol)
    if (!m) throw new Error(`Hyperliquid: unknown market ${symbol}`)
    return this.exchange.cancel({ cancels: [{ a: m.assetIndex, o: oid }] })
  }

  // ─────────── Helpers ───────────

  _fmtPx (px) { return parseFloat(px.toPrecision(5)).toString() }
  _fmtSz (sz, szDecimals) { return sz.toFixed(szDecimals) }

  async snapshot () {
    const out = {
      network: this.network,
      base: this.cfg.base,
      hasSigner: !!this.exchange,
      userAddress: this.userAddress
    }
    try {
      const [mids, funding, markets] = await Promise.all([
        this.getMids(), this.getFunding(), this.getMarkets()
      ])
      out.markets = markets.length
      out.mids = mids
      const ranked = Object.entries(funding)
        .map(([sym, f]) => ({ sym, ...f }))
        .sort((a, b) => b.funding - a.funding)
      out.fundingExtremes = {
        topPaid: ranked.slice(0, 3),
        topReceived: ranked.slice(-3).reverse()
      }
    } catch (e) {
      out.error = e.message
    }
    if (this.userAddress) {
      try {
        out.account = await this.getAccountState()
        out.positions = await this.getPositions()
      } catch (e) {
        out.accountError = e.message
      }
    }
    return out
  }
}

/** Build adapter from env vars */
export function createHyperliquidFromEnv () {
  const apiKey = process.env.HYPERLIQUID_API_WALLET
  const apiWallet = apiKey
    ? new ethers.Wallet(apiKey.startsWith('0x') ? apiKey : `0x${apiKey}`)
    : null
  return new HyperliquidPerps({
    network: process.env.HYPERLIQUID_NETWORK || 'testnet',
    userAddress: process.env.HYPERLIQUID_USER_ADDRESS || null,
    apiWallet
  })
}
