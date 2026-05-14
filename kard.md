# kard.md — what Kard is

Self-hosted agentic-trading runtime for the Kite ecosystem.
You type a strategy in plain English. Money moves on-chain.
Every action is verifiable on Kite. You hold every key.

---

## The one-paragraph version

Kard is software you run on your own machine that takes natural-language
trading and treasury instructions, decomposes them into structured plans,
validates them through a deterministic risk engine, executes them across
yield protocols and perp DEXes, and writes a verifiable record of every
action onto KiteAI. It supports any LLM you bring (Claude, GPT, DeepSeek,
Ollama, OpenRouter), any number of agents at once (up to 100 per device),
and lets agents teach themselves new capabilities by writing `.md` skill
files that propagate across the fleet. Kite Passport holds your USDC and
gates spending by passkey-approved sessions; Kard never custodies funds.

---

## What it does, end to end

1. **Listens** for intent — CLI, REPL, chat (Telegram/Discord/Slack), or
   programmatic SDK call.

2. **Compiles** intent → structured strategy via your chosen LLM. Output is
   a JSON action plan: `lending_supply`, `lucid_mint`, `perps_open`,
   `swap`, `bridge`, `skill` invocations, etc.

3. **Validates** the plan through a Risk Engine — hard veto on actions that
   exceed per-market exposure caps, correlated-bucket caps, gross leverage,
   or daily drawdown limits. Plus a kill-switch file that halts everything.

4. **Pre-flights** every transaction with `eth_call` (free) or an Anvil
   fork (full state simulation if `KARD_SIM_RPC` is set). Reverts caught
   before signing.

5. **Routes** swaps through best-of: 1inch Fusion → CowSwap → on-chain AMM
   (Uniswap, Aerodrome). Dynamic slippage from book depth.

6. **Executes** on the right chain. Lucid mints originate on Arbitrum.
   Hyperliquid trades go through your authorized API wallet. Aave supplies
   land on whatever chain has the best APY. KiteAI is the settlement layer.

7. **Reconciles** every cycle — diffs the agent's belief about positions
   against ground truth, self-heals dropped or replaced txs.

8. **Attests** every successful action on KiteAI. Two modes: a simple
   self-tx (zero-value tx with the action hash in calldata) or a real
   `KardAttestor.sol` contract that emits indexed events.

9. **Learns**. Every 20 cycles the agent distils a 200-word memo of what
   worked and what didn't from its history; the memo gets folded into the
   system prompt for the next cycle. Every 50 cycles, fleet agents may
   *author a new SKILL.md* capturing a recurring profitable pattern, and
   broadcast it to peers.

10. **Pays**. Programmable x402 streams: "pay this service 10% of revenue
    every second, capped at $1k/day." Streams persist and auto-rearm on
    restart.

---

## Architecture

```
NATURAL LANGUAGE  ─────►  LLM (BYOM)  ─────►  STRATEGY AST
                                              │
                                              ▼
                                       RISK ENGINE  (hard veto)
                                              │
                                              ▼
                                       SIMULATOR    (eth_call / Anvil)
                                              │
                                              ▼
                  ┌──────────────────────────────────────────────────┐
                  │                  EXECUTION                       │
                  │                                                  │
                  │  Aave V3 ─ supply, withdraw, monitor health      │
                  │  Lucid Kite ─ mint L-USDC, burn back             │
                  │  Hyperliquid ─ perps via authorized API wallet   │
                  │  GMX V2 ─ perps on Arbitrum                      │
                  │  Pendle ─ fixed-yield PT/YT                      │
                  │  Lido / EtherFi ─ LRT routing (Arb/Base)         │
                  │  Aerodrome ─ Base swaps (V2 + Slipstream)        │
                  │  USDT0 / Lucid bridges ─ cross-chain moves       │
                  │  Uniswap V3 ─ AMM fallback                       │
                  │  1inch / CowSwap ─ RFQ-first routing             │
                  │  x402 ─ pay services / receive payments          │
                  │  Shell ─ run scripts (gated, deny-listed)        │
                  └──────────────────────────────────────────────────┘
                                              │
                                              ▼
                                       RECONCILER   (diff vs on-chain)
                                              │
                                              ▼
                                       KITE ATTESTATION   (verifiable)
                                              │
                                              ▼
                                       LEARNER      (self-distil prompt)
```

---

## Custody model

Three keys, all yours, all on your machine:

