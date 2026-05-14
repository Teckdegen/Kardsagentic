# KARDS — Installation & Configuration Guide
> Complete setup from zero to running autonomous agent.
> Every command here is real. Every address is from the actual codebase.

---

## Before you start — pick your mode

| Mode | What it means | Good for |
|------|--------------|---------|
| **Testnet** | Free fake money, real execution logic, zero risk | Learning, demos, hackathon judging |
| **Mainnet** | Real money, real trades, real attestations | Production, live yield, real perps |

Switching is just changing 3 environment variables. The code is identical.

---

---

# PART 1 — REQUIREMENTS

| Requirement | Version | Check |
|------------|---------|-------|
| Node.js | 22+ | `node --version` |
| npm | 10+ | `npm --version` |

**Install Node 22 via nvm (Mac/Linux/WSL):**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 22 && nvm use 22
node --version  # should print v22.x.x
```

**Windows:** Download Node 22 from [nodejs.org](https://nodejs.org/en/download)

---

---

# PART 2 — INSTALL

```bash
# Clone
git clone https://github.com/your-org/kards.git
cd kards

# Install dependencies
npm install

# Fix the CLI bin path (required until next release)
npm pkg set bin.kard="./src/cli/index.js"
npm link

# Install two packages that are used but not yet in package.json
npm install @nktkas/hyperliquid zod

# Verify
kard --version
kard help
```

---

---

# PART 3 — CREATE YOUR WALLET

Run this once. It generates an encrypted wallet and tells you exactly what to fund.

```bash
kard init
```

**What happens:**
1. Asks you to set a password
2. Generates a fresh wallet
3. Shows your address (same on ALL chains — EVM addresses are universal)
4. Shows your recovery phrase — **write it down now**
5. Shows exact funding instructions for testnet or mainnet

**Or use an existing private key:**
```bash
# Just add to your .env file — no init needed
PRIVATE_KEY=0xYourPrivateKeyHere
KARD_PASSWORD=your-password
```

---

---

# PART 4 — FUND YOUR WALLET

This is the most important section. Read the full model first.

## The Funding Model

You fund **three things**. The agent handles everything else.

```
┌─────────────────────────────────────────────────────────────────┐
│  YOUR ADDRESS (same on all chains)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. KITE AI gas    → for attestations (every action needs this) │
│  2. Gas budget     → ETH on Arbitrum for transaction fees       │
│  3. Trading USDC   → your capital, goes into yield strategies   │
│                                                                 │
│  Agent auto-bridges gas to Base/Optimism when needed.          │
│  You never manually fund Base, Optimism, Polygon, or Avalanche.│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Why KITE AI separately?

Kite AI is its own L1 blockchain. It uses **KITE** as its native gas token — not ETH. No bridge currently supports KITE from other chains. It must be funded directly. Testnet: free. Mainnet: ~$0.05 total.

**Without KITE gas, attestations fail. Every agent action writes to Kite AI — it needs gas.**

## Why NOT Ethereum L1?

Ethereum mainnet is intentionally excluded from KARDS. Gas fees of $10–50 per transaction make autonomous agent execution uneconomical. Every Ethereum protocol KARDS uses (Aave, Morpho, Uniswap, Compound) has an identical cheaper version on Arbitrum or Base at under $0.10/tx.

---

## TESTNET FUNDING (all free)

| What | Chain | Amount | Faucet |
|------|-------|--------|--------|
| **KITE gas** ⚠ CRITICAL | Kite AI | 1 KITE | https://faucet.gokite.ai |
| **Gas budget (ETH)** | Arbitrum Sepolia | 0.02 ETH | https://faucet.quicknode.com/arbitrum/sepolia |
| **Trading USDC** | Arbitrum Sepolia | 1000+ USDC | https://staging.aave.com/faucet/ |
| Base ETH (optional) | Base Sepolia | 0.02 ETH | https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet |

**Order matters:** Get Arbitrum Sepolia ETH first, then get Aave USDC (needs ETH for gas to claim).

---

## MAINNET FUNDING

