# KARDS — Website Content
> Practical, user-facing copy. Every section maps to a page or block on the site.
> Covers: what KARDS is, how to install, CLI reference, MCP setup, and everything in between.

---

---

# SECTION 1 — HERO

## Headline
# Plain English. Real Trades. Fully Autonomous.

## Subheadline
Type a trading idea. KARDS turns it into a live strategy, checks the risk, executes it on-chain, and logs the proof — all without you touching a thing after that.

## Three Punchy Lines Under the Hero
- **No code.** Write strategies in plain English.
- **No lock-in.** Use any AI model — Claude, GPT, DeepSeek, or your own local model.
- **No black box.** Every action is signed, timestamped, and verifiable on Kite.

## CTA Buttons
- **Get Started** → scrolls to Install section
- **View CLI Docs** → scrolls to CLI section
- **Connect via MCP** → scrolls to MCP section

## Badge
Built for the Kite AI Global Hackathon 2026 — *"From Intelligence to Execution."*

---

---

# SECTION 2 — WHAT IS KARDS?

KARDS is software you run on your own machine. It takes trading ideas you write in plain English, turns them into structured strategies, validates them through a safety engine, executes them across real DeFi protocols, and writes a verifiable record of everything onto Kite AI.

**You hold every key. KARDS holds nothing.**

Think of it as the engine between your brain and the blockchain — the layer that takes what you *want* to happen and makes it *actually* happen, safely, automatically, and with proof.

## The One-Sentence Version
> You type a strategy. Money moves on-chain. Everything is verifiable.

## What it is NOT
- Not a hosted service — there is no KARDS server, no SaaS login
- Not a custodian — your funds stay in your wallet, always
- Not a chatbot — it executes real actions on real protocols
- Not locked to one AI model — you bring yours

---

---

# SECTION 3 — HOW IT WORKS

Six things happen every time KARDS runs a cycle:

### 1. You Describe What You Want
Write your strategy in plain English in the terminal, a chat message, or a text file. No syntax. No code.

```
"Long ETH if RSI drops below 30. Risk 2%. Take profit at 8%."
"Move my idle USDC into whatever has the highest yield right now."
"Hedge my BTC if volatility spikes."
"Rebalance my portfolio to 60% stablecoins."
```

### 2. The Strategy Compiler Reads It
KARDS sends your words to your chosen AI model, which turns them into a structured execution blueprint — with conditions, actions, risk limits, and timing baked in.

### 3. The Risk Engine Checks It
Before anything touches the market, a deterministic safety layer runs 10 hard checks. If anything fails — not enough gas, position too big, leverage too high, AI not confident enough — the action is blocked. Not warned. Blocked.

### 4. The Agent Executes It
Approved actions go on-chain: opening positions, supplying to lending pools, swapping tokens, bridging to another chain, defending positions from liquidation.

### 5. Kite Records It
Every action generates a verifiable attestation on Kite — a cryptographically signed record of what happened, why, the confidence score, the risk rating, and the transaction hash.

### 6. The Agent Learns and Repeats
Every 20 cycles, KARDS reviews what worked and folds those lessons into its reasoning. Then it waits for the next cycle and does it all again — 24/7, without you.

---

---

# SECTION 4 — INSTALL ON YOUR PC

## What You Need First