| Layer                | Holds                       | Custodied by         |
|----------------------|-----------------------------|----------------------|
| **Kite Passport**    | Your USDC on Kite           | You via passkey      |
| **Operator key**     | A few cents of gas / chain  | `~/.kard/wallet.json` (AES-encrypted) |
| **Hyperliquid API**  | Trading authority only      | `HYPERLIQUID_API_WALLET` env |

Kard the software runs as `node` on your machine. It never has a
server-side wallet, never has API keys to your funds, never sees your
seed phrase. The only thing it persists is the encrypted operator
keystore (which holds dust amounts of native gas tokens) and the
attestation log.

---

## Revenue mechanisms — how the agent makes money

The Yield Aggregator pulls live data from every supported rail every
cycle, ranks them by risk-adjusted APR, and feeds the top candidates
into the LLM's system prompt. The agent picks one (or a basket) per
cycle. None of these are predictions; they're observable on-chain rates
the agent reacts to.

| Mechanism                  | Source of yield                        | Typical APR  | Risk |
|----------------------------|----------------------------------------|--------------|------|
| Aave V3 stablecoin supply  | Borrower interest                      | 3–8%         | low  |
| Lucid L-USDC on KiteAI     | Aave on Arbitrum (90% of pool)         | 3–7% net     | low  |
| Pendle PT (fixed)          | Locked-in implied APY                  | 5–12%        | low–med |
| Lido wstETH (Arb/Base)     | ETH staking                            | 3–4%         | low  |
| EtherFi weETH (Arb/Base)   | ETH staking + restaking points         | 3–4% + pts   | low  |
| Hyperliquid funding arb    | Positive funding paid hourly           | 10–40%       | med  |
| Cross-chain stable rotation| APY differential between chains         | 1–3% spread  | low  |
| Cross-chain price arb      | Price difference between L2s           | gas-bounded  | low  |
| Directional perp trades    | Trend / mean-reversion / RSI signals    | high variance| med–high |
| LRT rotation               | Lido vs EtherFi APR differential       | small spread | low  |
| Liquidation defense        | Capital preservation                    | n/a          | n/a  |

The Goal Engine's outer loop ranks these candidates by
`expectedReturn / riskTier` and reinforces winners over time. After 50
profitable cycles in the same pattern, the FleetLearner can author a
SKILL.md capturing the heuristic and broadcast it to peer agents.

---

## Funding the wallet — chains and how to start

For testing, fund **as few as one chain** (KiteAI testnet) and you can
exercise the whole flow except perps.

### Minimum (1 chain — testnet only)

- **Kite testnet** — USDC for trading, KITE for gas.
  Get both from Passport's faucet after `kard passport signup`.

What you can do: Lucid mint/burn, attestations, x402 payments,
skill invocations, goal mode within stablecoin yield.

### Recommended (3 chains — testnet)

- **Kite testnet** — same as above
- **Arbitrum Sepolia** — for Lucid lock-chain origin, Aave testnet
  supply, GMX testnet trades, Hyperliquid testnet collateral.
  Faucet: https://faucet.quicknode.com/arbitrum/sepolia
- **Base Sepolia** — for Aerodrome and Pendle testnet.
  Faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

What you can do: everything except cross-chain LayerZero bridging
between mainnet-only chains and full Hyperliquid mainnet trading.

### Full (5 chains — testnet)

Add **Avalanche Fuji** (for AVAX-side Lucid testnet) and one of the
other chains in the registry as needed.

### Going to mainnet

Set `HYPERLIQUID_NETWORK=mainnet`, fund with real USDC via Kite Passport
on-ramp (credit card / ACH) or transfer from another wallet. Re-run
`kard verify-lucid USDC` first — it static-calls every Lucid controller
function to confirm the deployed ABI matches what Kard expects. Refuses
to start if you pass `--strict` and any selector mismatches.

---

## Multi-agent fleet (the agentic economy)

Up to 100 agents on one device. Each agent has its own:

- LLM provider (mix Claude / DeepSeek / GPT / OpenRouter / Ollama)
- Goal text
- Strategy preset
- Operator-key sub-account
- Identity (signed coordination messages)

All agents share:

- The skill registry (any agent-authored SKILL.md propagates fleet-wide)
- The strategy library
- A fleet-wide RiskEngine (global exposure caps across ALL agents combined)
- Per-provider token budgets (each LLM credit pool independent)
- A coordination channel for `intent` / `fill` / `skill_share` /
  `strategy_share` / `bid` / `ask` messages

