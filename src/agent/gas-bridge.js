// @kard/agent — Auto Gas Bridge
//
// THE DESIGN:
//   User funds ONE address on Arbitrum:
//     → 0.005 ETH minimum (for gas + first bridges)
//     → USDC (for trading capital)
//
//   Kite AI testnet: free faucet at https://faucet.gokite.ai
//   Kite AI mainnet: agent earns from profits OR user sends 1 KITE (~$0.01)
//
//   This module watches all chains every cycle.
//   When any chain drops below minimum gas → bridges ETH from Arbitrum via Across.
//   The agent stays funded autonomously from that first Arbitrum deposit.
//
// WHY ACROSS PROTOCOL:
//   - Fastest bridge (2-5 min vs 7-15 for official bridges)
//   - Cheapest (usually < $0.10 in fees)
//   - No token approval needed for ETH
//   - Works: Arbitrum → Base, Optimism, Polygon, Ethereum
//   - API gives exact fee quote before signing

import { ethers } from "ethers";

// ─── Across Protocol ─────────────────────────────────────────────────────────
// Across SpokePool contracts (the contract you call to initiate a bridge)
// NOTE: Ethereum L1 intentionally excluded — gas fees are too expensive ($10-50/tx)
// NOTE: Kite AI not supported by Across — KITE gas must be funded separately
const SPOKE_POOLS = {
  arbitrum: "0xe35e9842fceaCA96570B734083f4a58e8F7C5f2A",
  base: "0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64",
  optimism: "0x6f26Bf09B1C792e3228e5467807a900A503c0281",
  polygon: "0x9295ee1d8C5b022Be115A2AD3c30C72E34e7F096",
};

// Across chain IDs (their internal numbering)
const ACROSS_CHAIN_IDS = {
  arbitrum: 42161,
  base: 8453,
  optimism: 10,
  polygon: 137,
};

// ETH token address (Across uses 0x0 or WETH for native ETH)
const NATIVE_ETH = "0x0000000000000000000000000000000000000000";
const WETH = {
  arbitrum: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  base: "0x4200000000000000000000000000000000000006",
  optimism: "0x4200000000000000000000000000000000000006",
};

// Spoke pool ABI (minimal — just deposit for bridging)
const SPOKE_POOL_ABI = [
  // depositV3 — the current Across v3 function for bridging
  `function depositV3(
    address depositor,
    address recipient,
    address inputToken,
    address outputToken,
    uint256 inputAmount,
    uint256 outputAmount,
    uint256 destinationChainId,
    address exclusiveRelayer,
    uint32 quoteTimestamp,
    uint32 fillDeadline,
    uint32 exclusivityDeadline,
    bytes calldata message
  ) payable`,
];

// ─── Gas targets per chain ────────────────────────────────────────────────────
// How much ETH (or native) to top up to when refueling.
// Ethereum L1 removed — gas fees too expensive for autonomous agent ($10-50/tx).
// Kite AI removed — KITE token not bridgeable via Across. Must be funded manually.
const GAS_TARGETS = {
  // Mainnet (L2s only — cheap gas)
  base: { minimum: 0.001, topUpTo: 0.005, symbol: "ETH" },
  optimism: { minimum: 0.001, topUpTo: 0.003, symbol: "ETH" },
  polygon: { minimum: 0.5, topUpTo: 1.0, symbol: "MATIC" }, // can't auto-bridge MATIC via Across
  // Testnet — can't bridge testnet ETH, use faucets
  sepolia: null,
  baseSepolia: null,
  arbitrumSepolia: null,
};

// Across API for fee quotes
const ACROSS_API = "https://app.across.to/api";

// ─── GasBridge ───────────────────────────────────────────────────────────────
export class GasBridge {
  /**
   * @param {object} cfg
   * @param {import('../chain-context.js').ChainContext} cfg.chainContext
   * @param {import('../gas-manager.js').GasManager} cfg.gasManager
   * @param {number} [cfg.maxBridgePerDay=0.02] — max ETH to bridge in 24h (safety)
   * @param {boolean} [cfg.dryRun=false] — if true, logs but doesn't execute
   */
  constructor(cfg) {
    this.ctx = cfg.chainContext;
    this.gas = cfg.gasManager;
    this.maxBridgePerDay = cfg.maxBridgePerDay ?? 0.02; // ~$50 at $2500/ETH
    this.dryRun = cfg.dryRun ?? false;
    this.sourceChain = "arbitrum"; // always bridge FROM Arbitrum

    // Tracking
    this.bridgedToday = 0;
    this._dayKey = new Date().toISOString().slice(0, 10);
    this._log = [];
  }

