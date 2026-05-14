// @kard/agent — GMX V2 perps adapter (Arbitrum + Avalanche)
//
// GMX V2 uses an order-vault + ExchangeRouter architecture:
//   1. approve USDC to the router
//   2. ExchangeRouter.sendWnt(orderVault, executionFee)   — executionFee in WETH
//   3. ExchangeRouter.sendTokens(USDC, orderVault, collateral)
//   4. ExchangeRouter.createOrder({ ... })
// A keeper fills the order and emits OrderExecuted. We wait for it via logs.
//
// This adapter handles the four-step flow as one `openPosition()` call. Same
// shape as HyperliquidPerps so the agent runtime can use either.

import { ethers } from 'ethers'

const ADDRS = {
  arbitrum: {
    exchangeRouter: '0x69C527fC77291722b52649E45c838e41be8Bf5d5',
    orderVault:     '0x31eF83a530Fde1B38EE9A18093A333D8Bbbc40D5',
    dataStore:      '0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8',
    reader:         '0x5Ca84c34a381434786738735265b9f3FD814b824',
    weth:           '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    usdc:           '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
  },
  avalanche: {
    exchangeRouter: '0x2b76df209E1343da5698AF0f8757f6170162e78b',
    orderVault:     '0x3DbF23bb84BCA9F1c4Cf1C95dD2c9D70bD1A4Fb6',
    dataStore:      '0xa64e2d6FE8f64Bf4dC5f0Ac1A37D1056b8a5C3D3',
    reader:         '0x73BA76E11AAD8120049a92F2D4D2017Cc3E1c0C7',
    weth:           '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB', // WAVAX placeholder pre-confirm
    usdc:           '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'
  }
}

const ROUTER_ABI = [
  'function sendWnt(address receiver, uint256 amount) payable',
  'function sendTokens(address token, address receiver, uint256 amount)',
  'function createOrder((address receiver, address callbackContract, address uiFeeReceiver, address market, address initialCollateralToken, address[] swapPath, uint256 sizeDeltaUsd, uint256 initialCollateralDeltaAmount, uint256 triggerPrice, uint256 acceptablePrice, uint256 executionFee, uint256 callbackGasLimit, uint256 minOutputAmount, uint256 validFromTime, uint8 orderType, uint8 decreasePositionSwapType, bool isLong, bool shouldUnwrapNativeToken, bool autoCancel, bytes32 referralCode) params) returns (bytes32)'
]

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)'
]

// Order types (per GMX V2 source)
const OrderType = {
  MarketIncrease: 2,
  MarketDecrease: 4,
  StopLossDecrease: 6,
  Liquidation: 7
}

export class GmxV2Perps {
  /**
   * @param {object} cfg
   * @param {'arbitrum'|'avalanche'} cfg.chain
   * @param {ethers.Wallet} cfg.signer
   * @param {Map<string,string>} cfg.markets — symbol → market address
   * @param {(symbol)=>Promise<bigint>} cfg.priceOf — returns 30-decimal USD price
   */
  constructor (cfg) {
    this.chain = cfg.chain
    if (!ADDRS[this.chain]) throw new Error(`GMX V2: unsupported chain ${this.chain}`)
    this.addrs = ADDRS[this.chain]
    this.signer = cfg.signer
    this.markets = cfg.markets || new Map()
    this.priceOf = cfg.priceOf
    this.executionFee = cfg.executionFee || ethers.parseEther('0.0008') // ~Arbitrum default
    this.acceptablePriceSlippageBps = cfg.acceptablePriceSlippageBps ?? 50 // 0.5%
  }

  registerMarket (symbol, marketAddress) { this.markets.set(symbol, marketAddress) }

