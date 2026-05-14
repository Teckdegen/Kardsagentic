// @kard/agent — Compound V3 (Comet) Lending
// Alternative to Aave — often offers better rates on USDC.
// Testnet: Sepolia / Base Sepolia
// Mainnet: Arbitrum / Base / Ethereum

import { ethers } from "ethers";

// Real Comet (Compound V3) contract addresses per chain + asset
// NOTE: Ethereum L1 intentionally excluded — gas fees ($10-50/tx) are too expensive
// for autonomous agent use. Arbitrum and Base offer same protocol at <$0.10/tx.
const COMETS = {
  // TESTNET
  sepolia: {
    USDC: {
      address: "0xAec1F48e02Cfb822Be958B68C7957156EB3F0b6e",
      decimals: 6,
    },
  },
  // MAINNET (L2s only)
  arbitrum: {
    USDC: {
      address: "0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf",
      decimals: 6,
    },
    USDT: {
      address: "0xd98Be00b5D27fc98112BdE293e487f8D4cA57d07",
      decimals: 6,
    },
  },
  base: {
    USDC: { address: "0xb125E6687d4313864e53df431d5425969c15Eb2", decimals: 6 },
  },
};

// Comet ABI (minimal)
const COMET_ABI = [
  "function supply(address asset, uint amount)",
  "function withdraw(address asset, uint amount)",
  "function balanceOf(address account) view returns (uint256)",
  "function borrowBalanceOf(address account) view returns (uint256)",
  "function getSupplyRate(uint utilization) view returns (uint64)",
  "function getBorrowRate(uint utilization) view returns (uint64)",
  "function getUtilization() view returns (uint)",
  "function totalSupply() view returns (uint256)",
  "function totalBorrow() view returns (uint256)",
  "function baseToken() view returns (address)",
];

const ERC20_ABI = [
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

// Seconds per year (used for APR conversion)
const SECONDS_PER_YEAR = 31_536_000n;

export class CompoundV3 {
  /**
   * @param {object} cfg
   * @param {ethers.Wallet} cfg.signer
   * @param {'arbitrum'|'base'|'ethereum'|'sepolia'} cfg.chain
   */
  constructor(cfg) {
    this.signer = cfg.signer;
    this.chain = cfg.chain;
    this.comets = COMETS[cfg.chain] || {};
  }

  /** Get the current supply APR for a token (annualized %) */
  async getAPR(token = "USDC") {
    const comet = this._getComet(token);
    if (!comet) return null;

    try {
      const utilization = await comet.contract.getUtilization();
      const ratePerSec = await comet.contract.getSupplyRate(utilization);
      // Rate is in per-second format (1e18 scale) — annualize it
      const apr = (Number(ratePerSec) / 1e18) * Number(SECONDS_PER_YEAR) * 100;
      return {
        token,
        chain: this.chain,
        apr: Math.round(apr * 100) / 100,
        venue: "compound-v3",
      };
    } catch (e) {
      console.error(`[compound] getAPR failed: ${e.message}`);
      return null;
    }
  }

  /** Get APRs for all supported tokens on this chain */
  async getAllAPRs() {
    const results = {};
    for (const token of Object.keys(this.comets)) {
      const rate = await this.getAPR(token);
      if (rate) results[token] = rate.apr;
    }
    return results;
  }

  /** Get current supplied balance */
  async getBalance(token = "USDC") {
    const comet = this._getComet(token);
    if (!comet) return 0;
    const raw = await comet.contract.balanceOf(this.signer.address);
    return parseFloat(ethers.formatUnits(raw, comet.decimals));
  }

  /** Supply tokens to Compound V3 */
  async supply({ token = "USDC", amount }) {
    const comet = this._getComet(token);
    if (!comet)
      throw new Error(`Compound: no ${token} market on ${this.chain}`);

    const tokenAddr = await comet.contract.baseToken();
    const tokenContract = new ethers.Contract(
      tokenAddr,
      ERC20_ABI,
      this.signer,
    );
    const amountWei = ethers.parseUnits(amount.toString(), comet.decimals);

    // Approve
    const allowance = await tokenContract.allowance(
      this.signer.address,
      comet.address,
    );
    if (allowance < amountWei) {
      const approveTx = await tokenContract.approve(
        comet.address,
        ethers.MaxUint256,
      );
      await approveTx.wait();
    }

    const tx = await comet.contract.supply(tokenAddr, amountWei);
    const receipt = await tx.wait();

    console.log(`[compound] supplied ${amount} ${token} on ${this.chain}`);
    return {
      tx: tx.hash,
      gasUsed: receipt.gasUsed.toString(),
      token,
      amount,
      chain: this.chain,
      type: "compound_supply",
      venue: "compound-v3",
    };
  }

  /** Withdraw from Compound V3 */
  async withdraw({ token = "USDC", amount = "all" }) {
    const comet = this._getComet(token);
    if (!comet)
      throw new Error(`Compound: no ${token} market on ${this.chain}`);

    const tokenAddr = await comet.contract.baseToken();
    let amountWei;

    if (amount === "all") {
      amountWei = await comet.contract.balanceOf(this.signer.address);
    } else {
      amountWei = ethers.parseUnits(amount.toString(), comet.decimals);
    }

    const tx = await comet.contract.withdraw(tokenAddr, amountWei);
    const receipt = await tx.wait();

    console.log(`[compound] withdrew from ${token} market on ${this.chain}`);
    return {
      tx: tx.hash,
      gasUsed: receipt.gasUsed.toString(),
      token,
      amount,
      chain: this.chain,
      type: "compound_withdraw",
      venue: "compound-v3",
    };
  }

  /** Find Compound opportunities vs a minimum APR threshold */
  async opportunities(minAPR = 3) {
    const aprs = await this.getAllAPRs();
    return Object.entries(aprs)
      .filter(([, apr]) => apr >= minAPR)
      .map(([token, apr]) => ({
        source: "compound-v3",
        chain: this.chain,
        asset: token,
        apy: apr,
        riskTier: 1,
        action: { type: "compound_supply", token, chain: this.chain },
        note: `Compound V3 ${token} — ${apr.toFixed(2)}% APR on ${this.chain}`,
      }))
      .sort((a, b) => b.apy - a.apy);
  }

  _getComet(token) {
    const cfg = this.comets[token];
    if (!cfg) return null;
    if (!this._contracts) this._contracts = {};
    if (!this._contracts[token]) {
      this._contracts[token] = {
        address: cfg.address,
        decimals: cfg.decimals,
        contract: new ethers.Contract(cfg.address, COMET_ABI, this.signer),
      };
    }
    return this._contracts[token];
  }
}