  // ─── Main ──────────────────────────────────────────────────────────────────

  /**
   * Check all chains and bridge gas where needed.
   * Called every cycle by the agent. Returns list of bridges attempted.
   */
  async tick() {
    this._rolloverDay();

    if (this.bridgedToday >= this.maxBridgePerDay) {
      return {
        skipped: "daily bridge cap reached",
        bridgedToday: this.bridgedToday,
      };
    }

    // Check Arbitrum first — it's our source. If it's low, log a warning.
    const arbBalance = await this._getBalance("arbitrum");
    if (arbBalance < 0.002) {
      console.warn(
        `[gas-bridge] Arbitrum ETH low (${arbBalance.toFixed(6)}). Cannot auto-bridge. Fund Arbitrum wallet.`,
      );
      return { skipped: "source chain (arbitrum) low on gas", arbBalance };
    }

    const bridges = [];

    for (const [chain, target] of Object.entries(GAS_TARGETS)) {
      if (!target || chain === this.sourceChain) continue;
      if (target.symbol !== "ETH") continue; // only bridge ETH natively

      const balance = await this._getBalance(chain).catch(() => null);
      if (balance === null) continue; // RPC error, skip

      if (balance < target.minimum) {
        const amountToBridge = target.topUpTo - balance; // top up to recommended level
        const result = await this._bridge(chain, amountToBridge);
        bridges.push({
          chain,
          balance,
          target: target.topUpTo,
          amount: amountToBridge,
          result,
        });
      }
    }

    return { bridges, bridgedToday: this.bridgedToday, arbBalance };
  }

