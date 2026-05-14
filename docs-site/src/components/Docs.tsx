import { useState } from 'react'
import { motion } from 'motion/react'
import { cn } from '../lib/cn'

export default function Docs () {
  return (
    <div className="max-w-[900px] mx-auto mt-12 mb-24 px-6">
      <div className="text-center mb-16">
        <h1 className="text-[36px] md:text-[48px] font-black tracking-[-0.03em] text-white">Documentation</h1>
        <p className="mt-4 text-[15px] text-[#71717a]">Everything you need to install, configure, and run Kard.</p>
      </div>

      <div className="space-y-16">
        <DocSection title="Install">
          <Code code={`git clone https://github.com/Teckdegen/Kardsagentic kard\ncd kard\nnpm install\n\n# Verify\nnode src/cli/index.js help`} />
        </DocSection>

        <DocSection title="Create wallet">
          <P>Encrypted keystore at ~/.kard/wallet.json. Your key never leaves your machine.</P>
          <Code code={`node src/cli/index.js init\nnode src/cli/index.js wallet address`} />
        </DocSection>

        <DocSection title="Add LLM key">
          <P>Pick any provider. Or use Ollama for free local inference.</P>
          <Code code={`export ANTHROPIC_API_KEY=sk-ant-...     # Claude\nexport OPENAI_API_KEY=sk-...            # GPT\nexport DEEPSEEK_API_KEY=...             # DeepSeek\nexport OPENROUTER_API_KEY=...           # Any model via OpenRouter\n\n# Free local model:\n# ollama pull llama3.1`} />
        </DocSection>

        <DocSection title="Fund testnet">
          <P>Three things. All free on testnet.</P>
          <ul className="space-y-2 text-[14px] text-[#a1a1aa]">
            <li>• <a href="https://faucet.gokite.ai" target="_blank" rel="noreferrer" className="text-[#2563eb] hover:underline">Kite AI KITE</a> — critical for attestations</li>
            <li>• <a href="https://faucet.quicknode.com/arbitrum/sepolia" target="_blank" rel="noreferrer" className="text-[#2563eb] hover:underline">Arbitrum Sepolia ETH</a> — gas</li>
            <li>• <a href="https://staging.aave.com/faucet/" target="_blank" rel="noreferrer" className="text-[#2563eb] hover:underline">Arbitrum Sepolia USDC</a> — trading capital</li>
          </ul>
          <Code code={`# Verify funding\nnode src/cli/index.js gas`} />
        </DocSection>

        <DocSection title="Run">
          <Code code={`# Interactive REPL\nnode src/cli/index.js\n\n# Compile strategy (dry-run)\nnode src/cli/index.js claude "park USDC at highest yield"\nnode src/cli/index.js deepseek "long ETH if RSI < 30"\nnode src/cli/index.js gpt "hedge BTC exposure"\n\n# Execute\nnode src/cli/index.js claude "long ETH 2x" --execute\n\n# Autonomous loop\nnode src/cli/index.js run --strategy KITE_YIELD --interval 60s\n\n# Goal mode\nnode src/cli/index.js goal "grow portfolio 5% this month"\nnode src/cli/index.js goal "just trade"`} />
        </DocSection>

        <DocSection title="All strategies">
          <Code code={`node src/cli/index.js strategy list\n\n# Available:\n#   CONSERVATIVE    ~3%   Low    Aave lending only\n#   KITE_YIELD      ~7%   Low    Lucid + Aave (Kite-native)\n#   USDT_YIELD      ~8%   Med    USDT consolidation + Aave\n#   BALANCED        ~6%   Med    Aave + liquidity\n#   DELTA_NEUTRAL   ~12%  Med    Long spot + short perp\n#   LP_FARMER       ~15%  Med    Uniswap V3 + Aerodrome\n#   FULL_STACK      ~18%  Med    All protocols combined\n#   PERPS_TRADER    ~20%  High   Hyperliquid + GMX\n\nnode src/cli/index.js run --strategy KITE_YIELD --interval 60s`} />
        </DocSection>

        <DocSection title="Safety & policy">
          <Code code={`# Block specific actions\nnode src/cli/index.js config deny actions perps_open perps_close\n\n# Allow only specific chains\nnode src/cli/index.js config allow chains kiteai arbitrum\n\n# Block chains\nnode src/cli/index.js config deny chains avalanche polygon\n\n# Only stablecoins\nnode src/cli/index.js config allow assets USDC USDT\n\n# Block a venue\nnode src/cli/index.js config deny venues hyperliquid\n\n# View policy\nnode src/cli/index.js config show\n\n# Reset\nnode src/cli/index.js config reset\n\n# Emergency stop\nnode src/cli/index.js kill on\nnode src/cli/index.js kill off`} />
        </DocSection>

        <DocSection title="Yield opportunities">
          <Code code={`node src/cli/index.js opportunities\n\n# Shows live ranked yields:\n#  1. Morpho USDC (Base)       8.4% APY\n#  2. Lucid L-USDC (Kite AI)   7.2% APY\n#  3. Aave USDC (Arbitrum)     5.8% APY\n#  4. Compound (Arbitrum)      5.4% APY\n#  ...`} />
        </DocSection>

        <DocSection title="Attestations">
          <Code code={`# List all attestations\nnode src/cli/index.js attest list\n\n# Verify a specific attestation\nnode src/cli/index.js attest verify 0xYourTxHashHere`} />
        </DocSection>

        <DocSection title="Multi-agent fleet">
          <P>Run up to 100 agents with different models and strategies.</P>
          <Code code={`node src/cli/index.js fleet run examples/fleet.yml --interval 60s`} />
          <P>Example fleet.yml:</P>
          <Code code={`provider: anthropic\n\nagents:\n  - id: yield-hunter\n    provider: claude\n    goal: "park USDC at highest yield"\n    strategy: KITE_YIELD\n\n  - id: perps-trader\n    provider: deepseek\n    strategy: PERPS_TRADER\n\n  - id: safe-guard\n    provider: ollama\n    model: llama3.1\n    strategy: CONSERVATIVE`} />
        </DocSection>

        <DocSection title="Telegram / Discord / Slack">
          <Code code={`# Telegram\nexport TELEGRAM_BOT_TOKEN=<token>\nexport TELEGRAM_ALLOW_USERS=<your-user-id>\nexport KARD_ALLOW_EXECUTE=1\nnode src/cli/index.js chat telegram\n\n# Discord\nexport DISCORD_BOT_TOKEN=<token>\nnode src/cli/index.js chat discord\n\n# Slack\nexport SLACK_BOT_TOKEN=<token>\nexport SLACK_APP_TOKEN=<token>\nnode src/cli/index.js chat slack`} />
          <P>Message your bot in plain English:</P>
          <Code code={`"how's my portfolio?"\n"put the idle USDC somewhere better"\n"I want 5% gain this month"\n"stop the agent"`} />
        </DocSection>

        <DocSection title="Hyperliquid perps">
          <Code code={`export HYPERLIQUID_NETWORK=testnet\nexport HYPERLIQUID_API_WALLET=0x<api-wallet-pk>\nexport HYPERLIQUID_USER_ADDRESS=0x<your-address>\n\n# Trade perps\nnode src/cli/index.js claude "long ETH 3x if funding negative" --execute\nnode src/cli/index.js run --strategy PERPS_TRADER --interval 30s`} />
        </DocSection>

        <DocSection title="Skills">
          <Code code={`# List installed skills\nnode src/cli/index.js skill list\n\n# Add a skill\nnode src/cli/index.js skill add ./my-skill.md\n\n# Run a skill directly\nnode src/cli/index.js skill run coingecko-price get_price ids=bitcoin\nnode src/cli/index.js skill run defillama-yields pools\nnode src/cli/index.js skill run hyperliquid-funding\n\n# Search marketplace\nnode src/cli/index.js skill search "yield"\n\n# Remove\nnode src/cli/index.js skill remove my-skill`} />
        </DocSection>

        <DocSection title="Backtesting">
          <Code code={`node src/cli/index.js backtest claude "long ETH if RSI < 30" --from 2024-01-01 --to 2024-06-01`} />
        </DocSection>

        <DocSection title="Wallet & Passport">
          <Code code={`# Kite Passport\nnode src/cli/index.js passport signup you@email.com\nnode src/cli/index.js passport verify <code>\nnode src/cli/index.js passport address\nnode src/cli/index.js passport status\nnode src/cli/index.js passport sessions\nnode src/cli/index.js passport pay 0xRecipient 10 USDC\n\n# Local wallet\nnode src/cli/index.js init\nnode src/cli/index.js wallet list\nnode src/cli/index.js wallet add\nnode src/cli/index.js wallet import\nnode src/cli/index.js wallet address`} />
        </DocSection>

        <DocSection title="MCP server">
          <P>Use Kard from Claude Desktop, Cursor, or Claude Code.</P>
          <Code code={`# Start MCP server\nnode src/cli/index.js mcp\n\n# Claude Desktop config:\n{\n  "mcpServers": {\n    "kard": {\n      "command": "npx",\n      "args": ["-y", "@kard/agent", "mcp"],\n      "env": { "ANTHROPIC_API_KEY": "sk-ant-..." }\n    }\n  }\n}`} />
        </DocSection>

        <DocSection title="Deploy 24/7">
          <P>Docker:</P>
          <Code code={`cp .env.example .env\n# fill in your keys\ndocker compose up -d\ndocker compose logs -f kard`} />
          <P>systemd:</P>
          <Code code={`sudo cp examples/kard.service /etc/systemd/system/\nsudo systemctl daemon-reload\nsudo systemctl enable --now kard\njournalctl -u kard -f`} />
          <P>Daemon mode:</P>
          <Code code={`node src/cli/index.js daemon --strategy KITE_YIELD --interval 60s\nnode src/cli/index.js daemon --goal "grow 5% this month" --report 5m\nnode src/cli/index.js daemon --provider deepseek`} />
        </DocSection>

        <DocSection title="Go mainnet">
          <Code code={`export KARD_ENV=mainnet\nexport HYPERLIQUID_NETWORK=mainnet\n\nnode src/cli/index.js run --strict\nnode src/cli/index.js verify-lucid USDC`} />
          <P>Fund: real ETH on Arbitrum + KITE on Kite AI. Tighten policy. Test kill switch.</P>
        </DocSection>

        <DocSection title="All commands">
          <Code code={`kard                              Interactive REPL\nkard help                         All commands\nkard <provider> "<text>"          Compile strategy\nkard <provider> "<text>" --execute Execute it\nkard run                          Autonomous loop\nkard run --strategy <NAME>        Specific strategy\nkard goal "<text>"                Self-evolving goal\nkard fleet run <yml>              Multi-agent fleet\nkard opportunities                Live ranked yields\nkard gas                          Gas on all chains\nkard skill list|add|remove|run    Skill management\nkard strategy list|save|publish   Strategy management\nkard config show|allow|deny|reset Policy control\nkard attest list|verify           Attestations\nkard passport signup|verify|...   Kite Passport\nkard chat telegram|discord|slack  Chat integrations\nkard backtest <provider> "<text>" Historical backtest\nkard simulate '{tx}' --chain X    Tx simulation\nkard kill on|off                  Emergency stop\nkard wallet list|add|import       Wallet management\nkard init                         Create local wallet\nkard mcp                          MCP server\nkard daemon                       Background daemon\nkard verify-lucid USDC            ABI check`} />
        </DocSection>
      </div>
    </div>
  )
}

function DocSection ({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.4 }}
    >
      <h2 className="text-[22px] font-bold text-white mb-4 pb-2 border-b border-[#1a1a1a]">{title}</h2>
      <div className="space-y-4">{children}</div>
    </motion.section>
  )
}

function P ({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] text-[#71717a] leading-relaxed">{children}</p>
}

function Code ({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="relative group terminal">
      <button
        onClick={copy}
        className={cn(
          'absolute top-3 right-3 z-10 px-2.5 py-1 rounded text-[11px] font-medium',
          'bg-white/5 text-[#52525b] hover:text-white hover:bg-white/10 transition-all',
          'opacity-0 group-hover:opacity-100',
          copied && 'opacity-100 text-emerald-400'
        )}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className="p-5 text-[12.5px] leading-relaxed text-[#a1a1aa] overflow-x-auto font-mono whitespace-pre-wrap">
        <code>{code}</code>
      </pre>
    </div>
  )
}
