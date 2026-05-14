// @kard/agent — Uniswap V3 LP Position Manager
// Open, manage, collect fees, and close concentrated liquidity positions.
// Testnet: Sepolia / Base Sepolia
// Mainnet: Arbitrum / Base / Ethereum

import { ethers } from "ethers";

// ─── Contract Addresses ──────────────────────────────────────────────────────
// NOTE: Ethereum L1 excluded — gas too expensive ($10-50/tx) for autonomous LP management
const ADDRS = {
  // TESTNET
  sepolia: {
    positionManager: "0x1238536071E1c677A632429e3655c799b22cDA52",
    factory: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c",
    quoterV2: "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3",
  },
  baseSepolia: {
    positionManager: "0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2",
    factory: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    quoterV2: "0xC5290058841028F1614F3A6F0F5816cAd0df5E27",
  },
  // MAINNET (L2s only)
  arbitrum: {
    positionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    quoterV2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
  },
  base: {
    positionManager: "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1",
    factory: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
    quoterV2: "0x3d4e44Eb1374240CE5F1B136aa68B6bE428b1ad9",
  },
};

// Fee tiers
export const FEE_TIERS = {
  STABLE: 100, // 0.01% — stablecoin pairs
  LOW: 500, // 0.05% — correlated pairs (ETH/wstETH)
  MEDIUM: 3000, // 0.30% — most pairs
  HIGH: 10000, // 1.00% — exotic pairs
};

// ─── ABIs ────────────────────────────────────────────────────────────────────
const PM_ABI = [
  "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
  "function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max)) external payable returns (uint256 amount0, uint256 amount1)",
  "function decreaseLiquidity((uint256 tokenId,uint128 liquidity,uint256 amount0Min,uint256 amount1Min,uint256 deadline)) external payable returns (uint256 amount0, uint256 amount1)",
  "function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
  "function burn(uint256 tokenId) external payable",
];

const FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)",
];

const POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function liquidity() external view returns (uint128)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function fee() external view returns (uint24)",
  "function feeGrowthGlobal0X128() external view returns (uint256)",
  "function feeGrowthGlobal1X128() external view returns (uint256)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

// ─── Tick Math ────────────────────────────────────────────────────────────────
const MIN_TICK = -887272;
const MAX_TICK = 887272;

function priceToSqrtX96(price) {
  return BigInt(Math.floor(Math.sqrt(price) * 2 ** 96));
}

function sqrtX96ToPrice(sqrtX96) {
  const q96 = BigInt(2 ** 96);
  return Number((sqrtX96 * sqrtX96) / (q96 * q96));
}

// Convert a percentage range (e.g. ±10%) around current price to tick range
export function calculateTicks(currentPrice, rangePct = 0.1, tickSpacing = 60) {
  const lower = currentPrice * (1 - rangePct);
  const upper = currentPrice * (1 + rangePct);
  const rawTickLower = Math.floor(Math.log(lower) / Math.log(1.0001));
  const rawTickUpper = Math.floor(Math.log(upper) / Math.log(1.0001));
  // Align to tickSpacing
  const tickLower = Math.max(
    MIN_TICK,
    Math.floor(rawTickLower / tickSpacing) * tickSpacing,
  );
  const tickUpper = Math.min(
    MAX_TICK,
    Math.ceil(rawTickUpper / tickSpacing) * tickSpacing,
  );
  return { tickLower, tickUpper };
}

// ─── UniswapLP ────────────────────────────────────────────────────────────────
export class UniswapLP {
  /**
   * @param {object} cfg
   * @param {ethers.Wallet} cfg.signer
   * @param {'arbitrum'|'base'|'ethereum'|'sepolia'|'baseSepolia'} cfg.chain
   */
  constructor(cfg) {
    this.signer = cfg.signer;
    this.chain = cfg.chain;
    this.env = process.env.KARD_ENV || "testnet";

    const addrs = ADDRS[cfg.chain];
    if (!addrs) throw new Error(`UniswapLP: unsupported chain ${cfg.chain}`);

    this.pm = new ethers.Contract(addrs.positionManager, PM_ABI, this.signer);
    this.factory = new ethers.Contract(addrs.factory, FACTORY_ABI, this.signer);
    this.pmAddress = addrs.positionManager;
  }