| What | Chain | Amount | How |
|------|-------|--------|-----|
| **KITE gas** ⚠ CRITICAL | Kite AI | 1–5 KITE | Ask in Kite Discord. Cost ~$0.01–0.05 total. |
| **Gas budget (ETH)** | Arbitrum | 0.005 ETH (~$12) | Buy ETH on Coinbase, withdraw to "Arbitrum" network |
| **Trading USDC** | Arbitrum | Any amount | Buy USDC on Coinbase, withdraw to "Arbitrum" network |

**The agent auto-bridges:**
- Arbitrum ETH → Base ETH when Base balance drops below 0.001
- Arbitrum ETH → Optimism ETH when Optimism balance drops below 0.001
- Uses Across Protocol (2–5 min, under 0.1% fee)
- You never manually top up those chains

**To get ETH on Arbitrum (mainnet):**
```
Coinbase: Buy ETH → Withdraw → Network: "Arbitrum" ← choose this
Bridge:   https://across.to  (fast, from any chain)
Bridge:   https://bridge.arbitrum.io  (official, slower)
```

---

## Check your funding

After funding, verify everything is ready:

```bash
kard gas
```

Expected output:
```
┌──────────────────────────────────────────────────────────────┐
│  Gas Budget — TESTNET                                        │
├──────────────────────────────────────────────────────────────┤
│  Total budget: 0.01 ETH  │  Spent: 0 ETH  │  Remaining: 100%│
├──────────────────────────────────────────────────────────────┤
│  Chain              Symbol  Balance       Min       Status   │
├──────────────────────────────────────────────────────────────┤
│  Arbitrum Sepolia   ETH     0.020000      0.005     ✅ OK    │
│  Base Sepolia       ETH     0.020000      0.005     ✅ OK    │
└──────────────────────────────────────────────────────────────┘

📋 Kite AI gas (KITE): cannot be auto-funded via bridge.
   Testnet faucet: https://faucet.gokite.ai
```

If everything shows ✅ OK, you're ready.

---

---

# PART 5 — AI PROVIDER KEY

You need one AI key to reason about strategies. Pick any provider.

| Provider | Env variable | Get key at |
|---------|-------------|-----------|
| **Anthropic (Claude)** | `ANTHROPIC_API_KEY` | console.anthropic.com |
| **OpenAI (GPT)** | `OPENAI_API_KEY` | platform.openai.com |
| **DeepSeek** | `DEEPSEEK_API_KEY` | platform.deepseek.com |
| **Grok (xAI)** | `GROK_API_KEY` | console.x.ai |
| **Gemini** | `GEMINI_API_KEY` | aistudio.google.com |
| **OpenRouter** | `OPENROUTER_API_KEY` | openrouter.ai |
| **Ollama (free, local)** | No key needed | ollama.com |

**Free option — Ollama:**
```bash
# Mac
brew install ollama && ollama pull llama3.1

# Windows/Linux: download from ollama.com
ollama pull llama3.1
```

---

---

# PART 6 — ENVIRONMENT FILE

Create a `.env` file in your project folder. Copy the relevant block below.

## TESTNET .env

```bash
# ─── Mode ────────────────────────────────────────────────────
KARD_ENV=testnet

# ─── Wallet ──────────────────────────────────────────────────
KARD_PASSWORD=your-wallet-password
# OR if using private key directly:
# PRIVATE_KEY=0xYourTestnetPrivateKey

# ─── AI Provider (pick one) ──────────────────────────────────
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key-here

# ─── Primary Chain ───────────────────────────────────────────
KARD_ENV=testnet
ETH_CHAIN=arbitrumSepolia
ARB_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Testnet token addresses (Arbitrum Sepolia)
USDT_ADDRESS=0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0
USDC_ADDRESS=0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8

# ─── Aave (Sepolia) ──────────────────────────────────────────
AAVE_POOL=0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951
AAVE_DATA_PROVIDER=0x3e9708d80f7B3e43118013075F7e95CE3AB31F31

# ─── Kite AI ─────────────────────────────────────────────────
KITE_RPC_URL=https://rpc.gokite.ai
KITE_CHAIN_ID=2366

# ─── Hyperliquid (Testnet) ────────────────────────────────────
HYPERLIQUID_NETWORK=testnet
HYPERLIQUID_API_WALLET=0xYourTestnetApiWalletKey
HYPERLIQUID_USER_ADDRESS=0xYourTestnetAddress

# ─── Gas Budget ──────────────────────────────────────────────
GAS_BUDGET_ETH=0.02
GAS_BUDGET_ALERT_PCT=0.2

# ─── Strategy ────────────────────────────────────────────────
DEFAULT_STRATEGY=KITE_YIELD
POLL_INTERVAL_MS=60000

# ─── Attestations ────────────────────────────────────────────
KARD_ATTEST=1

# ─── Telegram (optional) ─────────────────────────────────────
# TELEGRAM_BOT_TOKEN=your-bot-token
# TELEGRAM_ALLOW_USERS=123456789
```

