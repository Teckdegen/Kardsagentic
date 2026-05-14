import { useState } from 'react'
import { motion } from 'motion/react'
import {
  Terminal, KeyRound, Coins, Wallet, Bot, MessageCircle, ServerCog,
  ShieldCheck, ChevronRight, Copy, Check, Sparkles
} from 'lucide-react'
import { cn } from '../lib/cn'

const STEPS: StepSection[] = [
  {
    id: 'install',
    title: 'Install Kard',
    icon: Terminal,
    intro: 'Node 22+ is the only system requirement. Clone and install.',
    blocks: [
      { kind: 'code', code: `git clone https://github.com/Teckdegen/Kardsagentic kard\ncd kard\nnpm install` },
      { kind: 'note', text: 'Verify it works:' },
      { kind: 'code', code: `node src/cli/index.js help` }
    ]
  },
  {
    id: 'wallet',
    title: 'Create your wallet',
    icon: Wallet,
    intro: 'Kard creates an encrypted keystore at ~/.kard/wallet.json. You set the password. Your key never leaves your machine.',
    blocks: [
      { kind: 'code', code: `node src/cli/index.js init` },
      { kind: 'note', text: 'It generates a fresh key, prints your seed phrase ONCE (write it down), then shows your operator address.' },
      { kind: 'code', code: `node src/cli/index.js wallet address   # send testnet funds here` }
    ]
  },
  {
    id: 'llm',
    title: 'Add an LLM key',
    icon: Sparkles,
    intro: 'Bring your own model. Pick one provider or mix them across agents in a fleet.',
    blocks: [
      {
        kind: 'code',
        code: `# Pick one:\nexport ANTHROPIC_API_KEY=sk-ant-...     # Claude\nexport OPENAI_API_KEY=sk-...            # GPT\nexport DEEPSEEK_API_KEY=...             # DeepSeek\nexport OPENROUTER_API_KEY=...           # Any model\n\n# Or free local model — no key needed:\n# brew install ollama && ollama pull llama3.1`
      },
      { kind: 'note', text: 'Test it:' },
      { kind: 'code', code: `node src/cli/index.js claude "say hello in 5 words"` }
    ]
  },
  {
    id: 'testnet',
    title: 'Fund testnet',
    icon: Coins,
    intro: 'Three things to fund. All free on testnet. The agent handles everything else including bridging gas to other chains.',
    blocks: [
      {
        kind: 'list',
        items: [
          ['Kite AI KITE (critical)', 'https://faucet.gokite.ai'],
          ['Arbitrum Sepolia ETH', 'https://faucet.quicknode.com/arbitrum/sepolia'],
          ['Arbitrum Sepolia USDC', 'https://staging.aave.com/faucet/']
        ]
      },
      { kind: 'note', text: 'For Hyperliquid perps (optional): open app.hyperliquid-testnet.xyz, claim testnet USDC, generate an API wallet.' },
      {
        kind: 'code',
        code: `export HYPERLIQUID_NETWORK=testnet\nexport HYPERLIQUID_API_WALLET=0x<api-wallet-pk>\nexport HYPERLIQUID_USER_ADDRESS=0x<your-address>`
      },
      { kind: 'note', text: 'Verify gas on all chains:' },
      { kind: 'code', code: `node src/cli/index.js gas` }
    ]
  },
  {
    id: 'first-run',
    title: 'First run',
    icon: Bot,
    intro: 'Three escalating commands — preview, explore, then go autonomous.',
    blocks: [
      { kind: 'note', text: '1. Compile a strategy (dry-run, no execution):' },
      { kind: 'code', code: `node src/cli/index.js claude "park USDC at the highest yield, min $1M TVL"` },
      { kind: 'note', text: '2. See live yield opportunities ranked:' },
      { kind: 'code', code: `node src/cli/index.js opportunities` },
      { kind: 'note', text: '3. Let it run autonomously:' },
      { kind: 'code', code: `node src/cli/index.js run --strategy KITE_YIELD --interval 60s` }
    ]
  },
  {
    id: 'policy',
    title: 'Set safety rules',
    icon: ShieldCheck,
    intro: 'Three hard veto layers: chain/venue/action allow-deny, risk engine, kill switch. Configure once, agent obeys forever.',
    blocks: [
      {
        kind: 'code',
        code: `# Block perps trading\nnode src/cli/index.js config deny actions perps_open perps_close\n\n# Only Kite + Arbitrum\nnode src/cli/index.js config allow chains kiteai arbitrum\n\n# Only stablecoins\nnode src/cli/index.js config allow assets USDC USDT\n\n# Emergency stop\nnode src/cli/index.js kill on`
      }
    ]
  },
  {
    id: 'telegram',
    title: 'Connect Telegram',
    icon: MessageCircle,
    intro: 'Run the agent from your phone. Full natural language — not slash commands.',
    blocks: [
      { kind: 'note', text: 'Create a bot via @BotFather, get your user ID from @userinfobot, then:' },
      {
        kind: 'code',
        code: `export TELEGRAM_BOT_TOKEN=<token>\nexport TELEGRAM_ALLOW_USERS=<your-user-id>\nexport KARD_ALLOW_EXECUTE=1\n\nnode src/cli/index.js chat telegram`
      },
      { kind: 'note', text: 'Now message your bot in plain English:' },
      {
        kind: 'code',
        code: `"how's my portfolio?"\n"put the idle USDC somewhere better"\n"I want 5% gain this month"\n"stop the agent"`
      }
    ]
  },
  {
    id: 'server',
    title: 'Run 24/7 on a server',
    icon: ServerCog,
    intro: 'Docker, systemd, or any PaaS that runs containers.',
    blocks: [
      { kind: 'note', text: 'Docker (easiest):' },
      {
        kind: 'code',
        code: `cp .env.example .env\n# fill in your keys\ndocker compose up -d\ndocker compose logs -f kard`
      },
      { kind: 'note', text: 'Or systemd on bare-metal Linux:' },
      {
        kind: 'code',
        code: `sudo cp examples/kard.service /etc/systemd/system/\nsudo systemctl enable --now kard\njournalctl -u kard -f`
      }
    ]
  },
  {
    id: 'going-live',
    title: 'Go to mainnet',
    icon: KeyRound,
    intro: 'When testnet has run clean for a week, flip three switches.',
    blocks: [
      {
        kind: 'code',
        code: `export KARD_ENV=mainnet\nexport HYPERLIQUID_NETWORK=mainnet\nnode src/cli/index.js run --strict\nnode src/cli/index.js verify-lucid USDC`
      },
      { kind: 'note', text: 'Fund your operator wallet with real ETH on Arbitrum + KITE on Kite AI. Tighten policy. Set risk limits low. Test the kill switch.' }
    ]
  }
]