  // ─── Read ──────────────────────────────────────────────────────────────────

  /** Get all LP positions owned by the signer */
  async getPositions() {
    const addr = this.signer.address;
    const count = await this.pm.balanceOf(addr);
    const positions = [];

    for (let i = 0; i < count; i++) {
      try {
        const tokenId = await this.pm.tokenOfOwnerByIndex(addr, i);
        const pos = await this.pm.positions(tokenId);
        const token0 = new ethers.Contract(pos.token0, ERC20_ABI, this.signer);
        const token1 = new ethers.Contract(pos.token1, ERC20_ABI, this.signer);
        const [sym0, sym1, dec0, dec1] = await Promise.all([
          token0.symbol().catch(() => "?"),
          token1.symbol().catch(() => "?"),
          token0.decimals().catch(() => 18),
          token1.decimals().catch(() => 18),
        ]);

        const feesOwed0 = parseFloat(ethers.formatUnits(pos.tokensOwed0, dec0));
        const feesOwed1 = parseFloat(ethers.formatUnits(pos.tokensOwed1, dec1));
        const hasLiquidity = pos.liquidity > 0n;

        positions.push({
          tokenId: tokenId.toString(),
          token0: pos.token0,
          sym0,
          dec0,
          token1: pos.token1,
          sym1,
          dec1,
          fee: pos.fee,
          tickLower: pos.tickLower,
          tickUpper: pos.tickUpper,
          liquidity: pos.liquidity.toString(),
          feesOwed0,
          feesOwed1,
          active: hasLiquidity,
          pair: `${sym0}/${sym1}`,
          feeTierPct: ((pos.fee / 1e6) * 100).toFixed(2) + "%",
        });
      } catch (e) {
        console.error(`[uniswap-lp] position ${i} read error: ${e.message}`);
      }
    }

    return positions;
  }

  /** Get pool info — price and current liquidity */
  async getPoolInfo(token0, token1, fee = FEE_TIERS.MEDIUM) {
    const poolAddr = await this.factory.getPool(token0, token1, fee);
    if (poolAddr === ethers.ZeroAddress) return null;

    const pool = new ethers.Contract(poolAddr, POOL_ABI, this.signer);
    const [slot0, liq] = await Promise.all([pool.slot0(), pool.liquidity()]);

    const sqrtPrice = slot0.sqrtPriceX96;
    const price = sqrtX96ToPrice(sqrtPrice);

    return {
      address: poolAddr,
      tick: slot0.tick,
      price,
      sqrtPriceX96: sqrtPrice.toString(),
      liquidity: liq.toString(),
    };
  }

  // ─── Write ─────────────────────────────────────────────────────────────────