---

## MAINNET .env

```bash
# ─── Mode ────────────────────────────────────────────────────
KARD_ENV=mainnet

# ─── Wallet ──────────────────────────────────────────────────
# SECURITY: Never commit this file. Add .env to .gitignore.
KARD_PASSWORD=your-strong-password
# OR: PRIVATE_KEY=0xYourMainnetPrivateKey

# ─── AI Provider (pick one) ──────────────────────────────────
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key-here

# ─── Primary Chain: Arbitrum ─────────────────────────────────
ETH_CHAIN=arbitrum
ARB_RPC_URL=https://arb1.arbitrum.io/rpc
BASE_RPC_URL=https://mainnet.base.org
OP_RPC_URL=https://mainnet.optimism.io
AVAX_RPC_URL=https://api.avax.network/ext/bc/C/rpc

# Token addresses on Arbitrum
USDT_ADDRESS=0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9
USDC_ADDRESS=0xaf88d065e77c8cC2239327C5EDb3A432268e5831
WETH_ADDRESS=0x82aF49447D8a07e3bd95BD0d56f35241523fBab1
DAI_ADDRESS=0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1

# ─── Aave V3 (Arbitrum) ──────────────────────────────────────
AAVE_POOL=0x794a61358D6845594F94dc1DB02A252b5b4814aD

# ─── Kite AI ─────────────────────────────────────────────────
KITE_RPC_URL=https://rpc.gokite.ai
KITE_CHAIN_ID=2366

# Lucid controllers on Kite AI
LUCID_USDC_CONTROLLER=0x92E2391d0836e10b9e5EAB5d56BfC286Fadec25b
LUCID_WETH_CONTROLLER=0x638d1c70c7b047b192eB88657B411F84fAc74681
LUCID_USDT_CONTROLLER=0x80bA7204f060Fd321BFE8d4F3aB2E2bF4e6fCe49

# Kite AI token addresses
KITE_USDC_ADDRESS=0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e
KITE_WETH_ADDRESS=0x3D66d6c3201190952e8EA973F59c4428b32D5F9b
KITE_USDT_ADDRESS=0x3Fdd283C4c43A60398bf93CA01a8a8BD773a755b

# ─── Hyperliquid (MAINNET) ────────────────────────────────────
# Get API wallet from: app.hyperliquid.xyz → Settings → API
# API wallet is SEPARATE from your main wallet
HYPERLIQUID_NETWORK=mainnet
HYPERLIQUID_API_WALLET=0xYourHyperliquidApiWalletKey
HYPERLIQUID_USER_ADDRESS=0xYourMainHyperliquidAddress

# ─── Avalanche (Lucid collateral lock chain) ──────────────────
AVAX_USDC_ADDRESS=0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e
AVAX_AAVE_POOL=0x794a61358D6845594F94dc1DB02A252b5b4814aD

# ─── x402 Payments ───────────────────────────────────────────
X402_NETWORK=eip155:42161
X402_TOKEN_ADDRESS=0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9

# ─── Gas Budget ──────────────────────────────────────────────
GAS_BUDGET_ETH=0.01          # total ETH reserved for gas
GAS_BUDGET_ALERT_PCT=0.2     # alert when < 20% remaining

# ─── Kite Attestation ────────────────────────────────────────
KARD_ATTEST=1
# Optional: contract attestation mode
# KARD_ATTESTOR_ADDR=0xYourDeployedKardAttestorContract

# ─── Strategy ────────────────────────────────────────────────
DEFAULT_STRATEGY=KITE_YIELD
POLL_INTERVAL_MS=60000

# ─── Optional: Telegram AI Bot ───────────────────────────────
# TELEGRAM_BOT_TOKEN=your-bot-token
# TELEGRAM_ALLOW_USERS=123456789

# ─── Optional: Simulation ────────────────────────────────────
# Full tx simulation before signing (requires Tenderly/Anvil fork)
# KARD_SIM_RPC=https://your-fork-rpc
```

