// Kard — Pre-built Treasury Strategies

/**
 * Conservative: prioritize capital preservation, low risk
 * - 60% in lending (Aave) for stable yield
 * - 10% in liquidity (swap-ready)
 * - 30% reserve (untouched)
 */
export const CONSERVATIVE = {
  name: 'Conservative',
  targetYield: 3,
  maxRisk: 15,
  allocations: {
    lending: 60,
    liquidity: 10,
    reserve: 30
  },
  rebalanceThreshold: 10
}

/**
 * Balanced: moderate risk for better yield
 * - 40% lending
 * - 30% liquidity provision
 * - 30% reserve
 */
export const BALANCED = {
  name: 'Balanced',
  targetYield: 6,
  maxRisk: 40,
  allocations: {
    lending: 40,
    liquidity: 30,
    reserve: 30
  },
  rebalanceThreshold: 5
}

/**
 * Aggressive: maximize yield, higher risk tolerance
 * - 50% lending
 * - 40% liquidity
 * - 10% reserve
 */
export const AGGRESSIVE = {
  name: 'Aggressive',
  targetYield: 12,
  maxRisk: 70,
  allocations: {
    lending: 50,
    liquidity: 40,
    reserve: 10
  },
  rebalanceThreshold: 3
}

/**
 * USDT Yield: Tether-centric — maximize USDT yield via Aave lending
 * - 70% lending (prioritize USDT supply on Aave)
 * - 10% liquidity (swap-ready for rebalancing)
 * - 20% reserve (USDT in wallet for bridging/payments)
 * - Consolidates DAI/USDC into USDT via swap when overweight
 * - Aggressively supplies USDT to Aave for yield
 */
export const USDT_YIELD = {
  name: 'USDT Yield',
  targetYield: 8,
  maxRisk: 30,
  allocations: {
    lending: 70,
    liquidity: 10,
    reserve: 20
  },
  rebalanceThreshold: 5,
  // USDT-centric preferences
  baseCurrency: 'USDT',
  consolidateToBase: true,       // swap DAI/USDC → USDT when overweight
  consolidateThreshold: 0.30,    // consolidate if non-USDT stables > 30% of total stables
  lendingPriority: ['USDT', 'USDC', 'DAI', 'WETH'],  // supply order preference
  minUsdtReserve: 500            // always keep >= $500 USDT in wallet
}

/**
 * Tether Diversified: spread across Tether ecosystem tokens
 * - USDT (stablecoin) + USAt (T-Bills yield) + XAUt (gold hedge)
 * - 60% lending (USDT/stablecoins via Aave)
 * - 15% real-world assets (USAt for T-Bills yield, XAUt for gold exposure)
 * - 10% liquidity
 * - 15% reserve
 */
export const TETHER_DIVERSIFIED = {
  name: 'Tether Diversified',
  targetYield: 6,
  maxRisk: 25,
  allocations: {
    lending: 60,
    liquidity: 10,
    reserve: 15,
    rwa: 15  // real-world assets (USAt/XAUt)
  },
  rebalanceThreshold: 5,
  baseCurrency: 'USDT',
  consolidateToBase: false,
  lendingPriority: ['USDT', 'USDC', 'DAI', 'WETH'],
  // Tether ecosystem token awareness
  tetherTokens: {
    USAt: { type: 'tbills', description: 'Tether T-Bills — USD-denominated US Treasury yield' },
    XAUt: { type: 'gold', description: 'Tether Gold — 1 troy ounce gold per token' }
  }
}

/**
 * Kite Yield: park idle USDC as Lucid L-USDC on KiteAI (yield-bearing).
 *  - Source chain: Arbitrum (Lucid lock chain — 90% of collateral deposited to Aave v3)
 *  - Settles on KiteAI; agent attests every mint/burn on the Kite chain
 *  - Compares on-chain Lucid yield vs. native Aave supply APY each cycle
 *    and routes idle USDC to whichever rail offers higher net APY after fees.
 *  - Maintains a small native-USDC buffer on Arbitrum for fast withdrawals.
 */
export const KITE_YIELD = {
  name: 'Kite Yield',
  targetYield: 7,
  maxRisk: 25,
  allocations: {
    lending: 30,        // direct Aave (USDT/USDC supply)
    lucidKite: 50,      // L-USDC on KiteAI (yield-bearing canonical)
    liquidity: 5,
    reserve: 15
  },
  rebalanceThreshold: 5,
  baseCurrency: 'USDC',
  lucid: {
    enabled: true,
    asset: 'USDC',
    sourceChain: 'arbitrum',  // mint from Arbitrum (Lucid lock chain)
    targetChain: 'kiteai',    // hold L-USDC on KiteAI
    minMintAmount: 50,        // don't bother minting below $50 (LayerZero fee not worth it)
    keepBuffer: 100,          // always leave $100 native USDC on source for fast access
    minYieldEdgeBps: 50,      // only mint if Lucid net APY beats Aave by >= 0.5%
    maxBufferRatioForMint: 0.95 // skip mint if Lucid pool buffer ratio is below ~10%
  }
}

/**
 * Perps Trader: text-to-onchain perps execution via Hyperliquid.
 *  - Stables-first margin (USDC); the agent does NOT hold spot crypto for trading
 *  - Risk-budget enforced per trade (% of account equity)
 *  - LLM proposes long/short triggers; risk engine validates leverage + size
 *  - Funding-aware: avoids entries against extreme positive funding
 *  - All entries/exits attest on Kite as verifiable execution records
 */
export const PERPS_TRADER = {
  name: 'Perps Trader',
  targetYield: 20,
  maxRisk: 70,
  allocations: {
    lending: 0,
    perps: 70,        // up to 70% of equity deployable as perp margin
    reserve: 30       // dry powder for adds / liquidation defense
  },
  rebalanceThreshold: 10,
  baseCurrency: 'USDC',
  perps: {
    venue: 'hyperliquid',
    network: 'testnet',         // testnet by default — flip to mainnet explicitly
    maxLeverage: 5,             // hard cap regardless of LLM suggestion
    riskPerTrade: 0.02,         // 2% of equity at risk per trade (stop-loss distance)
    maxConcurrentPositions: 3,
    avoidFundingAboveBps: 50,   // skip longs if 1h funding > 0.5%
    fundingFavorBps: 25,        // prefer entries where funding pays you ≥ 0.25%
    universe: ['BTC', 'ETH', 'SOL', 'ARB', 'AVAX'],
    defaultStopPct: 0.04,       // 4% stop if LLM doesn't specify
    defaultTakeProfitPct: 0.08
  }
}

export const STRATEGIES = { CONSERVATIVE, BALANCED, AGGRESSIVE, USDT_YIELD, TETHER_DIVERSIFIED, KITE_YIELD, PERPS_TRADER }
