import { useState } from 'react'
import { cn } from '../lib/cn'

export default function Docs () {
  return (
    <div className="max-w-[700px] mx-auto py-16 px-6 md:px-10">

      <Section id="quickstart" title="Quick Start">
        <P>Get Kard running in under 5 minutes. You need <B>Node.js 22+</B> and one API key (or Ollama for free local models).</P>
        <Code code={`npm install -g kard-agent
kard init
export ANTHROPIC_API_KEY=sk-ant-your-key
kard claude "park my USDC at the highest yield"
kard run --strategy KITE_YIELD --interval 60s`} />
        <Callout type="info">That's it. The agent is now scanning 8 protocols across 5 chains every 60 seconds, executing the best yield opportunity, and attesting every action on Kite AI.</Callout>
      </Section>

      <Section id="demo" title="Demo">
        <P>Run a complete end-to-end demonstration in under 60 seconds. Perfect for seeing everything Kard can do without any setup beyond an LLM key.</P>
        <Code code={`kard demo`} />
        <P>The demo will:</P>
        <P>1. Create/unlock an agent wallet</P>
        <P>2. Connect to Kite AI + Arbitrum chains</P>
        <P>3. Compile a strategy from natural language using AI</P>
        <P>4. Scan DeFi protocols for live yield opportunities</P>
        <P>5. Simulate execution with risk + policy checks</P>
        <P>6. Attest the action on Kite AI (verifiable on-chain)</P>
        <P>7. Query the agent's on-chain reputation score</P>
        <Code code={`# Run with real testnet execution
kard demo --execute

# Use a specific LLM provider
kard demo --provider deepseek

# Use free local model
kard demo --provider ollama`} />
        <Callout type="tip">Judges: run <code>kard demo</code> to see the full system in action. No testnet funds required for the default dry-run mode.</Callout>
      </Section>

      <Section id="install" title="Installation">
        <H3>Option A — npm (recommended)</H3>
        <P>Install globally as a CLI tool. No cloning needed.</P>
        <Code code={`npm install -g kard-agent
kard help`} />
        <Callout type="tip">Or use without installing: <code>npx kard-agent help</code></Callout>
        <H3>Option B — from source</H3>
        <P>Clone the repo if you want to modify the code or contribute.</P>
        <Code code={`git clone https://github.com/Teckdegen/Kardsagentic kard
cd kard
npm install
npm link    # makes 'kard' available globally`} />
        <P>Verify:</P>
        <Code code={`kard help`} />
        <H3>Use as an SDK</H3>
        <P>Import into your own Node.js project:</P>
        <Code code={`npm install kard-agent`} />
        <Code code={`import { createAgent, compileStrategy } from 'kard-agent'

// Compile a strategy from plain English
const plan = await compileStrategy("park USDC at highest yield", {
  provider: 'anthropic'
})

// Create and run an agent
const agent = await createAgent({
  provider: 'anthropic',
  strategy: 'KITE_YIELD'
})
agent.start(60_000) // check every 60s`} />
      </Section>

      <Section id="wallet" title="Wallet Setup">
        <P>Kard creates an encrypted keystore at <code>~/.kard/wallet.json</code>. Your private key never leaves your machine.</P>
        <Code code={`# Create a new wallet
kard init

# View your address (send funds here)
kard wallet address

# List all wallets
kard wallet list

# Import an existing private key
kard wallet import`} />
        <Callout type="warning">Write down your seed phrase when it appears. It's shown ONCE and cannot be recovered.</Callout>
        <P>Alternatively, use an existing key via environment variable:</P>
        <Code code={`export PRIVATE_KEY=0xYourPrivateKeyHere
export KARD_PASSWORD=your-encryption-password`} />
      </Section>

      <Section id="llm" title="LLM Configuration">
        <P>Kard is BYOM — Bring Your Own Model. Pick any provider or use multiple across agents in a fleet.</P>
        <H3>Supported providers</H3>
        <Table headers={['Provider', 'Env Variable', 'Default Model']} rows={[
          ['Anthropic (Claude)', 'ANTHROPIC_API_KEY', 'claude-haiku-4-5'],
          ['OpenAI (GPT)', 'OPENAI_API_KEY', 'gpt-4o-mini'],
          ['DeepSeek', 'DEEPSEEK_API_KEY', 'deepseek-chat'],
          ['xAI (Grok)', 'GROK_API_KEY', 'grok-beta'],
          ['Google (Gemini)', 'GEMINI_API_KEY', 'gemini-1.5-flash'],
          ['OpenRouter', 'OPENROUTER_API_KEY', 'any model'],
          ['Ollama (local)', 'No key needed', 'llama3.1'],
        ]} />
        <Code code={`# Set your provider
export ANTHROPIC_API_KEY=sk-ant-...
export LLM_PROVIDER=anthropic

# Or use a free local model
ollama pull llama3.1
export LLM_PROVIDER=ollama`} />
        <P>Test your LLM connection:</P>
        <Code code={`kard claude "say hello in 5 words"
kard deepseek "what is 2+2"
kard ollama "hello"`} />
      </Section>

      <Section id="funding" title="Funding (Testnet)">
        <P>You fund <B>three things</B>. The agent handles everything else — including auto-bridging gas to other chains.</P>
        <H3>Testnet faucets (all free)</H3>
        <Table headers={['What', 'Chain', 'Amount', 'Faucet']} rows={[
          ['KITE gas ⚠️', 'Kite AI', '1 KITE', 'faucet.gokite.ai'],
          ['Gas (ETH)', 'Arbitrum Sepolia', '0.02 ETH', 'faucet.quicknode.com/arbitrum/sepolia'],
          ['Trading USDC', 'Arbitrum Sepolia', '1000 USDC', 'staging.aave.com/faucet/'],
        ]} />
        <Callout type="warning">KITE on Kite AI is critical — without it, attestations will fail. This cannot be auto-bridged.</Callout>
        <P>Verify your funding:</P>
        <Code code={`kard gas`} />
        <P>Expected output:</P>
        <Code code={`Arbitrum Sepolia   ETH  0.020000  ✓ OK
Base Sepolia       ETH  0.020000  ✓ OK
Kite AI            KITE 1.000000  ✓ OK

✓ Gas budget healthy on all chains.`} />
        <Callout type="info">The agent auto-bridges ETH from Arbitrum to Base/Optimism when those chains run low. You never manually fund Base, Optimism, Polygon, or Avalanche.</Callout>
      </Section>

      <Section id="first-run" title="First Run">
        <H3>1. Compile a strategy (dry-run, no execution)</H3>
        <Code code={`kard claude "park USDC at the highest sustainable yield"
kard deepseek "long ETH if RSI drops below 30, risk 2%"
kard gpt "hedge my BTC exposure"`} />
        <H3>2. See live yield opportunities</H3>
        <Code code={`kard opportunities`} />
        <H3>3. Execute a strategy</H3>
        <Code code={`kard claude "park USDC at highest yield" --execute`} />
        <H3>4. Run autonomous loop</H3>
        <Code code={`kard run --strategy KITE_YIELD --interval 60s`} />
        <H3>5. Goal mode — AI figures it out</H3>
        <Code code={`kard goal "grow my portfolio 5% in 2 weeks"
kard goal "maximize yield, no perps"
kard goal "just trade"`} />
        <H3>6. Interactive REPL</H3>
        <Code code={`kard`} />
        <P>Opens a live chat session with your agent. Type strategies, ask questions, give commands.</P>
      </Section>

      <Section id="strategies" title="Strategies">
        <P>8 built-in strategies. Activate with <code>--strategy NAME</code>.</P>
        <Table headers={['Strategy', 'Risk', 'Target APY', 'What it uses']} rows={[
          ['CONSERVATIVE', 'Low', '~3%', 'Aave lending only'],
          ['KITE_YIELD', 'Low', '~7%', 'Lucid L-USDC + Aave (Kite-native)'],
          ['USDT_YIELD', 'Low-Med', '~8%', 'USDT consolidation + Aave'],
          ['BALANCED', 'Medium', '~6%', 'Aave + liquidity'],
          ['DELTA_NEUTRAL', 'Low-Med', '~12%', 'Long spot + short perp'],
          ['LP_FARMER', 'Medium', '~15%', 'Uniswap V3 + Aerodrome + Beefy'],
          ['FULL_STACK', 'Medium', '~18%', 'All protocols combined'],
          ['PERPS_TRADER', 'High', '~20%', 'Hyperliquid + GMX perps'],
        ]} />
        <Code code={`kard run --strategy KITE_YIELD --interval 60s
kard run --strategy PERPS_TRADER --interval 30s
kard run --strategy FULL_STACK --interval 5m

# Override LLM provider for this run
kard run --strategy KITE_YIELD --provider deepseek

# List all strategies
kard strategy list

# Save/publish custom strategies
kard strategy save
kard strategy publish`} />
      </Section>

      <Section id="strategy-marketplace" title="Strategy Marketplace">
        <P>A trust-minimized marketplace where strategy performance claims are cryptographically verifiable on Kite AI. Authors attest their backtest results on-chain — buyers can verify before installing.</P>
        <H3>Publish with attestation proof</H3>
        <Code code={`# Publish a strategy with on-chain backtest proof
kard strategy publish KITE_YIELD --attest --from 2024-01-01 --to 2024-06-01

# The backtest runs, results are attested on Kite AI,
# and the strategy + proof are pushed to the marketplace`} />
        <H3>Browse proven strategies</H3>
        <Code code={`# Browse marketplace (shows attestation status)
kard strategy browse

# Search for specific strategies
kard strategy browse "yield"

# Output:
#   ✓ proven  KITE_YIELD           Park USDC at highest yield (12.4% return)
#   ✓ proven  DELTA_NEUTRAL        Market-neutral via spot+perp (8.2% return)
#     unproven RISKY_DEGEN         Leverage everything 10x`} />
        <H3>Verify a strategy's proof</H3>
        <Code code={`# Verify on-chain — fetches the attestation tx from Kite AI
kard strategy verify KITE_YIELD

# Output:
#   ✓ Strategy attestation VERIFIED
#   Tx:      0x4a7f...
#   Agent:   0x9f3e...
#   Block:   1234567
#   Explorer: https://kitescan.ai/tx/0x4a7f...`} />
        <Callout type="info">Attestation proofs are permanent and verifiable by anyone. The backtest was actually run by the author's agent and recorded on Kite AI's chain (2366).</Callout>
      </Section>

      <Section id="policy" title="Safety & Policy">
        <P>Three independent enforcement layers: LLM prompt, action filter, and execute() veto. Configure once, agent obeys forever.</P>
        <Code code={`# View current policy
kard config show

# ─── ACTIONS ───
kard config deny actions perps_open perps_close
kard config deny actions bridge
kard config allow actions lending_supply swap

# ─── CHAINS ───
kard config allow chains kiteai arbitrum
kard config deny chains avalanche polygon ethereum

# ─── VENUES ───
kard config deny venues hyperliquid gmx

# ─── ASSETS ───
kard config allow assets USDC USDT WETH

# ─── UNDO ───
kard config undeny chains avalanche
kard config reset

# ─── DISCOVER OPTIONS ───
kard config venues
kard config actions

# ─── EMERGENCY STOP ───
kard kill on     # stops ALL agents immediately
kard kill off    # resume`} />
        <Callout type="warning"><code>kard kill on</code> is instant and absolute. Use it if anything looks wrong.</Callout>
      </Section>

      <Section id="risk-limits" title="Risk Limits">
        <P>Set your own maximum drawdown, leverage caps, position sizes, and more. These are hard limits — the agent cannot exceed them regardless of what the AI suggests.</P>
        <H3>View current limits</H3>
        <Code code={`kard risk show`} />
        <H3>Set custom limits</H3>
        <Code code={`# Max daily drawdown before agent halts (default: 8%)
kard risk set max_drawdown 5

# Max gross leverage (default: 3x)
kard risk set max_leverage 2

# Absolute leverage cap — never exceeded (default: 5x)
kard risk set hard_max_leverage 3

# Max % of equity in any single market (default: 20%)
kard risk set max_per_market 15

# Max % in correlated assets (default: 50%)
kard risk set max_bucket 40

# Max single position in USD (default: $1,000,000)
kard risk set max_position_usd 10000

# Skip trades below this USD value (default: $5)
kard risk set min_trade_usd 10`} />
        <H3>Reset to defaults</H3>
        <Code code={`kard risk reset`} />
        <H3>Set via environment variables</H3>
        <Code code={`# Add to .env:
KARD_MAX_DRAWDOWN=5
KARD_MAX_LEVERAGE=2
KARD_HARD_MAX_LEVERAGE=3
KARD_MAX_PER_MARKET=15
KARD_MAX_BUCKET=40
KARD_MAX_POSITION_USD=10000
KARD_MIN_TRADE_USD=10`} />
        <Callout type="info">Limits set via CLI (saved to ~/.kard/risk-limits.json) take priority over env vars. Both override the code defaults.</Callout>
        <Callout type="warning">If daily drawdown hits your limit, the agent halts ALL trading until the next 24h window. Use <code>kard kill off</code> to manually resume if needed.</Callout>
      </Section>

      <Section id="yields" title="Yield Opportunities">
        <Code code={`kard opportunities`} />
        <P>Returns live ranked yields across all connected protocols:</P>
        <Code code={`📊 Live Yield Opportunities

 1. Morpho USDC (Base)        8.4% APY   low risk    $85M TVL
 2. Lucid L-USDC (Kite AI)    7.2% APY   low risk    $45M TVL
 3. Aave USDC (Arbitrum)      5.8% APY   low risk    $900M TVL
 4. Compound USDC (Arbitrum)  5.4% APY   low risk    $340M TVL
 5. Pendle PT-USDC (Base)     9.1% APY   fixed       $8M TVL
 6. Uniswap V3 USDC/USDT     12.3% APY  LP fees     $28M TVL`} />
      </Section>

      <Section id="attestations" title="Attestations">
        <P>Every action Kard takes creates a verifiable record on Kite AI (chainId 2366).</P>
        <Code code={`# List all attestations
kard attest list

# Verify a specific attestation
kard attest verify 0xYourTxHashHere`} />
        <P>Each attestation contains: agent ID, action type, reasoning, confidence score, risk score, policy checks, tx hash, timestamp, and execution result.</P>
        <Callout type="info">Two modes: self-attestation (zero-cost tx with calldata) or contract attestation (KardAttestor.sol with indexed events).</Callout>
      </Section>

      <Section id="reputation" title="Reputation">
        <P>On-chain reputation derived from your attestation history on Kite AI. Every attested action contributes to a public, verifiable trust score. Higher reputation = more trusted agent.</P>
        <H3>Check your score</H3>
        <Code code={`kard reputation`} />
        <P>Example output:</P>
        <Code code={`🃏 Kard Agent Reputation

  Address:        0x9f3e...4a7f
  Score:          247
  Tier:           gold
  Chain:          Kite AI (2366)

  Breakdown:
    Base (attestations × 10):   180
    Profit bonus:               45
    Failure penalty:             -6
    Streak bonus:               16
    Age bonus:                  12

  Stats:
    Total attestations:  18
    Profitable:          9
    Failed:              2
    Success rate:        81.8%
    Longest streak:      8
    Active since:        24 days`} />
        <H3>Check any agent</H3>
        <Code code={`kard reputation show 0xSomeAgentAddress`} />
        <H3>Leaderboard</H3>
        <Code code={`kard reputation leaderboard 0xAgent1 0xAgent2 0xAgent3`} />
        <H3>Tier system</H3>
        <Table headers={['Tier', 'Score', 'Meaning']} rows={[
          ['Legendary', '1000+', 'Proven track record, hundreds of successful attestations'],
          ['Diamond', '500-999', 'Highly active, consistently profitable'],
          ['Gold', '200-499', 'Established agent with solid history'],
          ['Silver', '100-199', 'Active agent building reputation'],
          ['Bronze', '25-99', 'New but showing activity'],
          ['Newcomer', '1-24', 'Just getting started'],
        ]} />
        <Callout type="info">Reputation is fully on-chain and verifiable. Anyone can query an agent's attestation history on Kite AI and independently compute the score.</Callout>
      </Section>

      <Section id="fleet" title="Multi-Agent Fleet">
        <P>Run up to 100 agents simultaneously. Each with a different LLM, strategy, and risk profile. All share the risk engine.</P>
        <Code code={`kard fleet run examples/fleet.yml --interval 60s`} />
        <P>Example <code>fleet.yml</code>:</P>
        <Code code={`provider: anthropic

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
    strategy: BALANCED`} />
      </Section>

      <Section id="chat" title="Telegram / Discord / Slack">
        <P>Full AI chatbot — not slash commands. Message in plain English.</P>
        <Code code={`# Telegram
export TELEGRAM_BOT_TOKEN=<token>
export TELEGRAM_ALLOW_USERS=<your-user-id>
export KARD_ALLOW_EXECUTE=1
kard chat telegram

# Discord
export DISCORD_BOT_TOKEN=<token>
kard chat discord

# Slack
export SLACK_BOT_TOKEN=<token>
export SLACK_APP_TOKEN=<token>
kard chat slack`} />
        <P>Example Telegram conversation:</P>
        <Code code={`You: "how's my portfolio?"
Bot: "You're at $1,247. $800 in Aave at 5.8%, $200 idle."

You: "put the idle USDC somewhere better"
Bot: "Best: Morpho Base 8.4%. Move $190? yes/no"

You: "yes"
Bot: "✅ Done. tx: 0x4a7f... | Kite: 0x9f3e..."

You: "stop the agent"
Bot: "⏹ Agent loop paused."`} />
      </Section>

      <Section id="perps" title="Perps Trading">
        <P>Trade perpetual futures on Hyperliquid (testnet by default) and GMX V2.</P>
        <Code code={`# Setup
export HYPERLIQUID_NETWORK=testnet
export HYPERLIQUID_API_WALLET=0x<api-wallet-private-key>
export HYPERLIQUID_USER_ADDRESS=0x<your-main-address>

# Trade via natural language
kard claude "long ETH 3x if funding is negative" --execute
kard deepseek "short BTC 2x, stop 5%, TP 10%" --execute

# Autonomous perps strategy
kard run --strategy PERPS_TRADER --interval 30s

# Delta neutral (market-neutral yield)
kard run --strategy DELTA_NEUTRAL --interval 60s`} />
        <Callout type="warning">Risk per trade is capped at 2% of equity. Max leverage: 5x. These are hard limits enforced by the risk engine.</Callout>
      </Section>

      <Section id="skills" title="Skills System">
        <P>Skills are markdown files that teach Kard new capabilities. Drop one in a folder and the agent learns it on next reload.</P>
        <Code code={`# List installed skills
kard skill list

# Add a skill from file
kard skill add ./my-skill.md

# Run a skill directly
kard skill run coingecko-price get_price ids=bitcoin,ethereum
kard skill run defillama-yields pools
kard skill run hyperliquid-funding
kard skill run fear-greed
kard skill run cryptopanic-news

# Search marketplace
kard skill search "yield"

# Install from marketplace
kard skill install defillama-yields

# Remove
kard skill remove my-skill`} />
        <P>Built-in skills: coingecko-price, defillama-yields, hyperliquid-funding, fear-greed, cryptopanic-news, pyth-prices, coinglass-funding, etherscan-history.</P>
      </Section>

      <Section id="backtest" title="Backtesting">
        <Code code={`kard backtest claude "long ETH if RSI < 30" --from 2024-01-01 --to 2024-06-01
kard backtest deepseek "park stables at best yield" --from 2024-03-01 --to 2024-09-01`} />
      </Section>

      <Section id="passport" title="Wallet & Passport">
        <H3>Kite Passport (optional)</H3>
        <Code code={`kard passport signup you@email.com
kard passport verify <8-char-code>
kard passport address
kard passport status
kard passport sessions
kard passport pay 0xRecipient 10 USDC`} />
        <H3>Local wallet</H3>
        <Code code={`kard init
kard wallet list
kard wallet add
kard wallet import
kard wallet address`} />
        <H3>Payment streams</H3>
        <Code code={`kard pay-stream 0xPayee --pct 0.10 --basis revenue --interval 1s --cap-day 1000`} />
      </Section>

      <Section id="mcp" title="MCP Server">
        <P>Use Kard from Claude Desktop, Cursor, or Claude Code.</P>
        <Code code={`# Start MCP server
kard mcp`} />
        <H3>Claude Desktop config</H3>
        <Code code={`{
  "mcpServers": {
    "kard": {
      "command": "npx",
      "args": ["-y", "kard-agent", "mcp"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-your-key",
        "LLM_PROVIDER": "anthropic"
      }
    }
  }
}`} />
        <H3>Available MCP tools</H3>
        <Table headers={['Tool', 'What it does']} rows={[
          ['kard.compile', 'Plain English → structured strategy'],
          ['kard.opportunities', 'Live ranked yield opportunities'],
          ['kard.attest_verify', 'Verify an on-chain attestation'],
          ['kard.goal.set', 'Set an autonomous goal'],
          ['kard.skill.list', 'List installed skills'],
          ['kard.skill.run', 'Run a skill manually'],
          ['kard.fleet_state', 'Snapshot of all running agents'],
        ]} />
      </Section>

      <Section id="deploy" title="Deploy 24/7">
        <H3>Docker (recommended)</H3>
        <Code code={`cp .env.example .env
# fill: KARD_PASSWORD, ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, etc.
docker compose up -d
docker compose logs -f kard`} />
        <H3>systemd (bare-metal Linux)</H3>
        <Code code={`sudo cp examples/kard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kard
journalctl -u kard -f`} />
        <H3>Daemon mode</H3>
        <Code code={`kard daemon
kard daemon --strategy PERPS_TRADER --interval 30s
kard daemon --goal "grow 5% this month" --report 5m
kard daemon --provider deepseek`} />
        <H3>Cloud platforms</H3>
        <P>Push the included Dockerfile to Render, Railway, Fly.io, or Northflank. Mount a volume at <code>/data</code> so the keystore survives redeploys.</P>
      </Section>

      <Section id="mainnet" title="Go Mainnet">
        <Callout type="warning">Only go mainnet after testnet has run clean for at least a week.</Callout>
        <Code code={`export KARD_ENV=mainnet
export HYPERLIQUID_NETWORK=mainnet

kard run --strict          # refuses to start on ABI mismatch
kard verify-lucid USDC     # sanity-checks Lucid controllers`} />
        <P>Mainnet funding:</P>
        <Table headers={['What', 'Chain', 'Amount', 'How']} rows={[
          ['KITE gas', 'Kite AI', '1-5 KITE (~$0.05)', 'Ask Kite Discord'],
          ['Gas (ETH)', 'Arbitrum', '0.005 ETH (~$12)', 'Coinbase → Arbitrum'],
          ['Trading USDC', 'Arbitrum', 'Any amount', 'Coinbase → Arbitrum'],
        ]} />
        <P>Before production: confirm KARD_PASSWORD is set, tighten policy, set risk limits low, verify Telegram allow-list, test kill switch.</P>
      </Section>

      <Section id="rpc" title="Custom RPC Endpoints">
        <P>By default Kard uses public RPCs. If you get rate-limited or want faster execution, set your own endpoints from providers like Alchemy, Infura, or QuickNode.</P>
        <Code code={`# Add to your .env file:

# Kite AI (required for attestations)
KITE_RPC_URL=https://rpc.gokite.ai

# Arbitrum
ARB_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
ARB_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc

# Base
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Optimism
OP_RPC_URL=https://mainnet.optimism.io

# Polygon
POLYGON_RPC_URL=https://polygon-rpc.com

# Avalanche
AVAX_RPC_URL=https://api.avax.network/ext/bc/C/rpc`} />
        <Callout type="tip">For testnet, you only need <code>ARB_SEPOLIA_RPC_URL</code> and <code>KITE_RPC_URL</code>. The agent auto-detects which chains to use based on <code>KARD_ENV</code>.</Callout>
        <P>Free RPC providers:</P>
        <Table headers={['Provider', 'Free tier', 'URL']} rows={[
          ['Alchemy', '300M compute/month', 'alchemy.com'],
          ['Infura', '100K requests/day', 'infura.io'],
          ['QuickNode', '10M API credits', 'quicknode.com'],
          ['Ankr', 'Unlimited public', 'ankr.com'],
          ['Public (default)', 'Rate-limited', 'Built-in'],
        ]} />
      </Section>

      <Section id="all-commands" title="All Commands">
        <Code code={`kard                              Interactive REPL
kard help                         Show all commands
kard demo                         Full end-to-end demo (~30s)
kard demo --execute               Demo with real testnet execution
kard <provider> "<text>"          Compile strategy (dry-run)
kard <provider> "<text>" --execute Execute strategy
kard run                          Autonomous loop (default strategy)
kard run --strategy <NAME>        Run specific strategy
kard run --interval <time>        Set check interval (30s, 1m, 5m)
kard run --provider <name>        Override LLM provider
kard run --strict                 Refuse on ABI mismatch
kard goal "<text>"                Self-evolving goal mode
kard fleet run <yml>              Multi-agent fleet
kard fleet run <yml> --interval   Fleet with custom interval
kard daemon                       Background daemon mode
kard daemon --strategy <NAME>     Daemon with strategy
kard daemon --goal "<text>"       Daemon with goal
kard daemon --report <interval>   Progress reports
kard opportunities                Live ranked yield sources
kard gas                          Gas balances on all chains
kard gas --guide                  Funding instructions
kard reputation                   Your agent's on-chain reputation
kard reputation show <addr>       Check any agent's score
kard reputation leaderboard       Rank multiple agents
kard skill list                   List installed skills
kard skill add <file>             Install skill from file
kard skill remove <name>          Remove a skill
kard skill run <name> <tool>      Run skill tool directly
kard skill search "<query>"       Search marketplace
kard skill install <name>         Install from marketplace
kard strategy list                List all strategies
kard strategy save                Save current strategy
kard strategy publish --attest    Publish with on-chain proof
kard strategy verify <name>       Verify attestation proof
kard strategy browse [query]      Browse proven strategies
kard strategy search "<query>"    Search strategies
kard config show                  View current policy
kard config allow <type> <vals>   Allow chains/assets/actions
kard config deny <type> <vals>    Deny chains/venues/actions
kard config undeny <type> <vals>  Remove a deny rule
kard config reset                 Reset all policy
kard config venues                List available venues
kard config actions               List available actions
kard attest list                  List all attestations
kard attest verify <txHash>       Verify attestation on-chain
kard passport signup <email>      Create Kite Passport
kard passport verify <code>       Verify account
kard passport address             Get wallet address
kard passport status              Check status
kard passport sessions            View active sessions
kard passport pay <to> <amt> <tk> Send payment
kard chat telegram                Start Telegram bot
kard chat discord                 Start Discord bot
kard chat slack                   Start Slack bot
kard backtest <provider> "<text>" Backtest a strategy
kard simulate '{tx}' --chain X    Simulate a transaction
kard pay-stream <to> --pct N      Programmable payment stream
kard kill on                      EMERGENCY STOP all agents
kard kill off                     Resume after stop
kard wallet list                  List wallets
kard wallet add                   Add new wallet
kard wallet import                Import private key
kard wallet address               Show current address
kard init                         Create local wallet
kard mcp                          Start MCP server
kard verify-lucid USDC            Verify Lucid ABI`} />
      </Section>

    </div>
  )
}