---

---

# PART 7 — FIRST RUN

```bash
# 1. Load env
source .env   # Mac/Linux

# 2. Check wallet
kard wallet address

# 3. Verify gas on all chains
kard gas

# 4. Check gas funding guide if needed
kard gas --guide

# 5. Verify Lucid (mainnet only — run before first mainnet execution)
kard verify-lucid USDC

# 6. Test AI connection
kard claude "what is my current portfolio status?"

# 7. See live yield opportunities
kard opportunities

# 8. Start the agent
kard run --strategy KITE_YIELD --interval 60s
```

---

---

# PART 8 — STRATEGIES

## For testnet (try these first)

```bash
kard run --strategy CONSERVATIVE --interval 60s   # safe, no perps
kard run --strategy KITE_YIELD --interval 60s      # Kite-native yield
```

## For mainnet

```bash
kard run --strategy KITE_YIELD --interval 60s      # Lucid + Aave (~7% APY)
kard run --strategy USDT_YIELD --interval 60s      # USDT-focused (~8% APY)
kard run --strategy LP_FARMER --interval 60s       # LP fees + Beefy (~15% APY)
kard run --strategy DELTA_NEUTRAL --interval 30s   # market neutral (~12% APY)
kard run --strategy FULL_STACK --interval 60s      # all protocols (~18% APY)
kard run --strategy PERPS_TRADER --interval 30s    # perps (high risk)
```

## All strategies

| Strategy | Risk | Target APY | What it uses |
|---------|------|-----------|-------------|
| `CONSERVATIVE` | Low | ~3% | Aave lending only |
| `BALANCED` | Medium | ~6% | Aave + liquidity |
| `AGGRESSIVE` | Higher | ~12% | Aave + LP |
| `USDT_YIELD` | Low-Med | ~8% | Aave USDT focus, auto-consolidates DAI/USDC |
| `KITE_YIELD` | Low | ~7% | Lucid L-USDC on Kite + Aave backup |
| `PERPS_TRADER` | High | ~20% | Hyperliquid + GMX, 5x max leverage |
| `LP_FARMER` | Medium | ~15% | Uniswap V3 + Aerodrome + Beefy auto-compound |
| `DELTA_NEUTRAL` | Low-Med | ~12% | Long spot + short perp = zero directional risk |
| `FULL_STACK` | Medium | ~18% | Aave + Lucid + Morpho + Compound + LP + Beefy + Pendle |

---

---

# PART 9 — GOAL MODE

Let the AI decide the strategy instead of picking one yourself:

```bash
kard goal "earn 5% on my USDC in 2 weeks"
kard goal "maximize yield without touching perps"
kard goal "grow my portfolio $500 this month"
kard goal "just trade"
```

Every 15 minutes the agent re-evaluates whether it's on track and switches strategies if needed. Goals survive restarts.

---

---

# PART 10 — TELEGRAM AI CHATBOT

The Telegram bot is a full AI chatbot. Not slash commands. Any natural language message works.

```bash
# 1. Create bot: message @BotFather → /newbot → copy token
# 2. Get your user ID: message @userinfobot → copy the number
# 3. Add to .env:
TELEGRAM_BOT_TOKEN=1234567890:ABCdef...
TELEGRAM_ALLOW_USERS=123456789

# 4. Start
kard chat telegram
```

**Example conversations:**
```
"how's my portfolio?"       → natural language status with numbers
"put my USDC at best yield" → proposes action, asks yes/no, executes
"long ETH if RSI oversold"  → proposes perp trade, asks confirm, executes
"stop the agent"            → pauses the loop
"what are the top yields?"  → live ranked opportunities
"I want 5% gain this month" → sets a goal
```

The bot remembers the last 10 messages in your conversation. It always asks for confirmation before executing any trade or capital movement.

---

---