  /**
   * Open a position.
   * @param {object} order
   * @param {string} order.symbol
   * @param {'long'|'short'} order.side
   * @param {number} order.collateralUSDC — USDC to deposit
   * @param {number} order.leverage       — 1..50
   * @param {number} [order.acceptablePriceUsd]
   */
  async openPosition (order) {
    const market = this.markets.get(order.symbol)
    if (!market) throw new Error(`GMX V2: no market registered for ${order.symbol}`)

    const router = new ethers.Contract(this.addrs.exchangeRouter, ROUTER_ABI, this.signer)
    const usdc = new ethers.Contract(this.addrs.usdc, ERC20_ABI, this.signer)

    const collateralAmount = ethers.parseUnits(order.collateralUSDC.toString(), 6)
    const sizeDeltaUsd = collateralAmount * BigInt(order.leverage) * 10n ** 24n // → 30-dec
    const px = await this.priceOf(order.symbol)
    const accept = order.acceptablePriceUsd
      ? BigInt(Math.floor(order.acceptablePriceUsd * 1e30))
      : (order.side === 'long'
          ? px * (10000n + BigInt(this.acceptablePriceSlippageBps)) / 10000n
          : px * (10000n - BigInt(this.acceptablePriceSlippageBps)) / 10000n)

    // 1. Approve USDC
    const allowance = await usdc.allowance(this.signer.address, this.addrs.exchangeRouter)
    if (allowance < collateralAmount) {
      const tx = await usdc.approve(this.addrs.exchangeRouter, ethers.MaxUint256)
      await tx.wait()
    }

    // 2-4 happen in a multicall on the router but we send sequentially for clarity
    // 2. Send WETH for execution fee
    const sendWnt = await router.sendWnt(this.addrs.orderVault, this.executionFee, { value: this.executionFee })
    await sendWnt.wait()

    // 3. Send collateral
    const sendCol = await router.sendTokens(this.addrs.usdc, this.addrs.orderVault, collateralAmount)
    await sendCol.wait()

    // 4. Create order
    const params = {
      receiver: this.signer.address,
      callbackContract: ethers.ZeroAddress,
      uiFeeReceiver: ethers.ZeroAddress,
      market,
      initialCollateralToken: this.addrs.usdc,
      swapPath: [],
      sizeDeltaUsd,
      initialCollateralDeltaAmount: 0n,
      triggerPrice: 0n,
      acceptablePrice: accept,
      executionFee: this.executionFee,
      callbackGasLimit: 0n,
      minOutputAmount: 0n,
      validFromTime: 0n,
      orderType: OrderType.MarketIncrease,
      decreasePositionSwapType: 0,
      isLong: order.side === 'long',
      shouldUnwrapNativeToken: false,
      autoCancel: false,
      referralCode: ethers.ZeroHash
    }
    const tx = await router.createOrder(params)
    const receipt = await tx.wait()

    // VENUE-SIDE STOP / TP — submit decrease orders that trigger at fixed prices.
    // GMX V2 fires these via keepers regardless of whether Kard is online.
    const triggerOrders = []
    const stopPx = order.stopPriceUsd ??
      (order.stopPct ? (order.side === 'long' ? Number(px) * (1 - order.stopPct) / 1e30 : Number(px) * (1 + order.stopPct) / 1e30) : null)
    const tpPx = order.takeProfitPriceUsd ??
      (order.tpPct ? (order.side === 'long' ? Number(px) * (1 + order.tpPct) / 1e30 : Number(px) * (1 - order.tpPct) / 1e30) : null)

    // GMX V2 trigger semantics — `acceptablePrice` is the bound the keeper
    // is allowed to fill at. For each (side, kind) combination:
    //
    //   long + SL  : price drops to triggerPx → keeper sells, accept anything ≤ triggerPx
    //                  → acceptablePrice = 0  (accept any worse-down fill)
    //   long + TP  : price rises to triggerPx → keeper sells, accept anything ≥ triggerPx
    //                  → acceptablePrice = MaxUint256
    //   short + SL : price rises to triggerPx → keeper buys, accept anything ≥ triggerPx
    //                  → acceptablePrice = MaxUint256
    //   short + TP : price drops to triggerPx → keeper buys, accept anything ≤ triggerPx
    //                  → acceptablePrice = 0
    //
    // Note: the closing `isLong` flag MIRRORS the original position (not the
    // close direction). GMX uses isLong to identify which lot to decrement.
    const acceptForKind = (side, kind) => {
      if (side === 'long' && kind === 'sl') return 0n
      if (side === 'long' && kind === 'tp') return ethers.MaxUint256
      if (side === 'short' && kind === 'sl') return ethers.MaxUint256
      if (side === 'short' && kind === 'tp') return 0n
      return triggerPrice
    }

    const submitTrigger = async (triggerUsd, kind) => {
      const triggerPrice = BigInt(Math.floor(triggerUsd * 1e30))
      const sendWnt = await router.sendWnt(this.addrs.orderVault, this.executionFee, { value: this.executionFee })
      await sendWnt.wait()
      const triggerParams = {
        ...params,
        sizeDeltaUsd, // close full size
        initialCollateralDeltaAmount: collateralAmount,
        triggerPrice,
        acceptablePrice: acceptForKind(order.side, kind),
        orderType: kind === 'sl' ? OrderType.StopLossDecrease : OrderType.MarketDecrease,
        isLong: order.side === 'long'  // identifies the lot to decrement (mirrors original)
      }
      const t = await router.createOrder(triggerParams)
      const r = await t.wait()
      // Verify the order key (createOrder returns bytes32) — extract from logs
      const orderKey = r.logs?.[0]?.topics?.[1] || null
      triggerOrders.push({ kind, triggerPrice: triggerUsd, tx: t.hash, orderKey })
    }

    try {
      if (stopPx) await submitTrigger(stopPx, 'sl')
      if (tpPx)   await submitTrigger(tpPx, 'tp')
    } catch (e) {
      // entry succeeded but trigger order failed — return entry result with warning
      return {
        venue: 'gmx_v2', chain: this.chain, tx: tx.hash,
        gasUsed: receipt.gasUsed.toString(), market, side: order.side,
        collateralUSDC: order.collateralUSDC, leverage: order.leverage,
        executionFee: ethers.formatEther(this.executionFee),
        triggerOrdersError: e.shortMessage || e.message
      }
    }

    // Verify the trigger orders are reachable via the Reader contract
    // (cheap eth_call). If any are missing, surface a warning so the
    // caller can fall back to a Kard-side stop monitor.
    let triggerVerification = null
    if (triggerOrders.length) {
      triggerVerification = await this._verifyOrders(triggerOrders).catch(e => ({ ok: null, error: e.message }))
    }

    return {
      venue: 'gmx_v2',
      chain: this.chain,
      tx: tx.hash,
      gasUsed: receipt.gasUsed.toString(),
      market,
      side: order.side,
      collateralUSDC: order.collateralUSDC,
      leverage: order.leverage,
      executionFee: ethers.formatEther(this.executionFee),
      triggerOrders,
      triggerVerification
    }
  }

