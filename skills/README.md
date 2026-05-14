# Kard Skills

A **skill** is a single `.md` file that teaches the Kard agent a new
capability — a market data API, a new venue, a domain heuristic, a custom
rule, anything.

## Format

```yaml
---
name: my-skill
description: One-line summary the LLM reads.
triggers: [keyword, phrase, "another phrase"]
tools:
  - id: do_a_thing
    description: What this tool does
    endpoint: GET https://api.example.com/foo?bar={bar}
    params:
      bar: description of param
  - id: do_with_code
    description: Run JS instead of HTTP
    kind: js
    script: ./impl.js
    export: default
permissions:
  network: [example.com]
  reads: true
  writes: false
---

# Free-form markdown body

The LLM reads this on every cycle when the skill is relevant. Use it for
detailed instructions, edge cases, rate limits, anything you'd tell a
junior engineer.
```

## Where Kard looks for skills

In order (later wins on duplicate names):

1. `<package>/skills/builtin/*/SKILL.md` (bundled)
2. `./skills/**/SKILL.md` (project-local — the dir you run `kard` from)
3. `~/.kard/skills/**/SKILL.md` (user-global — your machine)
4. `$KARD_SKILLS_DIR/**/SKILL.md` (explicit)

## Adding skills

```bash
# from a local file (copies to ~/.kard/skills/<name>/SKILL.md)
npx @kard/agent skill add ./my-skill.md

# list what's loaded
npx @kard/agent skill list

# remove
npx @kard/agent skill remove my-skill

# call a skill directly to verify
npx @kard/agent skill run coingecko-price get_price ids=bitcoin,ethereum
```

## How the agent uses skills

Every cycle the agent's LLM gets the skill registry summarised in its system
prompt. When a strategy matches a skill's triggers, the LLM emits an action:

```json
{ "type": "skill", "name": "defillama-yields", "tool": "pools", "params": {} }
```

The runtime executes it (HTTP or JS), passes the result back to the LLM on
the next sub-turn, and the strategy proceeds with that data in hand. No code
change needed to teach the agent a new API — drop a `.md` and restart.

## Built-in skills

- `coingecko-price` — spot prices from CoinGecko
- `defillama-yields` — best yield pools, filterable by chain/asset
- `hyperliquid-funding` — live perp funding across all Hyperliquid markets