# PART 11 — POLICY (CONTROL WHAT THE AGENT CAN DO)

Three enforcement layers: LLM prompt + action filter + execution veto.

```bash
# See current policy
kard config show

# ── RECOMMENDED TESTNET POLICY ──────────────────────────────
kard config allow chains arbitrumSepolia baseSepolia kiteai
kard config deny actions perps_open perps_close bridge
kard config allow assets USDC USDT DAI

# ── RECOMMENDED MAINNET FIRST-TIME POLICY ────────────────────
kard config allow chains arbitrum base kiteai
kard config deny actions perps_open perps_close
kard config allow assets USDC USDT USDC.e
kard config set limits.max_per_market_pct 0.10
kard config set limits.max_daily_drawdown_pct 0.05

# ── FULL MAINNET (when ready) ────────────────────────────────
kard config reset
kard config allow chains arbitrum base optimism polygon avalanche kiteai
kard config allow assets USDC USDT WETH USDC.e DAI

# ── OTHER USEFUL RULES ────────────────────────────────────────
kard config deny venues hyperliquid      # no Hyperliquid
kard config deny actions lp_open         # no LP positions
kard config deny venues beefy            # no Beefy vaults
kard config deny actions bridge          # no cross-chain moves
```

---

---

# PART 12 — EMERGENCY STOP

```bash
# Stop all agents immediately
kard kill on

# Resume
kard kill off
```

This writes/removes `~/.kard/KILL`. Every agent checks for this file before every action.

---

---

# PART 13 — MCP SERVER

Connect KARDS to Claude Desktop, Cursor, or Claude Code:

## Claude Desktop

Config file: `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac)
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "kard": {
      "command": "npx",
      "args": ["-y", "@kard/agent", "mcp"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key",
        "KARD_ENV": "testnet"
      }
    }
  }
}
```

Restart Claude Desktop. Then:
```
Use kard to show live yield opportunities
Use kard to compile: long ETH if RSI < 30, risk 2%
Use kard to verify attestation 0x...
```

## Cursor

Settings → MCP → Add Server:
- Name: `kard`
- Command: `npx`
- Args: `-y @kard/agent mcp`
- Env: `ANTHROPIC_API_KEY=sk-ant-your-key`

## Claude Code

```bash
claude mcp add kard npx -y @kard/agent mcp
```

---

---

# PART 14 — DOCKER (24/7 SERVER)

```bash
# Clone on your server
git clone <repo> kards && cd kards

# Create .env (see Part 6)
cp .env.example .env && nano .env

# Start
docker compose up -d

# Watch logs
docker compose logs -f kard

# Stop
docker compose down
```

The container:
- Auto-restarts on crash
- Exposes no ports (outbound-only)
- Saves keystore + ledger + goals to `./data/` on the host

---

---

# PART 15 — WHAT'S SUPPORTED

## Protocols

| Category | Protocol | Chains |
|---------|---------|--------|
| Lending | Aave V3 | Arbitrum, Base, Optimism, Polygon, Avalanche |
| Lending | Morpho Blue | Arbitrum, Base |
| Lending | Compound V3 | Arbitrum, Base |
| Yield | Lucid L-USDC | Kite AI (minted from Arbitrum) |
| Yield | Pendle PT | Arbitrum, Base |
| Yield | Lido wstETH | Arbitrum, Base |
| Yield | EtherFi weETH | Arbitrum, Base |
| Yield | Beefy vaults | Arbitrum, Base, Avalanche, Polygon |
| LP | Uniswap V3 | Arbitrum, Base |
| LP | Aerodrome | Base |
| Perps | Hyperliquid | Testnet + Mainnet |
| Perps | GMX V2 | Arbitrum |
| Bridge | Across Protocol | Arbitrum → Base/Optimism/Polygon |
| Bridge | Lucid (LayerZero) | USDC: Arbitrum ↔ Kite AI |
| Bridge | USDT0 (LayerZero) | Arbitrum ↔ Berachain ↔ Ink |

## Bridge Capabilities (What Can and Cannot Be Bridged)