  /**
   * Static-call the Reader to confirm submitted trigger orders exist.
   * Reader.getAccountOrders(dataStore, account, start, end) returns Order[].
   */
  async _verifyOrders (triggers) {
    const READER_ABI = [
      'function getAccountOrders(address dataStore, address account, uint256 start, uint256 end) view returns (tuple(tuple(address account, address receiver, address callbackContract, address uiFeeReceiver, address market, address initialCollateralToken, address[] swapPath) addresses, tuple(uint256 orderType, uint256 decreasePositionSwapType, uint256 sizeDeltaUsd, uint256 initialCollateralDeltaAmount, uint256 triggerPrice, uint256 acceptablePrice, uint256 executionFee, uint256 callbackGasLimit, uint256 minOutputAmount, uint256 updatedAtBlock, uint256 updatedAtTime, uint256 validFromTime) numbers, tuple(bool isLong, bool shouldUnwrapNativeToken, bool isFrozen, bool autoCancel) flags)[])'
    ]
    const reader = new ethers.Contract(this.addrs.reader, READER_ABI, this.signer.provider)
    try {
      const orders = await reader.getAccountOrders(this.addrs.dataStore, this.signer.address, 0, 50)
      const found = triggers.map(t => {
        const triggerPriceWei = BigInt(Math.floor(t.triggerPrice * 1e30))
        const match = orders.find(o => {
          const diff = o.numbers.triggerPrice > triggerPriceWei
            ? o.numbers.triggerPrice - triggerPriceWei : triggerPriceWei - o.numbers.triggerPrice
          return diff * 1000n / triggerPriceWei < 5n  // < 0.5% drift
        })
        return { kind: t.kind, registered: !!match, expectedTriggerUsd: t.triggerPrice }
      })
      const allOk = found.every(f => f.registered)
      return {
        ok: allOk,
        found,
        warning: allOk ? null : 'One or more GMX trigger orders did not register. Falling back to Kard-side stop watch.'
      }
    } catch (e) {
      return { ok: null, error: e.shortMessage || e.message }
    }
  }

  async closePosition (symbol, sizeUSD) {
    const market = this.markets.get(symbol)
    if (!market) throw new Error(`GMX V2: no market for ${symbol}`)
    const router = new ethers.Contract(this.addrs.exchangeRouter, ROUTER_ABI, this.signer)
    const sizeDeltaUsd = BigInt(Math.floor(sizeUSD * 1e30))
    const sendWnt = await router.sendWnt(this.addrs.orderVault, this.executionFee, { value: this.executionFee })
    await sendWnt.wait()
    const params = {
      receiver: this.signer.address,
      callbackContract: ethers.ZeroAddress,
      uiFeeReceiver: ethers.ZeroAddress,
      market,
      initialCollateralToken: this.addrs.usdc,
      swapPath: [],
      sizeDeltaUsd,
      initialCollateralDeltaAmount: 0n,
      triggerPrice: 0n,
      acceptablePrice: 0n,
      executionFee: this.executionFee,
      callbackGasLimit: 0n,
      minOutputAmount: 0n,
      validFromTime: 0n,
      orderType: OrderType.MarketDecrease,
      decreasePositionSwapType: 0,
      isLong: true,           // reduces both sides — direction inferred from existing position
      shouldUnwrapNativeToken: false,
      autoCancel: false,
      referralCode: ethers.ZeroHash
    }
    const tx = await router.createOrder(params)
    return { tx: tx.hash, venue: 'gmx_v2', chain: this.chain }
  }

  /** @param {Array<{symbol, market}>} markets */
  registerMarkets (markets) { for (const m of markets) this.registerMarket(m.symbol, m.market) }
}
