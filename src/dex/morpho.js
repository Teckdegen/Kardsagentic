// @kard/agent — Morpho Blue Lending
// Peer-to-peer lending matching — consistently better rates than Aave.
// Testnet: Sepolia
// Mainnet: Base / Arbitrum (Ethereum L1 excluded — gas too expensive)

import { ethers } from "ethers";

// Morpho Blue is deployed at the SAME address across all chains
const MORPHO_BLUE = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";

// Morpho GraphQL API for market discovery
const MORPHO_API = "https://blue-api.morpho.org/graphql";

// Known high-liquidity markets (marketId, loanToken, collateralToken)
const KNOWN_MARKETS = {
  ethereum: [
    {
      id: "0xb323495f7e4148be5643a4ea4a8221eef163e4bccfdedc2a6f4696baacbc86cc",
      loan: "USDC",
      loanAddr: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      collateral: "wstETH",
      lltv: "86%",
      tvlUsd: 450_000_000,
    },
    {
      id: "0x64d65c9a2d91c36d56fbc42d69e979335320169b3df63bf92789e2c8883fcc64",
      loan: "USDT",
      loanAddr: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      collateral: "WETH",
      lltv: "86%",
      tvlUsd: 120_000_000,
    },
  ],
  base: [
    {
      id: "0x8793cf302b8ffd655ab97bd1c695dbd967807e8367a65cb2f4edaf1380ba1bda5",
      loan: "USDC",
      loanAddr: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      collateral: "WETH",
      lltv: "86%",
      tvlUsd: 85_000_000,
    },
    {
      id: "0x3a85e619751152991742810df6ec69ce473daef99e28a64ab2340d7b7ccfee49",
      loan: "USDC",
      loanAddr: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      collateral: "cbETH",
      lltv: "86%",
      tvlUsd: 42_000_000,
    },
  ],
  arbitrum: [
    {
      id: "0x49bb2d114be9041a787432952927f6f144f05ad3e83196a7d062f374ee11d0ee",
      loan: "USDC",
      loanAddr: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      collateral: "WETH",
      lltv: "86%",
      tvlUsd: 38_000_000,
    },
  ],
  // Testnet
  sepolia: [
    {
      id: "0x0000000000000000000000000000000000000000000000000000000000000001",
      loan: "USDC",
      loanAddr: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
      collateral: "WETH",
      lltv: "86%",
      tvlUsd: 0,
      testnet: true,
    },
  ],
  // NOTE: Ethereum L1 markets intentionally excluded.
  // Morpho has great rates on Ethereum but gas costs ($10-50/tx) make
  // autonomous agent execution uneconomical. Use Base or Arbitrum instead.
};

// ─── ABI ─────────────────────────────────────────────────────────────────────
const MORPHO_ABI = [
  // Supply — lend tokens into a market
  "function supply((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes calldata data) external returns (uint256 assetsSupplied, uint256 sharesSupplied)",
  // Withdraw — pull lent tokens back
  "function withdraw((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) external returns (uint256 assetsWithdrawn, uint256 sharesWithdrawn)",
  // Read market state
  "function market(bytes32 id) external view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)",
  // Read user position
  "function position(bytes32 id, address user) external view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
];

// ─── MorphoBlue ───────────────────────────────────────────────────────────────
export class MorphoBlue {
  /**
   * @param {object} cfg
   * @param {ethers.Wallet} cfg.signer
   * @param {'ethereum'|'base'|'arbitrum'|'sepolia'} cfg.chain
   */
  constructor(cfg) {
    if (cfg.chain === "ethereum") {
      throw new Error(
        "Morpho: Ethereum L1 disabled — gas fees too expensive. Use Base or Arbitrum.",
      );
    }
    this.signer = cfg.signer;
    this.chain = cfg.chain;
    this.morpho = new ethers.Contract(MORPHO_BLUE, MORPHO_ABI, this.signer);
    this.markets = KNOWN_MARKETS[cfg.chain] || [];
  }

  // ─── Read ──────────────────────────────────────────────────────────────────

  /** Fetch live APYs from Morpho's public GraphQL API */
  async getLiveRates() {
    try {
      const query = `{
        markets(first: 20, orderBy: SupplyApy, orderDirection: desc, where: { chainId_in: [${this._chainId()}] }) {
          items {
            id uniqueKey loanAsset { symbol address decimals }
            collateralAsset { symbol }
            state { supplyApy borrowApy utilization netSupplyApy liquidityAssets }
            lltv
          }
        }
      }`;

      const res = await fetch(MORPHO_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) throw new Error(`morpho api ${res.status}`);
      const data = await res.json();
      return data?.data?.markets?.items || [];
    } catch (e) {
      console.warn(
        `[morpho] api fetch failed (${e.message}) — using cached market list`,
      );
      return [];
    }
  }

  /** Get all markets ranked by supply APY */
  async getMarkets() {
    const live = await this.getLiveRates();

    if (live.length > 0) {
      return live
        .map((m) => ({
          id: m.uniqueKey,
          loan: m.loanAsset.symbol,
          loanAddr: m.loanAsset.address,
          decimals: m.loanAsset.decimals,
          collateral: m.collateralAsset?.symbol || "unknown",
          supplyAPY: (m.state.netSupplyApy || m.state.supplyApy || 0) * 100,
          borrowAPY: (m.state.borrowApy || 0) * 100,
          utilization: (m.state.utilization || 0) * 100,
          liquidityUsd: parseFloat(m.state.liquidityAssets || 0),
          lltv: m.lltv,
          source: "morpho",
          chain: this.chain,
        }))
        .sort((a, b) => b.supplyAPY - a.supplyAPY);
    }

    // Fallback to static known markets
    return this.markets.map((m) => ({
      ...m,
      supplyAPY: 5.5, // conservative estimate when API unavailable
      source: "morpho",
      chain: this.chain,
    }));
  }

