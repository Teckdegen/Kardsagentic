// @kard/agent — Gas Setup Wizard
//
// Every chain KARDS uses needs native token for gas.
// This module tells users exactly what they need, checks current balances,
// and prints actionable instructions for getting gas on each chain.
//
// Testnet: provides faucet links for each chain
// Mainnet: provides bridge recommendations and buy options

import { ethers } from "ethers";
import { CHAINS } from "../evm/chains.js";

// ─── Gas Requirements ─────────────────────────────────────────────────────────
// What you need on each chain to actually DO things
// Minimum = just enough for gas. Recommended = comfortable headroom.

export const GAS_REQUIREMENTS = {
  // TESTNETS
  sepolia: {
    symbol: "ETH",
    name: "Sepolia",
    minimum: 0.01,
    recommended: 0.05,
    what_for: "Aave supply/withdraw, Uniswap LP, general EVM gas",
    faucets: [
      { name: "Alchemy Sepolia Faucet", url: "https://sepoliafaucet.com" },
      {
        name: "QuickNode Faucet",
        url: "https://faucet.quicknode.com/ethereum/sepolia",
      },
      {
        name: "Infura Sepolia Faucet",
        url: "https://www.infura.io/faucet/sepolia",
      },
    ],
    bridge: null,
    buy: null,
  },
  arbitrumSepolia: {
    symbol: "ETH",
    name: "Arbitrum Sepolia",
    minimum: 0.005,
    recommended: 0.02,
    what_for: "Aave Arbitrum testing, Hyperliquid testnet collateral",
    faucets: [
      {
        name: "QuickNode Arbitrum Sepolia",
        url: "https://faucet.quicknode.com/arbitrum/sepolia",
      },
      {
        name: "Arbitrum Faucet",
        url: "https://faucet.triangleplatform.com/arbitrum/sepolia",
      },
    ],
    bridge: null,
    buy: null,
  },
  baseSepolia: {
    symbol: "ETH",
    name: "Base Sepolia",
    minimum: 0.005,
    recommended: 0.02,
    what_for: "Aerodrome LP testing, Base Aave testing",
    faucets: [
      {
        name: "Coinbase Base Faucet",
        url: "https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet",
      },
      {
        name: "QuickNode Base Sepolia",
        url: "https://faucet.quicknode.com/base/sepolia",
      },
    ],
    bridge: null,
    buy: null,
  },
  kiteai: {
    symbol: "KITE",
    name: "Kite AI",
    minimum: 0.1,
    recommended: 1.0,
    what_for:
      "Attestations (every action writes to Kite), Lucid L-USDC settlement",
    faucets: [
      { name: "Kite AI Testnet Faucet", url: "https://faucet.gokite.ai" },
    ],
    bridge: null,
    buy: null,
    critical: true, // without KITE gas, no attestations = no hackathon demo
  },

  // MAINNETS
  arbitrum: {
    symbol: "ETH",
    name: "Arbitrum One",
    minimum: 0.001,
    recommended: 0.005,
    what_for:
      "Aave V3, GMX, Hyperliquid collateral, Uniswap LP, Morpho, Lucid minting",
    faucets: null,
    bridge: [
      {
        name: "Official Arbitrum Bridge",
        url: "https://bridge.arbitrum.io",
        from: "Ethereum",
        note: "~7-15 minutes",
      },
      {
        name: "Across Protocol",
        url: "https://across.to",
        from: "Any chain",
        note: "Fast bridge, ~2 minutes",
      },
      {
        name: "Stargate",
        url: "https://stargate.finance",
        from: "Any chain",
        note: "Reliable, small fee",
      },
    ],
    buy: [
      {
        name: "Buy ETH directly on Arbitrum",
        url: "https://www.coinbase.com",
        note: "Withdraw ETH to Arbitrum",
      },
      {
        name: "Revolut / Kraken",
        url: null,
        note: "Buy ETH, withdraw to Arbitrum network",
      },
    ],
    costUSD: 2.5,
  },
  base: {
    symbol: "ETH",
    name: "Base",
    minimum: 0.001,
    recommended: 0.005,
    what_for:
      "Aerodrome LP, Aave V3, Morpho, meme trading (BRETT, DEGEN, TOSHI)",
    faucets: null,
    bridge: [
      {
        name: "Official Base Bridge",
        url: "https://bridge.base.org",
        from: "Ethereum",
        note: "~7 minutes",
      },
      {
        name: "Coinbase",
        url: "https://coinbase.com",
        note: "Buy on Coinbase, withdraw to Base directly",
      },
      {
        name: "Across Protocol",
        url: "https://across.to",
        from: "Any chain",
        note: "~2 minutes",
      },
    ],
    buy: [
      {
        name: "Buy on Coinbase (Base native)",
        url: "https://www.coinbase.com",
        note: "Best option — Coinbase supports Base natively",
      },
    ],
    costUSD: 2.5,
  },
  // Ethereum L1 removed — gas fees ($10-50/tx) make autonomous agent
  // execution uneconomical. All Ethereum protocols have cheaper equivalents
  // on Arbitrum and Base. USDT0 bridge still works Arbitrum ↔ Berachain ↔ Ink.
  avalanche: {
    symbol: "AVAX",
    name: "Avalanche C-Chain",
    minimum: 0.05,
    recommended: 0.2,
    what_for:
      "Lucid L-USDC lock chain (collateral custody before minting on Kite)",
    faucets: null,
    bridge: [
      {
        name: "Avalanche Bridge",
        url: "https://bridge.avax.network",
        from: "Ethereum",
        note: "Official bridge",
      },
      {
        name: "Stargate",
        url: "https://stargate.finance",
        from: "Any chain",
        note: "Fast, reliable",
      },
    ],
    buy: [
      {
        name: "Buy AVAX on Coinbase/Kraken",
        url: null,
        note: "Buy AVAX, withdraw to Avalanche C-Chain",
      },
    ],
    costUSD: 1.0,
  },
  polygon: {
    symbol: "MATIC",
    name: "Polygon",
    minimum: 0.5,
    recommended: 2.0,
    what_for: "Aave V3 yield (MATIC is very cheap)",
    faucets: null,
    bridge: [
      {
        name: "Polygon Bridge",
        url: "https://portal.polygon.technology",
        from: "Ethereum",
        note: "Official",
      },
      {
        name: "Across",
        url: "https://across.to",
        from: "Any chain",
        note: "Fast",
      },
    ],
    buy: [
      {
        name: "Buy MATIC on any exchange",
        url: null,
        note: "Very cheap — $0.30 worth covers days of usage",
      },
    ],
    costUSD: 0.3,
  },
  optimism: {
    symbol: "ETH",
    name: "Optimism",
    minimum: 0.001,
    recommended: 0.003,
    what_for: "Aave V3 yield",
    faucets: null,
    bridge: [
      {
        name: "Optimism Bridge",
        url: "https://app.optimism.io/bridge",
        from: "Ethereum",
        note: "~1 minute",
      },
      {
        name: "Across Protocol",
        url: "https://across.to",
        from: "Any chain",
        note: "Fast",
      },
    ],
    buy: [
      {
        name: "Buy ETH, bridge to Optimism",
        url: null,
        note: "Lowest fee bridge via Across",
      },
    ],
    costUSD: 2.5,
  },
};