| What | From → To | How | Supported? |
|------|----------|-----|-----------|
| USDC | Arbitrum → Kite AI | Lucid mint | ✅ |
| USDC | Kite AI → Arbitrum | Lucid burn | ✅ |
| ETH | Arbitrum → Base | Across | ✅ |
| ETH | Arbitrum → Optimism | Across | ✅ |
| USDT0 | Arbitrum → Berachain | LayerZero OFT | ✅ |
| KITE | Any chain → Kite AI | No bridge exists | ❌ Must fund manually |
| ETH | Any chain → Kite AI | Kite uses KITE not ETH | ❌ Not applicable |

---

---

# PART 16 — SECURITY CHECKLIST

Before running mainnet:

```
[ ] .env is in .gitignore  (check: grep .env .gitignore)
[ ] PRIVATE_KEY is a hot wallet — NOT your hardware wallet or exchange
[ ] HYPERLIQUID_API_WALLET is separate from your main Hyperliquid account
[ ] TELEGRAM_ALLOW_USERS is set — only your numeric ID can execute
[ ] Ran kard config show — policy looks right
[ ] Started on testnet first and everything worked
[ ] Tested kard kill on → kard kill off
[ ] GAS_BUDGET_ETH is set
[ ] Only using capital you can afford to lose
```

---

---

# PART 17 — QUICK REFERENCE

## The 5 key env vars that switch between testnet and mainnet

```bash
# TESTNET
KARD_ENV=testnet
ETH_CHAIN=arbitrumSepolia
ARB_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
AAVE_POOL=0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951
HYPERLIQUID_NETWORK=testnet

# MAINNET
KARD_ENV=mainnet
ETH_CHAIN=arbitrum
ARB_RPC_URL=https://arb1.arbitrum.io/rpc
AAVE_POOL=0x794a61358D6845594F94dc1DB02A252b5b4814aD
HYPERLIQUID_NETWORK=mainnet
```

## Real contract addresses

| Contract | Chain | Address |
|---------|-------|---------|
| Aave V3 Pool | Arbitrum | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` |
| Aave V3 Pool | Base | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` |
| Aave V3 Pool | Avalanche | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` |
| Aave V3 Pool | Sepolia (testnet) | `0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951` |
| Morpho Blue | All chains | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` |
| Compound USDC | Arbitrum | `0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf` |
| Compound USDC | Base | `0xb125E6687d4313864e53df431d5425969c15Eb2` |
| Uniswap V3 PM | Arbitrum | `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` |
| Uniswap V3 PM | Base | `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1` |
| Aerodrome Router | Base | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| GMX ExchangeRouter | Arbitrum | `0x69C527fC77291722b52649E45c838e41be8Bf5d5` |
| Across SpokePool | Arbitrum | `0xe35e9842fceaCA96570B734083f4a58e8F7C5f2A` |
| Across SpokePool | Base | `0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64` |
| USDT0 OFT | Arbitrum | `0x14E4A1B13bf7F943c8ff7C51fb60FA964A298D92` |
| Lucid USDC Controller | Kite AI | `0x92E2391d0836e10b9e5EAB5d56BfC286Fadec25b` |
| L-USDC | Kite AI | `0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e` |

## Cheat sheet

```
INSTALL       npm install -g @kard/agent
              npm pkg set bin.kard="./src/cli/index.js" && npm link
              npm install @nktkas/hyperliquid zod

WALLET        kard init                    (create local wallet)
              kard wallet address          (show address)

FUNDING       kard gas --guide             (what to fund)
              kard gas                     (check balances)

TESTNET GAS   https://faucet.gokite.ai     ← KITE (critical)
              https://faucet.quicknode.com/arbitrum/sepolia ← ETH
              https://staging.aave.com/faucet/ ← USDC

MAINNET GAS   Kite Discord for KITE (~$0.05)
              Coinbase → Arbitrum ETH (0.005 = ~$12)
              USDC on Arbitrum (your capital)

RUN           kard run --strategy KITE_YIELD
              kard goal "grow 5% this month"
              kard opportunities

CONTROL       kard kill on                 (EMERGENCY STOP)
              kard kill off                (resume)

VERIFY        kard attest list
              kard attest verify 0x<hash>
              https://kitescan.ai/tx/0x<hash>
```

---

*KARDS — From Intelligence to Execution.*
*Apache-2.0*