  /**
   * Open a Uniswap V3 LP position
   * @param {object} p
   * @param {string} p.token0 — address (lower address goes first)
   * @param {string} p.token1 — address
   * @param {number} p.fee — fee tier (use FEE_TIERS.STABLE/LOW/MEDIUM/HIGH)
   * @param {number} p.amount0 — human amount of token0
   * @param {number} p.amount1 — human amount of token1
   * @param {number} [p.rangePct=0.10] — ±% range around current price
   * @param {number} [p.slippage=0.005] — 0.5% slippage
   */
  async openPosition({
    token0,
    token1,
    fee = FEE_TIERS.MEDIUM,
    amount0,
    amount1,
    rangePct = 0.1,
    slippage = 0.005,
  }) {
    const t0 = new ethers.Contract(token0, ERC20_ABI, this.signer);
    const t1 = new ethers.Contract(token1, ERC20_ABI, this.signer);
    const [dec0, dec1] = await Promise.all([t0.decimals(), t1.decimals()]);

    const am0 = ethers.parseUnits(amount0.toString(), dec0);
    const am1 = ethers.parseUnits(amount1.toString(), dec1);

    // Approve
    for (const [contract, amount] of [
      [t0, am0],
      [t1, am1],
    ]) {
      const allowance = await contract.allowance(
        this.signer.address,
        this.pmAddress,
      );
      if (allowance < amount) {
        const tx = await contract.approve(this.pmAddress, ethers.MaxUint256);
        await tx.wait();
        console.log(`[uniswap-lp] approved ${this.pmAddress}`);
      }
    }

    // Get current pool price for tick calculation
    const poolInfo = await this.getPoolInfo(token0, token1, fee);
    const currentPrice = poolInfo?.price || 1;

    // Determine tick spacing from fee
    const SPACING = { 100: 1, 500: 10, 3000: 60, 10000: 200 };
    const spacing = SPACING[fee] || 60;
    const { tickLower, tickUpper } = calculateTicks(
      currentPrice,
      rangePct,
      spacing,
    );

    const am0Min =
      (am0 * BigInt(Math.floor((1 - slippage) * 1e6))) / 1_000_000n;
    const am1Min =
      (am1 * BigInt(Math.floor((1 - slippage) * 1e6))) / 1_000_000n;

    const params = {
      token0,
      token1,
      fee,
      tickLower,
      tickUpper,
      amount0Desired: am0,
      amount1Desired: am1,
      amount0Min: am0Min,
      amount1Min: am1Min,
      recipient: this.signer.address,
      deadline: Math.floor(Date.now() / 1000) + 1800,
    };

    const tx = await this.pm.mint(params);
    const receipt = await tx.wait();

    // Parse tokenId from logs
    const iface = new ethers.Interface([
      "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
    ]);
    let tokenId = null;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (
          parsed?.name === "Transfer" &&
          parsed.args.from === ethers.ZeroAddress
        ) {
          tokenId = parsed.args.tokenId.toString();
          break;
        }
      } catch {}
    }

    console.log(
      `[uniswap-lp] opened position tokenId=${tokenId} range=${(rangePct * 100).toFixed(0)}% on ${this.chain}`,
    );

    return {
      tx: tx.hash,
      gasUsed: receipt.gasUsed.toString(),
      tokenId,
      chain: this.chain,
      fee,
      tickLower,
      tickUpper,
      venue: "uniswap-v3",
      type: "lp_open",
    };
  }

  /** Collect all pending fees for a position */
  async collectFees(tokenId) {
    const MAX_UINT128 = 2n ** 128n - 1n;
    const params = {
      tokenId,
      recipient: this.signer.address,
      amount0Max: MAX_UINT128,
      amount1Max: MAX_UINT128,
    };
    const tx = await this.pm.collect(params);
    const receipt = await tx.wait();

    console.log(`[uniswap-lp] collected fees for tokenId=${tokenId}`);
    return {
      tx: tx.hash,
      gasUsed: receipt.gasUsed.toString(),
      tokenId,
      type: "lp_collect_fees",
      venue: "uniswap-v3",
    };
  }

  /** Remove all liquidity from a position and collect fees */
  async closePosition(tokenId) {
    const pos = await this.pm.positions(tokenId);
    if (pos.liquidity === 0n)
      throw new Error(`Position ${tokenId} has no liquidity`);

    // 1. Decrease all liquidity
    const decParams = {
      tokenId,
      liquidity: pos.liquidity,
      amount0Min: 0n,
      amount1Min: 0n,
      deadline: Math.floor(Date.now() / 1000) + 1800,
    };
    const decTx = await this.pm.decreaseLiquidity(decParams);
    await decTx.wait();

    // 2. Collect all tokens + fees
    const { tx: collectTx } = await this.collectFees(tokenId);

    // 3. Burn the NFT
    const burnTx = await this.pm.burn(tokenId);
    const receipt = await burnTx.wait();

    console.log(
      `[uniswap-lp] closed position tokenId=${tokenId} on ${this.chain}`,
    );
    return {
      tx: burnTx.hash,
      gasUsed: receipt.gasUsed.toString(),
      tokenId,
      type: "lp_close",
      venue: "uniswap-v3",
      collectTx,
    };
  }

  /** Check if positions are in range and earning fees */
  async opportunities() {
    const positions = await this.getPositions();
    return positions
      .filter((p) => p.active && (p.feesOwed0 > 0.01 || p.feesOwed1 > 0.01))
      .map((p) => ({
        source: "uniswap-v3",
        type: "collect_fees",
        tokenId: p.tokenId,
        pair: p.pair,
        feesOwed0: p.feesOwed0,
        feesOwed1: p.feesOwed1,
        chain: this.chain,
        note: `Collect pending fees on ${p.pair} (${p.feeTierPct})`,
      }));
  }
}