// ─── GasSetup ─────────────────────────────────────────────────────────────────
export class GasSetup {
  /**
   * @param {object} cfg
   * @param {import('../chain-context.js').ChainContext} cfg.chainContext
   * @param {'testnet'|'mainnet'} [cfg.mode]
   */
  constructor(cfg) {
    this.ctx = cfg.chainContext;
    this.mode = cfg.mode || process.env.KARD_ENV || "testnet";
  }

  /**
   * Audit every chain — check actual balances vs requirements.
   * Returns a full status table.
   */
  async audit() {
    // Ethereum L1 excluded — gas too expensive for autonomous agent
    const chains =
      mode === "testnet"
        ? ["sepolia", "arbitrumSepolia", "baseSepolia", "kiteai"]
        : ["arbitrum", "base", "avalanche", "kiteai", "polygon", "optimism"];

    const results = [];

    await Promise.all(
      chains.map(async (chainKey) => {
        const req = GAS_REQUIREMENTS[chainKey];
        if (!req) return;

        let balance = 0;
        let error = null;

        try {
          const provider = this.ctx.getProvider(chainKey);
          const addr = this.ctx.getSigner(chainKey).address;
          const raw = await provider.getBalance(addr);
          balance = parseFloat(ethers.formatEther(raw));
        } catch (e) {
          error = e.message;
        }

        const ok = balance >= req.minimum;
        const enough = balance >= req.recommended;

        results.push({
          chain: chainKey,
          name: req.name,
          symbol: req.symbol,
          balance: balance.toFixed(6),
          minimum: req.minimum,
          recommended: req.recommended,
          ok,
          enough,
          critical: !!req.critical,
          error,
          what_for: req.what_for,
          status: error
            ? "⚠ RPC ERROR"
            : !ok
              ? "❌ NEEDS GAS"
              : !enough
                ? "🟡 LOW"
                : "✅ OK",
        });
      }),
    );

    // Sort: critical first, then by status
    return results.sort((a, b) => {
      if (a.critical && !b.critical) return -1;
      if (!a.critical && b.critical) return 1;
      if (!a.ok && b.ok) return -1;
      if (a.ok && !b.ok) return 1;
      return 0;
    });
  }