export default function Docs () {
  return (
    <div id="install" className="max-w-[1200px] mx-auto mt-32 mb-24 px-6 md:px-12 scroll-mt-32">
      <Header />
      <div className="mt-16 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-10 lg:gap-16">
        <SideNav />
        <main className="min-w-0 space-y-20">
          {STEPS.map((s, i) => (
            <Section key={s.id} idx={i} {...s} />
          ))}
        </main>
      </div>
    </div>
  )
}

function Header () {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="text-center max-w-3xl mx-auto"
    >
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-[11px] font-semibold text-slate-400">
        <Terminal size={12} />
        Installation
      </div>
      <h2 className="mt-6 text-[36px] md:text-[48px] font-semibold tracking-tight leading-[1.05] text-white">
        Zero to running<br />in 9 steps
      </h2>
      <p className="mt-5 text-[15px] leading-relaxed text-slate-400">
        From a fresh clone to a 24/7 agent answering on your phone.
        Everything works on testnet first — no real money needed to learn.
      </p>
    </motion.div>
  )
}

function SideNav () {
  return (
    <aside className="lg:sticky lg:top-8 self-start hidden lg:block">
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="text-[10px] uppercase tracking-[0.15em] font-semibold text-slate-500 mb-4">
          Steps
        </div>
        <ul className="space-y-2">
          {STEPS.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="flex items-center gap-2.5 text-[13px] text-slate-500 hover:text-white transition-colors"
              >
                <span className="font-mono text-[10px] text-slate-600 w-4">{(i + 1).toString().padStart(2, '0')}</span>
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

function Section ({ id, idx, title, icon: Icon, intro, blocks }: StepSection & { idx: number }) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5 }}
      className="scroll-mt-32"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
          <Icon size={18} strokeWidth={1.5} className="text-slate-300" />
        </div>
        <div>
          <div className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">Step {idx + 1}</div>
          <h3 className="text-[22px] md:text-[26px] font-semibold text-white">{title}</h3>
        </div>
      </div>
      <p className="mt-4 text-[14px] leading-relaxed text-slate-400 max-w-[640px]">{intro}</p>
      <div className="mt-6 space-y-4">
        {blocks.map((b, i) =>
          b.kind === 'code'
            ? <CodeBlock key={i} code={b.code!} />
            : b.kind === 'list'
              ? <LinkList key={i} items={b.items!} />
              : <p key={i} className="text-[13px] text-slate-500">{b.text}</p>
        )}
      </div>
    </motion.section>
  )
}

function CodeBlock ({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="relative group rounded-xl bg-[#0a0a0a] border border-white/[0.06] overflow-hidden">
      <button
        onClick={copy}
        className={cn(
          'absolute top-3 right-3 z-10 flex items-center gap-1 px-2.5 py-1.5 rounded-md',
          'text-[11px] font-medium bg-white/5 text-slate-400 hover:bg-white/10 transition-all',
          'opacity-0 group-hover:opacity-100',
          copied && 'opacity-100 text-emerald-400'
        )}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className="text-[12.5px] leading-relaxed text-slate-300 px-5 py-4 overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function LinkList ({ items }: { items: [string, string][] }) {
  return (
    <ul className="space-y-2">
      {items.map(([label, url]) => (
        <li key={url}>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-[13px] text-blue-400 hover:text-blue-300 transition-colors"
          >
            {label}
            <ChevronRight size={12} className="opacity-50" />
          </a>
        </li>
      ))}
    </ul>
  )
}

interface StepSection {
  id: string
  title: string
  icon: any
  intro: string
  blocks: Block[]
}
type Block =
  | { kind: 'note'; text: string; code?: undefined; items?: undefined }
  | { kind: 'code'; code: string; text?: undefined; items?: undefined }
  | { kind: 'list'; items: [string, string][]; text?: undefined; code?: undefined }