| Requirement | Where to get it |
|-------------|----------------|
| **Node.js 22+** | [nodejs.org/en/download](https://nodejs.org/en/download) |
| **An AI provider API key** (or Ollama for free local models) | See table below |
| **Terminal / Command Prompt** | Already on your machine |

> **No API key?** Install [Ollama](https://ollama.com) and pull a free local model. KARDS works 100% offline with no cost.

---

## Step 1 — Install KARDS

```bash
npm install -g @kard/agent

# Fix CLI path (required until next release)
npm pkg set bin.kard="./src/cli/index.js" && npm link

# Install two missing packages
npm install @nktkas/hyperliquid zod

# Verify
kard --version
```

---

## Step 2 — Create Your Wallet

```bash
kard init
```

This generates an encrypted wallet stored at `~/.kard/wallet.json`. Your address is the same on every chain. The command shows your address and exact funding instructions.

**Or use an existing private key:**
```
PRIVATE_KEY=0xYourPrivateKeyHere
KARD_PASSWORD=your-password
```

---

## Step 3 — Fund Your Wallet (3 things only)

You fund three things. The agent handles everything else — including bridging gas to other chains.

**TESTNET (all free):**

| What | Chain | Amount | Faucet |
|------|-------|--------|--------|
| KITE gas ⚠️ CRITICAL | Kite AI | 1 KITE | https://faucet.gokite.ai |
| Gas budget (ETH) | Arbitrum Sepolia | 0.02 ETH | https://faucet.quicknode.com/arbitrum/sepolia |
| Trading USDC | Arbitrum Sepolia | 1000+ USDC | https://staging.aave.com/faucet/ |

**MAINNET:**

| What | Chain | Amount | How |
|------|-------|--------|-----|
| KITE gas ⚠️ CRITICAL | Kite AI | 1–5 KITE (~$0.05) | Ask Kite Discord. Cannot be bridged from other chains. |
| Gas budget (ETH) | Arbitrum | 0.005 ETH (~$12) | Buy on Coinbase, withdraw to “Arbitrum” network |
| Trading USDC | Arbitrum | Any amount | Buy USDC on Coinbase, withdraw to Arbitrum |

**The agent auto-bridges** ETH from Arbitrum to Base/Optimism when those chains run low. You never fund Base, Optimism, Polygon, or Avalanche directly.

**Ethereum L1 is excluded** — gas fees ($10–50/tx) make autonomous execution uneconomical. All protocols on this list work identically on Arbitrum/Base.

Verify your funding:
```bash
kard gas
```

---

## Step 4 — Add Your AI Provider Key

| Provider | Env variable | Get key at |
|---------|-------------|-----------|
| **Anthropic (Claude)** | `ANTHROPIC_API_KEY` | console.anthropic.com |
| **OpenAI (GPT)** | `OPENAI_API_KEY` | platform.openai.com |
| **DeepSeek** | `DEEPSEEK_API_KEY` | platform.deepseek.com |
| **Grok (xAI)** | `GROK_API_KEY` | console.x.ai |
| **Gemini** | `GEMINI_API_KEY` | aistudio.google.com |
| **OpenRouter** | `OPENROUTER_API_KEY` | openrouter.ai |
| **Ollama (local, free)** | No key needed | ollama.com |

```bash
# Mac/Linux
export ANTHROPIC_API_KEY=sk-ant-your-key-here

# Or create .env file:
ANTHROPIC_API_KEY=sk-ant-your-key-here
LLM_PROVIDER=anthropic
KARD_ENV=testnet
GAS_BUDGET_ETH=0.02

# Free local model
ollama pull llama3.1
```

---

## Step 5 — Run Your First Strategy

```bash
# Check gas is funded on all chains
kard gas

# Preview a strategy (no execution)
kard claude "park my USDC at the best yield available"

# Execute it
kard claude "park my USDC at the best yield available" --execute

# Start the autonomous agent
kard run --strategy KITE_YIELD --interval 60s
```

---

## Optional — Set Up Perps Trading (Hyperliquid)

```bash
export HYPERLIQUID_API_WALLET=0x<your-api-wallet-key>
export HYPERLIQUID_USER_ADDRESS=0x<your-main-address>
export HYPERLIQUID_NETWORK=testnet   # use 'mainnet' when ready
```

---

---

# SECTION 5 — MCP SERVER

## What is MCP?

MCP (Model Context Protocol) is a standard that lets AI tools like **Claude Desktop**, **Cursor**, and **Claude Code** call external tools directly. KARDS exposes an MCP server — meaning you can talk to your trading agent right inside your AI coding tool, no terminal switching required.

---

## Connect KARDS to Claude Desktop

### Step 1 — Find Your Claude Desktop Config File

**On Mac:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**On Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

### Step 2 — Add KARDS to the Config

Open the file and add this:

```json
{
  "mcpServers": {
    "kard": {
      "command": "npx",
      "args": ["-y", "@kard/agent", "mcp"]
    }
  }
}
```

If the file already has other MCP servers, just add the `"kard"` block inside `"mcpServers"`.

### Step 3 — Add Your API Key

KARDS needs to know your AI provider key. Add it to the same config:

```json
{
  "mcpServers": {
    "kard": {
      "command": "npx",
      "args": ["-y", "@kard/agent", "mcp"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key-here",
        "LLM_PROVIDER": "anthropic"
      }
    }
  }
}
```

### Step 4 — Restart Claude Desktop

Close and reopen Claude Desktop. You'll see a hammer icon in the chat input — that's KARDS tools being available.

### Step 5 — Test It

Type in Claude Desktop:
```
Use kard to show me live yield opportunities
```

Claude will call `kard.opportunities` and return live ranked yields right in the chat.

---

## Connect KARDS to Cursor

### Step 1 — Open Cursor Settings

Go to **Cursor → Settings → MCP** (or press `Cmd+,` / `Ctrl+,` and search for MCP).

### Step 2 — Add KARDS

Click **"Add MCP Server"** and fill in:

- **Name:** `kard`
- **Command:** `npx`
- **Args:** `-y @kard/agent mcp`
- **Environment:** `ANTHROPIC_API_KEY=sk-ant-your-key-here`

### Step 3 — Use It

In Cursor's AI panel, you can now say:
```
Compile a strategy to long ETH if RSI drops below 30 with 2% risk
```

Cursor will call `kard.compile` and return the structured strategy plan.

---

## Connect KARDS to Claude Code

Add to your project's `.claude/settings.json` or run:

```bash
claude mcp add kard npx -y @kard/agent mcp
```

Or manually:

```json
{
  "mcpServers": {
    "kard": {
      "command": "npx",
      "args": ["-y", "@kard/agent", "mcp"]
    }
  }
}
```

---

## MCP Tools Available

Once connected, your AI tool can call any of these:

| Tool | What it does |
|------|-------------|
| `kard.compile` | Turns plain English into a structured strategy plan |
| `kard.opportunities` | Returns live ranked yield opportunities across all chains |
| `kard.attest_verify` | Decodes and verifies an on-chain attestation by tx hash |
| `kard.passport.address` | Returns your Kite Passport wallet address |
| `kard.passport.pay` | Sends a payment through your Passport session |
| `kard.goal.set` | Sets an autonomous goal for the agent |
| `kard.fleet_state` | Returns snapshot of all running agents in your fleet |
| `kard.skill.list` | Lists all installed skills |
| `kard.skill.run` | Runs a specific skill manually |
| `kard.skill.search` | Searches the skill marketplace |
| `kard.skill.install` | Installs a skill from the marketplace |

### Example Conversations in Claude Desktop

**Find yield:**
```
Ask kard to show me the best yield opportunities for USDC right now
```

**Compile a strategy:**
```
Use kard to compile this strategy: long BTC if RSI drops below 28, take profit at 10%, stop loss at 5%
```

**Check attestations:**
```
Use kard to verify the attestation for tx 0x123abc...
```

**Set a goal:**
```
Tell kard my goal is to grow my portfolio by 5% over the next 2 weeks
```

---

## Start the MCP Server Manually

If you want to run the MCP server yourself (for custom setups):

```bash
kard mcp
```

Or using npx without installing globally:

```bash
npx @kard/agent mcp
```

---

---

# SECTION 6 — CLI FULL REFERENCE

The `kard` command is the main way to interact with KARDS from your terminal.

---

## Interactive Mode

```bash
kard
```

Opens the REPL — a live chat session with your agent. Type strategies, ask questions, give commands. Hit `Ctrl+C` to exit.

---

## Compile a Strategy

Use any provider name as the sub-command:

```bash
kard claude "your strategy in plain English"
kard gpt "your strategy in plain English"
kard deepseek "your strategy in plain English"
kard gemini "your strategy in plain English"
kard ollama "your strategy in plain English"
```

This shows you a preview of what the agent would do — without executing anything.

**To actually execute:**
```bash
kard claude "long ETH 2x if RSI < 30, stop at 8%" --execute
```

---

## Run the Autonomous Agent

```bash
# Start with the default KITE_YIELD strategy, checks every 60 seconds
kard run

# Run a specific strategy
kard run --strategy KITE_YIELD
kard run --strategy CONSERVATIVE
kard run --strategy BALANCED
kard run --strategy AGGRESSIVE
kard run --strategy USDT_YIELD
kard run --strategy PERPS_TRADER

# Change how often it checks
kard run --strategy KITE_YIELD --interval 30s
kard run --strategy PERPS_TRADER --interval 1m
kard run --strategy CONSERVATIVE --interval 5m

# Override the AI provider for this run
kard run --strategy KITE_YIELD --provider deepseek
```

---

## Goal Mode

Set a plain English goal — the agent figures out how to achieve it on its own.

```bash
kard goal "raise my portfolio by 5% in 2 weeks"
kard goal "maximize yield on my stablecoins"
kard goal "keep my portfolio balanced and safe"
kard goal "just trade"
```

Goals persist across restarts. The agent adapts its strategy based on whether it's making progress.

---

## Wallet & Passport

```bash
# Create a Kite Passport account
kard passport signup you@example.com

# Verify your account
kard passport verify <8-character-code>

# Get your wallet address (send funds here)
kard passport address

# Check your Passport status
kard passport status

# View active sessions
kard passport sessions

# Make a manual payment through Passport
kard passport pay 0xRecipient 10 USDC

# Set up a local wallet (alternative to Passport)
kard init

# Wallet management
kard wallet list
kard wallet add
kard wallet import
kard wallet address
```

---

## Market Data

```bash
# See live yield opportunities ranked from best to worst
kard opportunities

# Check your gas balances on every connected chain
kard gas
```

---

## Backtesting

```bash
# Test a strategy against historical data
kard backtest claude "long ETH if RSI < 30" --from 2024-01-01 --to 2024-06-01
kard backtest gpt "park USDC at highest yield" --from 2024-03-01 --to 2024-09-01
```

---

## Run as a Background Daemon (24/7)

```bash
# Start as a daemon (runs forever in the background)
kard daemon

# Daemon with a specific strategy and check interval
kard daemon --strategy PERPS_TRADER --interval 30s

# Daemon with a goal
kard daemon --goal "raise my portfolio 5% in 2 weeks"

# Daemon with a specific AI provider
kard daemon --provider deepseek

# Daemon with a progress report every 5 minutes
kard daemon --goal "grow portfolio" --report 5m
```

---

## Emergency Stop

```bash
# STOP ALL AGENTS IMMEDIATELY
kard kill on

# Resume after emergency stop
kard kill off
```

`kard kill on` halts every running agent instantly. Use it if anything looks wrong.

---

## Attestations & Verification

```bash
# List all execution attestations
kard attest list

# Verify a specific attestation on-chain
kard attest verify 0xYourTxHashHere
```

---

## Strategy Management

```bash
# List all available strategies
kard strategy list

# Search the strategy marketplace
kard strategy search "yield"
kard strategy search "perps"

# Install a strategy from the marketplace
kard strategy install <strategy-name>

# Save your current strategy
kard strategy save

# Publish your strategy to the marketplace
kard strategy publish
```

---

## Skills

Skills give your agent new capabilities — market data feeds, new venues, custom APIs. Add them with a single markdown file.

```bash
# List installed skills
kard skill list

# Install a skill from a local file
kard skill add ./my-skill.md

# Install from the marketplace
kard skill install defillama-yields

# Search available skills
kard skill search "yield"

# Remove a skill
kard skill remove my-skill

# Test a skill directly
kard skill run coingecko-price get_price ids=bitcoin,ethereum
kard skill run defillama-yields pools
kard skill run hyperliquid-funding
```

**Built-in skills that come pre-loaded:**
- `coingecko-price` — live spot prices for any coin
- `defillama-yields` — best yield pools across all of DeFi
- `hyperliquid-funding` — live funding rates on Hyperliquid perps
- `fear-greed` — crypto fear & greed index
- `cryptopanic-news` — latest crypto news
- `pyth-prices` — high-frequency Pyth Network price feeds
- `coinglass-funding` — funding rates across all major exchanges
- `etherscan-history` — wallet transaction history

---

## Policy — Control What Your Agent Can and Cannot Do

Lock down exactly what your agent is allowed to do. These rules are enforced at three separate layers — the LLM prompt, the action filter, and the execution layer.

```bash
# See current policy
kard config show

# Reset all policy to defaults
kard config reset

# --- ACTIONS ---
# Block specific action types
kard config deny actions perps_open perps_close    # never trade perps
kard config deny actions bridge                    # never bridge funds
kard config deny actions swap                      # never swap tokens

# Allow only specific action types
kard config allow actions lending_supply swap       # only yield and swaps

# --- CHAINS ---
# Only use specific chains
kard config allow chains kiteai arbitrum           # kite and arbitrum only

# Block specific chains
kard config deny chains avalanche polygon          # never touch these
kard config deny chains ethereum                   # avoid mainnet gas costs

# Undo a block
kard config undeny chains avalanche

# --- VENUES ---
# Block a specific protocol or exchange
kard config deny venues hyperliquid                # never use Hyperliquid
kard config deny venues gmx                        # never use GMX

# --- ASSETS ---
# Only allow specific tokens
kard config allow assets USDC USDT                 # stablecoins only
kard config allow assets USDC USDT WETH            # add ETH

# --- DISCOVER AVAILABLE OPTIONS ---
kard config venues          # list all venues you can allow/deny
kard config actions         # list all action types
```

---

## Multi-Agent Fleet

Run multiple agents at once, each with a different AI model, strategy, and risk profile.

```bash
# Run a fleet from a config file
kard fleet run examples/fleet.yml

# Fleet with a custom interval
kard fleet run fleet.yml --interval 60s
```

**Example fleet.yml:**
```yaml
provider: anthropic    # default for the whole fleet

agents:
  - id: yield-hunter
    provider: claude
    goal: "park USDC at highest yield"
    strategy: KITE_YIELD

  - id: perps-trader
    provider: deepseek
    strategy: PERPS_TRADER

  - id: safe-guard
    provider: ollama
    model: llama3.1
    strategy: CONSERVATIVE

  - id: rebalancer
    provider: openai
    model: gpt-4o-mini
    goal: "keep portfolio balanced"
    strategy: BALANCED
```

Up to 100 agents. All share the same risk engine. Each thinks independently.

---

## Chat Integrations

The Telegram bot is a full AI chatbot — not slash commands. Just send any message in plain English.

```bash
# Telegram (AI chatbot)
TELEGRAM_BOT_TOKEN=your-token TELEGRAM_ALLOW_USERS=123456789 kard chat telegram

# Discord
DISCORD_BOT_TOKEN=your-token kard chat discord

# Slack
SLACK_BOT_TOKEN=your-bot-token SLACK_APP_TOKEN=your-app-token kard chat slack
```

**Telegram — how it actually works (any natural language):**
```
You: "how's my portfolio?"
Bot: "You're at $1,247. $800 in Aave at 5.8%, $200 idle. ETH up 3.2%."

You: "put the idle USDC somewhere better"
Bot: "Best right now: Morpho Base 8.4%. Move $190 USDC?
      Confirm? yes / no"

You: "yes"
Bot: "✅ Done.
      🔗 Transaction: 0x4a7f...
      ⛓ Kite attestation: 0x9f3e...
      https://kitescan.ai/tx/0x9f3e..."

You: "stop the agent"
Bot: "⏹ Agent loop paused."

You: "I want 5% gain this month"
Bot: "🎯 Goal set. I'll adapt strategy every 15 min."
```

The bot remembers your last 10 messages. It always asks for confirmation before executing any trade or capital movement.

---

## Payments & Streams

```bash
# Stream 10% of revenue to a recipient every second, max $1000/day
kard pay-stream 0xPayeeAddress --pct 0.10 --basis revenue --interval 1s --cap-day 1000

# Fixed payment every 5 seconds to an x402 service
kard pay-stream https://api.someservice.io/pay --fixed 0.001 --interval 5s
```

---

## Simulation & Verification

```bash
# Simulate a transaction before sending (free, no gas)
kard simulate '{"to":"0x...","value":"0","data":"0x..."}' --chain arbitrum

# Verify Lucid protocol ABI matches what KARDS expects (run before mainnet)
kard verify-lucid USDC
```

---

## MCP Server (manual start)

```bash
kard mcp
```

---

---

# SECTION 7 — BUILT-IN STRATEGIES

Nine strategies ready to use out of the box. Activate any of them with `kard run --strategy <NAME>`.

---

## CONSERVATIVE
**Risk level: Low** | **Target: ~3% APY**

Safe and slow. Most of your capital goes into Aave lending where it earns interest. A large reserve stays untouched. Good if you want yield without worrying about losses.

- 60% lent on Aave for stable yield
- 10% kept liquid for quick swaps
- 30% untouched reserve
- Rebalances only when things drift more than 10%

```bash
kard run --strategy CONSERVATIVE
```

---

## BALANCED
**Risk level: Medium** | **Target: ~6% APY**

Middle ground. Decent yield with some flexibility to move capital where it's needed.

- 40% lending
- 30% liquid for opportunities
- 30% reserve
- Rebalances at 5% drift

```bash
kard run --strategy BALANCED
```

---

## AGGRESSIVE
**Risk level: Higher** | **Target: ~12% APY**

Chases returns. Less reserve, more capital deployed.

- 50% lending
- 40% liquid and active
- Only 10% kept back
- Rebalances at 3% drift

```bash
kard run --strategy AGGRESSIVE
```

---

## USDT_YIELD
**Risk level: Low-Medium** | **Target: ~8% APY**

Everything centers on USDT. Automatically swaps your DAI and USDC into USDT then lends it on Aave.

- 70% lent in USDT on Aave
- Always keeps at least $500 USDT in wallet
- Consolidates other stablecoins into USDT automatically
- 20% reserve, 10% liquid

```bash
kard run --strategy USDT_YIELD
```

---

## KITE_YIELD
**Risk level: Low** | **Target: ~7% APY**

Parks idle USDC into Kite AI via the Lucid protocol (L-USDC). Every cycle it compares Lucid's yield against native Aave rates and routes to whichever is higher. Fully attested on Kite.

- 50% in L-USDC on Kite AI
- 30% in direct Aave lending as backup
- 5% liquid
- 15% reserve
- Minimum $50 to bother moving (bridge fees not worth it below that)

```bash
kard run --strategy KITE_YIELD
```

---

## PERPS_TRADER
**Risk level: High** | **Target: ~20% (variable)**

Trades perpetual futures on Hyperliquid. The AI suggests long/short entries based on RSI, price action, and funding rates. The risk engine validates every trade — hard 5x leverage cap, 2% equity at risk per trade.

- Trades BTC, ETH, SOL, ARB, AVAX
- 70% of capital deployable as margin
- 30% reserve (kept back for defense)
- Avoids longs when funding rates are extreme
- Defaults to testnet — explicitly flip to mainnet when ready

```bash
kard run --strategy PERPS_TRADER
```

---

## LP_FARMER
**Risk level: Medium** | **Target: ~15% APY**

Provides liquidity to DEX pools and earns trading fees. Splits capital across Uniswap V3 concentrated liquidity positions and Aerodrome pools on Base. Beefy auto-compounds the LP rewards for higher effective yield.

- 40% Uniswap V3 USDC/USDT (stable pair, 0.01% fee tier, very low IL)
- 20% Uniswap V3 ETH/USDC (higher fees, some impermanent loss)
- 20% Aerodrome stablecoin pools on Base (+ AERO rewards)
- 10% Beefy auto-compounding on top
- 10% reserve
- Automatically collects fees every cycle
- Re-ranges out-of-range positions automatically

```bash
kard run --strategy LP_FARMER
```

---

## DELTA_NEUTRAL
**Risk level: Low-Medium** | **Target: ~12% APY**

Market-neutral yield farming. Holds a long spot position and a short perp position on the same asset — dollar exposure cancels out. Earns LP fees from the spot position plus funding payments from the short. Portfolio value stays stable regardless of crypto price direction.

- 40% long ETH spot (on Arbitrum)
- 35% short ETH perp on Hyperliquid (hedges the spot)
- 25% reserve (buffer for margin calls and rebalancing)
- Re-hedges automatically if delta drifts more than 5%
- Only opens hedge when funding pays shorts (negative funding = free hedge)

```bash
kard run --strategy DELTA_NEUTRAL
```

---

## FULL_STACK
**Risk level: Medium** | **Target: ~18% APY**

Uses every yield source KARDS supports simultaneously. The yield aggregator picks the best allocation each cycle and rebalances if any protocol offers 1%+ better than the current position.

- 20% Aave V3 (battle-tested baseline)
- 15% Lucid L-USDC on Kite AI (Kite-native yield)
- 15% Morpho Blue (better rates than Aave)
- 10% Compound V3 (diversification)
- 15% Uniswap V3 LP (fee income)
- 10% Beefy auto-compounding
- 5% Pendle fixed-yield PT tokens
- 10% reserve
- No perps — yield-only by default

```bash
kard run --strategy FULL_STACK
```

---

---

# SECTION 8 — SKILLS SYSTEM

Skills are markdown files that teach KARDS new capabilities. Drop one in a folder, restart the agent, and it knows how to use that data source or API.

---

## How to Create a Skill

Create a file called `SKILL.md`:

```yaml
---
name: my-data-feed
description: Explains what this skill does in one line. The AI reads this.
triggers: [keyword, "phrase that activates this skill"]
tools:
  - id: get_data
    description: What this specific tool does
    endpoint: GET https://api.example.com/data?id={id}
    params:
      id: the ID to look up
permissions:
  network: [example.com]
  reads: true
  writes: false
---

# Any extra notes for the agent go here in regular markdown
# Rate limits, edge cases, tips — the AI reads all of this
```

## Install It

```bash
kard skill add ./my-data-feed.md
```

That's it. The next time the agent cycles, it sees the skill and can use it.

## Where KARDS Looks for Skills

KARDS automatically loads skills from these locations in this order:

1. `skills/builtin/` — comes bundled with KARDS
2. `./skills/` — your current project folder
3. `~/.kard/skills/` — your global user skills folder
4. `$KARD_SKILLS_DIR/` — any custom path you set

---

## Self-Learning (Fleet Mode)

In fleet mode, after 50 profitable cycles in the same pattern, the agent can *write its own skill* — capturing the heuristic as a `.md` file and sharing it with other agents in your fleet.

Turn on auto-publishing to share skills publicly:
```bash
KARD_AUTOPUBLISH_SKILLS=1 kard fleet run fleet.yml
```

---

---

# SECTION 9 — DEPLOYMENT

## Run on Your PC (Development)

Just use the CLI — no extra setup needed:

```bash
kard run --strategy KITE_YIELD
```

---

## Run 24/7 on a Server

### Option 1 — Docker (Easiest for servers)

```bash
# Clone the repo
git clone https://github.com/your-org/kards kard
cd kard

# Copy the example env file and fill in your keys
cp .env.example .env
# Open .env in any text editor and add your API keys

# Start everything
docker compose up -d

# Watch the logs
docker compose logs -f kard

# Stop
docker compose down
```

The container:
- Auto-restarts if it crashes
- Exposes no ports (outbound-only — no attack surface)
- Saves your keystore and settings to `./data/` on your host machine so they survive restarts

---

### Option 2 — Cloud Platform (Vercel / Railway / Render / Fly.io)

1. Fork or clone the KARDS repo
2. Connect it to your cloud platform
3. Set your environment variables in the platform's dashboard
4. Mount a persistent volume at `/data` so your keystore survives redeploys

The included `Dockerfile` works with all of these out of the box.

---

### Option 3 — Linux Server (Advanced)

For a full Linux VPS setup with auto-restart via systemd:

```bash
# Install globally
sudo npm install -g @kard/agent

# Create a dedicated user
sudo useradd -m -s /bin/bash kard
sudo mkdir -p /home/kard/.kard
sudo chmod 700 /home/kard/.kard

# Add your env file (keep this chmod 600 — it has sensitive keys)
sudo nano /home/kard/.kard/env
sudo chmod 600 /home/kard/.kard/env

# Install and enable the systemd service
sudo cp examples/kard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kard

# Watch logs
journalctl -u kard -f
```

The systemd unit auto-restarts on crash, restricts filesystem access, and memory-caps the process.

---

### Connect Telegram to Your Server Daemon

Once the daemon is running with `TELEGRAM_BOT_TOKEN` set in your `.env`, the bot is live immediately. Message it from your phone:

```
/status
/earnings
/goal grow my portfolio 5% this month
/stop
/start
```

---

---

# SECTION 10 — BRING YOUR OWN MODEL (BYOM)

KARDS never forces you to use a specific AI. Every model is treated equally — KARDS just sends the strategy prompt and reads the JSON response.

## Supported Providers

| Provider | Default Model | Environment Variable |
|---------|--------------|---------------------|
| **Anthropic** | claude-haiku-4-5 | `ANTHROPIC_API_KEY` |
| **OpenAI** | gpt-4o-mini | `OPENAI_API_KEY` |
| **xAI (Grok)** | grok-beta | `GROK_API_KEY` |
| **Google** | gemini-1.5-flash | `GEMINI_API_KEY` |
| **DeepSeek** | deepseek-chat | `DEEPSEEK_API_KEY` |
| **OpenRouter** | anthropic/claude-haiku | `OPENROUTER_API_KEY` |
| **Ollama** | llama3 (local) | No key needed |

## Switch Providers Per Command

```bash
kard claude "long ETH if RSI < 30"
kard deepseek "park stables at best yield"
kard gpt "hedge BTC exposure"
kard ollama "rebalance my portfolio"
```

## Mix Providers in a Fleet

```yaml
agents:
  - id: conservative-agent
    provider: ollama          # free, local, no API cost
    model: llama3.1
    strategy: CONSERVATIVE

  - id: perps-agent
    provider: deepseek        # cheap, fast
    strategy: PERPS_TRADER

  - id: yield-agent
    provider: claude          # strong reasoning for complex yield decisions
    strategy: KITE_YIELD
```

## Use a Completely Local Model (No Internet, No Cost)

```bash
# Install Ollama
# Mac: brew install ollama
# Windows/Linux: ollama.com/download

# Pull a model
ollama pull llama3.1

# Run KARDS with it
kard run --strategy CONSERVATIVE --provider ollama
```

---

---

# SECTION 11 — KITE AI ATTESTATIONS

Every action KARDS takes creates a verifiable record on Kite AI. You can always prove what happened, when, why the AI decided it, and what the outcome was.

## What's in Every Attestation

| Field | What it contains |
|-------|----------------|
| Agent ID | Which agent took this action |
| Action Type | What kind of action (supply, swap, perp, bridge…) |
| Action Target | The token, chain, or venue involved |
| Reasoning | Why the AI suggested this action |
| Confidence Score | How sure the AI was (0 to 1) |
| Risk Score | How risky this action was rated |
| Policy Checks | Which safety rules ran and passed |
| Transaction Hash | The on-chain proof |
| Timestamp | Exactly when it happened |
| Execution Result | Success or failure, and why |
| Agent Signature | Cryptographically signed by your agent's wallet |

## Two Attestation Modes

**Self-attestation (default):** A zero-cost transaction on Kite AI with the action data in the calldata. No contract needed.

**Contract attestation:** Calls a deployed `KardAttestor.sol` smart contract that emits indexed events — searchable by agent, strategy, or goal on any block explorer.

## Verify an Attestation

```bash
kard attest verify 0xYourTxHashHere
```

## Export Your Attestation History

```bash
# List all attestations
kard attest list

# Export as JSON (via API)
GET /api/attestations?format=json

# Export as CSV (via API)
GET /api/attestations?format=csv
```

---

---

# SECTION 12 — CUSTODY MODEL

You own everything. KARDS owns nothing.

| Layer | What it holds | Who controls it |
|-------|--------------|----------------|
| **Kite Passport** | Your USDC on Kite | You, via passkey on your device |
| **Operator key** | A small amount of gas on each chain | Your machine — encrypted in `~/.kard/wallet.json` |
| **Hyperliquid API wallet** | Trading authority only (not funds) | Your `.env` file |

KARDS the software runs as a process on your machine. It never has a server-side wallet. It never has access to your seed phrase. If you stop the process, your money stays exactly where it is.

---

---

# SECTION 13 — WHAT KARDS SUPPORTS

## DeFi Protocols

| Category | Protocol | Chains |
|---------|---------|--------|
| Perps | Hyperliquid | Testnet + Mainnet |
| Perps | GMX V2 | Arbitrum |
| Lending | Aave V3 | Arbitrum, Base, Optimism, Polygon, Avalanche |
| Lending | Morpho Blue | Base, Arbitrum |
| Lending | Compound V3 | Arbitrum, Base |
| Yield | Lucid L-USDC | Kite AI (minted from Arbitrum) |
| Yield | Pendle PT | Arbitrum, Base |
| Yield | Lido wstETH | Arbitrum, Base |
| Yield | EtherFi weETH | Arbitrum, Base |
| Yield | Beefy vaults | Arbitrum, Base, Avalanche, Polygon |
| LP | Uniswap V3 | Arbitrum, Base |
| LP | Aerodrome | Base |
| Bridge | Across Protocol | Arbitrum → Base/Optimism/Polygon |
| Bridge | Lucid (LayerZero) | USDC: Arbitrum ↔ Kite AI |
| Bridge | USDT0 (LayerZero) | Arbitrum ↔ Berachain ↔ Ink |

## Chains

| Chain | What it's used for |
|-------|-------------------|
| **Kite AI** | Attestations, L-USDC settlement, the primary verification layer |
| **Arbitrum** | Aave V3, Morpho, Compound, Uniswap V3 LP, GMX V2, Hyperliquid collateral, Lucid minting |
| **Base** | Aerodrome LP, Aave V3, Morpho, Compound, Uniswap V3 LP, Pendle |
| **Optimism** | Aave V3 yield |
| **Polygon** | Aave V3 yield (MATIC gas = very cheap) |
| **Avalanche** | Aave V3, Lucid collateral lock chain |
| ~~Ethereum L1~~ | ❌ Excluded — gas fees $10–50/tx make autonomous execution uneconomical |

## Bridge Reality (What Can and Cannot Be Bridged)

| What | Direction | How | Status |
|------|-----------|-----|--------|
| USDC | Arbitrum → Kite AI | Lucid mint | ✅ |
| USDC | Kite AI → Arbitrum | Lucid burn | ✅ |
| ETH | Arbitrum → Base | Across | ✅ Auto |
| ETH | Arbitrum → Optimism | Across | ✅ Auto |
| USDT0 | Arbitrum ↔ Berachain | LayerZero OFT | ✅ |
| KITE | Any chain → Kite AI | No bridge exists | ❌ Must fund manually |

## Action Types Your Agent Can Execute

- Open and close long or short perpetual positions
- Supply to and withdraw from Aave, Morpho, and Compound
- Provide concentrated liquidity on Uniswap V3
- Provide liquidity on Aerodrome (with AERO rewards)
- Deposit into Beefy auto-compounding vaults
- Mint and burn L-USDC via Lucid on Kite AI
- Buy Pendle PT for fixed yield
- Stake into Lido wstETH or EtherFi weETH
- Swap tokens through 1inch/CowSwap/AMM
- Bridge assets cross-chain via Across or LayerZero
- Defend positions from liquidation automatically
- Stream programmable payments via x402
- Emit alerts without executing (monitoring mode)

---

---

# SECTION 14 — FAQ

**Do I need to know how to code?**
No. You write strategies in plain English. The CLI is just typing commands. If you can use a terminal, you can run KARDS.

**Can the AI blow up my account?**
The risk engine exists specifically to prevent this. Ten hard safety rules always run before any action — leverage caps, position size limits, gas reserve checks, health factor protection. The AI suggests. The rules decide. You also control the policy layer to block entire chains, venues, or action types.

**Can I use a free AI model?**
Yes. Install Ollama and pull any local model — Llama 3.1, Mistral, whatever you like. No API key, no cost, fully offline.

**Do I need Kite Passport?**
No. Kite Passport is optional. The default wallet is a local encrypted keystore created with `kard init`. Your private key stays on your machine.

**What are attestations?**
A cryptographically signed, timestamped record on Kite AI proving what the agent did, why it decided to do it, and what happened. Think of it as a receipt that nobody can fake or alter.

**Can I run multiple strategies at once?**
Yes. Stack custom rules on a single agent, or run a full fleet of agents — each with their own strategy and AI model — from one YAML file.

**Is this testnet or mainnet?**
Both. Set `KARD_ENV=testnet` for testnet or `KARD_ENV=mainnet` for mainnet. Hyperliquid defaults to testnet regardless of `KARD_ENV`. When you're ready for mainnet perps, set `HYPERLIQUID_NETWORK=mainnet`.

**What if I want to stop everything right now?**
```bash
kard kill on
```
One command. Stops every agent immediately.

**Does KARDS have a server or SaaS?**
No. It runs entirely on your machine. There is no KARDS cloud. No login. No monthly subscription. Your keys, your machine, your agent.

**How do I keep it running 24/7?**
Use Docker with the included `docker-compose.yml`, or deploy to Railway / Render / Fly.io using the included `Dockerfile`. See the Deployment section.

**Can agents teach themselves new capabilities?**
Yes. In fleet mode, after 50 profitable cycles in the same pattern, the agent writes a skill file capturing the heuristic and shares it with other agents in your fleet.

**What does BYOM mean?**
Bring Your Own Model. KARDS never forces you to use a specific AI provider. You pick the model, you supply the API key, you switch whenever you want.

---

---

# SECTION 15 — QUICK REFERENCE CARD

Print this. Put it next to your keyboard.

```
INSTALL         npm install -g @kard/agent
FIRST RUN       kard passport signup you@email.com
FUND WALLET     kard passport address  →  send USDC there
COMPILE         kard claude "your strategy"
EXECUTE         kard claude "your strategy" --execute
AUTO LOOP       kard run --strategy KITE_YIELD --interval 60s
GOAL MODE       kard goal "grow my portfolio 5% this month"
FLEET           kard fleet run fleet.yml
YIELDS          kard opportunities
GAS CHECK       kard gas
ATTESTATIONS    kard attest list
VERIFY TX       kard attest verify 0x<txhash>
BACKTEST        kard backtest claude "strategy" --from 2024-01-01 --to 2024-06-01
EMERGENCY STOP  kard kill on
RESUME          kard kill off
MCP SERVER      kard mcp
REPL            kard
DAEMON          kard daemon --strategy KITE_YIELD
HELP            kard help
```

---

*KARDS — From Intelligence to Execution.*
*Apache-2.0 — open source, free to use, free to extend.*