  /**
   * Print a formatted gas status table to the console.
   * Used by `kard gas` command.
   */
  async printTable() {
    const results = await this.audit();
    const mode = this.mode.toUpperCase();

    console.log(
      `\n┌─────────────────────────────────────────────────────────────────┐`,
    );
    console.log(`│  KARD Gas Status — ${mode.padEnd(46)}│`);
    console.log(
      `├─────────────────────────────────────────────────────────────────┤`,
    );
    console.log(
      `│  Chain              Symbol  Balance       Min       Status       │`,
    );
    console.log(
      `├─────────────────────────────────────────────────────────────────┤`,
    );

    for (const r of results) {
      const chain = r.name.padEnd(20);
      const sym = r.symbol.padEnd(7);
      const bal = r.balance.padEnd(13);
      const min = String(r.minimum).padEnd(9);
      const status = r.status;
      console.log(`│  ${chain} ${sym} ${bal} ${min} ${status.padEnd(12)} │`);
    }

    console.log(
      `└─────────────────────────────────────────────────────────────────┘\n`,
    );

    // Show actionable instructions for chains that need gas
    const needsGas = results.filter((r) => !r.ok && !r.error);
    if (needsGas.length > 0) {
      console.log("⛽ CHAINS THAT NEED GAS:\n");
      for (const r of needsGas) {
        console.log(
          `  ${r.name} (${r.symbol}): need ${r.minimum} ${r.symbol} minimum`,
        );
        if (r.critical)
          console.log(
            "  ⚠ CRITICAL — Kite attestations will fail without this",
          );
        if (r.faucets) {
          console.log("  Testnet faucets:");
          r.faucets.forEach((f) => console.log(`    → ${f.name}: ${f.url}`));
        }
        if (r.bridge) {
          console.log("  Bridges:");
          r.bridge
            .slice(0, 2)
            .forEach((b) =>
              console.log(`    → ${b.name}: ${b.url} (${b.note})`),
            );
        }
        if (r.buy) {
          console.log("  Buy options:");
          r.buy.slice(0, 1).forEach((b) => console.log(`    → ${b.note}`));
        }
        console.log();
      }
    }

    const allOk = results.every((r) => r.ok);
    if (allOk) {
      console.log("✅ All chains have sufficient gas. You're ready to run.\n");
    }

    return results;
  }

  /**
   * Returns the minimum required gas per chain as a simple object.
   * Used by the risk engine and agent init checks.
   */
  requirements() {
    const mode = this.mode;
    const chains =
      mode === "testnet"
        ? ["sepolia", "arbitrumSepolia", "baseSepolia", "kiteai"]
        : ["arbitrum", "base", "avalanche", "kiteai"];

    const out = {};
    for (const c of chains) {
      const req = GAS_REQUIREMENTS[c];
      if (req)
        out[c] = {
          symbol: req.symbol,
          minimum: req.minimum,
          recommended: req.recommended,
        };
    }
    return out;
  }

  /**
   * Check a single chain quickly.
   * Throws a clear error if the chain is below minimum.
   */
  async ensureGas(chainKey, extraNative = 0) {
    const req = GAS_REQUIREMENTS[chainKey];
    if (!req) return true; // unknown chain, skip check

    const provider = this.ctx.getProvider(chainKey);
    const addr = this.ctx.getSigner(chainKey).address;
    const raw = await provider.getBalance(addr);
    const balance = parseFloat(ethers.formatEther(raw));
    const needed = req.minimum + extraNative;

    if (balance < needed) {
      const hint = req.faucets
        ? `Get ${req.symbol} at: ${req.faucets[0].url}`
        : req.bridge
          ? `Bridge via: ${req.bridge[0].url}`
          : `Buy ${req.symbol} on a centralized exchange`;

      throw new Error(
        `Insufficient gas on ${req.name}: have ${balance.toFixed(6)} ${req.symbol}, ` +
          `need ${needed.toFixed(6)} ${req.symbol}. ${hint}`,
      );
    }

    return true;
  }

