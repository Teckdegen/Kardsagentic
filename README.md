# @kard/agent

Self-hosted agentic-trading runtime for Kite.

---

## Install

```bash
# 1. Install Kite Agent Passport (you control spending, not the agent)
curl -fsSL https://agentpassport.ai/install.sh | bash

# 2. Install Kard
npm install -g @kard/agent
```

Requires **Node ≥ 22**.

---

## Set up

```bash
# 1. Create your Kite Passport account
kard passport signup you@example.com
# → check email, click verification link, set up passkey
kard passport verify <8-char-code>

# 2. Fund your Passport wallet — get the address, send USDC on Kite
kard passport address

# 3. Add your LLM API key(s) to your shell or a .env file:
#    Pick any one to start; you can mix them across agents later.
export ANTHROPIC_API_KEY=sk-ant-…           # Claude
export OPENAI_API_KEY=sk-…                  # GPT
export DEEPSEEK_API_KEY=…                   # DeepSeek
export OPENROUTER_API_KEY=…                 # any model on OpenRouter
# Or run a local model — no key needed:
# brew install ollama && ollama pull llama3.1

# 4. Optional: set up Hyperliquid for real perp execution
export HYPERLIQUID_API_WALLET=0x<api-wallet-pk>
export HYPERLIQUID_USER_ADDRESS=0x<your-main-address>
export HYPERLIQUID_NETWORK=testnet
```

---

## Run

```bash
# Interactive REPL (default)
kard

# One-shot strategy compile (dry-run preview)
kard claude   "long ETH 3x if 1h funding is negative; risk 2%"
kard deepseek "park USDC at highest yield"
kard gpt      "hedge BTC if it drops 5%"

# Actually submit
kard claude "long BTC 2x" --execute

# Autonomous loop
kard run --strategy KITE_YIELD --interval 60s

# Self-evolving — set a goal, agent figures out how
kard goal "raise my portfolio by 5% in 2 weeks"
kard goal "just trade"

# Multi-agent fleet — up to 100 agents, mix any LLM providers
kard fleet run examples/fleet.yml --interval 60s

# Live ranked yield opportunities
kard opportunities

# Kill switch (stops every agent immediately)
kard kill on
kard kill off

# Chat front-ends
TELEGRAM_BOT_TOKEN=… kard chat telegram
DISCORD_BOT_TOKEN=…  kard chat discord
SLACK_BOT_TOKEN=… SLACK_APP_TOKEN=… kard chat slack

# MCP server (Claude Code, Cursor, Claude Desktop)
kard mcp
```

---

## Mix LLM providers in one fleet

Edit `examples/fleet.yml`:

```yaml
provider: anthropic     # default

token_budget_per_min:
  anthropic: 200000
  deepseek:  1000000
  openai:    150000
  ollama:    9999999

agents:
  - id: alpha
    provider: claude              # ← per-agent override
    goal: "park USDC at highest yield"
    strategy: KITE_YIELD
    account: 0

  - id: beta
    provider: deepseek            # different brain
    goal: "rebalance stables"
    strategy: USDT_YIELD
    account: 1

  - id: gamma
    provider: openai
    model: gpt-4o-mini
    strategy: PERPS_TRADER
    account: 2

  - id: delta
    provider: ollama              # local, free
    model: llama3.1
    strategy: CONSERVATIVE
    account: 3
```

Run:

```bash
kard fleet run examples/fleet.yml
```

All agents share the wallet keystore, skill registry, strategy library, and
the fleet-wide risk engine. Each thinks with its own model.

---

## Add a skill (give the agent a new capability)

Drop a markdown file:

```yaml
---
name: my-data-feed
description: My data API. Use when the user asks for X.
triggers: [my-feed, special data]
tools:
  - id: get
    endpoint: GET https://api.example.com/v1/data?id={id}
    params: { id: data id }
permissions:
  network: [example.com]
---

# Free-form notes the agent reads
```

Save as `~/.kard/skills/my-data-feed/SKILL.md` or run:

```bash
kard skill add ./my-data-feed.md
kard skill list
```

---

## Common commands

```
kard                              REPL
kard help                         all commands
kard <provider> "<text>"          compile (--execute submits)
kard run                          autonomous loop
kard goal "<text>"                self-evolving goal mode
kard fleet run <yml>              multi-agent (up to 100)
kard backtest <provider> "<text>" --from <date> --to <date>
kard opportunities                live ranked yield
kard skill <list|add|remove|run>
kard strategy <list|install|publish|search|save>
kard chat <telegram|discord|slack>
kard passport <signup|verify|address|sessions|pay|status>
kard attest <list|verify <txHash>>
kard pay-stream <recipient> --pct N --basis revenue --interval Ns
kard simulate '{tx}' --chain X
kard kill <on|off>                global circuit breaker
kard wallet <list|add|import|address>
kard init                         local wallet (alt to Passport)
kard mcp                          stdio MCP server
kard gas                          native balances on every chain
kard verify-lucid USDC            ABI sanity check
```