  /**
   * Get a quote for bridging ETH from Arbitrum to a target chain.
   * Returns { outputAmount, totalFeeUSD, estimatedFillTimeSec } or null.
   */
  async getQuote(destinationChain, amountETH) {
    const destChainId = ACROSS_CHAIN_IDS[destinationChain];
    if (!destChainId) return null;

    const inputAmountWei = ethers.parseEther(amountETH.toFixed(8));
    const inputToken = WETH[this.sourceChain];
    const outputToken = WETH[destinationChain] || NATIVE_ETH;

    try {
      const params = new URLSearchParams({
        inputToken,
        outputToken,
        originChainId: ACROSS_CHAIN_IDS[this.sourceChain].toString(),
        destinationChainId: destChainId.toString(),
        amount: inputAmountWei.toString(),
        skipAmountLimit: "true",
      });

      const res = await fetch(`${ACROSS_API}/suggested-fees?${params}`, {
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        console.warn(
          `[gas-bridge] Across API error ${res.status} for ${destinationChain}`,
        );
        return null;
      }

      const data = await res.json();
      const outputAmountWei =
        inputAmountWei - BigInt(data.totalRelayFee?.total || 0);
      const feePct = (Number(data.totalRelayFee?.pct || 0) / 1e18) * 100;

      return {
        inputAmount: amountETH,
        outputAmount: parseFloat(ethers.formatEther(outputAmountWei)),
        totalRelayFeeWei: data.totalRelayFee?.total,
        feePct,
        estimatedFillTimeSec: data.estimatedFillTimeSec || 120,
        quoteTimestamp: data.timestamp,
        spokePoolAddress: SPOKE_POOLS[this.sourceChain],
      };
    } catch (e) {
      console.error(
        `[gas-bridge] quote failed for ${destinationChain}: ${e.message}`,
      );
      return null;
    }
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  async _bridge(destinationChain, amountETH) {
    // Safety cap — don't bridge more than we calculated for the day
    const remaining = this.maxBridgePerDay - this.bridgedToday;
    const amount = Math.min(amountETH, remaining);

    if (amount < 0.0001) {
      return { skipped: "amount too small" };
    }

    console.log(
      `[gas-bridge] checking ${destinationChain} — bridging ${amount.toFixed(6)} ETH from Arbitrum`,
    );

    // Get quote
    const quote = await this.getQuote(destinationChain, amount);
    if (!quote) {
      return { error: "Could not get Across quote" };
    }

    // Sanity check: fee shouldn't be more than 10% of the bridge amount
    if (quote.feePct > 10) {
      console.warn(
        `[gas-bridge] fee too high (${quote.feePct.toFixed(2)}%) for ${destinationChain}, skipping`,
      );
      return { skipped: `fee too high: ${quote.feePct.toFixed(2)}%` };
    }

    if (this.dryRun) {
      console.log(
        `[gas-bridge] DRY RUN: would bridge ${amount.toFixed(6)} ETH to ${destinationChain} (fee: ${quote.feePct.toFixed(2)}%)`,
      );
      return { dryRun: true, amount, destinationChain, feePct: quote.feePct };
    }

    try {
      const signer = this.ctx.getSigner(this.sourceChain);
      const spokePool = new ethers.Contract(
        SPOKE_POOLS[this.sourceChain],
        SPOKE_POOL_ABI,
        signer,
      );

      const inputAmountWei = ethers.parseEther(amount.toFixed(8));
      const outputAmountWei = ethers.parseEther(quote.outputAmount.toFixed(8));
      const destChainId = ACROSS_CHAIN_IDS[destinationChain];
      const now = Math.floor(Date.now() / 1000);

      const tx = await spokePool.depositV3(
        signer.address, // depositor
        signer.address, // recipient (same wallet on destination chain)
        WETH[this.sourceChain], // inputToken (WETH on Arbitrum)
        WETH[destinationChain] || NATIVE_ETH, // outputToken
        inputAmountWei, // inputAmount
        outputAmountWei, // outputAmount (after fee)
        destChainId, // destinationChainId
        ethers.ZeroAddress, // exclusiveRelayer (none)
        quote.quoteTimestamp, // quoteTimestamp
        now + 3600, // fillDeadline (1 hour)
        0, // exclusivityDeadline (none)
        "0x", // message (none)
        { value: inputAmountWei }, // send ETH as msg.value
      );

      const receipt = await tx.wait();

      this.bridgedToday += amount;
      this._log.push({
        ts: new Date().toISOString(),
        destinationChain,
        amount,
        feePct: quote.feePct,
        tx: tx.hash,
        estimatedArrival: new Date(
          Date.now() + quote.estimatedFillTimeSec * 1000,
        ).toISOString(),
      });

      console.log(
        `[gas-bridge] ✅ Bridged ${amount.toFixed(6)} ETH to ${destinationChain}`,
      );
      console.log(
        `[gas-bridge] tx: ${tx.hash} — arrives in ~${Math.ceil(quote.estimatedFillTimeSec / 60)} min`,
      );

      return {
        tx: tx.hash,
        destinationChain,
        amount,
        outputAmount: quote.outputAmount,
        feePct: quote.feePct,
        estimatedArrivalMin: Math.ceil(quote.estimatedFillTimeSec / 60),
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (e) {
      console.error(
        `[gas-bridge] bridge to ${destinationChain} failed: ${e.message}`,
      );
      return { error: e.message, destinationChain, amount };
    }
  }

  async _getBalance(chain) {
    const provider = this.ctx.getProvider(chain);
    const addr = this.ctx.getSigner(chain).address;
    const raw = await provider.getBalance(addr);
    return parseFloat(ethers.formatEther(raw));
  }

  _rolloverDay() {
    const today = new Date().toISOString().slice(0, 10);
    if (this._dayKey !== today) {
      this._dayKey = today;
      this.bridgedToday = 0;
    }
  }

  /** Status snapshot for dashboard */
  status() {
    return {
      sourceChain: this.sourceChain,
      bridgedToday: this.bridgedToday,
      maxBridgePerDay: this.maxBridgePerDay,
      dryRun: this.dryRun,
      recentBridges: this._log.slice(-5),
    };
  }
}