  /**
   * Total estimated cost in USD to fund all chains for mainnet.
   */
  mainnetCostEstimate() {
    const chains = ["arbitrum", "base", "avalanche", "polygon", "optimism"];
    let totalUSD = 0;
    const breakdown = [];

    for (const c of chains) {
      const req = GAS_REQUIREMENTS[c];
      if (!req || !req.costUSD) continue;
      totalUSD += req.costUSD;
      breakdown.push({
        chain: req.name,
        symbol: req.symbol,
        amount: req.recommended,
        costUSD: req.costUSD,
      });
    }

    return { totalUSD, breakdown };
  }
}

/**
 * Print the testnet vs mainnet gas requirements as a formatted guide.
 * Used by `kard gas --guide`
 */
export function printGasGuide(mode = "testnet") {
  const isTestnet = mode === "testnet";

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`  KARD GAS FUNDING GUIDE — ${mode.toUpperCase()}`);
  console.log(`═══════════════════════════════════════════════════════\n`);

  if (isTestnet) {
    console.log("TESTNET — All gas is free from faucets.\n");
    console.log("1. KITE AI (CRITICAL — for attestations)");
    console.log("   → https://faucet.gokite.ai");
    console.log("   → Get at least 1 KITE for gas\n");
    console.log("2. Sepolia ETH (for Aave testing)");
    console.log("   → https://sepoliafaucet.com");
    console.log("   → Get 0.05 ETH\n");
    console.log("3. Arbitrum Sepolia ETH (for GMX / Hyperliquid testnet)");
    console.log("   → https://faucet.quicknode.com/arbitrum/sepolia");
    console.log("   → Get 0.02 ETH\n");
    console.log("4. Base Sepolia ETH (for Aerodrome / meme testing)");
    console.log(
      "   → https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet",
    );
    console.log("   → Get 0.02 ETH\n");
    console.log("Testnet USDC/USDT (for Aave deposits):");
    console.log(
      "   → https://staging.aave.com/faucet/ (after getting Sepolia ETH)\n",
    );
  } else {
    const estimate = new GasSetup({
      chainContext: null,
      mode: "mainnet",
    }).mainnetCostEstimate();
    console.log(
      `MAINNET — Estimated gas cost to fund all chains: ~$${estimate.totalUSD.toFixed(0)} total\n`,
    );

    const priority = [
      [
        "kiteai",
        "KITE AI (CRITICAL)",
        "attestations — agent cannot prove actions without this",
      ],
      [
        "arbitrum",
        "Arbitrum ETH (~$2.50)",
        "Aave, Lucid minting, Hyperliquid, GMX, Uniswap LP",
      ],
      [
        "base",
        "Base ETH (~$2.50)",
        "Aerodrome LP, Morpho, meme trading (BRETT, DEGEN)",
      ],
      ["avalanche", "Avalanche AVAX (~$1.00)", "Lucid collateral lock chain"],
      [
        "ethereum",
        "Ethereum ETH (~$25)",
        "Morpho Blue, USDT0 bridge origin, Uniswap LP",
      ],
      ["polygon", "Polygon MATIC (~$0.30)", "Aave V3 (very cheap)"],
      ["optimism", "Optimism ETH (~$2.50)", "Aave V3"],
    ];

    for (const [key, label, purpose] of priority) {
      const req = GAS_REQUIREMENTS[key];
      if (!req) continue;
      console.log(`${key === "kiteai" ? "⚠ CRITICAL: " : ""}${label}`);
      console.log(`   Purpose: ${purpose}`);
      console.log(`   Minimum: ${req.minimum} ${req.symbol}`);
      if (req.bridge) console.log(`   Bridge via: ${req.bridge[0].url}`);
      if (req.faucets) console.log(`   Faucet: ${req.faucets[0].url}`);
      console.log();
    }

    console.log(
      "PRIORITY ORDER: Fund Kite AI first (attestations), then Arbitrum (most DeFi), then Base (memes + LP).\n",
    );
  }

  console.log("After funding, verify with:  kard gas\n");
}