---

---

## Pick your chains / venues / actions

Kard ships with a hard policy layer. Tell it what you don't want and the
agent literally can't do it (LLM is told, aggregator filters, execute()
vetoes — three independent enforcement points).

```bash
# show current policy
kard config show

# don't trade perps (anywhere, ever)
kard config deny actions perps_open perps_close

# stay only on these chains
kard config allow chains kiteai arbitrum

# never touch a specific chain
kard config deny chains avalanche celo

# ban a venue entirely
kard config deny venues hyperliquid

# only stables
kard config allow assets USDC USDT USDC.e

# undo
kard config undeny chains avalanche
kard config reset

# discover the names you can use
kard config venues
kard config actions
```

The policy file is `~/.kard/config.json`. Survives restarts. Applied on
every cycle.

---

## Run it on a real server (24/7 + Telegram)

Three ways. Pick whichever you like.

### 1. Docker (any VPS / Hetzner / DigitalOcean / EC2)

```bash
git clone <your-fork-or-package>  kard
cd kard
cp .env.example .env
# fill in: KARD_PASSWORD, ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, etc.
docker compose up -d
docker compose logs -f kard       # watch it boot, agent address prints
```

The compose file persists `~/.kard` to `./data/` on the host so the
encrypted keystore + ledger + goals + streams survive container
restarts. Container exposes **no ports** — kard is outbound-only. Auto-
restarts on crash.

### 2. systemd (bare-metal Linux server)

```bash
# on the server:
sudo useradd -m -s /bin/bash kard
sudo -u kard mkdir -p /home/kard/.kard
sudo -u kard chmod 700 /home/kard/.kard

# put your env file there (chmod 600 — contains your password)
sudo -u kard nano /home/kard/.kard/env
sudo -u kard chmod 600 /home/kard/.kard/env

# clone + install
sudo -u kard git clone <your-package> /home/kard/kard
cd /home/kard/kard && sudo -u kard npm install --omit=dev

# install service unit
sudo cp examples/kard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kard

# logs
journalctl -u kard -f
```

The systemd unit hardens the process (no new privileges, read-only
home, restricted address families, memory cap) and auto-restarts.

### 3. Render / Railway / Fly.io / Northflank

Use the `Dockerfile`. Set the env vars in the platform's dashboard. Mount
a persistent volume at `/data` so `~/.kard` survives redeploys.

---

### Connect Telegram

Once the daemon is running with `TELEGRAM_BOT_TOKEN` in env, the bot is
already live. Just message it:

```
/help                 list commands
/status               portfolio + active strategy + best opportunity
/earnings             total PnL, by source, by symbol
/report               full snapshot
/goal raise 5% in 2 weeks
/compile long ETH 3x if RSI < 30
/execute long ETH 2x take profit 8%      (gated by TELEGRAM_ALLOW_USERS)
/skill list
/start  /stop                            agent loop control
```

Message any of these from your phone, the daemon executes them on the
server. `/execute` requires both `KARD_ALLOW_EXECUTE=1` and your user ID
in `TELEGRAM_ALLOW_USERS`.

To get your Telegram user ID: message `@userinfobot` and copy the number.

### Daemon mode flags

```bash
kard daemon                              defaults: KITE_YIELD strategy, 60s loop
kard daemon --strategy PERPS_TRADER --interval 30s
kard daemon --goal "raise 5% in 2 weeks" --report 5m
kard daemon --provider deepseek          override default LLM
```

The daemon auto-attaches every chat platform whose tokens it finds in
env. Set `TELEGRAM_BOT_TOKEN` only and you get Telegram only. Set all
three and the same agent answers from all three.

---

## Deploy the docs site to Vercel

The `docs-site/` directory is a standalone Vite + React + Tailwind v4 app
that explains how to install and run Kard. To deploy:

1. Import the repo at **https://vercel.com/new** → `Teckdegen/Kardsagentic`
2. In the import screen, expand **"Root Directory"** and click **Edit**
3. Select **`docs-site`** as the root directory
4. Framework preset: **Vite** (auto-detected)
5. Click **Deploy**

That's it. Vercel only builds the frontend — the agent runtime in `src/`
is outside the scope of the deploy and gets ignored automatically.

```bash
# locally
cd docs-site
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs to docs-site/dist
```

---

## License

Apache-2.0