Agents can yield to each other, hedge each other's positions, share
discovered strategies, and split work by universe restriction.

```bash
kard fleet run examples/fleet.yml
```

---

## Skills (`.md` capabilities)

A skill is a markdown file with YAML frontmatter:

```yaml
---
name: my-data-feed
description: One line the LLM reads.
triggers: [keyword, "phrase"]
tools:
  - id: get
    endpoint: GET https://api.example.com/v1/data?id={id}
permissions:
  network: [example.com]
  reads: true
  writes: false
---
```

Drop in `~/.kard/skills/<name>/SKILL.md`, restart the agent, the LLM
sees it in its system prompt and can emit `{ type: 'skill', name, tool,
params }` actions to invoke it.

Built-in skills include `coingecko-price`, `defillama-yields`,
`hyperliquid-funding`, and `shell-exec` (the agent can run terminal
commands and scripts, gated by deny-list and per-call confirmation).

Agents can author their own skills. After 50 cycles of profitable
behavior the FleetLearner asks the LLM to write a SKILL.md capturing
the pattern, drops it into the registry, and broadcasts it to peers.
With `KARD_AUTOPUBLISH_SKILLS=1` it pushes to the public marketplace.

---

## Goal Engine

Above the strategy layer. Takes a goal in plain English and figures out
*how* over time:

```
goal:    "raise my portfolio by 5% in 2 weeks"
   ↓
target:  { metric: portfolioUSD, op: '>=', value: baseline*1.05, deadline: ... }
   ↓
discover: LLM proposes 1–3 candidate strategies, sees:
            • live ranked yield opportunities
            • live funding rates
            • all installed skills
   ↓
choose:   pick by expectedReturn / risk
   ↓
enact:    set agent.strategy + custom rules
   ↓
measure:  did portfolio move toward goal?
   ↓
evolve:   reinforce winners, mutate losers
```

Open-ended goals work too: `kard goal "just trade"` triggers full
autonomous discovery. State persists to `~/.kard/goals.json`; goals
survive restarts.

---

## Kite attestation

Every successful execute() emits a tx on KiteAI. Two modes:

- **Self-attestation** (default, no contract needed): zero-value tx to
  signer.address with calldata `0x4b41524400 || keccak256(envelope) ||
  envelope-JSON`. The tx hash on KiteAI is the verifiable record.
- **Contract** (`KARD_ATTESTOR_ADDR=0x…`): calls
  `attest(bytes32 hash, bytes32 strategyId, bytes32 goalId, string uri)`
  on the deployed `KardAttestor.sol`. Indexed events let subgraphs and
  explorers aggregate by agent / strategy / goal.

The envelope contains: timestamp, cycle, agent address, strategy name,
the action (with private fields redacted), result, goal ID. Anyone can
fetch the tx, decompute the hash, and verify the agent's full reasoning
chain.

```bash
kard attest verify 0x<txHash>
```

---

## Programmable payments — x402 streams

```bash
# 10% of revenue every second, capped at $1000/day
kard pay-stream 0xPayee --pct 0.10 --basis revenue --interval 1s --cap-day 1000

# Pay an x402 service per call
kard pay-stream https://api.svc.io/pay --fixed 0.001 --interval 5s
```

Three formula kinds: `fixed`, `percent` (basis: revenue / pnl /
portfolio / delta), `callback` (SDK only). Caps: per-tick, per-day,
total. Streams persist to `~/.kard/streams.json` and auto-rearm on
restart so a server reboot doesn't drop your payment schedule.

---

## What Kard is not

- Not a hosted service. There is no Kard server. No SaaS sign-up.
- Not a custodian. Funds live in Kite Passport (yours) and the
  operator keystore (yours). Kard's process can be killed at any time
  and your money stays put.
- Not a black box. Every cycle's reasoning trail, every action's
  attestation, every skill the agent invokes is logged and queryable.
- Not coupled to one model. BYOM. Run different models on different
  agents in the same fleet.
- Not a web dashboard. CLI + chat (Telegram/Discord/Slack) + MCP only.

---

## What Kard is

Infrastructure for running autonomous economic agents on Kite. The kind
of thing that, ten years from now, every agent ought to have under it —
the deterministic plumbing between intent and execution, with verifiable
receipts and user-controlled custody. Today it does trading and yield;
the same primitives ship for any agentic-economic action you want to
delegate within your own constraints.