  /** Get current user position in a market */
  async getPosition(marketId) {
    try {
      const pos = await this.morpho.position(marketId, this.signer.address);
      const market = await this.morpho.market(marketId);

      // Calculate actual assets from shares
      const totalSupplyShares = market.totalSupplyShares;
      const totalSupplyAssets = market.totalSupplyAssets;

      let supplyAssets = 0n;
      if (totalSupplyShares > 0n && pos.supplyShares > 0n) {
        supplyAssets =
          (pos.supplyShares * totalSupplyAssets) / totalSupplyShares;
      }

      return {
        marketId,
        supplyShares: pos.supplyShares.toString(),
        supplyAssets: supplyAssets.toString(),
        borrowShares: pos.borrowShares.toString(),
        collateral: pos.collateral.toString(),
        hasPosition: pos.supplyShares > 0n || pos.borrowShares > 0n,
      };
    } catch (e) {
      console.error(`[morpho] getPosition failed: ${e.message}`);
      return null;
    }
  }

  /** Get all active positions across known markets */
  async getPositions() {
    const positions = [];
    for (const m of this.markets) {
      const pos = await this.getPosition(m.id);
      if (pos?.hasPosition) {
        positions.push({ ...m, ...pos });
      }
    }
    return positions;
  }

  // ─── Write ─────────────────────────────────────────────────────────────────

  /**
   * Supply tokens to a Morpho market
   * @param {object} p
   * @param {string} p.marketId — bytes32 market ID
   * @param {string} p.loanToken — token address to supply
   * @param {number} p.amount — human-readable amount
   * @param {object} p.marketParams — { loanToken, collateralToken, oracle, irm, lltv }
   */
  async supply({ marketId, loanToken, amount, marketParams }) {
    const token = new ethers.Contract(loanToken, ERC20_ABI, this.signer);
    const decimals = await token.decimals();
    const amountWei = ethers.parseUnits(amount.toString(), decimals);

    // Approve Morpho Blue
    const allowance = await token.allowance(this.signer.address, MORPHO_BLUE);
    if (allowance < amountWei) {
      const approveTx = await token.approve(MORPHO_BLUE, ethers.MaxUint256);
      await approveTx.wait();
    }

    const tx = await this.morpho.supply(
      marketParams,
      amountWei,
      0n,
      this.signer.address,
      "0x",
    );
    const receipt = await tx.wait();

    console.log(
      `[morpho] supplied ${amount} to market ${marketId.slice(0, 10)}... on ${this.chain}`,
    );
    return {
      tx: tx.hash,
      gasUsed: receipt.gasUsed.toString(),
      marketId,
      amount,
      type: "morpho_supply",
      venue: "morpho",
      chain: this.chain,
    };
  }

  /**
   * Withdraw from a Morpho market
   * @param {object} p
   * @param {string} p.marketId
   * @param {number} p.amount — set to 0 to withdraw all (uses shares)
   * @param {object} p.marketParams
   */
  async withdraw({ marketId, amount, marketParams }) {
    const pos = await this.getPosition(marketId);
    if (!pos?.hasPosition)
      throw new Error(`No supply position in market ${marketId}`);

    let tx;
    if (amount === 0 || amount === "all") {
      // Withdraw all shares
      tx = await this.morpho.withdraw(
        marketParams,
        0n,
        BigInt(pos.supplyShares),
        this.signer.address,
        this.signer.address,
      );
    } else {
      // Find decimals
      const m = this.markets.find((m) => m.id === marketId);
      const decimals = m ? 6 : 18;
      const amountWei = ethers.parseUnits(amount.toString(), decimals);
      tx = await this.morpho.withdraw(
        marketParams,
        amountWei,
        0n,
        this.signer.address,
        this.signer.address,
      );
    }

    const receipt = await tx.wait();
    console.log(
      `[morpho] withdrew from market ${marketId.slice(0, 10)}... on ${this.chain}`,
    );
    return {
      tx: tx.hash,
      gasUsed: receipt.gasUsed.toString(),
      marketId,
      type: "morpho_withdraw",
      venue: "morpho",
      chain: this.chain,
    };
  }

  /** Find markets where Morpho APY beats a comparison rate */
  async opportunities(compareAPY = 0) {
    const markets = await this.getMarkets();
    return markets
      .filter(
        (m) => m.supplyAPY > compareAPY + 0.5 && m.liquidityUsd > 1_000_000,
      )
      .slice(0, 5)
      .map((m) => ({
        source: "morpho",
        chain: this.chain,
        asset: m.loan,
        apy: m.supplyAPY,
        collateral: m.collateral,
        utilization: m.utilization,
        marketId: m.id,
        loanAddr: m.loanAddr,
        riskTier: 1,
        note: `Morpho ${m.loan}/${m.collateral} — ${m.supplyAPY.toFixed(2)}% APY (${m.utilization?.toFixed(0)}% utilization)`,
      }));
  }

  _chainId() {
    const ids = { ethereum: 1, base: 8453, arbitrum: 42161, sepolia: 11155111 };
    return ids[this.chain] || 1;
  }
}