// ─── Components ───

function Section ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 mb-20 pb-20 border-b border-[#111] last:border-0">
      <h2 className="text-[22px] font-bold text-white mb-8 tracking-[-0.02em]">{title}</h2>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

function H3 ({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[14px] font-semibold text-white mt-8 mb-3 tracking-[-0.01em]">{children}</h3>
}

function P ({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-[#888] leading-[1.7]">{children}</p>
}

function B ({ children }: { children: React.ReactNode }) {
  return <span className="text-white font-medium">{children}</span>
}

function Callout ({ type, children }: { type: 'info' | 'warning' | 'tip'; children: React.ReactNode }) {
  const styles = {
    info: 'border-[#1a2a4a] bg-[#0a1020] text-[#7aa2d4]',
    warning: 'border-[#3a2a10] bg-[#1a1508] text-[#c4a44a]',
    tip: 'border-[#1a3a2a] bg-[#081a10] text-[#6ab88a]',
  }
  return (
    <div className={`flex items-start gap-3 rounded-md border px-4 py-3 text-[12px] leading-[1.6] ${styles[type]}`}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5 opacity-60">
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 7v4M8 5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <span>{children}</span>
    </div>
  )
}

function Table ({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-[#111]">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-[#111]">
            {headers.map(h => <th key={h} className="text-left px-4 py-2.5 text-[#555] font-medium uppercase tracking-wider text-[11px]">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[#0a0a0a] last:border-0">
              {row.map((cell, j) => <td key={j} className="px-4 py-2.5 text-[#888]">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Code ({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="relative group rounded-md border border-[#111] bg-[#060606] overflow-hidden">
      <button
        onClick={copy}
        className={cn(
          'absolute top-2.5 right-2.5 z-10 px-2 py-0.5 rounded text-[10px] font-mono',
          'text-[#333] hover:text-white transition-all',
          'opacity-0 group-hover:opacity-100',
          copied && 'opacity-100 text-[#6ab88a]'
        )}
      >
        {copied ? 'copied' : 'copy'}
      </button>
      <pre className="p-4 text-[12px] leading-[1.8] text-[#999] overflow-x-auto font-mono whitespace-pre-wrap">
        <code>{code}</code>
      </pre>
    </div>
  )
}
