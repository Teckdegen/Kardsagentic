# KARD — Autonomous AI Treasury Agent on Kite AI

## What is Kard?

Kard is a **self-hosted AI agent runtime** that turns plain-English trading strategies into real on-chain execution. It manages a DeFi treasury across multiple chains — lending, swapping, bridging, trading perps — and writes a verifiable proof of every action onto **Kite AI**.

You hold every key. Kard holds nothing.

---

## How it works

```
You type a strategy → AI compiles it → Risk engine validates → Agent executes on-chain → Kite AI attests
```

1. **You describe what you want** — "Park my USDC at the highest yield" or "Long ETH 3x if funding is negative"
2. **Your chosen LLM compiles it** — Claude, GPT, DeepSeek, Grok, Gemini, or local Ollama
3. **Risk engine validates** — 10 hard safety checks. Fails = blocked, not warned
4. **Agent executes** — Real transactions on Aave, Uniswap, Hyperliquid, Lucid, Morpho, etc.
5. **Kite AI records the proof** — Cryptographically signed attestation. Permanent. Verifiable by anyone.
6. **Agent learns** — Every 20 cycles, reviews what worked and adapts

---

## Kite AI Integration

Kard is native to the Kite AI ecosystem. Not bolted on — built in.

| Layer | How Kard uses it |
|-------|-----------------|
| **Identity** | Kite Passport gives the agent a verified identity. Passkey-approved spending sessions. |
| **Payment** | USDC on Kite as settlement. x402 micropayments for machine-to-machine API access. |
| **Governance** | Per-session budgets, time limits, scope. Hard policy enforcement. |
| **Verification** | Every action → attestation tx on Kite AI (chainId 2366). Decode calldata = full action JSON. |
| **Yield** | Lucid L-USDC: mint on Arbitrum, settle on Kite AI. Yield-bearing canonical USDC. |

---

## What it can do

**Lending & Yield:**
- Aave V3 (Arbitrum, Base, Optimism, Polygon, Avalanche)
- Lucid L-USDC on Kite AI (minted from Arbitrum)
- Morpho Blue (Base, Arbitrum)
- Compound V3, Pendle PT, Lido wstETH, EtherFi weETH, Beefy vaults

**LP Positions:**
- Uniswap V3 concentrated liquidity
- Aerodrome on Base (+ AERO rewards)

**Trading:**
- Hyperliquid perps (testnet + mainnet)
- GMX V2 on Arbitrum

**Cross-chain:**
- Lucid (LayerZero): USDC ↔ Kite AI
- Across Protocol: ETH → Base/Optimism/Polygon
- Auto gas bridging from Arbitrum to other L2s

---

## Strategies

| Strategy | Risk | Target | What it uses |
|---------|------|--------|-------------|
| CONSERVATIVE | Low | ~3% | Aave lending only |
| KITE_YIELD | Low | ~7% | Lucid L-USDC + Aave (Kite-native) |
| USDT_YIELD | Low-Med | ~8% | USDT consolidation + Aave |
| BALANCED | Medium | ~6% | Aave + liquidity |
| DELTA_NEUTRAL | Low-Med | ~12% | Long spot + short perp (market-neutral) |
| LP_FARMER | Medium | ~15% | Uniswap V3 + Aerodrome + Beefy |
| FULL_STACK | Medium | ~18% | All protocols combined |
| PERPS_TRADER | High | ~20% | Hyperliquid + GMX |

---

## Quick start (testnet)

```bash
# 1. Clone & install
git clone https://github.com/Teckdegen/Kardsagentic kard
cd kard && npm install

# 2. Create wallet
node src/cli/index.js init

# 3. Add your LLM key
export ANTHROPIC_API_KEY=sk-ant-your-key
# or: export OPENAI_API_KEY=sk-...
# or: export DEEPSEEK_API_KEY=...
# or: ollama pull llama3.1 (free, local)

# 4. Set testnet mode
export KARD_ENV=testnet

# 5. Fund testnet (all free):
#    - Kite AI KITE:         https://faucet.gokite.ai
#    - Arbitrum Sepolia ETH: https://faucet.quicknode.com/arbitrum/sepolia
#    - Arbitrum Sepolia USDC: https://staging.aave.com/faucet/

# 6. Verify funding
node src/cli/index.js gas

# 7. Preview a strategy (no execution)
node src/cli/index.js claude "park my USDC at the highest yield"

# 8. Run autonomous agent
node src/cli/index.js run --strategy KITE_YIELD --interval 60s
```

---

## Key features

- **BYOM** — Bring Your Own Model. Claude, GPT, DeepSeek, Grok, Gemini, OpenRouter, Ollama
- **Multi-agent fleet** — Up to 100 agents, each with different LLM + strategy, coordinating via signed messages
- **Self-evolving** — Agent writes its own skill files after profitable patterns
- **Telegram/Discord/Slack** — Control from your phone in natural language
- **MCP server** — Use from Claude Desktop, Cursor, or Claude Code
- **Kill switch** — One command stops everything: `kard kill on`
- **Policy engine** — Ban chains, venues, actions, or assets. Three enforcement layers.
- **Self-custodial** — Your keys on your machine. No server. No SaaS. No login.

---

## What Kard is NOT

- Not a hosted service — runs entirely on your machine
- Not a custodian — your funds stay in your wallet
- Not a chatbot — it executes real on-chain transactions
- Not locked to one AI — you bring yours

---

## License

Apache-2.0 — open source, free to use, free to extend.
